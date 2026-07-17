'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { apiRequest, formatDate, formatMoney, stateLabel } from './client-api';
import { DemoRoleSwitch } from './demo-role-switch';

type Product = Readonly<{
  id: string;
  name: string;
}>;

type Project = Readonly<{
  createdAt: string;
  id: string;
  itemCount: number;
  name: string;
  state: string;
}>;

type Quotation = Readonly<{
  currencyCode: string;
  id: string;
  productionEstimateText: string;
  revisionId: string;
  revisionNumber: number;
  state: string;
  totalMinor: number;
}>;

type Order = Readonly<{
  createdAt: string;
  currencyCode: string;
  displayReference: string;
  fulfilmentMethod: 'DELIVERY' | 'PICKUP';
  fulfilmentState: string;
  id: string;
  lifecycleState: string;
  paymentState: string;
  productionState: string;
  totalMinor: number;
}>;

type OrderDetail = Order &
  Readonly<{
    fulfilmentDetails: Record<string, unknown>;
    fulfilmentDetailsConfirmedAt?: string | undefined;
    items: readonly Readonly<{
      id: string;
      itemSnapshot: Record<string, unknown>;
      itemTotalMinor: number;
      sequence: number;
    }>[];
    paymentSubmissions: readonly Readonly<{
      displayFilename: string;
      id: string;
      submittedAt: string;
    }>[];
    paymentVerifications: readonly Readonly<{
      decidedAt: string;
      outcome: 'REJECTED' | 'VERIFIED';
      reason: string;
    }>[];
    productionUpdates: readonly Readonly<{
      fromState: string;
      note: string;
      occurredAt: string;
      sequence: number;
      toState: string;
    }>[];
  }>;

type Notification = Readonly<{
  body: string;
  createdAt: string;
  id: string;
  read: boolean;
  title: string;
}>;

type Message = Readonly<{
  body: string;
  id: string;
  senderKind: 'CUSTOMER' | 'MANAGER';
  sentAt: string;
}>;

type CustomerDashboardProps = Readonly<{
  demoEnabled: boolean;
  initialProductId?: string | undefined;
}>;

function formText(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function productName(itemSnapshot: Record<string, unknown>): string {
  const product = itemSnapshot.product;
  if (product && typeof product === 'object' && !Array.isArray(product)) {
    const name = (product as Record<string, unknown>).name;
    if (typeof name === 'string') return name;
  }
  return 'تصميم مخصص';
}

export function CustomerDashboard({ demoEnabled, initialProductId }: CustomerDashboardProps) {
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [quotations, setQuotations] = useState<readonly Quotation[]>([]);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [notifications, setNotifications] = useState<readonly Notification[]>([]);
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [orderDetail, setOrderDetail] = useState<OrderDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      if (demoEnabled) {
        await apiRequest('/api/v1/demo-auth', {
          body: JSON.stringify({ role: 'customer' }),
          method: 'POST',
        });
      }
      const [
        catalog,
        projectResult,
        quotationResult,
        orderResult,
        notificationResult,
        messageResult,
      ] = await Promise.all([
        apiRequest<{ products: readonly Product[] }>('/api/v1/catalog'),
        apiRequest<{ projects: readonly Project[] }>('/api/v1/projects'),
        apiRequest<{ quotations: readonly Quotation[] }>('/api/v1/quotations'),
        apiRequest<{ orders: readonly Order[] }>('/api/v1/orders'),
        apiRequest<{ notifications: readonly Notification[] }>('/api/v1/notifications'),
        apiRequest<{ messages: readonly Message[] }>('/api/v1/messages'),
      ]);
      setProducts(catalog.products);
      setProjects(projectResult.projects);
      setQuotations(quotationResult.quotations);
      setOrders(orderResult.orders);
      setNotifications(notificationResult.notifications);
      setMessages(messageResult.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل مساحة العميل.');
    }
  }, [demoEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إكمال العملية.');
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await perform(async () => {
      await apiRequest('/api/v1/projects', {
        body: JSON.stringify({
          customerNotes: formText(form, 'customerNotes'),
          projectName: formText(form, 'projectName'),
        }),
        method: 'POST',
      });
      formElement.reset();
    }, 'تم إنشاء مسودة المشروع.');
  }

  async function addItem(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const dimensions = Object.fromEntries(
      ['width', 'height', 'depth']
        .map((key) => [key, formText(form, key)] as const)
        .filter(([, value]) => value.length > 0),
    );
    const selections = Object.fromEntries(
      ['material', 'color']
        .map((key) => [key, formText(form, key)] as const)
        .filter(([, value]) => value.length > 0),
    );
    await perform(async () => {
      await apiRequest(`/api/v1/projects/${projectId}/items`, {
        body: JSON.stringify({
          customerNotes: formText(form, 'customerNotes'),
          dimensions,
          productId: formText(form, 'productId'),
          selections,
        }),
        method: 'POST',
      });
      formElement.reset();
    }, 'تمت إضافة التصميم إلى المشروع.');
  }

  async function submitProject(projectId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/projects/${projectId}/submit`, { method: 'POST' });
    }, 'أُرسل المشروع إلى المدير للمراجعة.');
  }

  async function acceptQuotation(revisionId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/quotation-revisions/${revisionId}/accept`, { method: 'POST' });
    }, 'تم اعتماد عرض السعر وإنشاء الطلب.');
  }

  async function openOrder(orderId: string) {
    setBusy(true);
    setError('');
    try {
      setOrderDetail(await apiRequest<OrderDetail>(`/api/v1/orders/${orderId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر فتح الطلب.');
    } finally {
      setBusy(false);
    }
  }

  async function saveFulfilmentDetails(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/orders/${orderId}/fulfilment`, {
        body: JSON.stringify({
          address: formText(form, 'address'),
          city: formText(form, 'city'),
          deliveryNotes: formText(form, 'deliveryNotes'),
          district: formText(form, 'district'),
          mapUrl: formText(form, 'mapUrl'),
          method: formText(form, 'method'),
          phoneNumber: formText(form, 'phoneNumber'),
          pickupNotes: formText(form, 'pickupNotes'),
        }),
        method: 'POST',
      });
      await openOrder(orderId);
    }, 'تم حفظ تفاصيل الاستلام. يمكنك الآن إرسال إثبات التحويل.');
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/orders/${orderId}/payment-submissions`, {
        body: JSON.stringify({
          declaredReference: formText(form, 'declaredReference'),
          proofDisplayFilename: formText(form, 'proofDisplayFilename'),
          proofMediaType: formText(form, 'proofMediaType'),
          proofObjectKey: formText(form, 'proofObjectKey'),
        }),
        method: 'POST',
      });
      await openOrder(orderId);
    }, 'تم إرسال إثبات التحويل للمراجعة اليدوية.');
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await perform(async () => {
      await apiRequest('/api/v1/messages', {
        body: JSON.stringify({
          body: formText(form, 'body'),
          clientMessageKey: crypto.randomUUID(),
        }),
        method: 'POST',
      });
      formElement.reset();
    }, 'تم إرسال الرسالة.');
  }

  return (
    <main className="workspace section-shell" id="main-content" tabIndex={-1}>
      <header className="workspace__hero">
        <div>
          <p className="eyebrow">مساحة العميل</p>
          <h1>حوّل فكرتك إلى قطعة مصنوعة لك</h1>
          <p>أنشئ مشروعًا، أضف التصاميم والمقاسات، ثم تابع عرض السعر والتنفيذ من مكان واحد.</p>
        </div>
        <Link className="button button--secondary" href="/catalog">
          استعراض التصاميم
        </Link>
      </header>

      {demoEnabled ? <DemoRoleSwitch current="customer" /> : null}
      {error ? (
        <div className="workflow-alert workflow-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="workflow-alert workflow-alert--success" role="status">
          {notice}
        </div>
      ) : null}

      <div className="workspace-grid">
        <section className="workspace-panel" aria-labelledby="new-project-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">ابدأ الطلب</p>
              <h2 id="new-project-title">مشروع جديد</h2>
            </div>
          </div>
          <form className="workflow-form" onSubmit={createProject}>
            <label>
              اسم المشروع
              <input name="projectName" placeholder="مثال: مجلس العائلة" required minLength={2} />
            </label>
            <label>
              ملاحظات عامة
              <textarea name="customerNotes" placeholder="صف المساحة أو الفكرة باختصار" rows={3} />
            </label>
            <button className="button" disabled={busy} type="submit">
              إنشاء المسودة
            </button>
          </form>
        </section>

        <section className="workspace-panel workspace-panel--wide" aria-labelledby="projects-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">طلباتك</p>
              <h2 id="projects-title">المشاريع</h2>
            </div>
            <span className="count-pill">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <p className="workspace-empty">لا توجد مشاريع بعد.</p>
          ) : (
            <div className="workflow-stack">
              {projects.map((project) => (
                <article className="workflow-card" key={project.id}>
                  <div className="workflow-card__heading">
                    <div>
                      <h3>{project.name}</h3>
                      <span>
                        {formatDate(project.createdAt)} · {project.itemCount} تصميم
                      </span>
                    </div>
                    <span className="status-badge">{stateLabel(project.state)}</span>
                  </div>
                  {project.state === 'DRAFT' ? (
                    <>
                      <form
                        className="workflow-form workflow-form--compact"
                        onSubmit={(event) => addItem(event, project.id)}
                      >
                        <label className="workflow-form__full">
                          التصميم
                          <select defaultValue={initialProductId ?? ''} name="productId" required>
                            <option value="">اختر تصميمًا</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          العرض (سم)
                          <input inputMode="decimal" name="width" />
                        </label>
                        <label>
                          الارتفاع (سم)
                          <input inputMode="decimal" name="height" />
                        </label>
                        <label>
                          العمق (سم)
                          <input inputMode="decimal" name="depth" />
                        </label>
                        <label>
                          الخامة
                          <input name="material" placeholder="خشب، قماش..." />
                        </label>
                        <label>
                          اللون
                          <input name="color" placeholder="بيج، بني..." />
                        </label>
                        <label className="workflow-form__full">
                          ملاحظات القطعة
                          <textarea name="customerNotes" rows={2} />
                        </label>
                        <button
                          className="button button--secondary button--small"
                          disabled={busy}
                          type="submit"
                        >
                          إضافة التصميم
                        </button>
                      </form>
                      <button
                        className="button button--small"
                        disabled={busy || project.itemCount === 0}
                        onClick={() => submitProject(project.id)}
                        type="button"
                      >
                        إرسال المشروع للمراجعة
                      </button>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-panel" aria-labelledby="quotes-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التسعير</p>
              <h2 id="quotes-title">عروض السعر</h2>
            </div>
            <span className="count-pill">{quotations.length}</span>
          </div>
          <div className="workflow-stack">
            {quotations.length === 0 ? (
              <p className="workspace-empty">لا يوجد عرض سعر حاليًا.</p>
            ) : (
              quotations.map((quotation) => (
                <article className="workflow-card" key={quotation.revisionId}>
                  <div className="workflow-card__heading">
                    <div>
                      <h3>{formatMoney(quotation.totalMinor, quotation.currencyCode)}</h3>
                      <span>الإصدار {quotation.revisionNumber}</span>
                    </div>
                    <span className="status-badge">{stateLabel(quotation.state)}</span>
                  </div>
                  <p>{quotation.productionEstimateText}</p>
                  {quotation.state === 'SENT' ? (
                    <button
                      className="button button--small"
                      disabled={busy}
                      onClick={() => acceptQuotation(quotation.revisionId)}
                      type="button"
                    >
                      اعتماد العرض
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="workspace-panel workspace-panel--wide" aria-labelledby="orders-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">المتابعة</p>
              <h2 id="orders-title">الطلبات</h2>
            </div>
            <span className="count-pill">{orders.length}</span>
          </div>
          <div className="workflow-stack">
            {orders.length === 0 ? (
              <p className="workspace-empty">لا توجد طلبات معتمدة بعد.</p>
            ) : (
              orders.map((order) => (
                <article className="workflow-card" key={order.id}>
                  <div className="workflow-card__heading">
                    <div>
                      <h3>{order.displayReference}</h3>
                      <span>{formatMoney(order.totalMinor, order.currencyCode)}</span>
                    </div>
                    <span className="status-badge">{stateLabel(order.lifecycleState)}</span>
                  </div>
                  <div className="status-grid">
                    <span>
                      <small>الدفع</small>
                      {stateLabel(order.paymentState)}
                    </span>
                    <span>
                      <small>الإنتاج</small>
                      {stateLabel(order.productionState)}
                    </span>
                    <span>
                      <small>التسليم</small>
                      {stateLabel(order.fulfilmentState)}
                    </span>
                  </div>
                  <button
                    className="button button--secondary button--small"
                    disabled={busy}
                    onClick={() => openOrder(order.id)}
                    type="button"
                  >
                    عرض التفاصيل
                  </button>
                </article>
              ))
            )}
          </div>

          {orderDetail ? (
            <article className="order-detail" aria-labelledby="order-detail-title">
              <div className="workspace-panel__heading">
                <div>
                  <p className="eyebrow">تفاصيل الطلب</p>
                  <h3 id="order-detail-title">{orderDetail.displayReference}</h3>
                </div>
                <button
                  className="plain-button"
                  onClick={() => setOrderDetail(undefined)}
                  type="button"
                >
                  إغلاق
                </button>
              </div>
              <div className="workflow-stack">
                {orderDetail.items.map((item) => (
                  <div className="line-item" key={item.id}>
                    <span>
                      {item.sequence}. {productName(item.itemSnapshot)}
                    </span>
                    <strong>{formatMoney(item.itemTotalMinor, orderDetail.currencyCode)}</strong>
                  </div>
                ))}
              </div>
              {!orderDetail.fulfilmentDetailsConfirmedAt ? (
                <form
                  className="workflow-form"
                  onSubmit={(event) => saveFulfilmentDetails(event, orderDetail.id)}
                >
                  <h4>تفاصيل الاستلام</h4>
                  <p className="field-help">
                    أكد بيانات التواصل والاستلام المعتمدة في عرض السعر قبل إرسال إثبات التحويل.
                  </p>
                  <div className="workflow-form__full decision-box">
                    <strong>طريقة الاستلام المعتمدة</strong>
                    <span>
                      {orderDetail.fulfilmentMethod === 'DELIVERY' ? 'توصيل' : 'استلام من الورشة'}
                    </span>
                    <input name="method" type="hidden" value={orderDetail.fulfilmentMethod} />
                  </div>
                  <label>
                    رقم الهاتف
                    <input name="phoneNumber" required minLength={7} inputMode="tel" />
                  </label>
                  {orderDetail.fulfilmentMethod === 'DELIVERY' ? (
                    <>
                      <label>
                        المدينة
                        <input name="city" required minLength={2} />
                      </label>
                      <label>
                        الحي
                        <input name="district" required minLength={2} />
                      </label>
                      <label className="workflow-form__full">
                        العنوان الكامل
                        <input name="address" required minLength={5} />
                      </label>
                      <label className="workflow-form__full">
                        رابط الموقع على الخريطة (اختياري)
                        <input name="mapUrl" type="url" placeholder="https://maps.google.com/..." />
                      </label>
                      <label className="workflow-form__full">
                        ملاحظات التوصيل (اختياري)
                        <textarea name="deliveryNotes" rows={2} />
                      </label>
                    </>
                  ) : (
                    <label className="workflow-form__full">
                      ملاحظات الاستلام (اختياري)
                      <textarea name="pickupNotes" rows={2} />
                    </label>
                  )}
                  <button className="button" disabled={busy} type="submit">
                    حفظ تفاصيل الاستلام
                  </button>
                </form>
              ) : (
                <div className="workflow-alert workflow-alert--success" role="status">
                  تم تأكيد تفاصيل{' '}
                  {orderDetail.fulfilmentMethod === 'DELIVERY' ? 'التوصيل' : 'الاستلام'}.
                </div>
              )}
              {orderDetail.fulfilmentDetailsConfirmedAt &&
              ['AWAITING_SUBMISSION', 'REJECTED'].includes(orderDetail.paymentState) ? (
                <form
                  className="workflow-form"
                  onSubmit={(event) => submitPayment(event, orderDetail.id)}
                >
                  <h4>إرسال إثبات التحويل</h4>
                  <p className="field-help">
                    ارفع الملف إلى التخزين الخاص عبر خطوة S3، ثم أدخل مفتاحه هنا. لا يبدأ الإنتاج
                    قبل مراجعة المدير.
                  </p>
                  <label>
                    اسم الملف
                    <input name="proofDisplayFilename" placeholder="bank-transfer.pdf" required />
                  </label>
                  <label>
                    نوع الملف
                    <select name="proofMediaType">
                      <option value="application/pdf">PDF</option>
                      <option value="image/jpeg">JPG</option>
                      <option value="image/png">PNG</option>
                    </select>
                  </label>
                  <label className="workflow-form__full">
                    مفتاح الملف الخاص
                    <input
                      name="proofObjectKey"
                      placeholder="private/payment-proofs/..."
                      required
                      minLength={3}
                    />
                  </label>
                  <label className="workflow-form__full">
                    مرجع التحويل
                    <input name="declaredReference" />
                  </label>
                  <button className="button" disabled={busy} type="submit">
                    إرسال للمراجعة
                  </button>
                </form>
              ) : null}
              {orderDetail.productionUpdates.length > 0 ? (
                <ol className="timeline">
                  {orderDetail.productionUpdates.map((update) => (
                    <li key={update.sequence}>
                      <strong>{stateLabel(update.toState)}</strong>
                      <span>{update.note || formatDate(update.occurredAt)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {orderDetail.paymentVerifications.map((decision) => (
                <div className="workflow-alert" key={decision.decidedAt}>
                  {decision.outcome === 'VERIFIED'
                    ? 'تم تأكيد التحويل.'
                    : `رُفض الإثبات: ${decision.reason}`}
                </div>
              ))}
            </article>
          ) : null}
        </section>

        <section className="workspace-panel" aria-labelledby="messages-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التواصل</p>
              <h2 id="messages-title">الرسائل</h2>
            </div>
          </div>
          <div className="message-list">
            {messages.length === 0 ? (
              <p className="workspace-empty">ابدأ برسالة توضح ما تحتاجه.</p>
            ) : (
              messages.map((message) => (
                <div
                  className={`message message--${message.senderKind.toLowerCase()}`}
                  key={message.id}
                >
                  <strong>{message.senderKind === 'CUSTOMER' ? 'أنت' : 'المدير'}</strong>
                  <p>{message.body}</p>
                  <small>{formatDate(message.sentAt)}</small>
                </div>
              ))
            )}
          </div>
          <form className="workflow-form" onSubmit={sendMessage}>
            <label>
              رسالتك
              <textarea name="body" required rows={3} />
            </label>
            <button className="button button--small" disabled={busy} type="submit">
              إرسال
            </button>
          </form>
        </section>

        <section className="workspace-panel" aria-labelledby="notifications-title">
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">آخر المستجدات</p>
              <h2 id="notifications-title">الإشعارات</h2>
            </div>
          </div>
          <div className="workflow-stack">
            {notifications.length === 0 ? (
              <p className="workspace-empty">لا توجد إشعارات.</p>
            ) : (
              notifications.map((notification) => (
                <article
                  className={notification.read ? 'notification notification--read' : 'notification'}
                  key={notification.id}
                >
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <small>{formatDate(notification.createdAt)}</small>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

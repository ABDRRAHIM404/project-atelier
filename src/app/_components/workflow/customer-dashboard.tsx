'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { apiRequest, formatDate, formatMoney, stateLabel } from './client-api';
import { DemoRoleSwitch } from './demo-role-switch';

type Product = Readonly<{
  categoryLabel?: string;
  currencyCode?: string;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  name: string;
  startingAmountMinor?: number;
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

type CustomerTab = 'projects' | 'quotations' | 'orders' | 'messages' | 'notifications';

type CustomerDashboardProps = Readonly<{
  demoEnabled: boolean;
  initialProductId?: string | undefined;
}>;

function badgeText(count: number): string {
  return count > 9 ? '9+' : String(count);
}

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
  const [activeTab, setActiveTab] = useState<CustomerTab>('projects');
  const [managedProjectId, setManagedProjectId] = useState<string>();
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(initialProductId ?? '');
  const createProjectPanelRef = useRef<HTMLDetailsElement>(null);
  const initialTabChosen = useRef(false);
  const initialProductHandled = useRef(false);

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
      if (initialProductId && !initialProductHandled.current) {
        initialProductHandled.current = true;
        initialTabChosen.current = true;
        setActiveTab('projects');
        setSelectedProductId(initialProductId);
        const draftProject = projectResult.projects.find((project) => project.state === 'DRAFT');
        if (draftProject) {
          setManagedProjectId(draftProject.id);
        } else {
          window.setTimeout(() => createProjectPanelRef.current?.setAttribute('open', ''), 0);
        }
      } else if (!initialTabChosen.current) {
        initialTabChosen.current = true;
        setActiveTab(
          quotationResult.quotations.some((quotation) => quotation.state === 'SENT')
            ? 'quotations'
            : orderResult.orders.length > 0
              ? 'orders'
              : 'projects',
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل مساحة العميل.');
    }
  }, [demoEnabled, initialProductId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);


  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      const created = await apiRequest<Project>('/api/v1/projects', {
        body: JSON.stringify({
          customerNotes: formText(form, 'customerNotes'),
          projectName: formText(form, 'projectName'),
        }),
        method: 'POST',
      });
      setManagedProjectId(created.id);
      setActiveTab('projects');
      formElement.reset();
      createProjectPanelRef.current?.removeAttribute('open');
    }, selectedProductId ? 'تم إنشاء المشروع. أكمل تخصيص التصميم المختار.' : 'تم إنشاء مسودة المشروع.');
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
          productId: selectedProductId || formText(form, 'productId'),
          selections,
        }),
        method: 'POST',
      });
      formElement.reset();
      setSelectedProductId('');
      setProductSearch('');
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
    setActiveTab('orders');
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

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;
  const actionableQuotationCount = quotations.filter((quotation) => quotation.state === 'SENT').length;
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const normalizedProductSearch = productSearch.trim().toLocaleLowerCase('ar');
  const filteredProducts = products
    .filter((product) =>
      normalizedProductSearch
        ? `${product.name} ${product.categoryLabel ?? ''}`
            .toLocaleLowerCase('ar')
            .includes(normalizedProductSearch)
        : true,
    )
    .slice(0, 12);

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

      {initialProductId && selectedProduct ? (
        <section className="catalog-handoff" aria-label="التصميم المختار من المعرض">
          <div className="catalog-handoff__content">
            {selectedProduct.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={selectedProduct.imageAlt ?? selectedProduct.name}
                  src={selectedProduct.imageUrl}
                />
              </>
            ) : (
              <span className="catalog-handoff__placeholder" aria-hidden="true">تصميم</span>
            )}
            <div>
              <small>اخترته من المعرض</small>
              <strong>{selectedProduct.name}</strong>
              <span>أضفه إلى مشروع قائم أو أنشئ مشروعًا جديدًا.</span>
            </div>
          </div>
          <button
            className="plain-button"
            onClick={() => {
              setSelectedProductId('');
              setProductSearch('');
            }}
            type="button"
          >
            تغيير التصميم
          </button>
        </section>
      ) : null}

      <nav className="customer-tabs" aria-label="أقسام مساحة العميل" role="tablist">
        <button aria-controls="customer-panel-projects" aria-selected={activeTab === 'projects'} className={`customer-tab${activeTab === 'projects' ? ' customer-tab--active' : ''}`} onClick={() => setActiveTab('projects')} role="tab" type="button">
          المشاريع <span className="customer-tab__count">{projects.length}</span>
        </button>
        <button aria-controls="customer-panel-quotations" aria-selected={activeTab === 'quotations'} className={`customer-tab${activeTab === 'quotations' ? ' customer-tab--active' : ''}`} onClick={() => setActiveTab('quotations')} role="tab" type="button">
          عروض السعر
          {actionableQuotationCount > 0 ? <span className="customer-tab__badge">{badgeText(actionableQuotationCount)}</span> : null}
        </button>
        <button aria-controls="customer-panel-orders" aria-selected={activeTab === 'orders'} className={`customer-tab${activeTab === 'orders' ? ' customer-tab--active' : ''}`} onClick={() => setActiveTab('orders')} role="tab" type="button">
          الطلبات <span className="customer-tab__count">{orders.length}</span>
        </button>
        <button aria-controls="customer-panel-messages" aria-selected={activeTab === 'messages'} className={`customer-tab${activeTab === 'messages' ? ' customer-tab--active' : ''}`} onClick={() => setActiveTab('messages')} role="tab" type="button">
          الرسائل
        </button>
        <button aria-controls="customer-panel-notifications" aria-selected={activeTab === 'notifications'} className={`customer-tab${activeTab === 'notifications' ? ' customer-tab--active' : ''}`} onClick={() => setActiveTab('notifications')} role="tab" type="button">
          الإشعارات
          {unreadNotificationCount > 0 ? <span className="customer-tab__badge">{badgeText(unreadNotificationCount)}</span> : null}
        </button>
      </nav>

      <div className="workspace-grid customer-workspace-grid">
        <section className="workspace-panel workspace-panel--full customer-create-project" aria-labelledby="new-project-title" hidden={activeTab !== 'projects'}>
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">ابدأ الطلب</p>
              <h2 id="new-project-title">مشروع جديد</h2>
            </div>
          </div>
          <details className="customer-create-panel" ref={createProjectPanelRef}>
            <summary>إنشاء مشروع جديد</summary>
            <form className="workflow-form customer-create-panel__form" onSubmit={createProject}>
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
          </details>
        </section>

        <section aria-labelledby="projects-title" className="workspace-panel workspace-panel--full" hidden={activeTab !== 'projects'} id="customer-panel-projects" role="tabpanel" tabIndex={0}>
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">طلباتك</p>
              <h2 id="projects-title">المشاريع</h2>
            </div>
            <span className="count-pill">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <div className="customer-empty-state">
                <h3>ابدأ مشروعك الأول</h3>
                <p>أنشئ مسودة، أضف التصميم والمقاسات، ثم أرسلها للمراجعة.</p>
                <button className="button button--small" onClick={() => createProjectPanelRef.current?.setAttribute('open', '')} type="button">إنشاء مشروع</button>
              </div>
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
                      <button
                        aria-expanded={managedProjectId === project.id}
                        className="button button--secondary button--small"
                        onClick={() => {
                          const opening = managedProjectId !== project.id;
                          setManagedProjectId(opening ? project.id : undefined);
                          if (opening && initialProductId) setSelectedProductId(initialProductId);
                          setProductSearch('');
                        }}
                        type="button"
                      >
                        {managedProjectId === project.id ? 'إغلاق التعديل' : 'إضافة تصميم'}
                      </button>
                      {managedProjectId === project.id ? (
                      <form
                        className="workflow-form workflow-form--compact"
                        onSubmit={(event) => addItem(event, project.id)}
                      >
                        <div className="workflow-form__full product-picker">
                          <div className="product-picker__heading">
                            <div>
                              <strong>اختر التصميم</strong>
                              <span>ابحث بالاسم ثم اضغط على التصميم المطلوب.</span>
                            </div>
                            <Link className="text-link" href="/catalog">فتح المعرض</Link>
                          </div>

                          {selectedProduct ? (
                            <div className="product-picker__selected">
                              {selectedProduct.imageUrl ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt={selectedProduct.imageAlt ?? selectedProduct.name}
                                    src={selectedProduct.imageUrl}
                                  />
                                </>
                              ) : (
                                <span className="product-picker__placeholder" aria-hidden="true">صورة</span>
                              )}
                              <div>
                                <small>التصميم المختار</small>
                                <strong>{selectedProduct.name}</strong>
                                {selectedProduct.categoryLabel ? <span>{selectedProduct.categoryLabel}</span> : null}
                              </div>
                              <button
                                className="plain-button"
                                onClick={() => setSelectedProductId('')}
                                type="button"
                              >
                                تغيير
                              </button>
                            </div>
                          ) : (
                            <>
                              <label className="product-picker__search">
                                <span>البحث في التصاميم</span>
                                <input
                                  autoComplete="off"
                                  onChange={(event) => setProductSearch(event.currentTarget.value)}
                                  placeholder="مثال: طاولة، كنبة، سرير..."
                                  type="search"
                                  value={productSearch}
                                />
                              </label>
                              <div className="product-picker__results" role="listbox" aria-label="نتائج التصاميم">
                                {filteredProducts.length === 0 ? (
                                  <p className="workspace-empty">لا توجد تصاميم مطابقة.</p>
                                ) : (
                                  filteredProducts.map((product) => (
                                    <button
                                      aria-selected={selectedProductId === product.id}
                                      className="product-picker__option"
                                      key={product.id}
                                      onClick={() => {
                                        setSelectedProductId(product.id);
                                        setProductSearch('');
                                      }}
                                      role="option"
                                      type="button"
                                    >
                                      {product.imageUrl ? (
                                        <>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img alt={product.imageAlt ?? product.name} src={product.imageUrl} />
                                        </>
                                      ) : (
                                        <span className="product-picker__placeholder" aria-hidden="true">صورة</span>
                                      )}
                                      <span>
                                        <strong>{product.name}</strong>
                                        <small>{product.categoryLabel ?? 'تصميم حسب الطلب'}</small>
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                          <input name="productId" type="hidden" value={selectedProductId} />
                          {!selectedProductId ? <p className="field-help">اختر تصميمًا للمتابعة.</p> : null}
                        </div>
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
                          disabled={busy || !selectedProductId}
                          type="submit"
                        >
                          إضافة التصميم
                        </button>
                      </form>
                      ) : null}
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

        <section aria-labelledby="quotes-title" className="workspace-panel workspace-panel--full" hidden={activeTab !== 'quotations'} id="customer-panel-quotations" role="tabpanel" tabIndex={0}>
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التسعير</p>
              <h2 id="quotes-title">عروض السعر</h2>
            </div>
            <span className="count-pill">{quotations.length}</span>
          </div>
          <div className="workflow-stack">
            {quotations.length === 0 ? (
              <div className="customer-empty-state"><h3>لا يوجد عرض سعر بعد</h3><p>سيظهر عرض المدير هنا بعد مراجعة مشروعك.</p></div>
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

        <section aria-labelledby="orders-title" className="workspace-panel workspace-panel--full" hidden={activeTab !== 'orders'} id="customer-panel-orders" role="tabpanel" tabIndex={0}>
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">المتابعة</p>
              <h2 id="orders-title">الطلبات</h2>
            </div>
            <span className="count-pill">{orders.length}</span>
          </div>
          <div className="workflow-stack">
            {orders.length === 0 ? (
              <div className="customer-empty-state"><h3>لا توجد طلبات حالية</h3><p>بعد اعتماد عرض السعر، ستتابع الدفع والإنتاج والتسليم من هنا.</p></div>
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

        <section aria-labelledby="messages-title" className="workspace-panel workspace-panel--full" hidden={activeTab !== 'messages'} id="customer-panel-messages" role="tabpanel" tabIndex={0}>
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

        <section aria-labelledby="notifications-title" className="workspace-panel workspace-panel--full" hidden={activeTab !== 'notifications'} id="customer-panel-notifications" role="tabpanel" tabIndex={0}>
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
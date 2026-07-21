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

type RequestSummary = Readonly<{
  id: string;
  itemCount: number;
  projectName: string;
  state: string;
  submittedAt: string;
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
    terms: Record<string, unknown>;
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

type CustomerTab = 'requests' | 'quotations' | 'orders' | 'messages' | 'notifications';

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
  const [requests, setRequests] = useState<readonly RequestSummary[]>([]);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [quotations, setQuotations] = useState<readonly Quotation[]>([]);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [notifications, setNotifications] = useState<readonly Notification[]>([]);
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [orderDetail, setOrderDetail] = useState<OrderDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<CustomerTab>('requests');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(initialProductId ?? '');
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
        requestResult,
        quotationResult,
        orderResult,
        notificationResult,
        messageResult,
      ] = await Promise.all([
        apiRequest<{ products: readonly Product[] }>('/api/v1/catalog'),
        apiRequest<{ requests: readonly RequestSummary[] }>('/api/v1/requests'),
        apiRequest<{ quotations: readonly Quotation[] }>('/api/v1/quotations'),
        apiRequest<{ orders: readonly Order[] }>('/api/v1/orders'),
        apiRequest<{ notifications: readonly Notification[] }>('/api/v1/notifications'),
        apiRequest<{ messages: readonly Message[] }>('/api/v1/messages'),
      ]);
      setProducts(catalog.products);
      setRequests(requestResult.requests);
      setQuotations(quotationResult.quotations);
      setOrders(orderResult.orders);
      setNotifications(notificationResult.notifications);
      setMessages(messageResult.messages);
      if (initialProductId && !initialProductHandled.current) {
        initialProductHandled.current = true;
        initialTabChosen.current = true;
        setActiveTab('requests');
        setSelectedProductId(initialProductId);
      } else if (!initialTabChosen.current) {
        initialTabChosen.current = true;
        setActiveTab(
          quotationResult.quotations.some((quotation) => quotation.state === 'SENT')
            ? 'quotations'
            : orderResult.orders.length > 0
              ? 'orders'
              : 'requests',
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

  async function submitDirectRequest(event: FormEvent<HTMLFormElement>) {
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
      await apiRequest('/api/v1/requests', {
        body: JSON.stringify({
          customerNotes: formText(form, 'customerNotes'),
          dimensions,
          productId: selectedProductId,
          selections,
        }),
        method: 'POST',
      });
      formElement.reset();
      setSelectedProductId('');
      setProductSearch('');
    }, 'تم إرسال طلب التصميم إلى المدير.');
  }

  async function acceptQuotation(revisionId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/quotation-revisions/${revisionId}/accept`, { method: 'POST' });
    }, 'تم اعتماد عرض السعر وإنشاء الطلب.');
  }

  async function declineQuotation(event: FormEvent<HTMLFormElement>, revisionId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/quotation-revisions/${revisionId}/decline`, {
        body: JSON.stringify({ reason: formText(form, 'reason') }),
        method: 'POST',
      });
    }, 'تم رفض عرض السعر وإبلاغ المدير.');
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await perform(async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/payment-submissions`, {
        body: form,
        method: 'POST',
      });
      const payload = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(payload.detail ?? 'تعذر رفع إيصال التحويل.');
      formElement.reset();
      await openOrder(orderId);
    }, 'تم إرسال إيصال التحويل للمراجعة.');
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
  const actionableQuotationCount = quotations.filter(
    (quotation) => quotation.state === 'SENT',
  ).length;
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
      {busy ? (
        <div className="global-action-progress" role="status">
          جاري تنفيذ العملية...
        </div>
      ) : null}
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
              <span className="catalog-handoff__placeholder" aria-hidden="true">
                تصميم
              </span>
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
        <button
          aria-controls="customer-panel-requests"
          aria-selected={activeTab === 'requests'}
          className={`customer-tab${activeTab === 'requests' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('requests')}
          role="tab"
          type="button"
        >
          الطلبات الجديدة <span className="customer-tab__count">{requests.length}</span>
        </button>
        <button
          aria-controls="customer-panel-quotations"
          aria-selected={activeTab === 'quotations'}
          className={`customer-tab${activeTab === 'quotations' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('quotations')}
          role="tab"
          type="button"
        >
          عروض السعر
          {actionableQuotationCount > 0 ? (
            <span className="customer-tab__badge">{badgeText(actionableQuotationCount)}</span>
          ) : null}
        </button>
        <button
          aria-controls="customer-panel-orders"
          aria-selected={activeTab === 'orders'}
          className={`customer-tab${activeTab === 'orders' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('orders')}
          role="tab"
          type="button"
        >
          الطلبات <span className="customer-tab__count">{orders.length}</span>
        </button>
        <button
          aria-controls="customer-panel-messages"
          aria-selected={activeTab === 'messages'}
          className={`customer-tab${activeTab === 'messages' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('messages')}
          role="tab"
          type="button"
        >
          الرسائل
        </button>
        <button
          aria-controls="customer-panel-notifications"
          aria-selected={activeTab === 'notifications'}
          className={`customer-tab${activeTab === 'notifications' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('notifications')}
          role="tab"
          type="button"
        >
          الإشعارات
          {unreadNotificationCount > 0 ? (
            <span className="customer-tab__badge">{badgeText(unreadNotificationCount)}</span>
          ) : null}
        </button>
      </nav>

      <div className="workspace-grid customer-workspace-grid">
        <section
          aria-labelledby="requests-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'requests'}
          id="customer-panel-requests"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">طلب تصميم</p>
              <h2 id="requests-title">اختر تصميمًا وأرسله للمدير</h2>
            </div>
            <span className="count-pill">{requests.length}</span>
          </div>

          <form className="workflow-form direct-request-form" onSubmit={submitDirectRequest}>
            <div className="workflow-form__full product-picker">
              <div className="product-picker__heading">
                <div>
                  <strong>التصميم</strong>
                  <span>يمكنك تخصيصه أو إرساله كما هو.</span>
                </div>
                <Link className="text-link" href="/catalog">
                  فتح المعرض
                </Link>
              </div>
              {selectedProduct ? (
                <div className="product-picker__selected">
                  {selectedProduct.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={selectedProduct.imageAlt ?? selectedProduct.name}
                      src={selectedProduct.imageUrl}
                    />
                  ) : (
                    <span className="product-picker__placeholder">صورة</span>
                  )}
                  <div>
                    <small>التصميم المختار</small>
                    <strong>{selectedProduct.name}</strong>
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
                    البحث في التصاميم
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.currentTarget.value)}
                      placeholder="ابحث باسم التصميم..."
                    />
                  </label>
                  <div className="product-picker__results">
                    {filteredProducts.map((product) => (
                      <button
                        className="product-picker__option"
                        key={product.id}
                        onClick={() => setSelectedProductId(product.id)}
                        type="button"
                      >
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={product.imageAlt ?? product.name} src={product.imageUrl} />
                        ) : (
                          <span className="product-picker__placeholder">صورة</span>
                        )}
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.categoryLabel ?? 'تصميم حسب الطلب'}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
              <input name="material" />
            </label>
            <label>
              اللون
              <input name="color" />
            </label>
            <label className="workflow-form__full">
              ملاحظات التخصيص
              <textarea name="customerNotes" rows={3} />
            </label>
            <button
              className="button workflow-form__full"
              disabled={busy || !selectedProductId}
              type="submit"
            >
              {busy ? 'جاري إرسال الطلب...' : 'إرسال الطلب إلى المدير'}
            </button>
          </form>

          <div className="workflow-stack direct-request-list">
            <h3>الطلبات المرسلة</h3>
            {requests.length === 0 ? (
              <p className="workspace-empty">لم ترسل أي طلب بعد.</p>
            ) : (
              requests.map((request) => (
                <article className="workflow-card" key={request.id}>
                  <div className="workflow-card__heading">
                    <div>
                      <h3>{request.projectName}</h3>
                      <span>{formatDate(request.submittedAt)}</span>
                    </div>
                    <span className="status-badge">{stateLabel(request.state)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          aria-labelledby="quotes-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'quotations'}
          id="customer-panel-quotations"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التسعير</p>
              <h2 id="quotes-title">عروض السعر</h2>
            </div>
            <span className="count-pill">{quotations.length}</span>
          </div>
          <div className="workflow-stack">
            {quotations.length === 0 ? (
              <div className="customer-empty-state">
                <h3>لا يوجد عرض سعر بعد</h3>
                <p>سيظهر عرض المدير هنا بعد مراجعة مشروعك.</p>
              </div>
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
                    <div className="quotation-actions">
                      <button
                        className="button button--small"
                        disabled={busy}
                        onClick={() => acceptQuotation(quotation.revisionId)}
                        type="button"
                      >
                        {busy ? 'جاري الاعتماد...' : 'قبول عرض السعر'}
                      </button>
                      <details className="quotation-decline">
                        <summary>رفض عرض السعر</summary>
                        <form onSubmit={(event) => declineQuotation(event, quotation.revisionId)}>
                          <label>
                            سبب الرفض
                            <textarea
                              name="reason"
                              required
                              minLength={2}
                              rows={2}
                              placeholder="السعر، المدة، أو التعديلات المطلوبة"
                            />
                          </label>
                          <button
                            className="button button--secondary button--small"
                            disabled={busy}
                            type="submit"
                          >
                            تأكيد الرفض
                          </button>
                        </form>
                      </details>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section
          aria-labelledby="orders-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'orders'}
          id="customer-panel-orders"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">المتابعة</p>
              <h2 id="orders-title">الطلبات</h2>
            </div>
            <span className="count-pill">{orders.length}</span>
          </div>
          <div className="workflow-stack">
            {orders.length === 0 ? (
              <div className="customer-empty-state">
                <h3>لا توجد طلبات حالية</h3>
                <p>بعد اعتماد عرض السعر، ستتابع الدفع والإنتاج والتسليم من هنا.</p>
              </div>
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
              {orderDetail.terms.bankDetails &&
              typeof orderDetail.terms.bankDetails === 'object' ? (
                <section className="bank-details" aria-labelledby="bank-details-title">
                  <h4 id="bank-details-title">بيانات التحويل البنكي</h4>
                  <dl className="detail-list">
                    <div>
                      <dt>البنك</dt>
                      <dd>
                        {String(
                          (orderDetail.terms.bankDetails as Record<string, unknown>).bankName ??
                            '—',
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>اسم صاحب الحساب</dt>
                      <dd>
                        {String(
                          (orderDetail.terms.bankDetails as Record<string, unknown>)
                            .accountHolder ?? '—',
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>رقم الحساب البنكي (RIB)</dt>
                      <dd dir="ltr">
                        {String(
                          (orderDetail.terms.bankDetails as Record<string, unknown>).rib ?? '—',
                        )}
                      </dd>
                    </div>
                    {(orderDetail.terms.bankDetails as Record<string, unknown>).iban ? (
                      <div>
                        <dt>IBAN</dt>
                        <dd dir="ltr">
                          {String((orderDetail.terms.bankDetails as Record<string, unknown>).iban)}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>المبلغ</dt>
                      <dd>{formatMoney(orderDetail.totalMinor, orderDetail.currencyCode)}</dd>
                    </div>
                    <div>
                      <dt>مرجع الطلب</dt>
                      <dd dir="ltr">{orderDetail.displayReference}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}
              {orderDetail.fulfilmentDetailsConfirmedAt &&
              ['AWAITING_SUBMISSION', 'REJECTED'].includes(orderDetail.paymentState) ? (
                <form
                  className="workflow-form"
                  onSubmit={(event) => submitPayment(event, orderDetail.id)}
                >
                  <h4>إرسال إيصال التحويل</h4>
                  <p className="field-help">
                    ارفع صورة أو ملف PDF لإيصال التحويل، ثم أرسله للمراجعة.
                  </p>
                  <label className="workflow-form__full">
                    إيصال التحويل
                    <input
                      accept="image/jpeg,image/png,application/pdf"
                      name="receipt"
                      required
                      type="file"
                    />
                  </label>
                  <label className="workflow-form__full">
                    مرجع التحويل (اختياري)
                    <input name="declaredReference" />
                  </label>
                  <button className="button" disabled={busy} type="submit">
                    {busy ? 'جاري رفع الإيصال...' : 'إرسال للمراجعة'}
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

        <section
          aria-labelledby="messages-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'messages'}
          id="customer-panel-messages"
          role="tabpanel"
          tabIndex={0}
        >
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

        <section
          aria-labelledby="notifications-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'notifications'}
          id="customer-panel-notifications"
          role="tabpanel"
          tabIndex={0}
        >
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

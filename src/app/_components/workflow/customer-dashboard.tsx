'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { apiRequest, formatDate, formatMoney, stateLabel } from './client-api';
import { ConversationChat } from './conversation-chat';
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
  archivedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  displayReference: string;
  id: string;
  itemCount: number;
  projectName: string;
  requestType: 'CATALOG_PRODUCT' | 'CUSTOM_DESIGN';
  state: string;
  submittedAt: string;
}>;

type CustomerProfile = Readonly<{
  address: string;
  city: string;
  fullName: string;
  phoneNumber: string;
}>;

type Quotation = Readonly<{
  currencyCode: string;
  requestDisplayReference: string;
  requestId: string;
  requestName: string;
  id: string;
  productionEstimateText: string;
  revisionId: string;
  revisionNumber: number;
  state: string;
  totalMinor: number;
}>;

type Order = Readonly<{
  archivedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  currencyCode: string;
  displayReference: string;
  fulfilmentMethod: 'DELIVERY' | 'PICKUP';
  fulfilmentState: string;
  id: string;
  lifecycleState: string;
  paymentState: string;
  productionState: string;
  requestDisplayReference: string;
  requestId: string;
  requestName: string;
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

type CustomerTab = 'requests' | 'orders' | 'messages' | 'notifications';

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
  const [profile, setProfile] = useState<CustomerProfile>({ address: '', city: '', fullName: '', phoneNumber: '' });
  const [requestFilter, setRequestFilter] = useState<'ACTIVE' | 'CANCELLED' | 'HISTORY'>('ACTIVE');
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
  const [cancelTarget, setCancelTarget] = useState<{ id: string; kind: 'ORDER' | 'REQUEST'; title: string }>();
  const [receiptFile, setReceiptFile] = useState<File>();
  const [receiptDragging, setReceiptDragging] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
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
        profileResult,
      ] = await Promise.all([
        apiRequest<{ products: readonly Product[] }>('/api/v1/catalog'),
        apiRequest<{ requests: readonly RequestSummary[] }>('/api/v1/requests'),
        apiRequest<{ quotations: readonly Quotation[] }>('/api/v1/quotations'),
        apiRequest<{ orders: readonly Order[] }>('/api/v1/orders'),
        apiRequest<{ notifications: readonly Notification[] }>('/api/v1/notifications'),
        apiRequest<{ messages: readonly Message[] }>('/api/v1/messages'),
        apiRequest<CustomerProfile>('/api/v1/profile'),
      ]);
      setProducts(catalog.products);
      setRequests(requestResult.requests);
      setQuotations(quotationResult.quotations);
      setOrders(orderResult.orders);
      setNotifications(notificationResult.notifications);
      setMessages(messageResult.messages);
      setProfile(profileResult);
      if (initialProductId && !initialProductHandled.current) {
        initialProductHandled.current = true;
        initialTabChosen.current = true;
        setActiveTab('requests');
        setSelectedProductId(initialProductId);
      } else if (!initialTabChosen.current) {
        initialTabChosen.current = true;
        setActiveTab(
          requestResult.requests.length > 0 || quotationResult.quotations.length > 0 || orderResult.orders.length > 0
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
    if (activeTab !== 'messages') return;
    let disposed = false;

    const syncMessages = async () => {
      try {
        const result = await apiRequest<{ messages: readonly Message[] }>('/api/v1/messages');
        if (!disposed) setMessages(result.messages);
      } catch {
        // Keep the current conversation visible when a background refresh fails.
      }
    };

    void syncMessages();
    const timer = window.setInterval(() => void syncMessages(), 10_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(''), 7_000);
    return () => window.clearTimeout(timer);
  }, [error]);

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
        body: JSON.stringify({ reason: [formText(form, 'reason'), formText(form, 'details')].filter(Boolean).join(' — ') }),
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

  function chooseReceipt(file: File | undefined) {
    if (!file) return;
    const supported = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type);
    if (!supported || file.size > 10 * 1024 * 1024) {
      setError('اختر صورة JPG أو PNG أو ملف PDF بحجم لا يتجاوز 10 ميغابايت.');
      return;
    }
    setError('');
    setReceiptFile(file);
    if (receiptInputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      receiptInputRef.current.files = transfer.files;
    }
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
      setReceiptFile(undefined);
      await openOrder(orderId);
    }, 'تم إرسال إيصال التحويل للمراجعة.');
  }

  async function cancelOrder(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/orders/${orderId}/cancel`, {
        body: JSON.stringify({ reason: [formText(form, 'reason'), formText(form, 'details')].filter(Boolean).join(' — ') }),
        method: 'POST',
      });
      setOrderDetail(undefined);
      setCancelTarget(undefined);
    }, 'تم إلغاء الطلب وتسجيل السبب.');
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/api/v1/messages', {
        body: JSON.stringify({
          body: formText(form, 'body'),
          clientMessageKey: crypto.randomUUID(),
        }),
        method: 'POST',
      });
      const result = await apiRequest<{ messages: readonly Message[] }>('/api/v1/messages');
      setMessages(result.messages);
      formElement.reset();
      setNotice('تم إرسال الرسالة.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إرسال الرسالة.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const updated = await apiRequest<CustomerProfile>('/api/v1/profile', {
        body: JSON.stringify({
          address: formText(form, 'address'),
          city: formText(form, 'city'),
          fullName: formText(form, 'fullName'),
          phoneNumber: formText(form, 'phoneNumber'),
        }),
        method: 'PATCH',
      });
      setProfile(updated);
    }, 'تم حفظ بياناتك.');
  }

  async function cancelRequest(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/requests/${requestId}/cancel`, {
        body: JSON.stringify({ reason: [formText(form, 'reason'), formText(form, 'details')].filter(Boolean).join(' — ') }),
        method: 'POST',
      });
      setCancelTarget(undefined);
    }, 'تم إلغاء الطلب ونقله إلى السجل.');
  }

  async function archiveRequest(requestId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/requests/${requestId}/archive`, { method: 'POST' });
    }, 'تم نقل الطلب إلى السجل.');
  }

  async function archiveOrder(orderId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/orders/${orderId}/archive`, { method: 'POST' });
      if (orderDetail?.id === orderId) setOrderDetail(undefined);
    }, 'تم نقل الطلب إلى السجل.');
  }

  async function openNotifications() {
    setActiveTab('notifications');
    const unread = notifications.filter((notification) => !notification.read);
    if (unread.length === 0) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    try {
      await Promise.all(
        unread.map((notification) =>
          apiRequest(`/api/v1/notifications/${notification.id}/read`, { method: 'POST' }),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث الإشعارات.');
      await refresh();
    }
  }

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;
  const activeRequestStates = new Set([
    'SUBMITTED',
    'UNDER_REVIEW',
    'WAITING_FOR_CUSTOMER_INFORMATION',
    'READY_FOR_QUOTATION',
  ]);
  const orderRequestIds = new Set(orders.map((order) => order.requestId));
  const quotationRequestIds = new Set(quotations.map((quotation) => quotation.requestId));
  const requestById = new Map(requests.map((request) => [request.id, request] as const));
  const journeyQuotations = quotations.filter(
    (quotation) => requestById.get(quotation.requestId)?.state !== 'CANCELLED',
  );
  const standaloneRequests = requests.filter((request) => {
    if (orderRequestIds.has(request.id)) return false;
    if (request.state === 'CANCELLED') return true;
    return !quotationRequestIds.has(request.id);
  });
  const filteredRequests = standaloneRequests.filter((request) => {
    if (requestFilter === 'ACTIVE') {
      return !request.archivedAt && activeRequestStates.has(request.state);
    }
    if (requestFilter === 'CANCELLED') {
      return !request.archivedAt && request.state === 'CANCELLED';
    }
    return Boolean(request.archivedAt) || ['REJECTED', 'COMPLETED'].includes(request.state);
  });
  const filteredQuotations = journeyQuotations.filter((quotation) => {
    if (requestFilter === 'ACTIVE') return quotation.state === 'SENT';
    if (requestFilter === 'CANCELLED') return false;
    return quotation.state === 'DECLINED';
  });
  const filteredOrders = orders.filter((order) => {
    if (requestFilter === 'ACTIVE') {
      return !order.archivedAt && !['CANCELLED', 'COMPLETED'].includes(order.lifecycleState);
    }
    if (requestFilter === 'CANCELLED') {
      return !order.archivedAt && order.lifecycleState === 'CANCELLED';
    }
    return Boolean(order.archivedAt) || order.lifecycleState === 'COMPLETED';
  });
  const activeJourneyCount =
    standaloneRequests.filter(
      (request) => !request.archivedAt && activeRequestStates.has(request.state),
    ).length +
    journeyQuotations.filter((quotation) => quotation.state === 'SENT').length +
    orders.filter(
      (order) => !order.archivedAt && !['CANCELLED', 'COMPLETED'].includes(order.lifecycleState),
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
          <p>اختر تصميمًا أو أرسل فكرتك الخاصة، ثم تابع التسعير والدفع والتنفيذ من مكان واحد.</p>
        </div>
        <Link className="button button--secondary" href="/catalog">
          استعراض التصاميم
        </Link>
      </header>

      <section className="customer-quick-actions" aria-label="إجراءات سريعة">
        <Link className="button" href="/custom-design">أرسل تصميمك الخاص</Link>
        <details className="profile-panel">
          <summary>{profile.fullName ? `بياناتي: ${profile.fullName}` : 'أكمل بياناتك'}</summary>
          <form className="workflow-form workflow-form--compact" onSubmit={saveProfile}>
            <label>الاسم الكامل<input defaultValue={profile.fullName} name="fullName" required minLength={2} /></label>
            <label>رقم الهاتف<input defaultValue={profile.phoneNumber} name="phoneNumber" required minLength={6} /></label>
            <label>المدينة<input defaultValue={profile.city} name="city" required minLength={2} /></label>
            <label className="workflow-form__full">العنوان (اختياري)<textarea defaultValue={profile.address} name="address" rows={2} /></label>
            <button className="button button--small" disabled={busy} type="submit">حفظ البيانات</button>
          </form>
        </details>
      </section>

      {demoEnabled ? <DemoRoleSwitch current="customer" /> : null}
      {error ? (
        <div className="toast toast--error" role="alert">
          <span>{error}</span>
          <button aria-label="إغلاق التنبيه" className="toast__close" onClick={() => setError('')} type="button">×</button>
        </div>
      ) : null}
      {notice ? (
        <div className="toast toast--success" role="status">
          <span>{notice}</span>
          <button aria-label="إغلاق التنبيه" className="toast__close" onClick={() => setNotice('')} type="button">×</button>
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
              <span>خصصه كما تريد ثم أرسله مباشرة إلى المدير.</span>
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
          طلب جديد
        </button>
        <button
          aria-controls="customer-panel-orders"
          aria-selected={activeTab === 'orders'}
          className={`customer-tab${activeTab === 'orders' ? ' customer-tab--active' : ''}`}
          onClick={() => setActiveTab('orders')}
          role="tab"
          type="button"
        >
          طلباتي
          {activeJourneyCount > 0 ? (
            <span className="customer-tab__badge">{badgeText(activeJourneyCount)}</span>
          ) : null}
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
          onClick={() => void openNotifications()}
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
              <p className="eyebrow">رحلة الطلب</p>
              <h2 id="orders-title">طلباتي</h2>
              <p className="field-help">تابع طلب التصميم، عرض السعر، الدفع، الإنتاج والتسليم في مكان واحد.</p>
            </div>
          </div>

          <div className="saved-views customer-journey-views" aria-label="تصفية طلباتي">
            <button className={requestFilter === 'ACTIVE' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestFilter('ACTIVE')} type="button">النشطة</button>
            <button className={requestFilter === 'CANCELLED' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestFilter('CANCELLED')} type="button">الملغاة</button>
            <button className={requestFilter === 'HISTORY' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestFilter('HISTORY')} type="button">السجل</button>
          </div>

          <div className="workflow-stack customer-journey-list">
            {filteredRequests.length + filteredQuotations.length + filteredOrders.length === 0 ? (
              <div className="customer-empty-state">
                <h3>لا توجد عناصر في هذا العرض</h3>
                <p>ستظهر هنا طلباتك وعروض السعر والطلبات المؤكدة حسب حالتها.</p>
              </div>
            ) : null}

            {filteredRequests.map((request) => (
              <article className="workflow-card journey-card" key={`request-${request.id}`}>
                <div className="workflow-card__heading">
                  <div>
                    <span className="journey-card__kind">{request.requestType === 'CUSTOM_DESIGN' ? 'تصميم خاص' : 'منتج من الكتالوج'}</span>
                    <h3>{request.projectName}</h3>
                    <span>{request.displayReference} · {formatDate(request.submittedAt)}</span>
                  </div>
                  <span className="status-badge">{stateLabel(request.state)}</span>
                </div>
                {request.cancellationReason ? <p className="journey-card__reason">سبب الإلغاء: {request.cancellationReason}</p> : null}
                {activeRequestStates.has(request.state) ? (
                  <button
                    className="plain-button plain-button--danger"
                    onClick={() => setCancelTarget({ id: request.id, kind: 'REQUEST', title: request.projectName })}
                    type="button"
                  >
                    إلغاء الطلب
                  </button>
                ) : null}
                {!request.archivedAt && ['CANCELLED', 'REJECTED', 'COMPLETED'].includes(request.state) ? (
                  <button className="plain-button" disabled={busy} onClick={() => archiveRequest(request.id)} type="button">نقل إلى السجل</button>
                ) : null}
              </article>
            ))}

            {filteredQuotations.map((quotation) => (
              <article className="workflow-card journey-card journey-card--quotation" key={`quotation-${quotation.revisionId}`}>
                <div className="workflow-card__heading">
                  <div>
                    <span className="journey-card__kind">عرض سعر</span>
                    <h3>{quotation.requestName}</h3>
                    <span>{quotation.requestDisplayReference} · الإصدار {quotation.revisionNumber}</span>
                  </div>
                  <span className="status-badge">{stateLabel(quotation.state)}</span>
                </div>
                <strong className="journey-card__price">{formatMoney(quotation.totalMinor, quotation.currencyCode)}</strong>
                <p>{quotation.productionEstimateText}</p>
                {quotation.state === 'SENT' ? (
                  <div className="quotation-actions">
                    <button className="button button--small" disabled={busy} onClick={() => acceptQuotation(quotation.revisionId)} type="button">
                      {busy ? 'جاري الاعتماد...' : 'قبول عرض السعر'}
                    </button>
                    <details className="quotation-decline">
                      <summary>رفض عرض السعر</summary>
                      <form onSubmit={(event) => declineQuotation(event, quotation.revisionId)}>
                        <label>
                          سبب الرفض
                          <textarea name="reason" required minLength={2} rows={2} placeholder="السعر، المدة، أو التعديلات المطلوبة" />
                        </label>
                        <button className="button button--secondary button--small" disabled={busy} type="submit">تأكيد الرفض</button>
                      </form>
                    </details>
                  </div>
                ) : null}
              </article>
            ))}

            {filteredOrders.map((order) => (
              <article className="workflow-card journey-card journey-card--order" key={`order-${order.id}`}>
                <div className="workflow-card__heading">
                  <div>
                    <span className="journey-card__kind">طلب مؤكد</span>
                    <h3>{order.requestName}</h3>
                    <span>{order.displayReference} · {formatMoney(order.totalMinor, order.currencyCode)}</span>
                  </div>
                  <span className="status-badge">{stateLabel(order.lifecycleState)}</span>
                </div>
                <div className="status-grid">
                  <span><small>الدفع</small>{stateLabel(order.paymentState)}</span>
                  <span><small>الإنتاج</small>{stateLabel(order.productionState)}</span>
                  <span><small>التسليم</small>{stateLabel(order.fulfilmentState)}</span>
                </div>
                {order.cancellationReason ? <p className="journey-card__reason">سبب الإلغاء: {order.cancellationReason}</p> : null}
                <div className="journey-card__actions">
                  <button className="button button--secondary button--small" disabled={busy} onClick={() => openOrder(order.id)} type="button">عرض التفاصيل</button>
                  {!['COMPLETED', 'CANCELLED'].includes(order.lifecycleState) ? (
                    <button className="plain-button plain-button--danger" onClick={() => setCancelTarget({ id: order.id, kind: 'ORDER', title: order.displayReference })} type="button">طلب إلغاء</button>
                  ) : null}
                  {!order.archivedAt && ['COMPLETED', 'CANCELLED'].includes(order.lifecycleState) ? (
                    <button className="plain-button" disabled={busy} onClick={() => archiveOrder(order.id)} type="button">نقل إلى السجل</button>
                  ) : null}
                </div>
              </article>
            ))}
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
              {orderDetail.lifecycleState === 'CANCELLED' ? (
                <div className="decision-box decision-box--cancelled" role="status">
                  <strong>تم إلغاء هذا الطلب</strong>
                  <span>{orderDetail.cancellationReason ?? 'تم حفظه ضمن الطلبات الملغاة.'}</span>
                </div>
              ) : !orderDetail.fulfilmentDetailsConfirmedAt ? (
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
                <div className="decision-box decision-box--success" role="status">
                  تم تأكيد تفاصيل {orderDetail.fulfilmentMethod === 'DELIVERY' ? 'التوصيل' : 'الاستلام'}.
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
              {orderDetail.lifecycleState !== 'CANCELLED' &&
              orderDetail.fulfilmentDetailsConfirmedAt &&
              ['AWAITING_SUBMISSION', 'REJECTED'].includes(orderDetail.paymentState) ? (
                <form
                  className="workflow-form"
                  onSubmit={(event) => submitPayment(event, orderDetail.id)}
                >
                  <h4>إرسال إيصال التحويل</h4>
                  <p className="field-help">
                    ارفع صورة أو ملف PDF لإيصال التحويل، ثم أرسله للمراجعة.
                  </p>
                  <div className="workflow-form__full">
                    <input
                      accept="image/jpeg,image/png,application/pdf"
                      hidden
                      name="receipt"
                      onChange={(event) => chooseReceipt(event.currentTarget.files?.[0])}
                      ref={receiptInputRef}
                      required
                      type="file"
                    />
                    <section
                      className={`receipt-uploader${receiptDragging ? ' receipt-uploader--dragging' : ''}`}
                      onDragEnter={(event) => { event.preventDefault(); setReceiptDragging(true); }}
                      onDragLeave={(event) => { event.preventDefault(); setReceiptDragging(false); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        setReceiptDragging(false);
                        chooseReceipt(event.dataTransfer.files[0]);
                      }}
                    >
                      <span className="receipt-uploader__icon" aria-hidden="true">↑</span>
                      <div>
                        <strong>رفع إيصال التحويل</strong>
                        <p>اسحب الإيصال هنا أو اضغط لاختياره من جهازك.</p>
                        <small>JPG، PNG، PDF · الحد الأقصى 10 ميغابايت</small>
                      </div>
                      <button className="button button--secondary button--small" onClick={() => receiptInputRef.current?.click()} type="button">
                        {receiptFile ? 'استبدال الملف' : 'اختيار الملف'}
                      </button>
                    </section>
                    {receiptFile ? (
                      <article className="receipt-file-card">
                        <span className="receipt-file-card__type">{receiptFile.type === 'application/pdf' ? 'PDF' : 'صورة'}</span>
                        <div><strong>{receiptFile.name}</strong><small>{(receiptFile.size / 1024 / 1024).toFixed(1)} ميغابايت</small></div>
                        <button className="plain-button plain-button--danger" onClick={() => {
                          setReceiptFile(undefined);
                          if (receiptInputRef.current) receiptInputRef.current.value = '';
                        }} type="button">حذف</button>
                      </article>
                    ) : null}
                  </div>
                  <label className="workflow-form__full">
                    مرجع التحويل (اختياري)
                    <input name="declaredReference" />
                  </label>
                  <button className="button" disabled={busy || !receiptFile} type="submit">
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
          <ConversationChat
            busy={busy}
            currentActor="CUSTOMER"
            emptyText="ابدأ برسالة توضح ما تحتاجه، وسيظهر رد المدير هنا."
            messages={messages}
            onSubmit={sendMessage}
            subtitle="فريق بيتي بذوقي"
            title="خدمة العملاء"
          />
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
      {cancelTarget ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCancelTarget(undefined)}>
          <section aria-labelledby="customer-cancel-title" aria-modal="true" className="cancel-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="cancel-dialog__icon" aria-hidden="true">!</div>
            <div>
              <p className="eyebrow">إجراء حساس</p>
              <h2 id="customer-cancel-title">إلغاء {cancelTarget.kind === 'ORDER' ? 'الطلب' : 'طلب التصميم'}</h2>
              <p>سيُنقل <strong>{cancelTarget.title}</strong> إلى قسم الملغاة مع الاحتفاظ بالسجل.</p>
            </div>
            <form onSubmit={(event) => {
              if (cancelTarget.kind === 'ORDER') void cancelOrder(event, cancelTarget.id);
              else void cancelRequest(event, cancelTarget.id);
            }}>
              <fieldset className="cancel-reasons">
                <legend>اختر سببًا</legend>
                {['غيّرت رأيي', 'السعر غير مناسب', 'أريد تعديل المواصفات', 'تأخر التنفيذ'].map((reason) => (
                  <label key={reason}><input name="reason" required type="radio" value={reason} />{reason}</label>
                ))}
                <label><input name="reason" required type="radio" value="سبب آخر" />سبب آخر</label>
              </fieldset>
              <label className="cancel-dialog__note">تفاصيل إضافية (اختياري)<textarea name="details" rows={3} placeholder="اكتب أي توضيح يساعدنا على فهم سبب الإلغاء." /></label>
              <div className="cancel-dialog__actions">
                <button className="button button--secondary" onClick={() => setCancelTarget(undefined)} type="button">رجوع</button>
                <button className="button button--danger" disabled={busy} type="submit">تأكيد الإلغاء</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

    </main>
  );
}

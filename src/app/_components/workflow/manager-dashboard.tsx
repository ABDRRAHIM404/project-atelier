'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { apiRequest, formatDate, formatMoney, stateLabel } from './client-api';
import { DemoRoleSwitch } from './demo-role-switch';

type RequestSummary = Readonly<{
  cancelledAt?: string;
  cancellationReason?: string;
  customerCity?: string;
  customerId: string;
  customerLabel: string;
  customerPhone?: string;
  displayReference: string;
  id: string;
  itemCount: number;
  projectId?: string;
  projectName: string;
  requestType: 'CATALOG_PRODUCT' | 'CUSTOM_DESIGN';
  state: string;
  submittedAt: string;
}>;

type RequestDetail = RequestSummary &
  Readonly<{
    customerNotes: string;
    customDesignDetails: Record<string, unknown>;
    customDesignFiles: readonly Record<string, unknown>[];
    items: readonly Readonly<{
      configuration: Record<string, unknown>;
      customerNotes: string;
      id: string;
      productName: string;
      sequence: number;
    }>[];
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

type Message = Readonly<{
  body: string;
  id: string;
  senderKind: 'CUSTOMER' | 'MANAGER';
  sentAt: string;
}>;

type Notification = Readonly<{
  body: string;
  createdAt: string;
  id: string;
  read: boolean;
  title: string;
}>;

type CatalogProduct = Readonly<{
  description: string;
  furnitureType: string;
  id: string;
  lifecycle: string;
  name: string;
  productionInformation: string;
  recordVersion: number;
  startingAmountMinor: number;
}>;

type ProductImage = Readonly<{
  altText?: string;
  id: string;
  isPrimary: boolean;
  publicUrl: string;
  sortOrder: number;
}>;

type ManagerDashboardProps = Readonly<{ demoEnabled: boolean }>;

type ManagerTab = 'catalog' | 'requests' | 'orders' | 'messages' | 'notifications';
type CatalogFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

const nextProductionState: Readonly<Record<string, string>> = Object.freeze({
  IN_PRODUCTION: 'QUALITY_INSPECTION',
  MATERIALS_PREPARATION: 'IN_PRODUCTION',
  NOT_STARTED: 'MATERIALS_PREPARATION',
  QUALITY_INSPECTION: 'READY',
});

function formText(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function minorFromForm(form: FormData, key: string): number {
  const value = Number(formText(form, key));
  if (!Number.isFinite(value) || value < 0) throw new Error('أدخل مبلغًا صحيحًا.');
  return Math.round(value * 100);
}

function badgeText(count: number): string {
  return count > 9 ? '9+' : String(count);
}

function configurationText(configuration: Record<string, unknown>): string {
  const dimensions = configuration.dimensions;
  const selections = configuration.selections;
  const labels: Readonly<Record<string, string>> = Object.freeze({
    color: 'اللون',
    depth: 'العمق',
    height: 'الارتفاع',
    material: 'الخامة',
    width: 'العرض',
  });
  const parts: string[] = [];
  if (dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)) {
    for (const [key, value] of Object.entries(dimensions as Record<string, unknown>)) {
      parts.push(`${labels[key] ?? key}: ${String(value)} سم`);
    }
  }
  if (selections && typeof selections === 'object' && !Array.isArray(selections)) {
    for (const [key, value] of Object.entries(selections as Record<string, unknown>)) {
      parts.push(
        `${labels[key] ?? key}: ${Array.isArray(value) ? value.join('، ') : String(value)}`,
      );
    }
  }
  return parts.join(' · ') || 'بدون تعديلات؛ يُنفذ التصميم كما هو.';
}

export function ManagerDashboard({ demoEnabled }: ManagerDashboardProps) {
  const [requests, setRequests] = useState<readonly RequestSummary[]>([]);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [notifications, setNotifications] = useState<readonly Notification[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<readonly CatalogProduct[]>([]);
  const [productImages, setProductImages] = useState<Record<string, readonly ProductImage[]>>({});
  const [requestDetail, setRequestDetail] = useState<RequestDetail>();
  const [orderDetail, setOrderDetail] = useState<OrderDetail>();
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [messageCustomerId, setMessageCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<ManagerTab>('catalog');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('ALL');
  const [managedProductId, setManagedProductId] = useState<string>();
  const [requestSearch, setRequestSearch] = useState('');
  const [requestView, setRequestView] = useState<'ACTION' | 'WAITING' | 'CANCELLED' | 'HISTORY'>('ACTION');
  const [cancelTarget, setCancelTarget] = useState<{ id: string; kind: 'ORDER' | 'REQUEST'; title: string }>();
  const requestDetailRef = useRef<HTMLElement>(null);
  const initialTabChosen = useRef(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      if (demoEnabled) {
        await apiRequest('/api/v1/demo-auth', {
          body: JSON.stringify({ role: 'manager' }),
          method: 'POST',
        });
      }
      const [requestResult, orderResult, notificationResult, catalogResult] = await Promise.all([
        apiRequest<{ requests: readonly RequestSummary[] }>('/api/v1/manager/requests'),
        apiRequest<{ orders: readonly Order[] }>('/api/v1/orders'),
        apiRequest<{ notifications: readonly Notification[] }>('/api/v1/notifications'),
        apiRequest<{ products: readonly CatalogProduct[] }>('/api/v1/manager/catalog/products'),
      ]);
      setRequests(requestResult.requests);
      setOrders(orderResult.orders);
      setNotifications(notificationResult.notifications);
      setCatalogProducts(catalogResult.products);
      if (!initialTabChosen.current) {
        initialTabChosen.current = true;
        setActiveTab(
          requestResult.requests.length > 0
            ? 'requests'
            : orderResult.orders.length > 0
              ? 'orders'
              : 'catalog',
        );
      }
      const imageEntries = await Promise.all(
        catalogResult.products.map(async (product) => {
          try {
            const result = await apiRequest<{ images: readonly ProductImage[] }>(
              `/api/v1/manager/catalog/products/${product.id}/images`,
            );
            return [product.id, result.images] as const;
          } catch {
            return [product.id, [] as readonly ProductImage[]] as const;
          }
        }),
      );
      setProductImages(Object.fromEntries(imageEntries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحميل لوحة المدير.');
    }
  }, [demoEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

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

  useEffect(() => {
    if (!requestDetail) return;
    const timer = window.setTimeout(() => {
      requestDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      requestDetailRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [requestDetail]);

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

  async function createCatalogDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await perform(async () => {
      await apiRequest('/api/v1/manager/catalog/products', {
        body: JSON.stringify({
          description: formText(form, 'description'),
          furnitureType: formText(form, 'furnitureType'),
          name: formText(form, 'name'),
          productionInformation: formText(form, 'productionInformation'),
          startingAmountMinor: minorFromForm(form, 'startingPrice'),
        }),
        method: 'POST',
      });
      formElement.reset();
    }, 'تم حفظ تصميم جديد كمسودة.');
  }

  async function updateCatalogDraft(event: FormEvent<HTMLFormElement>, product: CatalogProduct) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}`, {
        body: JSON.stringify({
          description: formText(form, 'description'),
          expectedVersion: product.recordVersion,
          furnitureType: formText(form, 'furnitureType'),
          name: formText(form, 'name'),
          productionInformation: formText(form, 'productionInformation'),
          startingAmountMinor: minorFromForm(form, 'startingPrice'),
        }),
        method: 'PATCH',
      });
    }, 'تم تحديث مسودة التصميم.');
  }

  async function publishCatalogDraft(product: CatalogProduct) {
    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}/publish`, {
        method: 'POST',
      });
    }, 'تم نشر التصميم وأصبح ظاهراً في المعرض.');
  }

  async function archiveCatalogProduct(product: CatalogProduct) {
    const confirmed = window.confirm(
      'سيختفي التصميم من المعرض، لكن ستبقى الطلبات والسجلات القديمة محفوظة. هل تريد المتابعة؟',
    );
    if (!confirmed) return;

    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}/archive`, {
        body: JSON.stringify({ expectedVersion: product.recordVersion }),
        method: 'POST',
      });
      setManagedProductId(undefined);
    }, 'تم نقل التصميم إلى الأرشيف.');
  }

  async function restoreCatalogProduct(product: CatalogProduct) {
    const confirmed = window.confirm('هل تريد إعادة نشر هذا التصميم في المعرض؟');
    if (!confirmed) return;

    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}/restore`, {
        body: JSON.stringify({ expectedVersion: product.recordVersion }),
        method: 'POST',
      });
      setManagedProductId(undefined);
    }, 'تم استعادة التصميم ونشره في المعرض.');
  }

  async function refreshProductImagesById(product: CatalogProduct) {
    try {
      const result = await apiRequest<{ images: readonly ProductImage[] }>(
        `/api/v1/manager/catalog/products/${product.id}/images`,
      );
      setProductImages((current) => ({ ...current, [product.id]: result.images }));
    } catch {
      setProductImages((current) => ({ ...current, [product.id]: [] }));
    }
  }

  async function uploadProductImage(event: FormEvent<HTMLFormElement>, product: CatalogProduct) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('اختر صورة أولاً.');
    const response = await fetch(`/api/v1/manager/catalog/products/${product.id}/images`, {
      body: form,
      method: 'POST',
    });
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    if (!response.ok) throw new Error(payload.detail ?? 'تعذر رفع الصورة.');
    formElement.reset();
    await refreshProductImagesById(product);
  }

  async function setPrimaryProductImage(product: CatalogProduct, imageId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}/images`, {
        body: JSON.stringify({ imageId, isPrimary: true }),
        method: 'PATCH',
      });
      await refreshProductImagesById(product);
    }, 'تم تعيين الصورة الرئيسية.');
  }

  async function deleteProductImage(product: CatalogProduct, imageId: string) {
    await perform(async () => {
      await apiRequest(`/api/v1/manager/catalog/products/${product.id}/images`, {
        body: JSON.stringify({ imageId }),
        method: 'DELETE',
      });
      await refreshProductImagesById(product);
    }, 'تم حذف الصورة.');
  }

  async function openRequest(requestId: string) {
    setActiveTab('requests');
    setBusy(true);
    setError('');
    try {
      const detail = await apiRequest<RequestDetail>(`/api/v1/manager/requests/${requestId}`);
      setRequestDetail(detail);
      setMessageCustomerId(detail.customerId);
      const result = await apiRequest<{ messages: readonly Message[] }>(
        `/api/v1/messages?customerId=${encodeURIComponent(detail.customerId)}`,
      );
      setMessages(result.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر فتح الطلب.');
    } finally {
      setBusy(false);
    }
  }

  async function sendQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestDetail) return;
    const form = new FormData(event.currentTarget);
    const lines = requestDetail.items.map((item) => ({
      itemTotalMinor: minorFromForm(form, `price-${item.id}`),
      submittedItemId: item.id,
    }));
    await perform(async () => {
      await apiRequest(`/api/v1/manager/requests/${requestDetail.id}/quotation`, {
        body: JSON.stringify({
          deliveryMinor: minorFromForm(form, 'delivery'),
          fulfilmentMethod: formText(form, 'fulfilmentMethod'),
          fulfilmentSnapshot: {},
          lines,
          managerNotes: formText(form, 'managerNotes'),
          productionEstimateText: formText(form, 'productionEstimateText'),
          termsSnapshot: {
            payment: 'تحويل بنكي كامل قبل بدء التنفيذ',
            bankDetails: {
              accountHolder: formText(form, 'accountHolder'),
              bankName: formText(form, 'bankName'),
              iban: formText(form, 'iban'),
              rib: formText(form, 'rib'),
              transferInstructions: formText(form, 'transferInstructions'),
            },
          },
        }),
        method: 'POST',
      });
      setRequestDetail(
        await apiRequest<RequestDetail>(`/api/v1/manager/requests/${requestDetail.id}`),
      );
    }, 'تم إرسال عرض السعر للعميل.');
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

  async function decidePayment(outcome: 'reject' | 'verify', submissionId: string, reason = '') {
    await perform(
      async () => {
        await apiRequest(`/api/v1/manager/payment-submissions/${submissionId}/${outcome}`, {
          body: JSON.stringify({ safeReason: reason }),
          method: 'POST',
        });
        if (orderDetail)
          setOrderDetail(await apiRequest<OrderDetail>(`/api/v1/orders/${orderDetail.id}`));
      },
      outcome === 'verify' ? 'تم تأكيد التحويل.' : 'تم رفض الإثبات وإبلاغ العميل.',
    );
  }

  async function rejectPayment(event: FormEvent<HTMLFormElement>, submissionId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await decidePayment('reject', submissionId, formText(form, 'safeReason'));
  }

  async function advanceProduction(orderId: string, toState: string) {
    await perform(
      async () => {
        await apiRequest(`/api/v1/manager/orders/${orderId}/production`, {
          body: JSON.stringify({
            customerVisibleNote: `تم تحديث حالة الطلب إلى: ${stateLabel(toState)}`,
            toState,
          }),
          method: 'POST',
        });
        setOrderDetail(await apiRequest<OrderDetail>(`/api/v1/orders/${orderId}`));
      },
      `تم نقل الإنتاج إلى ${stateLabel(toState)}.`,
    );
  }

  async function completeOrder(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/manager/orders/${orderId}/complete`, {
        body: JSON.stringify({
          proofDisplayFilename: formText(form, 'proofDisplayFilename'),
          proofMediaType: formText(form, 'proofMediaType'),
          proofObjectKey: formText(form, 'proofObjectKey'),
        }),
        method: 'POST',
      });
      setOrderDetail(await apiRequest<OrderDetail>(`/api/v1/orders/${orderId}`));
    }, 'تم تسجيل التسليم وإكمال الطلب.');
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageCustomerId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await perform(async () => {
      await apiRequest('/api/v1/messages', {
        body: JSON.stringify({
          body: formText(form, 'body'),
          clientMessageKey: crypto.randomUUID(),
          customerId: messageCustomerId,
          projectId: requestDetail?.projectId,
        }),
        method: 'POST',
      });
      const result = await apiRequest<{ messages: readonly Message[] }>(
        `/api/v1/messages?customerId=${encodeURIComponent(messageCustomerId)}`,
      );
      setMessages(result.messages);
      formElement.reset();
    }, 'تم إرسال الرسالة للعميل.');
  }

  async function cancelManagerOrder(event: FormEvent<HTMLFormElement>, orderId: string) {
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

  async function cancelManagerRequest(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await apiRequest(`/api/v1/requests/${requestId}/cancel`, {
        body: JSON.stringify({ reason: [formText(form, 'reason'), formText(form, 'details')].filter(Boolean).join(' — ') }),
        method: 'POST',
      });
      setRequestDetail(undefined);
      setCancelTarget(undefined);
    }, 'تم إلغاء الطلب وتسجيل السبب.');
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
  const filteredCatalogProducts = catalogProducts.filter(
    (product) => catalogFilter === 'ALL' || product.lifecycle === catalogFilter,
  );
  const catalogCounts = {
    ALL: catalogProducts.length,
    ARCHIVED: catalogProducts.filter((product) => product.lifecycle === 'ARCHIVED').length,
    DRAFT: catalogProducts.filter((product) => product.lifecycle === 'DRAFT').length,
    PUBLISHED: catalogProducts.filter((product) => product.lifecycle === 'PUBLISHED').length,
  } as const;

  const normalizedRequestSearch = requestSearch.trim().toLocaleLowerCase('ar');
  const inboxRequests = requests.filter((request) => {
    const matchesSearch = !normalizedRequestSearch ||
      `${request.customerLabel} ${request.customerPhone ?? ''} ${request.displayReference} ${request.projectName}`
        .toLocaleLowerCase('ar')
        .includes(normalizedRequestSearch);
    if (!matchesSearch) return false;
    if (requestView === 'ACTION') return ['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_QUOTATION'].includes(request.state);
    if (requestView === 'WAITING') return ['WAITING_FOR_CUSTOMER_INFORMATION', 'QUOTED'].includes(request.state);
    if (requestView === 'CANCELLED') return request.state === 'CANCELLED';
    return ['REJECTED', 'COMPLETED'].includes(request.state);
  });

  const latestSubmission = orderDetail?.paymentSubmissions.at(-1);
  const nextState =
    orderDetail &&
    (orderDetail.paymentState === 'VERIFIED' || orderDetail.productionState !== 'NOT_STARTED')
      ? nextProductionState[orderDetail.productionState]
      : undefined;

  return (
    <main className="workspace section-shell" id="main-content" tabIndex={-1}>
      {busy ? (
        <div className="global-action-progress" role="status">
          جاري تنفيذ العملية...
        </div>
      ) : null}
      <header className="workspace__hero">
        <div>
          <p className="eyebrow">لوحة المدير</p>
          <h1>إدارة الطلبات من المراجعة حتى التسليم</h1>
          <p>راجع طلبات التصميم، أرسل عروض السعر، تحقق من التحويلات، وحدّث تقدم الإنتاج.</p>
        </div>
        <Link className="button button--secondary" href="/catalog">
          فتح المعرض
        </Link>
      </header>

      {demoEnabled ? <DemoRoleSwitch current="manager" /> : null}
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

      <nav className="manager-tabs" aria-label="أقسام لوحة المدير" role="tablist">
        <button
          aria-controls="manager-panel-catalog"
          aria-selected={activeTab === 'catalog'}
          className={`manager-tab${activeTab === 'catalog' ? ' manager-tab--active' : ''}`}
          id="manager-tab-catalog"
          onClick={() => setActiveTab('catalog')}
          role="tab"
          type="button"
        >
          الكتالوج <span className="manager-tab__count">{catalogProducts.length}</span>
        </button>
        <button
          aria-controls="manager-panel-requests"
          aria-selected={activeTab === 'requests'}
          className={`manager-tab${activeTab === 'requests' ? ' manager-tab--active' : ''}`}
          id="manager-tab-requests"
          onClick={() => setActiveTab('requests')}
          role="tab"
          type="button"
        >
          صندوق العمل
          {requests.length > 0 ? (
            <span className="manager-tab__badge">{badgeText(requests.length)}</span>
          ) : null}
        </button>
        <button
          aria-controls="manager-panel-orders"
          aria-selected={activeTab === 'orders'}
          className={`manager-tab${activeTab === 'orders' ? ' manager-tab--active' : ''}`}
          id="manager-tab-orders"
          onClick={() => setActiveTab('orders')}
          role="tab"
          type="button"
        >
          الطلبات الجارية
          {orders.length > 0 ? (
            <span className="manager-tab__badge">{badgeText(orders.length)}</span>
          ) : null}
        </button>
        <button
          aria-controls="manager-panel-messages"
          aria-selected={activeTab === 'messages'}
          className={`manager-tab${activeTab === 'messages' ? ' manager-tab--active' : ''}`}
          id="manager-tab-messages"
          onClick={() => setActiveTab('messages')}
          role="tab"
          type="button"
        >
          الرسائل
        </button>
        <button
          aria-controls="manager-panel-notifications"
          aria-selected={activeTab === 'notifications'}
          className={`manager-tab${activeTab === 'notifications' ? ' manager-tab--active' : ''}`}
          id="manager-tab-notifications"
          onClick={() => void openNotifications()}
          role="tab"
          type="button"
        >
          الإشعارات
          {unreadNotificationCount > 0 ? (
            <span className="manager-tab__badge">{badgeText(unreadNotificationCount)}</span>
          ) : null}
        </button>
      </nav>

      <div className="workspace-grid manager-workspace-grid">
        <section
          aria-labelledby="manager-catalog-title"
          aria-describedby="manager-catalog-help"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'catalog'}
          id="manager-panel-catalog"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">الكتالوج</p>
              <h2 id="manager-catalog-title">التصاميم والمسودات</h2>
            </div>
            <span className="count-pill">{catalogProducts.length}</span>
          </div>
          <p className="field-help" id="manager-catalog-help">
            أضف التصاميم، أدِر الصور، وعدّل المسودات من مكان واحد منظم.
          </p>

          <details className="catalog-create-panel">
            <summary>إنشاء تصميم جديد</summary>
            <form
              className="workflow-form catalog-create-panel__form"
              onSubmit={createCatalogDraft}
            >
              <label>
                اسم التصميم
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <label>
                النوع
                <select name="furnitureType" defaultValue="SOFA">
                  <option value="SOFA">كنبة</option>
                  <option value="BED">سرير</option>
                  <option value="DINING_TABLE">طاولة طعام</option>
                  <option value="WARDROBE">دولاب</option>
                  <option value="TV_UNIT">وحدة تلفاز</option>
                  <option value="SHELF">مكتبة أو رف</option>
                  <option value="DESK">مكتب</option>
                  <option value="CHAIR">كرسي</option>
                  <option value="OTHER">أخرى</option>
                </select>
              </label>
              <label>
                السعر الابتدائي (ر.س)
                <input name="startingPrice" min="0" required step="0.01" type="number" />
              </label>
              <label className="workflow-form__full">
                الوصف العربي
                <textarea name="description" required minLength={10} maxLength={2000} rows={3} />
              </label>
              <label className="workflow-form__full">
                معلومات التنفيذ
                <textarea name="productionInformation" maxLength={1000} rows={2} />
              </label>
              <button className="button" disabled={busy} type="submit">
                حفظ كمسودة
              </button>
            </form>
          </details>

          <div className="catalog-toolbar">
            <div className="catalog-filters" aria-label="تصفية التصاميم">
              {(
                [
                  ['ALL', 'الكل'],
                  ['PUBLISHED', 'منشور'],
                  ['DRAFT', 'مسودة'],
                  ['ARCHIVED', 'مؤرشف'],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={catalogFilter === value}
                  className={`catalog-filter${catalogFilter === value ? ' catalog-filter--active' : ''}`}
                  key={value}
                  onClick={() => setCatalogFilter(value)}
                  type="button"
                >
                  {label} <span>{catalogCounts[value]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredCatalogProducts.length === 0 ? (
            <p className="workspace-empty">لا توجد تصاميم ضمن هذا التصنيف.</p>
          ) : (
            <div className="catalog-product-list">
              {filteredCatalogProducts.map((product) => {
                const images = productImages[product.id] ?? [];
                const primaryImage = images.find((image) => image.isPrimary) ?? images[0];
                const isManaged = managedProductId === product.id;
                return (
                  <article className="catalog-product-card" key={product.id}>
                    <div className="catalog-product-card__image">
                      {primaryImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={primaryImage.altText ?? product.name}
                            src={primaryImage.publicUrl}
                          />
                        </>
                      ) : (
                        <div className="catalog-product-card__placeholder" aria-hidden="true">
                          صورة
                        </div>
                      )}
                    </div>
                    <div className="catalog-product-card__content">
                      <div className="catalog-product-card__heading">
                        <div>
                          <h3>{product.name}</h3>
                          <strong>{formatMoney(product.startingAmountMinor, 'SAR')}</strong>
                        </div>
                        <span className="status-badge">{stateLabel(product.lifecycle)}</span>
                      </div>
                      <p>{product.description || 'لا يوجد وصف بعد.'}</p>
                      <div className="catalog-product-card__meta">
                        <span>
                          {images.length} {images.length === 1 ? 'صورة' : 'صور'}
                        </span>
                        <span>الإصدار {product.recordVersion}</span>
                      </div>
                      <button
                        aria-expanded={isManaged}
                        className="button button--secondary button--small"
                        onClick={() => setManagedProductId(isManaged ? undefined : product.id)}
                        type="button"
                      >
                        {isManaged ? 'إغلاق الإدارة' : 'إدارة'}
                      </button>
                    </div>

                    {isManaged ? (
                      <div className="catalog-product-manager">
                        <h4>إدارة الصور</h4>
                        <form
                          className="workflow-form workflow-form--compact"
                          onSubmit={(event) =>
                            void perform(() => uploadProductImage(event, product), 'تم رفع الصورة.')
                          }
                        >
                          <label className="workflow-form__full">
                            صورة المنتج
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              name="file"
                              required
                              type="file"
                            />
                          </label>
                          <label className="workflow-form__full">
                            نص بديل
                            <input maxLength={120} name="altText" />
                          </label>
                          <button className="button button--small" disabled={busy} type="submit">
                            رفع صورة
                          </button>
                        </form>

                        {images.length === 0 ? (
                          <p className="workspace-empty">لا توجد صور بعد.</p>
                        ) : (
                          <div className="catalog-image-grid">
                            {images.map((image) => (
                              <article className="catalog-image-card" key={image.id}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt={image.altText ?? product.name} src={image.publicUrl} />
                                <div className="workflow-actions">
                                  <button
                                    className="button button--secondary button--small"
                                    disabled={busy || image.isPrimary}
                                    onClick={() => void setPrimaryProductImage(product, image.id)}
                                    type="button"
                                  >
                                    {image.isPrimary ? 'الصورة الرئيسية' : 'تعيين رئيسية'}
                                  </button>
                                  <button
                                    className="plain-button plain-button--danger"
                                    disabled={busy}
                                    onClick={() => void deleteProductImage(product, image.id)}
                                    type="button"
                                  >
                                    حذف
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}

                        {product.lifecycle === 'DRAFT' ? (
                          <div className="catalog-draft-editor">
                            <h4>تعديل المسودة</h4>
                            <form
                              className="workflow-form workflow-form--compact"
                              onSubmit={(event) => updateCatalogDraft(event, product)}
                            >
                              <label>
                                الاسم
                                <input
                                  defaultValue={product.name}
                                  name="name"
                                  required
                                  minLength={2}
                                />
                              </label>
                              <label>
                                النوع
                                <select defaultValue={product.furnitureType} name="furnitureType">
                                  <option value="SOFA">كنبة</option>
                                  <option value="BED">سرير</option>
                                  <option value="DINING_TABLE">طاولة طعام</option>
                                  <option value="WARDROBE">دولاب</option>
                                  <option value="TV_UNIT">وحدة تلفاز</option>
                                  <option value="SHELF">مكتبة أو رف</option>
                                  <option value="DESK">مكتب</option>
                                  <option value="CHAIR">كرسي</option>
                                  <option value="OTHER">أخرى</option>
                                </select>
                              </label>
                              <label>
                                السعر الابتدائي (ر.س)
                                <input
                                  defaultValue={(product.startingAmountMinor / 100).toFixed(2)}
                                  min="0"
                                  name="startingPrice"
                                  required
                                  step="0.01"
                                  type="number"
                                />
                              </label>
                              <label className="workflow-form__full">
                                الوصف العربي
                                <textarea
                                  defaultValue={product.description}
                                  name="description"
                                  required
                                  minLength={10}
                                  rows={3}
                                />
                              </label>
                              <label className="workflow-form__full">
                                معلومات التنفيذ
                                <textarea
                                  defaultValue={product.productionInformation}
                                  name="productionInformation"
                                  rows={2}
                                />
                              </label>
                              <div className="workflow-actions">
                                <button
                                  className="button button--small"
                                  disabled={busy}
                                  type="submit"
                                >
                                  حفظ التعديل
                                </button>
                                <button
                                  className="button button--secondary button--small"
                                  disabled={busy}
                                  onClick={() => void publishCatalogDraft(product)}
                                  type="button"
                                >
                                  نشر التصميم
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : null}
                        {product.lifecycle === 'PUBLISHED' ? (
                          <div className="catalog-lifecycle-actions">
                            <h4>إزالة التصميم من المعرض</h4>
                            <p className="field-help">
                              الأرشفة تخفي التصميم عن العملاء وتحافظ على الطلبات والسجلات السابقة.
                            </p>
                            <button
                              className="plain-button plain-button--danger"
                              disabled={busy}
                              onClick={() => void archiveCatalogProduct(product)}
                              type="button"
                            >
                              أرشفة التصميم
                            </button>
                          </div>
                        ) : null}

                        {product.lifecycle === 'ARCHIVED' ? (
                          <div className="catalog-lifecycle-actions">
                            <h4>التصميم مؤرشف</h4>
                            <p className="field-help">
                              يمكنك إعادته إلى المعرض بنفس البيانات والصور.
                            </p>
                            <button
                              className="button button--secondary button--small"
                              disabled={busy}
                              onClick={() => void restoreCatalogProduct(product)}
                              type="button"
                            >
                              استعادة ونشر التصميم
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          aria-labelledby="manager-requests-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'requests'}
          id="manager-panel-requests"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">صندوق العمل</p>
              <h2 id="manager-requests-title">ما يحتاج إلى انتباهك</h2>
            </div>
            <span className="count-pill">{requests.length}</span>
          </div>
          <div className="manager-inbox-controls">
            <label className="manager-inbox-search">بحث<input type="search" value={requestSearch} onChange={(event) => setRequestSearch(event.currentTarget.value)} placeholder="العميل، الهاتف، المرجع..." /></label>
            <div className="saved-views">
              <button className={requestView === 'ACTION' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestView('ACTION')} type="button">يحتاج إجراء</button>
              <button className={requestView === 'WAITING' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestView('WAITING')} type="button">بانتظار العميل</button>
              <button className={requestView === 'CANCELLED' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestView('CANCELLED')} type="button">الملغاة</button>
              <button className={requestView === 'HISTORY' ? 'saved-view saved-view--active' : 'saved-view'} onClick={() => setRequestView('HISTORY')} type="button">السجل</button>
            </div>
          </div>
          <div className="manager-inbox-list">
            {inboxRequests.length === 0 ? (
              <p className="workspace-empty">لا توجد طلبات جديدة.</p>
            ) : (
              inboxRequests.map((request) => (
                <article className="workflow-card" key={request.id}>
                  <div className="workflow-card__heading">
                    <div>
                      <h3>{request.projectName}</h3>
                      <span>{request.customerLabel}{request.customerCity ? ` · ${request.customerCity}` : ''}{request.customerPhone ? ` · ${request.customerPhone}` : ''}</span>
                    </div>
                    <span className="status-badge">{stateLabel(request.state)}</span>
                  </div>
                  <p>{request.displayReference} · {request.requestType === 'CUSTOM_DESIGN' ? 'تصميم خاص' : 'منتج من الكتالوج'} · {formatDate(request.submittedAt)}</p>
                  <button
                    className="button button--secondary button--small"
                    disabled={busy}
                    onClick={() => openRequest(request.id)}
                    type="button"
                  >
                    مراجعة وتسعير
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          className="workspace-panel workspace-panel--wide"
          aria-labelledby="manager-orders-title"
          hidden={activeTab !== 'orders'}
          id="manager-panel-orders"
          role="tabpanel"
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التنفيذ</p>
              <h2 id="manager-orders-title">الطلبات الجارية</h2>
            </div>
            <span className="count-pill">{orders.length}</span>
          </div>
          <div className="workflow-stack">
            {orders.length === 0 ? (
              <p className="workspace-empty">لا توجد طلبات معتمدة.</p>
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
                    إدارة الطلب
                  </button>
                  {!['COMPLETED', 'CANCELLED'].includes(order.lifecycleState) ? (
                    <button className="plain-button plain-button--danger" onClick={() => setCancelTarget({ id: order.id, kind: 'ORDER', title: order.displayReference })} type="button">إلغاء الطلب</button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        {requestDetail ? (
          <section
            className="workspace-panel workspace-panel--full"
            aria-labelledby="request-detail-title"
            ref={requestDetailRef}
            tabIndex={-1}
          >
            <div className="workspace-panel__heading">
              <div>
                <p className="eyebrow">مراجعة الطلب</p>
                <h2 id="request-detail-title">
                  طلب {requestDetail.items[0]?.productName ?? 'تصميم مخصص'}
                </h2>
              </div>
              <button
                className="plain-button"
                onClick={() => setRequestDetail(undefined)}
                type="button"
              >
                إغلاق
              </button>
            </div>
            <div className="request-detail-summary">
              <span><small>المرجع</small>{requestDetail.displayReference}</span>
              <span><small>العميل</small>{requestDetail.customerLabel}</span>
              {requestDetail.customerPhone ? <span><small>الهاتف</small>{requestDetail.customerPhone}</span> : null}
              {requestDetail.customerCity ? <span><small>المدينة</small>{requestDetail.customerCity}</span> : null}
            </div>
            <p>{requestDetail.customerNotes || 'لا توجد ملاحظات عامة.'}</p>
            {requestDetail.requestType === 'CUSTOM_DESIGN' && requestDetail.customDesignFiles.length > 0 ? (
              <div className="custom-design-file-list">
                {requestDetail.customDesignFiles.map((file, index) => (
                  <a
                    className="custom-design-file"
                    href={typeof file.signedUrl === 'string' ? file.signedUrl : undefined}
                    key={`${String(file.objectKey)}-${index}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {typeof file.signedUrl === 'string' && String(file.mediaType ?? '').startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={String(file.displayName ?? `ملف ${index + 1}`)} src={file.signedUrl} />
                    ) : <span className="custom-design-file__icon">PDF</span>}
                    <strong>{String(file.displayName ?? `ملف ${index + 1}`)}</strong>
                    <small>فتح الملف</small>
                  </a>
                ))}
              </div>
            ) : null}
            {!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(requestDetail.state) ? (
              <button className="plain-button plain-button--danger" onClick={() => setCancelTarget({ id: requestDetail.id, kind: 'REQUEST', title: requestDetail.projectName })} type="button">إلغاء الطلب</button>
            ) : null}
            <form className="workflow-form" onSubmit={sendQuotation}>
              {requestDetail.items.map((item) => (
                <fieldset className="quote-line" key={item.id}>
                  <legend>
                    {item.sequence}. {item.productName}
                  </legend>
                  <p>{configurationText(item.configuration)}</p>
                  {item.customerNotes ? <p>ملاحظة العميل: {item.customerNotes}</p> : null}
                  <label>
                    سعر القطعة (ر.س)
                    <input min="0" name={`price-${item.id}`} required step="0.01" type="number" />
                  </label>
                </fieldset>
              ))}
              <label>
                تكلفة التوصيل (ر.س)
                <input
                  defaultValue="0"
                  min="0"
                  name="delivery"
                  required
                  step="0.01"
                  type="number"
                />
              </label>
              <label>
                طريقة الاستلام
                <select name="fulfilmentMethod">
                  <option value="PICKUP">استلام</option>
                  <option value="DELIVERY">توصيل</option>
                </select>
              </label>
              <label className="workflow-form__full">
                مدة التنفيذ المتوقعة
                <input
                  name="productionEstimateText"
                  placeholder="من 20 إلى 30 يوم عمل"
                  required
                  minLength={2}
                />
              </label>
              <fieldset className="workflow-form__full bank-fields">
                <legend>بيانات التحويل البنكي</legend>
                <p className="field-help">ستظهر هذه البيانات للعميل بعد قبول عرض السعر.</p>
                <label>
                  اسم البنك
                  <input name="bankName" required />
                </label>
                <label>
                  اسم صاحب الحساب
                  <input name="accountHolder" required />
                </label>
                <label>
                  رقم الحساب البنكي (RIB)
                  <input dir="ltr" name="rib" required />
                </label>
                <label>
                  IBAN (اختياري)
                  <input dir="ltr" name="iban" />
                </label>
                <label className="workflow-form__full">
                  تعليمات التحويل (اختياري)
                  <textarea name="transferInstructions" rows={2} />
                </label>
              </fieldset>
              <label className="workflow-form__full">
                ملاحظات المدير
                <textarea name="managerNotes" rows={3} />
              </label>
              <button className="button" disabled={busy} type="submit">
                {busy ? 'جاري إرسال عرض السعر...' : 'إرسال عرض السعر'}
              </button>
            </form>
          </section>
        ) : null}

        {orderDetail ? (
          <section
            aria-labelledby="manager-order-detail-title"
            className="workspace-panel workspace-panel--full"
            hidden={activeTab !== 'orders'}
            role="region"
          >
            <div className="workspace-panel__heading">
              <div>
                <p className="eyebrow">إدارة الطلب</p>
                <h2 id="manager-order-detail-title">{orderDetail.displayReference}</h2>
              </div>
              <button
                className="plain-button"
                onClick={() => setOrderDetail(undefined)}
                type="button"
              >
                إغلاق
              </button>
            </div>
            <div className="status-grid">
              <span>
                <small>الدفع</small>
                {stateLabel(orderDetail.paymentState)}
              </span>
              <span>
                <small>الإنتاج</small>
                {stateLabel(orderDetail.productionState)}
              </span>
              <span>
                <small>التسليم</small>
                {stateLabel(orderDetail.fulfilmentState)}
              </span>
            </div>

            <div className="decision-box">
              <h3>تفاصيل الاستلام</h3>
              {!orderDetail.fulfilmentDetailsConfirmedAt ? (
                <p>لم يؤكد العميل تفاصيل التوصيل أو الاستلام بعد.</p>
              ) : (
                <dl className="detail-list">
                  <div>
                    <dt>الطريقة</dt>
                    <dd>
                      {orderDetail.fulfilmentMethod === 'DELIVERY' ? 'توصيل' : 'استلام من الورشة'}
                    </dd>
                  </div>
                  <div>
                    <dt>الهاتف</dt>
                    <dd>{String(orderDetail.fulfilmentDetails.phoneNumber ?? '—')}</dd>
                  </div>
                  {orderDetail.fulfilmentMethod === 'DELIVERY' ? (
                    <>
                      <div>
                        <dt>المدينة</dt>
                        <dd>{String(orderDetail.fulfilmentDetails.city ?? '—')}</dd>
                      </div>
                      <div>
                        <dt>الحي</dt>
                        <dd>{String(orderDetail.fulfilmentDetails.district ?? '—')}</dd>
                      </div>
                      <div>
                        <dt>العنوان</dt>
                        <dd>{String(orderDetail.fulfilmentDetails.address ?? '—')}</dd>
                      </div>
                      {orderDetail.fulfilmentDetails.mapUrl ? (
                        <div>
                          <dt>الموقع</dt>
                          <dd>
                            <a
                              href={String(orderDetail.fulfilmentDetails.mapUrl)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              فتح الخريطة
                            </a>
                          </dd>
                        </div>
                      ) : null}
                      {orderDetail.fulfilmentDetails.deliveryNotes ? (
                        <div>
                          <dt>ملاحظات</dt>
                          <dd>{String(orderDetail.fulfilmentDetails.deliveryNotes)}</dd>
                        </div>
                      ) : null}
                    </>
                  ) : orderDetail.fulfilmentDetails.pickupNotes ? (
                    <div>
                      <dt>ملاحظات</dt>
                      <dd>{String(orderDetail.fulfilmentDetails.pickupNotes)}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>

            {orderDetail.paymentState === 'SUBMITTED' && latestSubmission ? (
              <div className="decision-box">
                <h3>مراجعة إثبات التحويل</h3>
                <p>
                  {latestSubmission.displayFilename} · {formatDate(latestSubmission.submittedAt)}
                </p>
                <div className="button-row">
                  <button
                    className="button button--small"
                    disabled={busy}
                    onClick={() => decidePayment('verify', latestSubmission.id)}
                    type="button"
                  >
                    تأكيد التحويل
                  </button>
                </div>
                <form
                  className="workflow-form workflow-form--compact"
                  onSubmit={(event) => rejectPayment(event, latestSubmission.id)}
                >
                  <label>
                    سبب الرفض الآمن
                    <input
                      name="safeReason"
                      placeholder="الصورة غير واضحة"
                      required
                      minLength={2}
                    />
                  </label>
                  <button
                    className="button button--secondary button--small"
                    disabled={busy}
                    type="submit"
                  >
                    رفض وطلب إثبات جديد
                  </button>
                </form>
              </div>
            ) : null}

            {nextState ? (
              <div className="decision-box">
                <h3>تقدم الإنتاج</h3>
                <p>الحالة الحالية: {stateLabel(orderDetail.productionState)}</p>
                <button
                  className="button button--small"
                  disabled={busy}
                  onClick={() => advanceProduction(orderDetail.id, nextState)}
                  type="button"
                >
                  نقل إلى {stateLabel(nextState)}
                </button>
              </div>
            ) : null}

            {orderDetail.productionState === 'READY' &&
            orderDetail.fulfilmentState !== 'COMPLETED' ? (
              <form
                className="workflow-form"
                onSubmit={(event) => completeOrder(event, orderDetail.id)}
              >
                <h3>تسجيل التسليم</h3>
                <p className="field-help">ارفع إثبات التسليم إلى التخزين الخاص ثم سجّل مفتاحه.</p>
                <label>
                  اسم الملف
                  <input name="proofDisplayFilename" placeholder="handoff.jpg" required />
                </label>
                <label>
                  نوع الملف
                  <select name="proofMediaType">
                    <option value="image/jpeg">JPG</option>
                    <option value="image/png">PNG</option>
                    <option value="application/pdf">PDF</option>
                  </select>
                </label>
                <label className="workflow-form__full">
                  مفتاح الملف الخاص
                  <input
                    name="proofObjectKey"
                    placeholder="private/handoff/..."
                    required
                    minLength={3}
                  />
                </label>
                <button className="button" disabled={busy} type="submit">
                  تأكيد التسليم وإكمال الطلب
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
          </section>
        ) : null}

        <section
          aria-labelledby="manager-messages-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'messages'}
          id="manager-panel-messages"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">التواصل</p>
              <h2 id="manager-messages-title">رسائل العميل</h2>
            </div>
          </div>
          {!messageCustomerId ? (
            <p className="workspace-empty">افتح طلبًا لاختيار العميل.</p>
          ) : (
            <>
              <div className="message-list">
                {messages.map((message) => (
                  <div
                    className={`message message--${message.senderKind.toLowerCase()}`}
                    key={message.id}
                  >
                    <strong>{message.senderKind === 'MANAGER' ? 'أنت' : 'العميل'}</strong>
                    <p>{message.body}</p>
                    <small>{formatDate(message.sentAt)}</small>
                  </div>
                ))}
              </div>
              <form className="workflow-form" onSubmit={sendMessage}>
                <label>
                  الرد
                  <textarea name="body" required rows={3} />
                </label>
                <button className="button button--small" disabled={busy} type="submit">
                  إرسال
                </button>
              </form>
            </>
          )}
        </section>

        <section
          aria-labelledby="manager-notifications-title"
          className="workspace-panel workspace-panel--full"
          hidden={activeTab !== 'notifications'}
          id="manager-panel-notifications"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="workspace-panel__heading">
            <div>
              <p className="eyebrow">المستجدات</p>
              <h2 id="manager-notifications-title">الإشعارات</h2>
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
          <section aria-labelledby="manager-cancel-title" aria-modal="true" className="cancel-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="cancel-dialog__icon" aria-hidden="true">!</div>
            <div><p className="eyebrow">إجراء حساس</p><h2 id="manager-cancel-title">إلغاء {cancelTarget.kind === 'ORDER' ? 'الطلب الجاري' : 'طلب التصميم'}</h2><p>سيتم تسجيل السبب وإبلاغ العميل مع الاحتفاظ بالسجل الكامل.</p></div>
            <form onSubmit={(event) => {
              if (cancelTarget.kind === 'ORDER') void cancelManagerOrder(event, cancelTarget.id);
              else void cancelManagerRequest(event, cancelTarget.id);
            }}>
              <fieldset className="cancel-reasons"><legend>اختر سببًا</legend>
                {['تعذر التنفيذ', 'معلومات غير مكتملة', 'مشكلة في الدفع', 'طلب العميل الإلغاء'].map((reason) => (<label key={reason}><input name="reason" required type="radio" value={reason} />{reason}</label>))}
                <label><input name="reason" required type="radio" value="سبب آخر" />سبب آخر</label>
              </fieldset>
              <label className="cancel-dialog__note">ملاحظة للعميل (اختياري)<textarea name="details" rows={3} placeholder="اكتب توضيحًا مختصرًا ومحترمًا." /></label>
              <div className="cancel-dialog__actions"><button className="button button--secondary" onClick={() => setCancelTarget(undefined)} type="button">رجوع</button><button className="button button--danger" disabled={busy} type="submit">تأكيد الإلغاء</button></div>
            </form>
          </section>
        </div>
      ) : null}

    </main>
  );
}

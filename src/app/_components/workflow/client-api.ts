export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

export async function apiRequest<Result>(path: string, init?: RequestInit): Promise<Result> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      code?: string;
      detail?: string;
    };
    throw new ApiFailure(
      problem.code ?? `HTTP_${response.status}`,
      problem.detail ?? 'تعذر إكمال العملية.',
    );
  }

  if (response.status === 204) return undefined as Result;
  return (await response.json()) as Result;
}

export function formatMoney(minor: number, currencyCode = 'SAR'): string {
  return new Intl.NumberFormat('ar-SA', {
    currency: currencyCode,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(minor / 100);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export const stateLabels: Readonly<Record<string, string>> = Object.freeze({
  ACCEPTED: 'مقبول',
  AWAITING_PAYMENT: 'بانتظار التحويل',
  AWAITING_SUBMISSION: 'بانتظار الإثبات',
  COMPLETED: 'مكتمل',
  DRAFT: 'مسودة',
  IN_PRODUCTION: 'قيد التنفيذ',
  MATERIALS_PREPARATION: 'تجهيز الخامات',
  NOT_STARTED: 'لم يبدأ',
  PAYMENT_UNDER_REVIEW: 'مراجعة التحويل',
  PAYMENT_VERIFIED: 'تم تأكيد التحويل',
  QUALITY_INSPECTION: 'فحص الجودة',
  QUOTED: 'تم إرسال عرض السعر',
  READY: 'جاهز',
  READY_FOR_HANDOFF: 'جاهز للتسليم',
  REJECTED: 'مرفوض',
  SENT: 'مرسل',
  SUBMITTED: 'مرسل للمراجعة',
  UNDER_REVIEW: 'قيد المراجعة',
  VERIFIED: 'مؤكد',
  WAITING_FOR_CUSTOMER_INFORMATION: 'بانتظار معلومات العميل',
  WAITING_FOR_PRODUCTION: 'بانتظار الإنتاج',
});

export function stateLabel(value: string): string {
  return stateLabels[value] ?? value;
}

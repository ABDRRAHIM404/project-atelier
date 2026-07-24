import 'server-only';

import { ZodError } from 'zod';

const statusByCode: Readonly<Record<string, number>> = Object.freeze({
  AUTHENTICATION_REQUIRED: 401,
  CATALOG_CATEGORY_MISSING: 409,
  CATALOG_PRODUCT_NOT_DRAFT: 409,
  CATALOG_TRANSLATION_NOT_DRAFT: 409,
  CUSTOMER_AUTHENTICATION_REQUIRED: 403,
  MANAGER_AUTHENTICATION_REQUIRED: 403,
  MANAGER_MFA_REQUIRED: 403,
  RESOURCE_NOT_FOUND: 404,
  PROJECT_NOT_EDITABLE: 409,
  PROJECT_REQUIRES_ITEM: 422,
  PRODUCT_NOT_AVAILABLE: 422,
  REQUEST_NOT_FOUND: 404,
  REQUEST_NOT_QUOTABLE: 409,
  QUOTATION_ALREADY_ACCEPTED: 409,
  QUOTATION_LINES_INCOMPLETE: 422,
  QUOTATION_NOT_ACCEPTABLE: 409,
  PAYMENT_ALREADY_VERIFIED: 409,
  PAYMENT_ATTEMPT_NOT_FOUND: 404,
  PAYMENT_ATTEMPT_NOT_PENDING: 409,
  PAYMENT_ATTEMPT_NOT_REUSABLE: 409,
  PAYMENT_NOT_PAYABLE: 409,
  PAYMENT_NOT_SUBMITTABLE: 409,
  PAYMENT_PROVIDER_EVENT_INVALID: 422,
  PAYMENT_PROVIDER_TRANSACTION_REQUIRED: 422,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  PAYMENT_WEBHOOK_DIGEST_CONFLICT: 409,
  PAYMENT_WEBHOOK_EVENT_CONFLICT: 409,
  PAYMENT_WEBHOOK_ORDER_MISMATCH: 409,
  PAYMENT_WEBHOOK_VERIFICATION_REQUIRED: 401,
  PAYMENT_SUBMISSION_NOT_FOUND: 404,
  PAYMENT_SUBMISSION_NOT_CURRENT: 409,
  PAYMENT_DECISION_CONFLICT: 409,
  PAYMENT_REJECTION_REASON_REQUIRED: 422,
  PAYMENT_PROOF_UNAVAILABLE: 404,
  PRIVATE_UPLOADS_NOT_READY: 503,
  PRODUCTION_TRANSITION_FORBIDDEN: 409,
  FULFILMENT_DETAILS_NOT_EDITABLE: 409,
  FULFILMENT_DETAILS_REQUIRED: 409,
  FULFILMENT_METHOD_CHANGE_REQUIRES_NEW_QUOTATION: 409,
  FULFILMENT_NOT_COMPLETABLE: 409,
  HANDOFF_PROOF_INVALID: 422,
  HANDOFF_PROOF_REQUIRED: 422,
  CUSTOM_DESIGN_FILES_REQUIRED: 422,
  CUSTOM_DESIGN_FILE_INVALID: 422,
  REQUEST_NOT_CANCELLABLE: 409,
  REQUEST_NOT_ARCHIVABLE: 409,
  ORDER_NOT_CANCELLABLE: 409,
  ORDER_NOT_ARCHIVABLE: 409,
  REQUEST_HAS_ORDER: 409,
  NOTIFICATION_NOT_FOUND: 404,
});

const detailByCode: Readonly<Record<string, string>> = Object.freeze({
  HANDOFF_PROOF_INVALID:
    'يجب أن يكون إثبات التسليم صورة JPG أو PNG أو ملف PDF بحجم لا يتجاوز 10 ميغابايت.',
  HANDOFF_PROOF_REQUIRED: 'اختر إثبات التسليم أولاً.',
  PAYMENT_PROOF_UNAVAILABLE: 'تعذر فتح إثبات التحويل.',
  PAYMENT_PROVIDER_UNAVAILABLE:
    'الدفع الإلكتروني غير متاح حالياً. سيظهر زر الدفع عند اكتمال الربط الآمن مع مزود الخدمة.',
  PAYMENT_NOT_PAYABLE: 'هذا الطلب غير متاح للدفع في حالته الحالية.',
  ORDER_NOT_ARCHIVABLE: 'يمكن نقل الطلبات الملغاة أو المكتملة فقط إلى السجل.',
  ORDER_NOT_CANCELLABLE: 'لا يمكن إلغاء هذا الطلب في حالته الحالية.',
  REQUEST_HAS_ORDER: 'تحول هذا الطلب إلى طلب مؤكد. استخدم إلغاء الطلب المؤكد بدلًا منه.',
  REQUEST_NOT_ARCHIVABLE: 'يمكن نقل الطلبات الملغاة أو المرفوضة أو المكتملة فقط إلى السجل.',
  REQUEST_NOT_CANCELLABLE: 'لا يمكن إلغاء طلب التصميم في حالته الحالية.',
});

function errorCode(error: unknown): string {
  if (error instanceof ZodError) return 'VALIDATION_FAILED';
  if (error instanceof Error && /^[A-Z][A-Z0-9_:.-]+$/u.test(error.message)) return error.message;
  return 'WORKFLOW_OPERATION_FAILED';
}

export function workflowProblem(error: unknown, request: Request): Response {
  const code = errorCode(error);
  const publicCode = code.startsWith('WORKFLOW_CONFIGURATION_MISSING:')
    ? 'WORKFLOW_CONFIGURATION_MISSING'
    : code;
  return Response.json(
    {
      code: publicCode,
      detail:
        detailByCode[publicCode] ??
        (publicCode === 'VALIDATION_FAILED'
          ? 'البيانات المدخلة غير مكتملة أو غير صحيحة.'
          : publicCode === 'AUTHENTICATION_REQUIRED'
            ? 'يلزم تسجيل الدخول لإكمال هذه العملية.'
            : 'تعذر إكمال العملية. راجع الحالة وحاول مرة أخرى.'),
      instance: new URL(request.url).pathname,
      title: 'تعذر إكمال الطلب',
      type: 'about:blank',
    },
    {
      headers: { 'Cache-Control': 'private, no-store' },
      status: statusByCode[publicCode] ?? (publicCode === 'VALIDATION_FAILED' ? 422 : 500),
    },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('VALIDATION_FAILED');
  return value as Record<string, unknown>;
}

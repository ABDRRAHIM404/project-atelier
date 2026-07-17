export const problemCodes = [
  'AUTHENTICATION_REQUIRED',
  'SESSION_INVALID',
  'AUTH_ASSURANCE_REQUIRED',
  'ACCOUNT_DISABLED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'MALFORMED_REQUEST',
  'VALIDATION_FAILED',
  'VERSION_PRECONDITION_REQUIRED',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
  'RATE_LIMITED',
  'INVALID_STATE_TRANSITION',
  'IMMUTABLE_RECORD',
  'PROJECT_ALREADY_SUBMITTED',
  'QUOTATION_REVISION_NOT_CURRENT',
  'QUOTATION_REVISION_NOT_ACTIONABLE',
  'ORDER_ALREADY_CREATED',
  'PAYMENT_PROOF_NOT_READY',
  'PAYMENT_ALREADY_VERIFIED',
  'PAYMENT_DECISION_EXISTS',
  'PRODUCTION_REQUIRES_VERIFIED_PAYMENT',
  'PRODUCTION_SEQUENCE_INVALID',
  'HANDOFF_PROOF_REQUIRED',
  'CONTENT_NOT_APPROVED',
  'LOCALE_NOT_AVAILABLE',
  'POLICY_ACTION_NOT_ENABLED',
  'UNSUPPORTED_MEDIA_TYPE',
  'FILE_TOO_LARGE',
  'FILE_INTEGRITY_MISMATCH',
  'FILE_SCAN_PENDING',
  'FILE_REJECTED',
  'FILE_QUARANTINED',
  'UPLOAD_CAPABILITY_EXPIRED',
  'IDENTITY_SERVICE_UNAVAILABLE',
  'DATA_SERVICE_UNAVAILABLE',
  'STORAGE_SERVICE_UNAVAILABLE',
  'DEPENDENCY_TIMEOUT',
  'DEPENDENCY_FAILURE',
  'INTERNAL_ERROR',
] as const;

export type ProblemCode = (typeof problemCodes)[number];

export type ProblemCatalogEntry = Readonly<{
  detailAr: string;
  idempotencyRequiredForRetry?: true;
  retryable: boolean;
  status: 400 | 401 | 403 | 404 | 409 | 412 | 413 | 415 | 422 | 428 | 429 | 500 | 502 | 503 | 504;
  titleAr: string;
}>;

const authenticationTitle = 'تعذر إكمال التحقق من الهوية';
const authorizationTitle = 'لا يمكن تنفيذ هذا الإجراء';
const requestTitle = 'تعذر قبول الطلب';
const conflictTitle = 'يتعارض الطلب مع الحالة الحالية';
const fileTitle = 'تعذر استخدام الملف';
const serviceTitle = 'الخدمة غير متاحة مؤقتاً';

export const problemCatalog = {
  AUTHENTICATION_REQUIRED: {
    detailAr: 'يرجى تسجيل الدخول للمتابعة.',
    retryable: false,
    status: 401,
    titleAr: authenticationTitle,
  },
  SESSION_INVALID: {
    detailAr: 'تعذر التحقق من جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.',
    retryable: false,
    status: 401,
    titleAr: authenticationTitle,
  },
  AUTH_ASSURANCE_REQUIRED: {
    detailAr: 'يتطلب هذا الإجراء تحققاً إضافياً من هوية المدير.',
    retryable: false,
    status: 403,
    titleAr: authorizationTitle,
  },
  ACCOUNT_DISABLED: {
    detailAr: 'هذا الحساب غير متاح حالياً.',
    retryable: false,
    status: 403,
    titleAr: authorizationTitle,
  },
  FORBIDDEN: {
    detailAr: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
    retryable: false,
    status: 403,
    titleAr: authorizationTitle,
  },
  RESOURCE_NOT_FOUND: {
    detailAr: 'تعذر العثور على المورد المطلوب.',
    retryable: false,
    status: 404,
    titleAr: 'المورد غير موجود',
  },
  MALFORMED_REQUEST: {
    detailAr: 'صيغة الطلب غير صحيحة.',
    retryable: false,
    status: 400,
    titleAr: requestTitle,
  },
  VALIDATION_FAILED: {
    detailAr: 'تحتاج بعض القيم إلى التصحيح قبل المتابعة.',
    retryable: false,
    status: 422,
    titleAr: requestTitle,
  },
  VERSION_PRECONDITION_REQUIRED: {
    detailAr: 'أعد تحميل البيانات ثم أرسل الطلب مع الإصدار الحالي.',
    retryable: false,
    status: 428,
    titleAr: conflictTitle,
  },
  VERSION_CONFLICT: {
    detailAr: 'تغيرت البيانات منذ تحميلها. راجع النسخة الحالية ثم أعد المحاولة.',
    retryable: false,
    status: 412,
    titleAr: conflictTitle,
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    detailAr: 'يفتقد الطلب إلى مفتاح التكرار الآمن المطلوب.',
    retryable: false,
    status: 400,
    titleAr: requestTitle,
  },
  IDEMPOTENCY_KEY_REUSED: {
    detailAr: 'استُخدم مفتاح التكرار الآمن سابقاً لطلب مختلف.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  IDEMPOTENCY_IN_PROGRESS: {
    detailAr: 'الطلب المطابق قيد التنفيذ حالياً.',
    retryable: true,
    status: 409,
    titleAr: conflictTitle,
  },
  RATE_LIMITED: {
    detailAr: 'تم إرسال طلبات كثيرة. انتظر قبل المحاولة مرة أخرى.',
    retryable: true,
    status: 429,
    titleAr: 'طلبات كثيرة',
  },
  INVALID_STATE_TRANSITION: {
    detailAr: 'لا يسمح الوضع الحالي بهذا الانتقال.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  IMMUTABLE_RECORD: {
    detailAr: 'لا يمكن تعديل هذا السجل التاريخي.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PROJECT_ALREADY_SUBMITTED: {
    detailAr: 'تم إرسال هذا المشروع ولا يمكن تعديل النسخة المرسلة.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  QUOTATION_REVISION_NOT_CURRENT: {
    detailAr: 'لا يمكن الرد إلا على نسخة عرض السعر الحالية.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  QUOTATION_REVISION_NOT_ACTIONABLE: {
    detailAr: 'نسخة عرض السعر هذه غير متاحة لاتخاذ إجراء.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  ORDER_ALREADY_CREATED: {
    detailAr: 'تم إنشاء الطلب لهذا القبول مسبقاً.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PAYMENT_PROOF_NOT_READY: {
    detailAr: 'إثبات التحويل غير جاهز للمراجعة بعد.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PAYMENT_ALREADY_VERIFIED: {
    detailAr: 'تم التحقق من الدفع لهذا الطلب مسبقاً.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PAYMENT_DECISION_EXISTS: {
    detailAr: 'تم تسجيل قرار لهذه المحاولة مسبقاً.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PRODUCTION_REQUIRES_VERIFIED_PAYMENT: {
    detailAr: 'لا يمكن بدء الإنتاج قبل التحقق اليدوي من الدفع.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  PRODUCTION_SEQUENCE_INVALID: {
    detailAr: 'خطوة الإنتاج المطلوبة لا تتبع التسلسل المسموح.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  HANDOFF_PROOF_REQUIRED: {
    detailAr: 'يلزم إثبات تسليم صالح لإكمال الطلب.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  CONTENT_NOT_APPROVED: {
    detailAr: 'لا يمكن نشر محتوى غير مكتمل أو غير معتمد.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  LOCALE_NOT_AVAILABLE: {
    detailAr: 'اللغة المطلوبة غير متاحة لهذا المحتوى.',
    retryable: false,
    status: 404,
    titleAr: 'اللغة غير متاحة',
  },
  POLICY_ACTION_NOT_ENABLED: {
    detailAr: 'هذا الإجراء غير مفعّل حالياً.',
    retryable: false,
    status: 409,
    titleAr: conflictTitle,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    detailAr: 'نوع الملف غير مدعوم لهذا الاستخدام.',
    retryable: false,
    status: 415,
    titleAr: fileTitle,
  },
  FILE_TOO_LARGE: {
    detailAr: 'حجم الملف يتجاوز الحد المسموح.',
    retryable: false,
    status: 413,
    titleAr: fileTitle,
  },
  FILE_INTEGRITY_MISMATCH: {
    detailAr: 'لا تتطابق بيانات الملف مع الرفع المتوقع.',
    retryable: false,
    status: 422,
    titleAr: fileTitle,
  },
  FILE_SCAN_PENDING: {
    detailAr: 'فحص الملف قيد التنفيذ.',
    retryable: true,
    status: 409,
    titleAr: fileTitle,
  },
  FILE_REJECTED: {
    detailAr: 'لم يجتز الملف التحقق المطلوب.',
    retryable: false,
    status: 422,
    titleAr: fileTitle,
  },
  FILE_QUARANTINED: {
    detailAr: 'الملف غير متاح للاستخدام.',
    retryable: false,
    status: 409,
    titleAr: fileTitle,
  },
  UPLOAD_CAPABILITY_EXPIRED: {
    detailAr: 'انتهت صلاحية إذن الرفع. أنشئ إذن رفع جديداً.',
    retryable: false,
    status: 409,
    titleAr: fileTitle,
  },
  IDENTITY_SERVICE_UNAVAILABLE: {
    detailAr: 'تعذر التحقق من الهوية حالياً. حاول لاحقاً.',
    retryable: true,
    status: 503,
    titleAr: serviceTitle,
  },
  DATA_SERVICE_UNAVAILABLE: {
    detailAr: 'تعذر الوصول إلى البيانات حالياً. حاول لاحقاً.',
    retryable: true,
    status: 503,
    titleAr: serviceTitle,
  },
  STORAGE_SERVICE_UNAVAILABLE: {
    detailAr: 'تعذر الوصول إلى خدمة الملفات حالياً. حاول لاحقاً.',
    retryable: true,
    status: 503,
    titleAr: serviceTitle,
  },
  DEPENDENCY_TIMEOUT: {
    detailAr: 'انتهت مهلة خدمة مطلوبة. حاول لاحقاً.',
    idempotencyRequiredForRetry: true,
    retryable: true,
    status: 504,
    titleAr: serviceTitle,
  },
  DEPENDENCY_FAILURE: {
    detailAr: 'تعذر إكمال طلب متزامن لدى خدمة مطلوبة.',
    idempotencyRequiredForRetry: true,
    retryable: true,
    status: 502,
    titleAr: serviceTitle,
  },
  INTERNAL_ERROR: {
    detailAr: 'حدث خطأ غير متوقع. استخدم رقم المتابعة عند طلب المساعدة.',
    retryable: false,
    status: 500,
    titleAr: 'خطأ غير متوقع',
  },
} as const satisfies Record<ProblemCode, ProblemCatalogEntry>;

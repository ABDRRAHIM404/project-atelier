import { z } from 'zod';

import type { Identifier, RecordVersion, UtcInstant } from '../kernel';
import {
  validationIssueCodes,
  type ValidationIssue,
  type ValidationIssueCode,
} from '../validation';
import { problemCatalog, problemCodes, type ProblemCode } from './catalog';

export type CorrelationId = Identifier<'Correlation'>;
export type ProblemMessagePart = 'detail' | 'title';

export interface ProblemTranslator {
  translateIssue(code: ValidationIssueCode): string | undefined;
  translateProblem(code: ProblemCode, part: ProblemMessagePart): string | undefined;
}

export type ProblemDescriptor = Readonly<{
  code: ProblemCode;
  currentVersion?: RecordVersion;
  idempotentRetryPermitted?: boolean;
  issues?: readonly ValidationIssue[];
  retryAfter?: number | UtcInstant;
}>;

const issueMessagesAr: Record<ValidationIssueCode, string> = {
  DOMAIN_RULE_FAILED: 'القيمة لا تحقق المتطلبات المطلوبة.',
  INVALID_FORMAT: 'تنسيق القيمة غير صحيح.',
  INVALID_TYPE: 'نوع القيمة غير صحيح.',
  INVALID_VALUE: 'القيمة غير صالحة.',
  OUT_OF_RANGE: 'القيمة خارج النطاق المسموح.',
  UNRECOGNIZED_FIELD: 'يحتوي الطلب على حقل غير مدعوم.',
};

function safelyTranslate(
  translator: ProblemTranslator | undefined,
  fallback: string,
  translate: (translator: ProblemTranslator) => string | undefined,
): string {
  if (!translator) {
    return fallback;
  }

  try {
    const translated = translate(translator)?.trim();
    return translated ? translated : fallback;
  } catch {
    return fallback;
  }
}

function safeInstancePath(instance: string): string {
  const path = instance.split(/[?#]/u, 1)[0] ?? '';

  return path.startsWith('/') && !/[\u0000-\u001f\u007f]/u.test(path) ? path : '/';
}

const fieldProblemSchema = z.strictObject({
  code: z.enum(validationIssueCodes),
  message: z.string().trim().min(1),
  pointer: z.string().refine((value) => value === '' || value.startsWith('/')),
});

export const problemDetailsSchema = z.strictObject({
  code: z.enum(problemCodes),
  correlationId: z.uuid(),
  currentVersion: z.number().int().positive().optional(),
  detail: z.string().trim().min(1),
  errors: z.array(fieldProblemSchema).optional(),
  instance: z.string().startsWith('/'),
  retryAfter: z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d{4}-\d{2}-\d{2}T/u)])
    .optional(),
  retryable: z.boolean(),
  status: z.number().int().min(400).max(599),
  title: z.string().trim().min(1),
  type: z.string().startsWith('urn:project-atelier:problem:'),
});

type ParsedProblemDetails = z.output<typeof problemDetailsSchema>;
type ParsedFieldProblem = NonNullable<ParsedProblemDetails['errors']>[number];

export type ProblemDetails = Readonly<
  Omit<ParsedProblemDetails, 'errors'> & {
    errors?: readonly Readonly<ParsedFieldProblem>[];
  }
>;

export function createProblemDetails(
  descriptor: ProblemDescriptor,
  context: Readonly<{
    correlationId: CorrelationId;
    instance: string;
    translator?: ProblemTranslator;
  }>,
): ProblemDetails {
  const catalogEntry = problemCatalog[descriptor.code];
  const retryable =
    catalogEntry.retryable &&
    (!('idempotencyRequiredForRetry' in catalogEntry) ||
      descriptor.idempotentRetryPermitted === true);
  const errors = descriptor.issues?.map((issue) => ({
    code: issue.code,
    message: safelyTranslate(context.translator, issueMessagesAr[issue.code], (translator) =>
      translator.translateIssue(issue.code),
    ),
    pointer: issue.pointer,
  }));

  return Object.freeze({
    code: descriptor.code,
    correlationId: context.correlationId,
    ...(descriptor.code === 'VERSION_CONFLICT' && descriptor.currentVersion
      ? { currentVersion: descriptor.currentVersion }
      : {}),
    detail: safelyTranslate(context.translator, catalogEntry.detailAr, (translator) =>
      translator.translateProblem(descriptor.code, 'detail'),
    ),
    ...(errors && errors.length > 0 ? { errors: Object.freeze(errors) } : {}),
    instance: safeInstancePath(context.instance),
    ...(retryable && descriptor.retryAfter !== undefined
      ? { retryAfter: descriptor.retryAfter }
      : {}),
    retryable,
    status: catalogEntry.status,
    title: safelyTranslate(context.translator, catalogEntry.titleAr, (translator) =>
      translator.translateProblem(descriptor.code, 'title'),
    ),
    type: `urn:project-atelier:problem:${descriptor.code.toLowerCase().replaceAll('_', '-')}`,
  });
}

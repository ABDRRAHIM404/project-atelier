import type { ResolvedActorContext, UtcInstant } from '../../../shared/kernel';
import { assertSafeCategory, type JsonPrimitive, UnsafeOperationalDataError } from './safe-json';

const AUDIT_NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,95}$/u;
const TARGET_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,63}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const auditMetadataKeys = [
  'attempt',
  'changed_fields',
  'config_code',
  'provider',
  'reason_code',
  'result_code',
  'schema',
  'state_from',
  'state_to',
] as const;

export type SafeAuditMetadata = Readonly<
  Partial<{
    attempt: number;
    changed_fields: readonly string[];
    config_code: string;
    provider: string;
    reason_code: string;
    result_code: string;
    schema: string;
    state_from: string;
    state_to: string;
  }>
>;

export type AuditOutcome = 'DENIED' | 'FAILED' | 'SUCCEEDED';

export type AuditEventInput = Readonly<{
  correlationId: string;
  eventType: string;
  metadata?: SafeAuditMetadata;
  occurredAt: UtcInstant;
  operation: string;
  outcome: AuditOutcome;
  requestId?: string;
  safeReasonCode?: string;
  stateAfter?: string;
  stateBefore?: string;
  targetId?: string;
  targetType: string;
}>;

export type AuditEventDraft = Readonly<{
  actorKind: Exclude<ResolvedActorContext['actor']['kind'], 'visitor'>;
  actorPrincipalId?: string;
  correlationId: string;
  eventType: string;
  metadata: SafeAuditMetadata;
  metadataSchemaVersion: 1;
  occurredAt: UtcInstant;
  operation: string;
  outcome: AuditOutcome;
  requestId?: string;
  safeReasonCode?: string;
  stateAfter?: string;
  stateBefore?: string;
  targetId?: string;
  targetType: string;
}>;

function assertUuid(candidate: string, field: string): void {
  if (!UUID_PATTERN.test(candidate)) {
    throw new UnsafeOperationalDataError(`${field} must be a canonical UUID.`);
  }
}

function validateMetadata(metadata: SafeAuditMetadata): SafeAuditMetadata {
  const allowed = new Set<string>(auditMetadataKeys);
  const normalized: Record<string, JsonPrimitive | readonly string[]> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key)) {
      throw new UnsafeOperationalDataError('Audit metadata contains a non-allowlisted field.');
    }

    if (key === 'attempt') {
      if (!Number.isSafeInteger(value) || Number(value) < 1) {
        throw new UnsafeOperationalDataError('Audit attempt must be a positive integer.');
      }
      normalized[key] = Number(value);
      continue;
    }

    if (key === 'changed_fields') {
      if (!Array.isArray(value) || value.length > 32) {
        throw new UnsafeOperationalDataError('Audit changed fields must be a bounded string list.');
      }
      for (const field of value) {
        if (typeof field !== 'string') {
          throw new UnsafeOperationalDataError('Audit changed fields must be safe categories.');
        }
        assertSafeCategory(field, 'changed field');
      }
      normalized[key] = Object.freeze([...value]);
      continue;
    }

    if (typeof value !== 'string') {
      throw new UnsafeOperationalDataError('Audit metadata values must use the approved shape.');
    }
    assertSafeCategory(value, key);
    normalized[key] = value;
  }

  const result = Object.freeze(normalized) as SafeAuditMetadata;
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 4_096) {
    throw new UnsafeOperationalDataError('Audit metadata exceeds its safe size limit.');
  }
  return result;
}

export function createAuditEventDraft(
  actorContext: ResolvedActorContext,
  input: AuditEventInput,
): AuditEventDraft {
  if (actorContext.actor.kind === 'visitor') {
    throw new UnsafeOperationalDataError('Anonymous visitors cannot create business Audit Events.');
  }
  if (!AUDIT_NAME_PATTERN.test(input.eventType) || !AUDIT_NAME_PATTERN.test(input.operation)) {
    throw new UnsafeOperationalDataError('Audit event names must use stable uppercase codes.');
  }
  if (!TARGET_TYPE_PATTERN.test(input.targetType)) {
    throw new UnsafeOperationalDataError('Audit target type is invalid.');
  }

  assertUuid(input.correlationId, 'correlationId');
  if (input.requestId) assertUuid(input.requestId, 'requestId');
  if (input.targetId) assertUuid(input.targetId, 'targetId');
  if (input.safeReasonCode) assertSafeCategory(input.safeReasonCode, 'safeReasonCode');
  if (input.stateBefore) assertSafeCategory(input.stateBefore, 'stateBefore');
  if (input.stateAfter) assertSafeCategory(input.stateAfter, 'stateAfter');

  const principalId =
    actorContext.actor.kind === 'customer' || actorContext.actor.kind === 'manager'
      ? actorContext.actor.principalId
      : undefined;

  return Object.freeze({
    actorKind: actorContext.actor.kind,
    ...(principalId ? { actorPrincipalId: principalId } : {}),
    correlationId: input.correlationId,
    eventType: input.eventType,
    metadata: validateMetadata(input.metadata ?? {}),
    metadataSchemaVersion: 1,
    occurredAt: input.occurredAt,
    operation: input.operation,
    outcome: input.outcome,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.safeReasonCode ? { safeReasonCode: input.safeReasonCode } : {}),
    ...(input.stateAfter ? { stateAfter: input.stateAfter } : {}),
    ...(input.stateBefore ? { stateBefore: input.stateBefore } : {}),
    ...(input.targetId ? { targetId: input.targetId } : {}),
    targetType: input.targetType,
  });
}

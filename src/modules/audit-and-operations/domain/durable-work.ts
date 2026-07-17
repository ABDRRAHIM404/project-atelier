import type { UtcInstant } from '../../../shared/kernel';
import {
  assertSafeCategory,
  assertSafeOperationalPayload,
  type JsonValue,
  UnsafeOperationalDataError,
} from './safe-json';

const EVENT_NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,95}$/u;
const PROVIDER_PATTERN = /^[a-z][a-z0-9_]{1,31}$/u;
const MAX_POSTGRES_INTEGER = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type OperationalPayload = Readonly<{ [key: string]: JsonValue }>;

export type OutboxEventInput = Readonly<{
  aggregateId: string;
  aggregateType: string;
  availableAt: UtcInstant;
  correlationId: string;
  dedupeKey: string;
  eventSchemaVersion: number;
  eventType: string;
  payload: OperationalPayload;
  payloadSchemaVersion: number;
}>;

export type OutboxEvent = OutboxEventInput &
  Readonly<{
    attemptCount: number;
    id: string;
    state: 'COMPLETED' | 'DEAD' | 'LEASED' | 'PENDING';
  }>;

export type OutboxLease = Readonly<{
  event: OutboxEvent;
  leaseExpiresAt: UtcInstant;
  leaseToken: string;
}>;

export type Job = Readonly<{
  attemptCount: number;
  dedupeKey: string;
  handlerType: string;
  handlerVersion: number;
  id: string;
  maxAttempts: number;
  payload: OperationalPayload;
  payloadSchemaVersion: number;
  sourceOutboxEventId?: string;
}>;

export type JobInput = Readonly<{
  dedupeKey: string;
  handlerType: string;
  handlerVersion: number;
  maxAttempts: number;
  nextEligibleAt: UtcInstant;
  payload: OperationalPayload;
  payloadSchemaVersion: number;
  sourceOutboxEventId?: string;
}>;

export type JobLease = Readonly<{
  job: Job;
  leaseExpiresAt: UtcInstant;
  leaseToken: string;
  startedAt: UtcInstant;
}>;

export type ProviderEventInput = Readonly<{
  correlationId: string;
  eventType: string;
  payloadDigest: string;
  provider: string;
  providerEventId: string;
  providerOccurredAt?: UtcInstant;
  receivedAt: UtcInstant;
  semanticKey?: string;
  signatureVerified: true;
}>;

export type ProviderEventRegistration =
  | Readonly<{ id: string; kind: 'accepted' }>
  | Readonly<{ id: string; kind: 'duplicate' }>
  | Readonly<{ id: string; kind: 'semantic_duplicate' }>
  | Readonly<{ kind: 'digest_conflict' }>;

export type ProviderEventDecision = Readonly<{
  outcome: 'FAILED_FINAL' | 'FAILED_RETRYABLE' | 'IGNORED' | 'PROCESSED';
  safeResultCode: string;
}>;

function assertUuid(candidate: string, field: string): void {
  if (!UUID_PATTERN.test(candidate)) {
    throw new UnsafeOperationalDataError(`${field} must be a canonical UUID.`);
  }
}

function assertPositiveVersion(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_POSTGRES_INTEGER) {
    throw new UnsafeOperationalDataError(`${field} must be a positive version.`);
  }
}

export function validateOutboxEvent(input: OutboxEventInput): OutboxEventInput {
  if (!EVENT_NAME_PATTERN.test(input.eventType)) {
    throw new UnsafeOperationalDataError('Outbox event type must be a stable uppercase code.');
  }
  assertSafeCategory(input.aggregateType, 'aggregateType');
  assertUuid(input.aggregateId, 'aggregateId');
  assertUuid(input.correlationId, 'correlationId');
  if (input.dedupeKey.length < 1 || input.dedupeKey.length > 180) {
    throw new UnsafeOperationalDataError('Outbox dedupe key length is invalid.');
  }
  assertPositiveVersion(input.eventSchemaVersion, 'eventSchemaVersion');
  assertPositiveVersion(input.payloadSchemaVersion, 'payloadSchemaVersion');
  assertSafeOperationalPayload(input.payload);
  return Object.freeze({ ...input, payload: Object.freeze({ ...input.payload }) });
}

export function validateJob(input: JobInput): JobInput {
  assertSafeCategory(input.handlerType, 'handlerType');
  if (input.handlerType.length > 96) {
    throw new UnsafeOperationalDataError('Job handler type is too long.');
  }
  if (input.dedupeKey.length < 1 || input.dedupeKey.length > 180) {
    throw new UnsafeOperationalDataError('Job dedupe key length is invalid.');
  }
  assertPositiveVersion(input.handlerVersion, 'handlerVersion');
  assertPositiveVersion(input.payloadSchemaVersion, 'payloadSchemaVersion');
  assertPositiveVersion(input.maxAttempts, 'maxAttempts');
  if (input.sourceOutboxEventId) assertUuid(input.sourceOutboxEventId, 'sourceOutboxEventId');
  assertSafeOperationalPayload(input.payload);
  return Object.freeze({ ...input, payload: Object.freeze({ ...input.payload }) });
}

export function validateProviderEvent(input: ProviderEventInput): ProviderEventInput {
  if (!PROVIDER_PATTERN.test(input.provider)) {
    throw new UnsafeOperationalDataError('Provider must use its stable lowercase code.');
  }
  if (input.signatureVerified !== true) {
    throw new UnsafeOperationalDataError('Unverified provider events cannot be persisted.');
  }
  if (input.providerEventId.length < 1 || input.providerEventId.length > 255) {
    throw new UnsafeOperationalDataError('Provider event ID length is invalid.');
  }
  if (input.eventType.length < 1 || input.eventType.length > 128) {
    throw new UnsafeOperationalDataError('Provider event type length is invalid.');
  }
  if (!/^[a-f0-9]{64}$/u.test(input.payloadDigest)) {
    throw new UnsafeOperationalDataError('Provider payload digest is invalid.');
  }
  if (input.semanticKey && input.semanticKey.length > 180) {
    throw new UnsafeOperationalDataError('Provider semantic key is too long.');
  }
  assertUuid(input.correlationId, 'correlationId');
  return Object.freeze({ ...input });
}

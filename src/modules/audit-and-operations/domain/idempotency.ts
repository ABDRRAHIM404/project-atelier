import { createHash, randomUUID } from 'node:crypto';

import type { ResolvedActorContext, UtcInstant } from '../../../shared/kernel';
import { canonicalJson, type JsonValue, UnsafeOperationalDataError } from './safe-json';

const API_VERSION_PATTERN = /^v[1-9][0-9]*$/u;
const SAFE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,95}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type IdempotencyScope = Readonly<{
  actorKind: Exclude<ResolvedActorContext['actor']['kind'], 'visitor'>;
  principalId?: string;
}>;

export type IdempotencyCommand = Readonly<{
  apiVersion: string;
  idempotencyKey: string;
  operation: string;
  requestDigest: string;
  scope: IdempotencyScope;
  targetId?: string;
  targetType: string;
}>;

export type IdempotencyLease = Readonly<{
  id: string;
  leaseExpiresAt: UtcInstant;
  leaseToken: string;
}>;

export type IdempotencyReplay = Readonly<{
  resourceId?: string;
  resourceType?: string;
  responseCode?: string;
  responseStatus: number;
  status: 'FAILED_FINAL' | 'SUCCEEDED';
}>;

export type IdempotencyClaim =
  | Readonly<{ kind: 'acquired'; lease: IdempotencyLease }>
  | Readonly<{ kind: 'conflict' }>
  | Readonly<{ kind: 'in_progress'; retryAfter: UtcInstant }>
  | Readonly<{ kind: 'replay'; result: IdempotencyReplay }>;

export function canonicalRequestDigest(value: JsonValue): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function createIdempotencyScope(context: ResolvedActorContext): IdempotencyScope {
  if (context.actor.kind === 'visitor') {
    throw new UnsafeOperationalDataError('Anonymous commands cannot acquire idempotency records.');
  }

  const principalId =
    context.actor.kind === 'customer' || context.actor.kind === 'manager'
      ? context.actor.principalId
      : undefined;
  return Object.freeze({
    actorKind: context.actor.kind,
    ...(principalId ? { principalId } : {}),
  });
}

export function createIdempotencyCommand(
  context: ResolvedActorContext,
  input: Readonly<{
    apiVersion: string;
    idempotencyKey: string;
    operation: string;
    request: JsonValue;
    targetId?: string;
    targetType: string;
  }>,
): IdempotencyCommand {
  if (!API_VERSION_PATTERN.test(input.apiVersion)) {
    throw new UnsafeOperationalDataError('Idempotency API version is invalid.');
  }
  if (!SAFE_NAME_PATTERN.test(input.operation) || !SAFE_NAME_PATTERN.test(input.targetType)) {
    throw new UnsafeOperationalDataError('Idempotency operation or target type is invalid.');
  }
  if (input.targetType.length > 64) {
    throw new UnsafeOperationalDataError('Idempotency target type is too long.');
  }
  if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128) {
    throw new UnsafeOperationalDataError('Idempotency key length is invalid.');
  }
  if (input.targetId && !UUID_PATTERN.test(input.targetId)) {
    throw new UnsafeOperationalDataError('Idempotency target ID must be a canonical UUID.');
  }

  return Object.freeze({
    apiVersion: input.apiVersion,
    idempotencyKey: input.idempotencyKey,
    operation: input.operation,
    requestDigest: canonicalRequestDigest(input.request),
    scope: createIdempotencyScope(context),
    ...(input.targetId ? { targetId: input.targetId } : {}),
    targetType: input.targetType,
  });
}

export function newLeaseToken(): string {
  return randomUUID();
}

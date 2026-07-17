import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  canonicalRequestDigest,
  createAuditEventDraft,
  createIdempotencyCommand,
  validateJob,
  validateOutboxEvent,
  UnsafeOperationalDataError,
} from '../../src/modules/audit-and-operations';
import {
  parseIdentifier,
  parseUtcInstant,
  type ResolvedActorContext,
} from '../../src/shared/kernel';

function instant(value: string) {
  const result = parseUtcInstant(value);
  if (!result.ok) throw new Error('Test timestamp is invalid.');
  return result.value;
}

function principal(value: string) {
  const result = parseIdentifier<'Principal'>(value);
  if (!result.ok) throw new Error('Test principal is invalid.');
  return result.value;
}

const manager = Object.freeze({
  actor: Object.freeze({
    kind: 'manager',
    principalId: principal('40000000-0000-4000-8000-000000000001'),
  }),
  assurance: 'manager_mfa',
}) satisfies ResolvedActorContext;

describe('Audit and Operations domain contracts', () => {
  it('derives the Audit actor from trusted context and accepts only allowlisted safe metadata', () => {
    const draft = createAuditEventDraft(manager, {
      correlationId: randomUUID(),
      eventType: 'CONFIG_ACTIVATED',
      metadata: {
        changed_fields: ['lifecycle', 'effective_from'],
        config_code: 'CFG-007',
      },
      occurredAt: instant('2026-07-16T10:00:00.000Z'),
      operation: 'ACTIVATE_CONFIG',
      outcome: 'SUCCEEDED',
      stateAfter: 'ACTIVE',
      stateBefore: 'DRAFT',
      targetId: randomUUID(),
      targetType: 'ConfigurationRevision',
    });

    expect(draft.actorKind).toBe('manager');
    expect(draft.actorPrincipalId).toBe(manager.actor.principalId);
    expect(draft.metadata).toEqual({
      changed_fields: ['lifecycle', 'effective_from'],
      config_code: 'CFG-007',
    });
  });

  it('rejects anonymous Audit Events and sensitive or uncontrolled metadata', () => {
    const visitor = Object.freeze({
      actor: Object.freeze({ kind: 'visitor' }),
      assurance: 'anonymous',
    }) satisfies ResolvedActorContext;

    expect(() =>
      createAuditEventDraft(visitor, {
        correlationId: randomUUID(),
        eventType: 'ACCESS_DENIED',
        occurredAt: instant('2026-07-16T10:00:00.000Z'),
        operation: 'READ_ORDER',
        outcome: 'DENIED',
        targetType: 'Order',
      }),
    ).toThrow(UnsafeOperationalDataError);

    expect(() =>
      createAuditEventDraft(manager, {
        correlationId: randomUUID(),
        eventType: 'ACCESS_DENIED',
        metadata: { provider: 'Bearer secret value' },
        occurredAt: instant('2026-07-16T10:00:00.000Z'),
        operation: 'READ_ORDER',
        outcome: 'DENIED',
        targetType: 'Order',
      }),
    ).toThrow(UnsafeOperationalDataError);
  });

  it('creates a canonical request digest independent of object key order', () => {
    expect(canonicalRequestDigest({ a: 1, nested: { left: true, right: 'x' }, z: 2 })).toBe(
      canonicalRequestDigest({ z: 2, nested: { right: 'x', left: true }, a: 1 }),
    );
    expect(canonicalRequestDigest({ items: ['a', 'b'] })).not.toBe(
      canonicalRequestDigest({ items: ['b', 'a'] }),
    );
  });

  it('scopes idempotency to the actor, API operation, target and exact request semantics', () => {
    const targetId = randomUUID();
    const command = createIdempotencyCommand(manager, {
      apiVersion: 'v1',
      idempotencyKey: 'manager-command-0001',
      operation: 'ACTIVATE_CONFIG',
      request: { revisionId: targetId },
      targetId,
      targetType: 'ConfigurationRevision',
    });

    expect(command.scope).toEqual({
      actorKind: 'manager',
      principalId: manager.actor.principalId,
    });
    expect(command.requestDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects sensitive durable payload fields and requires explicit retry/attempt configuration', () => {
    const base = {
      aggregateId: randomUUID(),
      aggregateType: 'ConfigurationRevision',
      availableAt: instant('2026-07-16T10:00:00.000Z'),
      correlationId: randomUUID(),
      dedupeKey: 'config-revision:1:activated',
      eventSchemaVersion: 1,
      eventType: 'CONFIG_ACTIVATED',
      payloadSchemaVersion: 1,
    } as const;

    expect(() => validateOutboxEvent({ ...base, payload: { authToken: 'secret' } })).toThrow(
      UnsafeOperationalDataError,
    );
    expect(
      validateJob({
        dedupeKey: 'notification:1',
        handlerType: 'notification_delivery',
        handlerVersion: 1,
        maxAttempts: 3,
        nextEligibleAt: instant('2026-07-16T10:00:00.000Z'),
        payload: { notificationId: randomUUID() },
        payloadSchemaVersion: 1,
      }),
    ).toMatchObject({ maxAttempts: 3 });
  });
});

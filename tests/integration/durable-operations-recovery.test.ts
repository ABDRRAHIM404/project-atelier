import { describe, expect, it, vi } from 'vitest';

import {
  DurableDispatcher,
  ReconciliationAuthenticationError,
  type DurableFailurePolicy,
  type DurableWorkLeaseStore,
  type JobLease,
  type OutboxLease,
} from '../../src/modules/audit-and-operations';
import { parseUtcInstant, type ResolvedActorContext } from '../../src/shared/kernel';

function instant(value: string) {
  const result = parseUtcInstant(value);
  if (!result.ok) throw new Error('Test timestamp is invalid.');
  return result.value;
}

const now = instant('2026-07-16T10:00:00.000Z');
const retryAt = instant('2026-07-16T10:05:00.000Z');
const leaseExpiresAt = instant('2026-07-16T10:01:00.000Z');

function storeWith(overrides: Partial<DurableWorkLeaseStore> = {}): DurableWorkLeaseStore {
  return {
    claimJobs: vi.fn(async () => []),
    claimOutbox: vi.fn(async () => []),
    completeJob: vi.fn(async () => true),
    completeOutbox: vi.fn(async () => true),
    recoverJob: vi.fn(async () => true),
    recoverOutbox: vi.fn(async () => true),
    ...overrides,
  };
}

const failurePolicy: DurableFailurePolicy = {
  fromException: () => ({ kind: 'retry', nextEligibleAt: retryAt, safeErrorCode: 'TRANSIENT' }),
};

const outboxLease = Object.freeze({
  event: Object.freeze({
    aggregateId: '10000000-0000-4000-8000-000000000001',
    aggregateType: 'Order',
    attemptCount: 1,
    availableAt: now,
    correlationId: '20000000-0000-4000-8000-000000000001',
    dedupeKey: 'order:1:accepted',
    eventSchemaVersion: 1,
    eventType: 'ORDER_ACCEPTED',
    id: '30000000-0000-4000-8000-000000000001',
    payload: Object.freeze({ orderId: '10000000-0000-4000-8000-000000000001' }),
    payloadSchemaVersion: 1,
    state: 'LEASED',
  }),
  leaseExpiresAt,
  leaseToken: '40000000-0000-4000-8000-000000000001',
}) satisfies OutboxLease;

const jobLease = Object.freeze({
  job: Object.freeze({
    attemptCount: 2,
    dedupeKey: 'email:1',
    handlerType: 'email',
    handlerVersion: 1,
    id: '50000000-0000-4000-8000-000000000001',
    maxAttempts: 2,
    payload: Object.freeze({ deliveryId: '60000000-0000-4000-8000-000000000001' }),
    payloadSchemaVersion: 1,
  }),
  leaseExpiresAt,
  leaseToken: '70000000-0000-4000-8000-000000000001',
  startedAt: now,
}) satisfies JobLease;

describe('Durable dispatcher integration contract', () => {
  it('converts exceptions into explicit retry work without relying on an in-memory timer', async () => {
    const recoverOutbox = vi.fn(async () => true);
    const store = storeWith({
      claimOutbox: vi.fn(async () => [outboxLease]),
      recoverOutbox,
    });
    const dispatcher = new DurableDispatcher(
      store,
      { handle: vi.fn(async () => Promise.reject(new Error('provider timeout'))) },
      [],
      failurePolicy,
      { now: () => now },
    );

    await expect(dispatcher.dispatchOutbox({ leaseExpiresAt, limit: 1, now })).resolves.toEqual({
      completed: 0,
      dead: 0,
      leaseLost: 0,
      retried: 1,
    });
    expect(recoverOutbox).toHaveBeenCalledWith(
      outboxLease,
      { kind: 'retry', nextEligibleAt: retryAt, safeErrorCode: 'TRANSIENT' },
      now,
    );
  });

  it('makes poison and exhausted work terminal and visible', async () => {
    const recoverJob = vi.fn(async () => true);
    const store = storeWith({ claimJobs: vi.fn(async () => [jobLease]), recoverJob });
    const dispatcher = new DurableDispatcher(
      store,
      { handle: vi.fn(async () => Object.freeze({ kind: 'completed' as const })) },
      [
        {
          canHandle: () => true,
          handle: vi.fn(async () =>
            Object.freeze({
              kind: 'retry' as const,
              nextEligibleAt: retryAt,
              safeErrorCode: 'PROVIDER_TIMEOUT',
            }),
          ),
        },
      ],
      failurePolicy,
      { now: () => now },
    );

    await expect(dispatcher.dispatchJobs({ leaseExpiresAt, limit: 1, now })).resolves.toEqual({
      completed: 0,
      dead: 1,
      leaseLost: 0,
      retried: 0,
    });
    expect(recoverJob).toHaveBeenCalledWith(
      jobLease,
      { kind: 'dead', safeErrorCode: 'PROVIDER_TIMEOUT' },
      now,
    );
  });

  it('fails reconciliation closed unless a trusted system or operator context is verified', async () => {
    const dispatcher = new DurableDispatcher(
      storeWith(),
      { handle: vi.fn(async () => Object.freeze({ kind: 'completed' as const })) },
      [],
      failurePolicy,
      { now: () => now },
    );
    const request = {
      credential: 'opaque-test-credential',
      job: { leaseExpiresAt, limit: 1, now },
      outbox: { leaseExpiresAt, limit: 1, now },
    };

    await expect(
      dispatcher.reconcile(request, { verify: vi.fn(async () => null) }),
    ).rejects.toBeInstanceOf(ReconciliationAuthenticationError);

    const systemContext = Object.freeze({
      actor: Object.freeze({ kind: 'system_job' }),
      assurance: 'system_job',
    }) satisfies ResolvedActorContext;
    await expect(
      dispatcher.reconcile(request, { verify: vi.fn(async () => systemContext) }),
    ).resolves.toEqual({
      jobs: { completed: 0, dead: 0, leaseLost: 0, retried: 0 },
      outbox: { completed: 0, dead: 0, leaseLost: 0, retried: 0 },
    });
  });
});

import { createHash, randomUUID } from 'node:crypto';

import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AuditRecorder,
  DurableDispatcher,
  DurableEventRecorder,
  IdempotencyService,
  ProviderEventService,
  type DurableFailurePolicy,
} from '../../src/modules/audit-and-operations';
import {
  DurableDedupeConflictError,
  PostgresAuditAndOperationsRepository,
  PostgresDurableWorkLeaseStore,
} from '../../src/modules/audit-and-operations/infrastructure/postgres/repositories';
import { createDatabasePool, withActorTransaction } from '../../src/platform/database';
import { parseUtcInstant } from '../../src/shared/kernel';
import { p1ActorContexts, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

function instant(value: string) {
  const result = parseUtcInstant(value);
  if (!result.ok) throw new Error('Test timestamp is invalid.');
  return result.value;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const t0 = instant('2026-07-16T10:00:00.000Z');
const t1 = instant('2026-07-16T10:01:00.000Z');
const t2 = instant('2026-07-16T10:02:00.000Z');
const t3 = instant('2026-07-16T10:03:00.000Z');

describe('P1 Audit and Operations PostgreSQL contracts', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  const repository = new PostgresAuditAndOperationsRepository();
  const audit = new AuditRecorder(repository);
  const durable = new DurableEventRecorder(repository, repository);
  const idempotency = new IdempotencyService(repository);
  const providerEvents = new ProviderEventService(repository);

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('audit_operations');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = createDatabasePool({
      applicationName: 'atelier-p1-audit-operations-test',
      connectionString: database.connectionString,
      maxConnections: 8,
    });
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('persists safe actor-attributed Audit Events and rejects mutation or unsafe metadata', async () => {
    const correlationId = randomUUID();
    const created = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      async (transaction) =>
        audit.record(transaction, {
          correlationId,
          eventType: 'MANAGER_ACTION_TESTED',
          metadata: { changed_fields: ['lifecycle'], reason_code: 'TEST_APPROVED' },
          occurredAt: t0,
          operation: 'TEST_MANAGER_ACTION',
          outcome: 'SUCCEEDED',
          stateAfter: 'ACTIVE',
          stateBefore: 'DRAFT',
          targetId: randomUUID(),
          targetType: 'ConfigurationRevision',
        }),
    );

    const persisted = await owner.query<{
      actor_kind: string;
      actor_principal_id: string;
      correlation_id: string;
    }>('select actor_kind, actor_principal_id, correlation_id from audit.events where id = $1', [
      created.id,
    ]);
    expect(persisted.rows[0]).toMatchObject({
      actor_kind: 'manager',
      actor_principal_id: p1ActorContexts.managerMfa.actor.principalId,
      correlation_id: correlationId,
    });

    await expect(
      owner.query('update audit.events set outcome = $2 where id = $1', [created.id, 'FAILED']),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      owner.query('delete from audit.events where id = $1', [created.id]),
    ).rejects.toMatchObject({
      code: '55000',
    });

    await expect(
      owner.query(
        `insert into audit.events (
           event_type, actor_kind, actor_principal_id, target_type, operation, outcome,
           correlation_id, metadata_json
         ) values ('UNSAFE_EVENT_TESTED', 'manager', $1, 'AuditEvent', 'TEST_UNSAFE_EVENT',
                   'FAILED', $2, '{"token":"secret"}'::jsonb)`,
        [p1ActorContexts.managerMfa.actor.principalId, correlationId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('keeps audit and outbox intent atomic with the authoritative transaction', async () => {
    const atomicIdempotencyKey = `atomic-${randomUUID()}`;
    const atomicCommand = idempotency.command(p1ActorContexts.managerMfa, {
      apiVersion: 'v1',
      idempotencyKey: atomicIdempotencyKey,
      operation: 'TEST_ATOMIC_ROLLBACK',
      request: { test: 'rollback' },
      targetType: 'ConfigurationRevision',
    });
    const before = await owner.query<{ count: string }>(
      `select count(*) from audit.events where event_type = 'ATOMIC_ROLLBACK_TESTED'`,
    );

    await expect(
      withActorTransaction(pool, p1ActorContexts.managerMfa, async (transaction) => {
        const claim = await idempotency.claim(transaction, atomicCommand, {
          leaseExpiresAt: t2,
          now: t0,
        });
        if (claim.kind !== 'acquired') throw new Error('Expected atomic idempotency lease.');
        await audit.record(transaction, {
          correlationId: randomUUID(),
          eventType: 'ATOMIC_ROLLBACK_TESTED',
          occurredAt: t0,
          operation: 'TEST_ATOMIC_ROLLBACK',
          outcome: 'SUCCEEDED',
          targetType: 'ConfigurationRevision',
        });
        await durable.recordOutbox(transaction, {
          aggregateId: randomUUID(),
          aggregateType: 'ConfigurationRevision',
          availableAt: t0,
          correlationId: randomUUID(),
          dedupeKey: `rollback:${randomUUID()}`,
          eventSchemaVersion: 1,
          eventType: 'ATOMIC_ROLLBACK_TESTED',
          payload: { revisionId: randomUUID() },
          payloadSchemaVersion: 1,
        });
        await idempotency.complete(
          transaction,
          claim.lease,
          { responseStatus: 200, status: 'SUCCEEDED' },
          t1,
        );
        throw new Error('injected rollback');
      }),
    ).rejects.toThrow('injected rollback');

    const after = await owner.query<{ count: string }>(
      `select count(*) from audit.events where event_type = 'ATOMIC_ROLLBACK_TESTED'`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    const outbox = await owner.query<{ count: string }>(
      `select count(*) from ops.outbox_events where event_type = 'ATOMIC_ROLLBACK_TESTED'`,
    );
    expect(outbox.rows[0]?.count).toBe('0');
    const idempotencyRows = await owner.query<{ count: string }>(
      'select count(*) from ops.idempotency_records where idempotency_key = $1',
      [atomicIdempotencyKey],
    );
    expect(idempotencyRows.rows[0]?.count).toBe('0');
  });

  it('enforces idempotency scope, digest replay, conflict, in-progress and stale-lease recovery', async () => {
    const targetId = randomUUID();
    const command = idempotency.command(p1ActorContexts.managerMfa, {
      apiVersion: 'v1',
      idempotencyKey: `test-${randomUUID()}`,
      operation: 'ACTIVATE_CONFIG',
      request: { revisionId: targetId },
      targetId,
      targetType: 'ConfigurationRevision',
    });
    const acquired = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.claim(transaction, command, { leaseExpiresAt: t2, now: t0 }),
    );
    expect(acquired.kind).toBe('acquired');
    if (acquired.kind !== 'acquired') throw new Error('Expected acquired idempotency lease.');

    const inProgress = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.claim(transaction, command, { leaseExpiresAt: t3, now: t1 }),
    );
    expect(inProgress).toEqual({ kind: 'in_progress', retryAfter: t2 });

    await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.complete(
        transaction,
        acquired.lease,
        {
          resourceId: targetId,
          resourceType: 'ConfigurationRevision',
          responseCode: 'CONFIG_ACTIVATED',
          responseStatus: 200,
          status: 'SUCCEEDED',
        },
        t1,
      ),
    );

    const replay = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.claim(transaction, command, { leaseExpiresAt: t3, now: t2 }),
    );
    expect(replay).toEqual({
      kind: 'replay',
      result: {
        resourceId: targetId,
        resourceType: 'ConfigurationRevision',
        responseCode: 'CONFIG_ACTIVATED',
        responseStatus: 200,
        status: 'SUCCEEDED',
      },
    });

    const changed = idempotency.command(p1ActorContexts.managerMfa, {
      apiVersion: 'v1',
      idempotencyKey: command.idempotencyKey,
      operation: command.operation,
      request: { revisionId: randomUUID() },
      targetId,
      targetType: command.targetType,
    });
    await expect(
      withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
        idempotency.claim(transaction, changed, { leaseExpiresAt: t3, now: t2 }),
      ),
    ).resolves.toEqual({ kind: 'conflict' });

    const staleCommand = idempotency.command(p1ActorContexts.managerMfa, {
      apiVersion: 'v1',
      idempotencyKey: `stale-${randomUUID()}`,
      operation: 'TEST_STALE_LEASE',
      request: { targetId },
      targetId,
      targetType: 'ConfigurationRevision',
    });
    await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.claim(transaction, staleCommand, { leaseExpiresAt: t1, now: t0 }),
    );
    const reclaimed = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      idempotency.claim(transaction, staleCommand, { leaseExpiresAt: t3, now: t2 }),
    );
    expect(reclaimed.kind).toBe('acquired');
  });

  it('deduplicates outbox and jobs while exposing mismatched semantics', async () => {
    const outboxInput = {
      aggregateId: randomUUID(),
      aggregateType: 'ConfigurationRevision',
      availableAt: t3,
      correlationId: randomUUID(),
      dedupeKey: `outbox-${randomUUID()}`,
      eventSchemaVersion: 1,
      eventType: 'CONFIG_ACTIVATED',
      payload: { revisionId: randomUUID() },
      payloadSchemaVersion: 1,
    } as const;
    const first = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      durable.recordOutbox(transaction, outboxInput),
    );
    const duplicate = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      durable.recordOutbox(transaction, outboxInput),
    );
    expect(duplicate).toEqual({ created: false, id: first.id });

    await expect(
      withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
        durable.recordOutbox(transaction, {
          ...outboxInput,
          payload: { revisionId: randomUUID() },
        }),
      ),
    ).rejects.toBeInstanceOf(DurableDedupeConflictError);

    const jobInput = {
      dedupeKey: `job-${randomUUID()}`,
      handlerType: 'notification_delivery',
      handlerVersion: 1,
      maxAttempts: 3,
      nextEligibleAt: t3,
      payload: { notificationId: randomUUID() },
      payloadSchemaVersion: 1,
      sourceOutboxEventId: first.id,
    } as const;
    const job = await withActorTransaction(pool, p1ActorContexts.systemJob, (transaction) =>
      durable.enqueueJob(transaction, jobInput),
    );
    await expect(
      withActorTransaction(pool, p1ActorContexts.systemJob, (transaction) =>
        durable.enqueueJob(transaction, jobInput),
      ),
    ).resolves.toEqual({ created: false, id: job.id });
  });

  it('leases concurrently, recovers stale work, appends attempts, and makes poison work visible', async () => {
    const leaseStore = new PostgresDurableWorkLeaseStore(pool);
    const crashOutbox = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      (transaction) =>
        durable.recordOutbox(transaction, {
          aggregateId: randomUUID(),
          aggregateType: 'ConfigurationRevision',
          availableAt: t0,
          correlationId: randomUUID(),
          dedupeKey: `crash-outbox-${randomUUID()}`,
          eventSchemaVersion: 1,
          eventType: 'OUTBOX_CRASH_RECOVERY_TESTED',
          payload: { revisionId: randomUUID() },
          payloadSchemaVersion: 1,
        }),
    );
    const [leftOutbox, rightOutbox] = await Promise.all([
      leaseStore.claimOutbox({ leaseExpiresAt: t1, limit: 1, now: t0 }),
      leaseStore.claimOutbox({ leaseExpiresAt: t1, limit: 1, now: t0 }),
    ]);
    expect(leftOutbox.length + rightOutbox.length).toBe(1);
    const crashedOutboxLease = leftOutbox[0] ?? rightOutbox[0];
    if (!crashedOutboxLease) throw new Error('Expected one leased outbox event.');
    expect(crashedOutboxLease.event.id).toBe(crashOutbox.id);
    await expect(leaseStore.completeOutbox(crashedOutboxLease, t2)).resolves.toBe(false);

    const reclaimedOutbox = await leaseStore.claimOutbox({
      leaseExpiresAt: t3,
      limit: 1,
      now: t2,
    });
    expect(reclaimedOutbox).toHaveLength(1);
    const recoveredOutboxLease = reclaimedOutbox[0];
    if (!recoveredOutboxLease) throw new Error('Expected stale outbox reclamation.');
    await expect(leaseStore.completeOutbox(recoveredOutboxLease, t2)).resolves.toBe(true);
    const outboxState = await owner.query<{ attempt_count: number; state: string }>(
      'select state, attempt_count from ops.outbox_events where id = $1',
      [crashOutbox.id],
    );
    expect(outboxState.rows[0]).toEqual({ attempt_count: 2, state: 'COMPLETED' });

    const newJob = async (dedupe: string, maxAttempts = 3) =>
      withActorTransaction(pool, p1ActorContexts.systemJob, (transaction) =>
        durable.enqueueJob(transaction, {
          dedupeKey: dedupe,
          handlerType: 'recovery_test',
          handlerVersion: 1,
          maxAttempts,
          nextEligibleAt: t0,
          payload: { workId: randomUUID() },
          payloadSchemaVersion: 1,
        }),
      );

    await newJob(`concurrent-${randomUUID()}`);
    const [left, right] = await Promise.all([
      leaseStore.claimJobs({ leaseExpiresAt: t1, limit: 1, now: t0 }),
      leaseStore.claimJobs({ leaseExpiresAt: t1, limit: 1, now: t0 }),
    ]);
    expect(left.length + right.length).toBe(1);
    const firstLease = left[0] ?? right[0];
    if (!firstLease) throw new Error('Expected one leased job.');
    await expect(leaseStore.completeJob(firstLease, t2)).resolves.toBe(false);

    const staleClaims = await leaseStore.claimJobs({ leaseExpiresAt: t3, limit: 1, now: t2 });
    expect(staleClaims).toHaveLength(1);
    const staleLease = staleClaims[0];
    if (!staleLease) throw new Error('Expected stale job reclamation.');
    expect(staleLease.job.id).toBe(firstLease.job.id);
    await expect(leaseStore.completeJob(staleLease, t2)).resolves.toBe(true);

    const attempts = await owner.query<{ outcome: string }>(
      `select outcome from ops.job_attempts where job_id = $1 order by attempt_number`,
      [firstLease.job.id],
    );
    expect(attempts.rows.map((row) => row.outcome)).toEqual(['ABANDONED', 'SUCCEEDED']);
    await expect(
      owner.query(`update ops.job_attempts set safe_error_code = 'CHANGED' where job_id = $1`, [
        firstLease.job.id,
      ]),
    ).rejects.toMatchObject({ code: '55000' });

    const poison = await newJob(`poison-${randomUUID()}`, 1);
    const failurePolicy: DurableFailurePolicy = {
      fromException: () => ({
        kind: 'retry',
        nextEligibleAt: t3,
        safeErrorCode: 'TRANSIENT',
      }),
    };
    const dispatcher = new DurableDispatcher(
      leaseStore,
      { handle: async () => ({ kind: 'completed' }) },
      [],
      failurePolicy,
      { now: () => t2 },
    );
    await expect(
      dispatcher.dispatchJobs({ leaseExpiresAt: t3, limit: 1, now: t2 }),
    ).resolves.toMatchObject({ dead: 1 });
    const poisonState = await owner.query<{ last_error_code: string; state: string }>(
      'select state, last_error_code from ops.jobs where id = $1',
      [poison.id],
    );
    expect(poisonState.rows[0]).toEqual({
      last_error_code: 'HANDLER_NOT_FOUND',
      state: 'DEAD',
    });
  });

  it('deduplicates verified provider events and ignores reordered semantic effects without regression', async () => {
    const semanticKey = `identity:${randomUUID()}:active`;
    const event = {
      correlationId: randomUUID(),
      eventType: 'user.updated',
      payloadDigest: digest('payload-one'),
      provider: 'clerk',
      providerEventId: `evt_${randomUUID()}`,
      providerOccurredAt: t1,
      receivedAt: t2,
      semanticKey,
      signatureVerified: true,
    } as const;
    const accepted = await withActorTransaction(
      pool,
      p1ActorContexts.providerWebhook,
      (transaction) => providerEvents.register(transaction, event),
    );
    expect(accepted.kind).toBe('accepted');
    if (accepted.kind !== 'accepted') throw new Error('Expected provider event acceptance.');

    await expect(
      withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
        providerEvents.register(transaction, event),
      ),
    ).resolves.toEqual({ id: accepted.id, kind: 'duplicate' });

    await expect(
      withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
        providerEvents.register(transaction, { ...event, payloadDigest: digest('changed') }),
      ),
    ).resolves.toEqual({ kind: 'digest_conflict' });

    await expect(
      withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
        providerEvents.register(transaction, {
          ...event,
          providerEventId: `evt_${randomUUID()}`,
          providerOccurredAt: t0,
        }),
      ),
    ).resolves.toEqual({ id: accepted.id, kind: 'semantic_duplicate' });

    await withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
      providerEvents.decide(
        transaction,
        accepted.id,
        { outcome: 'IGNORED', safeResultCode: 'STALE_PROVIDER_EVENT' },
        t2,
      ),
    );
    const state = await owner.query<{ process_state: string; safe_result_code: string }>(
      'select process_state, safe_result_code from ops.inbound_provider_events where id = $1',
      [accepted.id],
    );
    expect(state.rows[0]).toEqual({
      process_state: 'IGNORED',
      safe_result_code: 'STALE_PROVIDER_EVENT',
    });
  });

  it('keeps operational Audit Event reads hidden from Customers through RLS', async () => {
    const customerAudit = await withActorTransaction(
      pool,
      p1ActorContexts.customerA,
      async (transaction) =>
        audit.record(transaction, {
          correlationId: randomUUID(),
          eventType: 'CUSTOMER_ACTION_TESTED',
          occurredAt: t2,
          operation: 'TEST_CUSTOMER_ACTION',
          outcome: 'SUCCEEDED',
          targetType: 'Customer',
        }),
    );
    expect(customerAudit.id).toMatch(/^[0-9a-f-]{36}$/u);

    const visibleToCustomer = await withActorTransaction(
      pool,
      p1ActorContexts.customerA,
      async (transaction) => transaction.query('select id from audit.events'),
    );
    expect(visibleToCustomer.rows).toEqual([]);
  });
});

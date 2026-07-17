import { randomUUID } from 'node:crypto';

import type { Pool, QueryResultRow } from 'pg';

import { withActorTransaction, type ActorScopedTransaction } from '../../../../platform/database';
import {
  utcInstantFromDate,
  type ResolvedActorContext,
  type UtcInstant,
} from '../../../../shared/kernel';
import type { AuditEventDraft } from '../../domain/audit-event';
import type {
  Job,
  JobInput,
  JobLease,
  OperationalPayload,
  OutboxEvent,
  OutboxEventInput,
  OutboxLease,
  ProviderEventDecision,
  ProviderEventInput,
  ProviderEventRegistration,
} from '../../domain/durable-work';
import type {
  IdempotencyClaim,
  IdempotencyCommand,
  IdempotencyLease,
  IdempotencyReplay,
} from '../../domain/idempotency';
import { assertSafeCategory } from '../../domain/safe-json';
import type { DurableWorkLeaseStore, LeaseBatchRequest, WorkRecovery } from '../../ports/dispatch';
import type {
  AuditEventRepository,
  IdempotencyRepository,
  JobRepository,
  OutboxEventRepository,
  ProviderEventRepository,
} from '../../ports/persistence';

const systemJobContext = Object.freeze({
  actor: Object.freeze({ kind: 'system_job' }),
  assurance: 'system_job',
}) satisfies ResolvedActorContext;

export class DurableDedupeConflictError extends Error {
  readonly code = 'DURABLE_DEDUPE_CONFLICT';

  constructor() {
    super('A durable dedupe key was reused for different semantics.');
    this.name = 'DurableDedupeConflictError';
  }
}

function instant(value: Date | string): UtcInstant {
  const parsed = utcInstantFromDate(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error('PostgreSQL returned an invalid timestamp.');
  return parsed.value;
}

function objectPayload(value: unknown): OperationalPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PostgreSQL returned an invalid operational payload.');
  }
  return Object.freeze(value as OperationalPayload);
}

export class PostgresAuditAndOperationsRepository
  implements
    AuditEventRepository,
    IdempotencyRepository,
    JobRepository,
    OutboxEventRepository,
    ProviderEventRepository
{
  async append(
    transaction: ActorScopedTransaction,
    event: AuditEventDraft,
  ): Promise<Readonly<{ id: string }>> {
    const eventId = randomUUID();
    const result = await transaction.query(
      `insert into audit.events (
         id, event_type, occurred_at, actor_kind, actor_principal_id, target_type, target_id,
         operation, outcome, state_before, state_after, safe_reason_code, request_id,
         correlation_id, metadata_json, metadata_schema_version
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16
       )`,
      [
        eventId,
        event.eventType,
        event.occurredAt,
        event.actorKind,
        event.actorPrincipalId ?? null,
        event.targetType,
        event.targetId ?? null,
        event.operation,
        event.outcome,
        event.stateBefore ?? null,
        event.stateAfter ?? null,
        event.safeReasonCode ?? null,
        event.requestId ?? null,
        event.correlationId,
        JSON.stringify(event.metadata),
        event.metadataSchemaVersion,
      ],
    );
    if (result.rowCount !== 1) throw new Error('Audit insert did not persist exactly one event.');
    return Object.freeze({ id: eventId });
  }

  async claim(
    transaction: ActorScopedTransaction,
    command: IdempotencyCommand,
    timing: Readonly<{ leaseExpiresAt: UtcInstant; leaseToken: string; now: UtcInstant }>,
  ): Promise<IdempotencyClaim> {
    const inserted = await transaction.query<{ id: string }>(
      `insert into ops.idempotency_records (
         scope_actor_kind, scope_principal_id, api_version, operation, target_type, target_id,
         idempotency_key, request_digest, lease_token, lease_expires_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict do nothing
       returning id`,
      [
        command.scope.actorKind,
        command.scope.principalId ?? null,
        command.apiVersion,
        command.operation,
        command.targetType,
        command.targetId ?? null,
        command.idempotencyKey,
        command.requestDigest,
        timing.leaseToken,
        timing.leaseExpiresAt,
      ],
    );
    const created = inserted.rows[0];
    if (created) {
      return Object.freeze({
        kind: 'acquired',
        lease: Object.freeze({
          id: created.id,
          leaseExpiresAt: timing.leaseExpiresAt,
          leaseToken: timing.leaseToken,
        }),
      });
    }

    type Existing = QueryResultRow & {
      id: string;
      lease_expires_at: Date;
      request_digest: string;
      resource_id: string | null;
      resource_type: string | null;
      response_json: null | { code?: unknown };
      response_status: number | null;
      status: 'FAILED_FINAL' | 'PROCESSING' | 'SUCCEEDED';
    };
    const existingResult = await transaction.query<Existing>(
      `select id, request_digest, status, lease_expires_at, response_status, response_json,
              resource_type, resource_id
       from ops.idempotency_records
       where scope_actor_kind = $1
         and scope_principal_id is not distinct from $2::uuid
         and api_version = $3 and operation = $4 and target_type = $5
         and target_id is not distinct from $6::uuid and idempotency_key = $7
       for update`,
      [
        command.scope.actorKind,
        command.scope.principalId ?? null,
        command.apiVersion,
        command.operation,
        command.targetType,
        command.targetId ?? null,
        command.idempotencyKey,
      ],
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('Idempotency conflict row could not be resolved.');
    if (existing.request_digest !== command.requestDigest) {
      return Object.freeze({ kind: 'conflict' });
    }
    if (existing.status !== 'PROCESSING') {
      if (existing.response_status === null) {
        throw new Error('Completed idempotency row is missing its safe response status.');
      }
      const responseCode = existing.response_json?.code;
      return Object.freeze({
        kind: 'replay',
        result: Object.freeze({
          ...(existing.resource_id ? { resourceId: existing.resource_id } : {}),
          ...(existing.resource_type ? { resourceType: existing.resource_type } : {}),
          ...(typeof responseCode === 'string' ? { responseCode } : {}),
          responseStatus: existing.response_status,
          status: existing.status,
        }),
      });
    }

    if (instant(existing.lease_expires_at) > timing.now) {
      return Object.freeze({
        kind: 'in_progress',
        retryAfter: instant(existing.lease_expires_at),
      });
    }

    const reclaimed = await transaction.query<{ id: string }>(
      `update ops.idempotency_records
       set lease_token = $2, lease_expires_at = $3, updated_at = $4
       where id = $1 and status = 'PROCESSING' and lease_expires_at <= $4
       returning id`,
      [existing.id, timing.leaseToken, timing.leaseExpiresAt, timing.now],
    );
    if (!reclaimed.rows[0]) {
      return Object.freeze({ kind: 'in_progress', retryAfter: instant(existing.lease_expires_at) });
    }
    return Object.freeze({
      kind: 'acquired',
      lease: Object.freeze({
        id: existing.id,
        leaseExpiresAt: timing.leaseExpiresAt,
        leaseToken: timing.leaseToken,
      }),
    });
  }

  async complete(
    transaction: ActorScopedTransaction,
    lease: IdempotencyLease,
    result: IdempotencyReplay,
    completedAt: UtcInstant,
  ): Promise<boolean> {
    if (result.responseCode) assertSafeCategory(result.responseCode, 'responseCode');
    if (result.resourceType) assertSafeCategory(result.resourceType, 'resourceType');
    const responseJson = result.responseCode ? JSON.stringify({ code: result.responseCode }) : null;
    const updated = await transaction.query(
      `update ops.idempotency_records
       set status = $2, response_status = $3, response_json = $4::jsonb,
           response_schema_version = case when $4::jsonb is null then null else 1 end,
           resource_type = $5, resource_id = $6, completed_at = $7, updated_at = $7
       where id = $1 and status = 'PROCESSING' and lease_token = $8
         and lease_expires_at > $7`,
      [
        lease.id,
        result.status,
        result.responseStatus,
        responseJson,
        result.resourceType ?? null,
        result.resourceId ?? null,
        completedAt,
        lease.leaseToken,
      ],
    );
    return updated.rowCount === 1;
  }

  async record(
    transaction: ActorScopedTransaction,
    event: OutboxEventInput,
  ): Promise<Readonly<{ created: boolean; id: string }>> {
    const eventId = randomUUID();
    const inserted = await transaction.query(
      `insert into ops.outbox_events (
         id, event_type, event_schema_version, aggregate_type, aggregate_id, correlation_id,
         dedupe_key, payload_json, payload_schema_version, available_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       on conflict (dedupe_key) do nothing`,
      [
        eventId,
        event.eventType,
        event.eventSchemaVersion,
        event.aggregateType,
        event.aggregateId,
        event.correlationId,
        event.dedupeKey,
        JSON.stringify(event.payload),
        event.payloadSchemaVersion,
        event.availableAt,
      ],
    );
    if (inserted.rowCount === 1) return Object.freeze({ created: true, id: eventId });

    const existing = await transaction.query<{ equivalent: boolean; id: string }>(
      `select id,
         event_type = $2
         and event_schema_version = $3
         and aggregate_type = $4
         and aggregate_id = $5
         and correlation_id = $6
         and payload_json = $7::jsonb
         and payload_schema_version = $8 as equivalent
       from ops.outbox_events where dedupe_key = $1`,
      [
        event.dedupeKey,
        event.eventType,
        event.eventSchemaVersion,
        event.aggregateType,
        event.aggregateId,
        event.correlationId,
        JSON.stringify(event.payload),
        event.payloadSchemaVersion,
      ],
    );
    const row = existing.rows[0];
    if (!row?.equivalent) throw new DurableDedupeConflictError();
    return Object.freeze({ created: false, id: row.id });
  }

  async enqueue(
    transaction: ActorScopedTransaction,
    job: JobInput,
  ): Promise<Readonly<{ created: boolean; id: string }>> {
    const inserted = await transaction.query<{ id: string }>(
      `insert into ops.jobs (
         source_outbox_event_id, handler_type, handler_version, dedupe_key,
         payload_json, payload_schema_version, next_eligible_at, max_attempts
       ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       on conflict do nothing returning id`,
      [
        job.sourceOutboxEventId ?? null,
        job.handlerType,
        job.handlerVersion,
        job.dedupeKey,
        JSON.stringify(job.payload),
        job.payloadSchemaVersion,
        job.nextEligibleAt,
        job.maxAttempts,
      ],
    );
    const created = inserted.rows[0];
    if (created) return Object.freeze({ created: true, id: created.id });

    const existing = await transaction.query<{ equivalent: boolean; id: string }>(
      `select id,
         source_outbox_event_id is not distinct from $2::uuid
         and handler_type = $3 and handler_version = $4
         and payload_json = $5::jsonb and payload_schema_version = $6
         and max_attempts = $7 as equivalent
       from ops.jobs where dedupe_key = $1`,
      [
        job.dedupeKey,
        job.sourceOutboxEventId ?? null,
        job.handlerType,
        job.handlerVersion,
        JSON.stringify(job.payload),
        job.payloadSchemaVersion,
        job.maxAttempts,
      ],
    );
    const row = existing.rows[0];
    if (!row?.equivalent) throw new DurableDedupeConflictError();
    return Object.freeze({ created: false, id: row.id });
  }

  async register(
    transaction: ActorScopedTransaction,
    event: ProviderEventInput,
  ): Promise<ProviderEventRegistration> {
    const inserted = await transaction.query<{ id: string }>(
      `insert into ops.inbound_provider_events (
         provider, provider_event_id, semantic_key, event_type, payload_digest,
         signature_verified, provider_occurred_at, received_at, correlation_id
       ) values ($1, $2, $3, $4, $5, true, $6, $7, $8)
       on conflict do nothing returning id`,
      [
        event.provider,
        event.providerEventId,
        event.semanticKey ?? null,
        event.eventType,
        event.payloadDigest,
        event.providerOccurredAt ?? null,
        event.receivedAt,
        event.correlationId,
      ],
    );
    const created = inserted.rows[0];
    if (created) return Object.freeze({ id: created.id, kind: 'accepted' });

    const duplicate = await transaction.query<{ id: string; payload_digest: string }>(
      `select id, payload_digest from ops.inbound_provider_events
       where provider = $1 and provider_event_id = $2`,
      [event.provider, event.providerEventId],
    );
    const duplicateRow = duplicate.rows[0];
    if (duplicateRow) {
      return duplicateRow.payload_digest === event.payloadDigest
        ? Object.freeze({ id: duplicateRow.id, kind: 'duplicate' })
        : Object.freeze({ kind: 'digest_conflict' });
    }

    if (event.semanticKey) {
      const semantic = await transaction.query<{ id: string }>(
        `select id from ops.inbound_provider_events
         where provider = $1 and semantic_key = $2`,
        [event.provider, event.semanticKey],
      );
      const semanticRow = semantic.rows[0];
      if (semanticRow) {
        return Object.freeze({ id: semanticRow.id, kind: 'semantic_duplicate' });
      }
    }
    throw new Error('Provider event conflict could not be resolved.');
  }

  async recordDecision(
    transaction: ActorScopedTransaction,
    eventId: string,
    decision: ProviderEventDecision,
    decidedAt: UtcInstant,
  ): Promise<boolean> {
    assertSafeCategory(decision.safeResultCode, 'safeResultCode');
    const terminal = decision.outcome !== 'FAILED_RETRYABLE';
    const result = await transaction.query(
      `update ops.inbound_provider_events
       set process_state = $2, safe_result_code = $3,
           processed_at = case when $4 then $5::timestamptz else null end,
           updated_at = $5
       where id = $1 and process_state in ('RECEIVED', 'PROCESSING', 'FAILED_RETRYABLE')`,
      [eventId, decision.outcome, decision.safeResultCode, terminal, decidedAt],
    );
    return result.rowCount === 1;
  }
}

type OutboxRow = QueryResultRow & {
  aggregate_id: string;
  aggregate_type: string;
  attempt_count: number;
  available_at: Date;
  correlation_id: string;
  dedupe_key: string;
  event_schema_version: number;
  event_type: string;
  id: string;
  lease_expires_at: Date;
  lease_token: string;
  payload_json: unknown;
  payload_schema_version: number;
  state: OutboxEvent['state'];
};

type JobRow = QueryResultRow & {
  attempt_count: number;
  dedupe_key: string;
  handler_type: string;
  handler_version: number;
  id: string;
  lease_expires_at: Date;
  lease_token: string;
  max_attempts: number;
  payload_json: unknown;
  payload_schema_version: number;
  source_outbox_event_id: string | null;
  started_at: Date;
};

function mapOutbox(row: OutboxRow): OutboxLease {
  return Object.freeze({
    event: Object.freeze({
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      attemptCount: row.attempt_count,
      availableAt: instant(row.available_at),
      correlationId: row.correlation_id,
      dedupeKey: row.dedupe_key,
      eventSchemaVersion: row.event_schema_version,
      eventType: row.event_type,
      id: row.id,
      payload: objectPayload(row.payload_json),
      payloadSchemaVersion: row.payload_schema_version,
      state: row.state,
    }),
    leaseExpiresAt: instant(row.lease_expires_at),
    leaseToken: row.lease_token,
  });
}

function mapJob(row: JobRow): JobLease {
  const job: Job = Object.freeze({
    attemptCount: row.attempt_count,
    dedupeKey: row.dedupe_key,
    handlerType: row.handler_type,
    handlerVersion: row.handler_version,
    id: row.id,
    maxAttempts: row.max_attempts,
    payload: objectPayload(row.payload_json),
    payloadSchemaVersion: row.payload_schema_version,
    ...(row.source_outbox_event_id ? { sourceOutboxEventId: row.source_outbox_event_id } : {}),
  });
  return Object.freeze({
    job,
    leaseExpiresAt: instant(row.lease_expires_at),
    leaseToken: row.lease_token,
    startedAt: instant(row.started_at),
  });
}

export class PostgresDurableWorkLeaseStore implements DurableWorkLeaseStore {
  constructor(private readonly pool: Pool) {}

  claimOutbox(request: LeaseBatchRequest): Promise<readonly OutboxLease[]> {
    return withActorTransaction(this.pool, systemJobContext, async (transaction) => {
      const token = randomUUID();
      const claimed = await transaction.query<OutboxRow>(
        `with candidates as (
           select id from ops.outbox_events
           where available_at <= $1
             and (state = 'PENDING' or (state = 'LEASED' and lease_expires_at <= $1))
           order by available_at, created_at, id
           for update skip locked limit $2
         )
         update ops.outbox_events event
         set state = 'LEASED', lease_token = $3, lease_expires_at = $4,
             attempt_count = event.attempt_count + 1, last_error_code = null
         from candidates where event.id = candidates.id
         returning event.*`,
        [request.now, request.limit, token, request.leaseExpiresAt],
      );
      return Object.freeze(claimed.rows.map(mapOutbox));
    });
  }

  completeOutbox(lease: OutboxLease, completedAt: UtcInstant): Promise<boolean> {
    return withActorTransaction(this.pool, systemJobContext, async (transaction) => {
      const result = await transaction.query(
        `update ops.outbox_events
         set state = 'COMPLETED', lease_token = null, lease_expires_at = null,
             completed_at = $3, last_error_code = null
         where id = $1 and state = 'LEASED' and lease_token = $2 and lease_expires_at > $3`,
        [lease.event.id, lease.leaseToken, completedAt],
      );
      return result.rowCount === 1;
    });
  }

  recoverOutbox(
    lease: OutboxLease,
    recovery: WorkRecovery,
    recoveredAt: UtcInstant,
  ): Promise<boolean> {
    assertSafeCategory(recovery.safeErrorCode, 'safeErrorCode');
    return withActorTransaction(this.pool, systemJobContext, async (transaction) => {
      const state = recovery.kind === 'dead' ? 'DEAD' : 'PENDING';
      const availableAt = recovery.kind === 'retry' ? recovery.nextEligibleAt : recoveredAt;
      const result = await transaction.query(
        `update ops.outbox_events
         set state = $3, lease_token = null, lease_expires_at = null,
             available_at = $4, last_error_code = $5
         where id = $1 and state = 'LEASED' and lease_token = $2 and lease_expires_at > $6`,
        [lease.event.id, lease.leaseToken, state, availableAt, recovery.safeErrorCode, recoveredAt],
      );
      return result.rowCount === 1;
    });
  }

  claimJobs(request: LeaseBatchRequest): Promise<readonly JobLease[]> {
    return withActorTransaction(this.pool, systemJobContext, async (transaction) => {
      const token = randomUUID();
      type ClaimedJobRow = JobRow & {
        old_attempt_count: number;
        old_lease_token: string | null;
        old_started_at: Date;
        old_state: string;
      };
      const claimed = await transaction.query<ClaimedJobRow>(
        `with candidates as (
           select id, state as old_state, lease_token as old_lease_token,
                  updated_at as old_started_at, attempt_count as old_attempt_count
           from ops.jobs
           where next_eligible_at <= $1
             and (state in ('PENDING', 'RETRY') or (state = 'LEASED' and lease_expires_at <= $1))
           order by next_eligible_at, created_at, id
           for update skip locked limit $2
         )
         update ops.jobs job
         set state = 'LEASED', lease_token = $3, lease_expires_at = $4,
             attempt_count = job.attempt_count + 1, updated_at = $1, last_error_code = null
         from candidates where job.id = candidates.id
         returning job.*, $1::timestamptz as started_at, candidates.old_state,
                   candidates.old_lease_token, candidates.old_started_at,
                   candidates.old_attempt_count`,
        [request.now, request.limit, token, request.leaseExpiresAt],
      );

      for (const row of claimed.rows) {
        if (row.old_state === 'LEASED' && row.old_lease_token && row.old_attempt_count > 0) {
          await transaction.query(
            `insert into ops.job_attempts (
               job_id, attempt_number, lease_token, started_at, finished_at,
               outcome, safe_error_code
             ) values ($1, $2, $3, $4, $5, 'ABANDONED', 'STALE_LEASE_RECLAIMED')
             on conflict (job_id, attempt_number) do nothing`,
            [row.id, row.old_attempt_count, row.old_lease_token, row.old_started_at, request.now],
          );
        }
      }
      return Object.freeze(claimed.rows.map(mapJob));
    });
  }

  completeJob(lease: JobLease, completedAt: UtcInstant): Promise<boolean> {
    return this.finishJob(lease, { kind: 'completed' }, completedAt);
  }

  recoverJob(lease: JobLease, recovery: WorkRecovery, recoveredAt: UtcInstant): Promise<boolean> {
    assertSafeCategory(recovery.safeErrorCode, 'safeErrorCode');
    return this.finishJob(lease, recovery, recoveredAt);
  }

  private finishJob(
    lease: JobLease,
    result: Readonly<{ kind: 'completed' }> | WorkRecovery,
    finishedAt: UtcInstant,
  ): Promise<boolean> {
    return withActorTransaction(this.pool, systemJobContext, async (transaction) => {
      const state =
        result.kind === 'completed' ? 'SUCCEEDED' : result.kind === 'dead' ? 'DEAD' : 'RETRY';
      const outcome =
        result.kind === 'completed'
          ? 'SUCCEEDED'
          : result.kind === 'dead'
            ? 'FAILED_FINAL'
            : 'RETRY';
      const nextEligibleAt = result.kind === 'retry' ? result.nextEligibleAt : finishedAt;
      const completedAt = state === 'SUCCEEDED' || state === 'DEAD' ? finishedAt : null;
      const errorCode = result.kind === 'completed' ? null : result.safeErrorCode;
      const updated = await transaction.query(
        `update ops.jobs
         set state = $3, next_eligible_at = $4, lease_token = null, lease_expires_at = null,
             last_error_code = $5, completed_at = $6, updated_at = $7
         where id = $1 and state = 'LEASED' and lease_token = $2 and lease_expires_at > $7`,
        [lease.job.id, lease.leaseToken, state, nextEligibleAt, errorCode, completedAt, finishedAt],
      );
      if (updated.rowCount !== 1) return false;

      await transaction.query(
        `insert into ops.job_attempts (
           job_id, attempt_number, lease_token, started_at, finished_at,
           outcome, safe_error_code
         ) values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          lease.job.id,
          lease.job.attemptCount,
          lease.leaseToken,
          lease.startedAt,
          finishedAt,
          outcome,
          errorCode,
        ],
      );
      return true;
    });
  }
}

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const auditSchema = pgSchema('audit');
export const operationsSchema = pgSchema('ops');

const createdAt = () => timestamp('created_at', { mode: 'date', withTimezone: true }).notNull();
const updatedAt = () => timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull();

export const auditEvents = auditSchema.table(
  'events',
  {
    id: uuid().defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { mode: 'date', withTimezone: true }).notNull(),
    actorKind: text('actor_kind').notNull(),
    actorPrincipalId: uuid('actor_principal_id'),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    operation: text().notNull(),
    outcome: text().notNull().$type<'DENIED' | 'FAILED' | 'SUCCEEDED'>(),
    stateBefore: text('state_before'),
    stateAfter: text('state_after'),
    safeReasonCode: text('safe_reason_code'),
    requestId: uuid('request_id'),
    correlationId: uuid('correlation_id').notNull(),
    metadataJson: jsonb('metadata_json').notNull().$type<Readonly<Record<string, unknown>>>(),
    metadataSchemaVersion: integer('metadata_schema_version').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_events_target_time_idx').on(table.targetType, table.targetId, table.occurredAt),
    index('audit_events_correlation_idx').on(table.correlationId),
  ],
);

export const idempotencyRecords = operationsSchema.table(
  'idempotency_records',
  {
    id: uuid().defaultRandom().primaryKey(),
    scopeActorKind: text('scope_actor_kind').notNull(),
    scopePrincipalId: uuid('scope_principal_id'),
    apiVersion: text('api_version').notNull(),
    operation: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    requestDigest: text('request_digest').notNull(),
    status: text().notNull().$type<'FAILED_FINAL' | 'PROCESSING' | 'SUCCEEDED'>(),
    leaseToken: uuid('lease_token').notNull(),
    leaseExpiresAt: timestamp('lease_expires_at', { mode: 'date', withTimezone: true }).notNull(),
    responseStatus: smallint('response_status'),
    responseJson: jsonb('response_json').$type<Readonly<Record<string, unknown>>>(),
    responseSchemaVersion: integer('response_schema_version'),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    retentionEligibleAt: timestamp('retention_eligible_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    unique('idempotency_scope_unique')
      .on(
        table.scopeActorKind,
        table.scopePrincipalId,
        table.apiVersion,
        table.operation,
        table.targetType,
        table.targetId,
        table.idempotencyKey,
      )
      .nullsNotDistinct(),
  ],
);

export const outboxEvents = operationsSchema.table(
  'outbox_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    eventSchemaVersion: integer('event_schema_version').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    correlationId: uuid('correlation_id').notNull(),
    createdByActorKind: text('created_by_actor_kind').notNull(),
    createdByPrincipalId: uuid('created_by_principal_id'),
    dedupeKey: text('dedupe_key').notNull(),
    payloadJson: jsonb('payload_json').notNull().$type<Readonly<Record<string, unknown>>>(),
    payloadSchemaVersion: integer('payload_schema_version').notNull(),
    state: text().notNull().$type<'COMPLETED' | 'DEAD' | 'LEASED' | 'PENDING'>(),
    availableAt: timestamp('available_at', { mode: 'date', withTimezone: true }).notNull(),
    leaseToken: uuid('lease_token'),
    leaseExpiresAt: timestamp('lease_expires_at', { mode: 'date', withTimezone: true }),
    attemptCount: integer('attempt_count').notNull(),
    lastErrorCode: text('last_error_code'),
    retentionEligibleAt: timestamp('retention_eligible_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('outbox_events_dedupe_unique').on(table.dedupeKey),
    index('outbox_events_eligible_idx')
      .on(table.state, table.availableAt, table.createdAt)
      .where(sql`${table.state} in ('PENDING', 'LEASED')`),
  ],
);

export const jobs = operationsSchema.table(
  'jobs',
  {
    id: uuid().defaultRandom().primaryKey(),
    sourceOutboxEventId: uuid('source_outbox_event_id'),
    handlerType: text('handler_type').notNull(),
    handlerVersion: integer('handler_version').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    payloadJson: jsonb('payload_json').notNull().$type<Readonly<Record<string, unknown>>>(),
    payloadSchemaVersion: integer('payload_schema_version').notNull(),
    state: text().notNull().$type<'DEAD' | 'LEASED' | 'PENDING' | 'RETRY' | 'SUCCEEDED'>(),
    nextEligibleAt: timestamp('next_eligible_at', { mode: 'date', withTimezone: true }).notNull(),
    leaseToken: uuid('lease_token'),
    leaseExpiresAt: timestamp('lease_expires_at', { mode: 'date', withTimezone: true }),
    attemptCount: integer('attempt_count').notNull(),
    maxAttempts: integer('max_attempts').notNull(),
    lastErrorCode: text('last_error_code'),
    retentionEligibleAt: timestamp('retention_eligible_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('jobs_source_outbox_unique').on(table.sourceOutboxEventId),
    uniqueIndex('jobs_dedupe_unique').on(table.dedupeKey),
    index('jobs_eligible_idx')
      .on(table.state, table.nextEligibleAt, table.createdAt)
      .where(sql`${table.state} in ('PENDING', 'RETRY', 'LEASED')`),
  ],
);

export const jobAttempts = operationsSchema.table(
  'job_attempts',
  {
    id: uuid().defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    attemptNumber: integer('attempt_number').notNull(),
    leaseToken: uuid('lease_token').notNull(),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { mode: 'date', withTimezone: true }),
    outcome: text().$type<'ABANDONED' | 'FAILED_FINAL' | 'RETRY' | 'SUCCEEDED'>(),
    safeErrorCode: text('safe_error_code'),
    safeDiagnosticJson: jsonb('safe_diagnostic_json').$type<Readonly<Record<string, unknown>>>(),
    safeDiagnosticSchemaVersion: integer('safe_diagnostic_schema_version'),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('job_attempt_sequence_unique').on(table.jobId, table.attemptNumber)],
);

export const inboundProviderEvents = operationsSchema.table(
  'inbound_provider_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    provider: text().notNull(),
    providerEventId: text('provider_event_id').notNull(),
    semanticKey: text('semantic_key'),
    eventType: text('event_type').notNull(),
    payloadDigest: text('payload_digest').notNull(),
    signatureVerified: boolean('signature_verified').notNull(),
    providerOccurredAt: timestamp('provider_occurred_at', { mode: 'date', withTimezone: true }),
    receivedAt: timestamp('received_at', { mode: 'date', withTimezone: true }).notNull(),
    processState: text('process_state')
      .notNull()
      .$type<
        'FAILED_FINAL' | 'FAILED_RETRYABLE' | 'IGNORED' | 'PROCESSED' | 'PROCESSING' | 'RECEIVED'
      >(),
    correlationId: uuid('correlation_id').notNull(),
    processedAt: timestamp('processed_at', { mode: 'date', withTimezone: true }),
    safeResultCode: text('safe_result_code'),
    retentionEligibleAt: timestamp('retention_eligible_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('inbound_provider_event_unique').on(table.provider, table.providerEventId),
    uniqueIndex('inbound_provider_event_semantic_unique')
      .on(table.provider, table.semanticKey)
      .where(sql`${table.semanticKey} is not null`),
  ],
);

export const auditAndOperationsTables = Object.freeze({
  auditEvents,
  idempotencyRecords,
  inboundProviderEvents,
  jobAttempts,
  jobs,
  outboxEvents,
});

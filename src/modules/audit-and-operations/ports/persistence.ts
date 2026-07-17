import type { ActorScopedTransaction } from '../../../platform/database';
import type { UtcInstant } from '../../../shared/kernel';
import type { AuditEventDraft } from '../domain/audit-event';
import type {
  IdempotencyClaim,
  IdempotencyCommand,
  IdempotencyLease,
  IdempotencyReplay,
} from '../domain/idempotency';
import type {
  JobInput,
  OutboxEventInput,
  ProviderEventDecision,
  ProviderEventInput,
  ProviderEventRegistration,
} from '../domain/durable-work';

export interface AuditEventRepository {
  append(
    transaction: ActorScopedTransaction,
    event: AuditEventDraft,
  ): Promise<Readonly<{ id: string }>>;
}

export interface IdempotencyRepository {
  claim(
    transaction: ActorScopedTransaction,
    command: IdempotencyCommand,
    timing: Readonly<{ leaseExpiresAt: UtcInstant; leaseToken: string; now: UtcInstant }>,
  ): Promise<IdempotencyClaim>;
  complete(
    transaction: ActorScopedTransaction,
    lease: IdempotencyLease,
    result: IdempotencyReplay,
    completedAt: UtcInstant,
  ): Promise<boolean>;
}

export interface OutboxEventRepository {
  record(
    transaction: ActorScopedTransaction,
    event: OutboxEventInput,
  ): Promise<Readonly<{ created: boolean; id: string }>>;
}

export interface JobRepository {
  enqueue(
    transaction: ActorScopedTransaction,
    job: JobInput,
  ): Promise<Readonly<{ created: boolean; id: string }>>;
}

export interface ProviderEventRepository {
  register(
    transaction: ActorScopedTransaction,
    event: ProviderEventInput,
  ): Promise<ProviderEventRegistration>;
  recordDecision(
    transaction: ActorScopedTransaction,
    eventId: string,
    decision: ProviderEventDecision,
    decidedAt: UtcInstant,
  ): Promise<boolean>;
}

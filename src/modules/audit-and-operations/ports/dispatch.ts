import type { ResolvedActorContext, UtcInstant } from '../../../shared/kernel';
import type { Job, JobLease, OutboxEvent, OutboxLease } from '../domain/durable-work';
import type { Awaitable } from './telemetry';

export type LeaseBatchRequest = Readonly<{
  leaseExpiresAt: UtcInstant;
  limit: number;
  now: UtcInstant;
}>;

export type WorkRecovery =
  | Readonly<{ kind: 'dead'; safeErrorCode: string }>
  | Readonly<{ kind: 'retry'; nextEligibleAt: UtcInstant; safeErrorCode: string }>;

export interface DurableWorkLeaseStore {
  claimOutbox(request: LeaseBatchRequest): Promise<readonly OutboxLease[]>;
  completeOutbox(lease: OutboxLease, completedAt: UtcInstant): Promise<boolean>;
  recoverOutbox(
    lease: OutboxLease,
    recovery: WorkRecovery,
    recoveredAt: UtcInstant,
  ): Promise<boolean>;
  claimJobs(request: LeaseBatchRequest): Promise<readonly JobLease[]>;
  completeJob(lease: JobLease, completedAt: UtcInstant): Promise<boolean>;
  recoverJob(lease: JobLease, recovery: WorkRecovery, recoveredAt: UtcInstant): Promise<boolean>;
}

export type HandlerResult = Readonly<{ kind: 'completed' }> | WorkRecovery;

export interface OutboxHandlerPort {
  handle(event: OutboxEvent): Awaitable<HandlerResult>;
}

export interface JobHandlerPort {
  canHandle(job: Job): boolean;
  handle(job: Job): Awaitable<HandlerResult>;
}

export interface DurableFailurePolicy {
  fromException(
    work: Readonly<{
      attemptCount: number;
      kind: 'job' | 'outbox';
      maxAttempts?: number;
    }>,
    error: unknown,
    now: UtcInstant,
  ): WorkRecovery;
}

export interface ReconciliationCredentialPort<Credential> {
  verify(candidate: Credential): Awaitable<ResolvedActorContext | null>;
}

export type ReconciliationRequest<Credential> = Readonly<{
  credential: Credential;
  job: LeaseBatchRequest;
  outbox: LeaseBatchRequest;
}>;

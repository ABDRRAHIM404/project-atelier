import type { Clock, UtcInstant } from '../../../shared/kernel';
import type { JobLease, OutboxLease } from '../domain/durable-work';
import type {
  DurableFailurePolicy,
  DurableWorkLeaseStore,
  HandlerResult,
  JobHandlerPort,
  LeaseBatchRequest,
  OutboxHandlerPort,
  ReconciliationCredentialPort,
  ReconciliationRequest,
  WorkRecovery,
} from '../ports/dispatch';

export type DispatchSummary = Readonly<{
  completed: number;
  dead: number;
  leaseLost: number;
  retried: number;
}>;

export type ReconciliationSummary = Readonly<{
  jobs: DispatchSummary;
  outbox: DispatchSummary;
}>;

export class ReconciliationAuthenticationError extends Error {
  readonly code = 'RECONCILIATION_AUTHENTICATION_REQUIRED';

  constructor() {
    super('Reconciliation authentication failed.');
    this.name = 'ReconciliationAuthenticationError';
  }
}

function validateBatch(request: LeaseBatchRequest): void {
  if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) {
    throw new RangeError('A durable dispatch batch must contain between 1 and 100 items.');
  }
  if (request.leaseExpiresAt <= request.now) {
    throw new RangeError('A durable dispatch lease must expire after it starts.');
  }
}

function emptySummary(): { completed: number; dead: number; leaseLost: number; retried: number } {
  return { completed: 0, dead: 0, leaseLost: 0, retried: 0 };
}

function recordResult(
  summary: ReturnType<typeof emptySummary>,
  result: HandlerResult,
  persisted: boolean,
): void {
  if (!persisted) {
    summary.leaseLost += 1;
  } else if (result.kind === 'completed') {
    summary.completed += 1;
  } else if (result.kind === 'dead') {
    summary.dead += 1;
  } else {
    summary.retried += 1;
  }
}

async function persistOutboxResult(
  store: DurableWorkLeaseStore,
  lease: OutboxLease,
  result: HandlerResult,
  now: UtcInstant,
): Promise<boolean> {
  return result.kind === 'completed'
    ? store.completeOutbox(lease, now)
    : store.recoverOutbox(lease, result, now);
}

async function persistJobResult(
  store: DurableWorkLeaseStore,
  lease: JobLease,
  result: HandlerResult,
  now: UtcInstant,
): Promise<boolean> {
  if (result.kind === 'retry' && lease.job.attemptCount >= lease.job.maxAttempts) {
    const exhausted: WorkRecovery = Object.freeze({
      kind: 'dead',
      safeErrorCode: result.safeErrorCode,
    });
    return store.recoverJob(lease, exhausted, now);
  }
  return result.kind === 'completed'
    ? store.completeJob(lease, now)
    : store.recoverJob(lease, result, now);
}

export class DurableDispatcher {
  constructor(
    private readonly store: DurableWorkLeaseStore,
    private readonly outboxHandler: OutboxHandlerPort,
    private readonly jobHandlers: readonly JobHandlerPort[],
    private readonly failurePolicy: DurableFailurePolicy,
    private readonly clock: Clock,
  ) {}

  async dispatchOutbox(request: LeaseBatchRequest): Promise<DispatchSummary> {
    validateBatch(request);
    const summary = emptySummary();
    const leases = await this.store.claimOutbox(request);

    for (const lease of leases) {
      let result: HandlerResult;
      try {
        result = await this.outboxHandler.handle(lease.event);
      } catch (error) {
        const failedAt = this.clock.now();
        result = this.failurePolicy.fromException(
          { attemptCount: lease.event.attemptCount, kind: 'outbox' },
          error,
          failedAt,
        );
      }
      const persisted = await persistOutboxResult(this.store, lease, result, this.clock.now());
      recordResult(summary, result, persisted);
    }

    return Object.freeze(summary);
  }

  async dispatchJobs(request: LeaseBatchRequest): Promise<DispatchSummary> {
    validateBatch(request);
    const summary = emptySummary();
    const leases = await this.store.claimJobs(request);

    for (const lease of leases) {
      let result: HandlerResult;
      const handler = this.jobHandlers.find((candidate) => candidate.canHandle(lease.job));
      if (!handler) {
        result = Object.freeze({ kind: 'dead', safeErrorCode: 'HANDLER_NOT_FOUND' });
      } else {
        try {
          result = await handler.handle(lease.job);
        } catch (error) {
          const failedAt = this.clock.now();
          result = this.failurePolicy.fromException(
            {
              attemptCount: lease.job.attemptCount,
              kind: 'job',
              maxAttempts: lease.job.maxAttempts,
            },
            error,
            failedAt,
          );
        }
      }
      const persisted = await persistJobResult(this.store, lease, result, this.clock.now());
      const recordedResult: HandlerResult =
        result.kind === 'retry' && lease.job.attemptCount >= lease.job.maxAttempts
          ? Object.freeze({ kind: 'dead', safeErrorCode: result.safeErrorCode })
          : result;
      recordResult(summary, recordedResult, persisted);
    }

    return Object.freeze(summary);
  }

  async reconcile<Credential>(
    request: ReconciliationRequest<Credential>,
    credentialPort: ReconciliationCredentialPort<Credential>,
  ): Promise<ReconciliationSummary> {
    const context = await credentialPort.verify(request.credential);
    if (
      !context ||
      !(
        (context.actor.kind === 'system_job' && context.assurance === 'system_job') ||
        (context.actor.kind === 'operator' && context.assurance === 'operator')
      )
    ) {
      throw new ReconciliationAuthenticationError();
    }

    const outbox = await this.dispatchOutbox(request.outbox);
    const jobs = await this.dispatchJobs(request.job);
    return Object.freeze({ jobs, outbox });
  }
}

import type { ActorScopedTransaction } from '../../../platform/database';
import type { ResolvedActorContext, UtcInstant } from '../../../shared/kernel';
import {
  createIdempotencyCommand,
  newLeaseToken,
  type IdempotencyClaim,
  type IdempotencyCommand,
  type IdempotencyLease,
  type IdempotencyReplay,
} from '../domain/idempotency';
import type { JsonValue } from '../domain/safe-json';
import type { IdempotencyRepository } from '../ports/persistence';

export class IdempotencyLeaseLostError extends Error {
  readonly code = 'IDEMPOTENCY_LEASE_LOST';

  constructor() {
    super('The idempotency lease is no longer current.');
    this.name = 'IdempotencyLeaseLostError';
  }
}

export class IdempotencyService {
  constructor(
    private readonly repository: IdempotencyRepository,
    private readonly createLeaseToken: () => string = newLeaseToken,
  ) {}

  command(
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
    return createIdempotencyCommand(context, input);
  }

  claim(
    transaction: ActorScopedTransaction,
    command: IdempotencyCommand,
    timing: Readonly<{ leaseExpiresAt: UtcInstant; now: UtcInstant }>,
  ): Promise<IdempotencyClaim> {
    if (timing.leaseExpiresAt <= timing.now) {
      throw new RangeError('An idempotency lease must expire after it starts.');
    }
    return this.repository.claim(transaction, command, {
      ...timing,
      leaseToken: this.createLeaseToken(),
    });
  }

  async complete(
    transaction: ActorScopedTransaction,
    lease: IdempotencyLease,
    result: IdempotencyReplay,
    completedAt: UtcInstant,
  ): Promise<void> {
    if (
      !Number.isSafeInteger(result.responseStatus) ||
      result.responseStatus < 200 ||
      result.responseStatus > 599
    ) {
      throw new RangeError('An idempotency replay status must be an HTTP response status.');
    }
    if (!(await this.repository.complete(transaction, lease, result, completedAt))) {
      throw new IdempotencyLeaseLostError();
    }
  }
}

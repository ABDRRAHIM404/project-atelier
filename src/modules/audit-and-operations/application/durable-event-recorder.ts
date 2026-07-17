import type { ActorScopedTransaction } from '../../../platform/database';
import {
  validateJob,
  validateOutboxEvent,
  type JobInput,
  type OutboxEventInput,
} from '../domain/durable-work';
import type { JobRepository, OutboxEventRepository } from '../ports/persistence';

export class DurableEventRecorder {
  constructor(
    private readonly outboxRepository: OutboxEventRepository,
    private readonly jobRepository: JobRepository,
  ) {}

  recordOutbox(
    transaction: ActorScopedTransaction,
    event: OutboxEventInput,
  ): Promise<Readonly<{ created: boolean; id: string }>> {
    return this.outboxRepository.record(transaction, validateOutboxEvent(event));
  }

  enqueueJob(
    transaction: ActorScopedTransaction,
    job: JobInput,
  ): Promise<Readonly<{ created: boolean; id: string }>> {
    return this.jobRepository.enqueue(transaction, validateJob(job));
  }
}

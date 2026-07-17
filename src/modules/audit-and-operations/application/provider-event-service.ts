import type { ActorScopedTransaction } from '../../../platform/database';
import type { UtcInstant } from '../../../shared/kernel';
import {
  validateProviderEvent,
  type ProviderEventDecision,
  type ProviderEventInput,
  type ProviderEventRegistration,
} from '../domain/durable-work';
import type { ProviderEventRepository } from '../ports/persistence';

export class ProviderEventService {
  constructor(private readonly repository: ProviderEventRepository) {}

  register(
    transaction: ActorScopedTransaction,
    event: ProviderEventInput,
  ): Promise<ProviderEventRegistration> {
    if (transaction.actorContext.actor.kind !== 'provider_webhook') {
      throw new Error('Provider events require a verified provider-webhook transaction.');
    }
    return this.repository.register(transaction, validateProviderEvent(event));
  }

  async decide(
    transaction: ActorScopedTransaction,
    eventId: string,
    decision: ProviderEventDecision,
    decidedAt: UtcInstant,
  ): Promise<void> {
    if (transaction.actorContext.actor.kind !== 'provider_webhook') {
      throw new Error('Provider event decisions require a verified provider-webhook transaction.');
    }
    if (!(await this.repository.recordDecision(transaction, eventId, decision, decidedAt))) {
      throw new Error('Provider event is missing or already terminal.');
    }
  }
}

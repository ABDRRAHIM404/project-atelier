import type { ActorScopedTransaction } from '../../../platform/database';
import { createAuditEventDraft, type AuditEventInput } from '../domain/audit-event';
import type { AuditEventRepository } from '../ports/persistence';

export class AuditRecorder {
  constructor(private readonly repository: AuditEventRepository) {}

  record(
    transaction: ActorScopedTransaction,
    input: AuditEventInput,
  ): Promise<Readonly<{ id: string }>> {
    return this.repository.append(
      transaction,
      createAuditEventDraft(transaction.actorContext, input),
    );
  }
}

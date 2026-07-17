import { err, ok, type Result, type UtcInstant } from '../../../shared/kernel';
import type { ActorScopedTransaction } from '../../../platform/database';
import {
  approvalActorMatches,
  parseConfigurationJsonObject,
  resolveConfigurationAttribution,
  type ConfigurationCommandFailure,
  type ConfigurationRevision,
} from '../domain/configuration-revision';
import type { ConfigurationKey } from '../domain/readiness';
import type {
  ConfigurationAuditWriter,
  ConfigurationPersistence,
  ConfigurationValueValidator,
} from '../ports/configuration-persistence';

export class ConfigurationService {
  constructor(
    private readonly persistence: ConfigurationPersistence,
    private readonly validator: ConfigurationValueValidator,
    private readonly audit: ConfigurationAuditWriter,
  ) {}

  async createDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{ key: ConfigurationKey; value: unknown }>,
  ): Promise<Result<ConfigurationRevision, ConfigurationCommandFailure>> {
    const actor = resolveConfigurationAttribution(transaction.actorContext);
    if (!actor.ok) return actor;
    const value = parseConfigurationJsonObject(input.value);
    if (!value.ok) return value;
    const definition = await this.persistence.findDefinition(transaction, input.key);
    if (!definition) return err({ code: 'CONFIGURATION_VALUE_INVALID' });
    if (!this.validator.accepts(definition.code, definition.valueSchemaVersion, value.value)) {
      return err({ code: 'CONFIGURATION_VALUE_INVALID' });
    }
    return ok(
      await this.persistence.createDraft(transaction, {
        actor: actor.value,
        definition,
        value: value.value,
      }),
    );
  }

  async activateDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      correlationId: string;
      effectiveFrom: UtcInstant;
      reasonCode: string;
      revisionId: string;
    }>,
  ): Promise<Result<ConfigurationRevision, ConfigurationCommandFailure>> {
    const actor = resolveConfigurationAttribution(transaction.actorContext);
    if (!actor.ok) return actor;
    const revision = await this.persistence.findRevisionForUpdate(transaction, input.revisionId);
    if (!revision || revision.lifecycle !== 'DRAFT') {
      return err({ code: 'CONFIGURATION_REVISION_NOT_DRAFT' });
    }
    const definition = await this.persistence.findDefinition(transaction, revision.definitionCode);
    if (!definition || !approvalActorMatches(actor.value, definition.approvalActor)) {
      return err({ code: 'CONFIGURATION_APPROVAL_ACTOR_MISMATCH' });
    }
    if (
      !this.validator.accepts(revision.definitionCode, revision.valueSchemaVersion, revision.value)
    ) {
      return err({ code: 'CONFIGURATION_VALUE_INVALID' });
    }

    const activated = await this.persistence.activateDraft(transaction, {
      actor: actor.value,
      effectiveFrom: input.effectiveFrom,
      reasonCode: input.reasonCode,
      revisionId: revision.id,
    });
    if (!activated) return err({ code: 'CONFIGURATION_REVISION_NOT_DRAFT' });
    await this.audit.configurationActivated(transaction, {
      actor: actor.value,
      configurationKey: revision.definitionCode,
      correlationId: input.correlationId,
      reasonCode: input.reasonCode,
      revisionId: revision.id,
    });
    return ok(activated);
  }
}

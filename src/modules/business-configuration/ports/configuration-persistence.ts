import type { ActorScopedTransaction } from '../../../platform/database';
import type { UtcInstant } from '../../../shared/kernel';
import type {
  ConfigurationActorAttribution,
  ConfigurationApprovalActor,
  ConfigurationRevision,
  JsonObject,
} from '../domain/configuration-revision';
import type { ConfigurationKey } from '../domain/readiness';

export type ConfigurationDefinition = Readonly<{
  approvalActor: ConfigurationApprovalActor;
  code: ConfigurationKey;
  valueSchemaVersion: number;
}>;

export interface ConfigurationPersistence {
  activateDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actor: ConfigurationActorAttribution;
      effectiveFrom: UtcInstant;
      reasonCode: string;
      revisionId: string;
    }>,
  ): Promise<ConfigurationRevision | undefined>;
  createDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actor: ConfigurationActorAttribution;
      definition: ConfigurationDefinition;
      value: JsonObject;
    }>,
  ): Promise<ConfigurationRevision>;
  findActive(
    transaction: ActorScopedTransaction,
    key: ConfigurationKey,
    at: UtcInstant,
  ): Promise<ConfigurationRevision | undefined>;
  findDefinition(
    transaction: ActorScopedTransaction,
    key: ConfigurationKey,
  ): Promise<ConfigurationDefinition | undefined>;
  findRevisionForUpdate(
    transaction: ActorScopedTransaction,
    revisionId: string,
  ): Promise<ConfigurationRevision | undefined>;
}

export interface ConfigurationValueValidator {
  accepts(key: ConfigurationKey, schemaVersion: number, value: JsonObject): boolean;
}

export interface ConfigurationAuditWriter {
  configurationActivated(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actor: ConfigurationActorAttribution;
      configurationKey: ConfigurationKey;
      correlationId: string;
      reasonCode: string;
      revisionId: string;
    }>,
  ): Promise<void>;
}

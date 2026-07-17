import type { ActorScopedTransaction } from '../../../../platform/database';
import type { UtcInstant } from '../../../../shared/kernel';
import type {
  ConfigurationActorAttribution,
  ConfigurationRevision,
  JsonObject,
} from '../../domain/configuration-revision';
import type { ConfigurationKey } from '../../domain/readiness';
import type {
  ConfigurationDefinition,
  ConfigurationPersistence,
} from '../../ports/configuration-persistence';

type RevisionRow = Readonly<{
  definition_code: ConfigurationKey;
  effective_from: Date | null;
  id: string;
  lifecycle: 'ACTIVE' | 'DRAFT' | 'RETIRED';
  revision_number: number;
  value_json: JsonObject;
  value_schema_version: number;
}>;

function toRevision(row: RevisionRow): ConfigurationRevision {
  return Object.freeze({
    definitionCode: row.definition_code,
    ...(row.effective_from ? { effectiveFrom: row.effective_from } : {}),
    id: row.id,
    lifecycle: row.lifecycle,
    revisionNumber: row.revision_number,
    value: Object.freeze(row.value_json),
    valueSchemaVersion: row.value_schema_version,
  });
}

function attributionValues(actor: ConfigurationActorAttribution): readonly [string, string | null] {
  return actor.actorKind === 'manager'
    ? [actor.actorKind, actor.principalId]
    : [actor.actorKind, null];
}

const revisionSelection = `
  select id, definition_code, revision_number, value_json, value_schema_version,
         lifecycle, effective_from
  from config.configuration_revisions`;

export class PostgresConfigurationRepository implements ConfigurationPersistence {
  async findDefinition(
    transaction: ActorScopedTransaction,
    key: ConfigurationKey,
  ): Promise<ConfigurationDefinition | undefined> {
    const result = await transaction.query<{
      approval_actor: 'MANAGER' | 'OPERATOR';
      code: ConfigurationKey;
      value_schema_version: number;
    }>(
      `select code, approval_actor, value_schema_version
       from config.configuration_definitions where code = $1`,
      [key],
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          approvalActor: row.approval_actor,
          code: row.code,
          valueSchemaVersion: row.value_schema_version,
        })
      : undefined;
  }

  async findActive(
    transaction: ActorScopedTransaction,
    key: ConfigurationKey,
    at: UtcInstant,
  ): Promise<ConfigurationRevision | undefined> {
    const result = await transaction.query<RevisionRow>(
      `${revisionSelection}
       where definition_code = $1 and lifecycle = 'ACTIVE'
         and effective_from <= $2
         and (effective_until is null or effective_until > $2)`,
      [key, at],
    );
    const row = result.rows[0];
    return row ? toRevision(row) : undefined;
  }

  async findRevisionForUpdate(
    transaction: ActorScopedTransaction,
    revisionId: string,
  ): Promise<ConfigurationRevision | undefined> {
    const result = await transaction.query<RevisionRow>(
      `${revisionSelection} where id = $1 for update`,
      [revisionId],
    );
    const row = result.rows[0];
    return row ? toRevision(row) : undefined;
  }

  async createDraft(
    transaction: ActorScopedTransaction,
    input: Parameters<ConfigurationPersistence['createDraft']>[1],
  ): Promise<ConfigurationRevision> {
    await transaction.query(
      `select pg_advisory_xact_lock(hashtextextended('configuration:' || $1, 0))`,
      [input.definition.code],
    );
    const next = await transaction.query<{ revision_number: number }>(
      `select coalesce(max(revision_number), 0)::integer + 1 as revision_number
       from config.configuration_revisions where definition_code = $1`,
      [input.definition.code],
    );
    const [actorKind, principalId] = attributionValues(input.actor);
    const inserted = await transaction.query<RevisionRow>(
      `insert into config.configuration_revisions
         (definition_code, revision_number, value_json, value_schema_version,
          authored_by_actor_kind, authored_by_principal_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, definition_code, revision_number, value_json, value_schema_version,
                 lifecycle, effective_from`,
      [
        input.definition.code,
        next.rows[0]?.revision_number ?? 1,
        input.value,
        input.definition.valueSchemaVersion,
        actorKind,
        principalId,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error('Configuration draft insert returned no row.');
    return toRevision(row);
  }

  async activateDraft(
    transaction: ActorScopedTransaction,
    input: Parameters<ConfigurationPersistence['activateDraft']>[1],
  ): Promise<ConfigurationRevision | undefined> {
    const draft = await transaction.query<{ definition_code: ConfigurationKey }>(
      `select definition_code from config.configuration_revisions
       where id = $1 and lifecycle = 'DRAFT' for update`,
      [input.revisionId],
    );
    const key = draft.rows[0]?.definition_code;
    if (!key) return undefined;
    await transaction.query(
      `update config.configuration_revisions
       set lifecycle = 'RETIRED', retired_at = $2, effective_until = $2,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where definition_code = $1 and lifecycle = 'ACTIVE'`,
      [key, input.effectiveFrom],
    );
    const [actorKind, principalId] = attributionValues(input.actor);
    const activated = await transaction.query<RevisionRow>(
      `update config.configuration_revisions
       set lifecycle = 'ACTIVE', effective_from = $2,
           approved_by_actor_kind = $3, approved_by_principal_id = $4,
           activation_reason_code = $5,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT'
       returning id, definition_code, revision_number, value_json, value_schema_version,
                 lifecycle, effective_from`,
      [input.revisionId, input.effectiveFrom, actorKind, principalId, input.reasonCode],
    );
    const row = activated.rows[0];
    return row ? toRevision(row) : undefined;
  }
}

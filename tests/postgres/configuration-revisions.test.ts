import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ConfigurationService,
  type ConfigurationAuditWriter,
  type ConfigurationValueValidator,
} from '../../src/modules/business-configuration';
import { PostgresConfigurationRepository } from '../../src/modules/business-configuration/infrastructure/postgres/configuration-repository';
import { withActorTransaction } from '../../src/platform/database';
import { parseUtcInstant } from '../../src/shared/kernel';
import { p1ActorContexts, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

const validator: ConfigurationValueValidator = {
  accepts: (_key, schemaVersion, value) =>
    schemaVersion === 1 && typeof value.synthetic === 'string',
};

const audit: ConfigurationAuditWriter = {
  configurationActivated: async (transaction, input) => {
    const principalId = input.actor.actorKind === 'manager' ? input.actor.principalId : null;
    await transaction.query(
      `insert into audit.events
         (event_type, actor_kind, actor_principal_id, target_type, target_id,
          operation, outcome, correlation_id, safe_reason_code, metadata_json)
       values
         ('CONFIGURATION_ACTIVATED', $1, $2, 'ConfigurationRevision', $3,
          'ACTIVATE_CONFIGURATION', 'SUCCEEDED', $4, $5::text,
          jsonb_build_object('config_code', $6::text, 'reason_code', $5::text))`,
      [
        input.actor.actorKind,
        principalId,
        input.revisionId,
        input.correlationId,
        input.reasonCode,
        input.configurationKey,
      ],
    );
  },
};

function instant(value: string) {
  const result = parseUtcInstant(value);
  if (!result.ok) throw new Error('Invalid test instant.');
  return result.value;
}

describe('typed configuration persistence', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  const repository = new PostgresConfigurationRepository();
  const service = new ConfigurationService(repository, validator, audit);

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('configuration_revisions');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = new Pool({ connectionString: database.connectionString });
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('activates revisions atomically, retires the prior value, and appends audit evidence', async () => {
    const firstDraft = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      service.createDraft(transaction, { key: 'CFG-001', value: { synthetic: 'قيمة 1' } }),
    );
    expect(firstDraft.ok).toBe(true);
    if (!firstDraft.ok) return;
    const firstActivation = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      (transaction) =>
        service.activateDraft(transaction, {
          correlationId: '60000000-0000-4000-8000-000000000001',
          effectiveFrom: instant('2026-07-16T12:00:00.000Z'),
          reasonCode: 'TEST_FIRST_ACTIVATION',
          revisionId: firstDraft.value.id,
        }),
    );
    expect(firstActivation.ok).toBe(true);

    const secondDraft = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      (transaction) =>
        service.createDraft(transaction, { key: 'CFG-001', value: { synthetic: 'قيمة 2\u202e' } }),
    );
    if (!secondDraft.ok) throw new Error('Second synthetic configuration draft failed.');
    await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      service.activateDraft(transaction, {
        correlationId: '60000000-0000-4000-8000-000000000002',
        effectiveFrom: instant('2026-07-16T13:00:00.000Z'),
        reasonCode: 'TEST_SECOND_ACTIVATION',
        revisionId: secondDraft.value.id,
      }),
    );

    const state = await owner.query<{ lifecycle: string; value: string }>(
      `select lifecycle, value_json->>'synthetic' as value
       from config.configuration_revisions order by revision_number`,
    );
    expect(state.rows).toEqual([
      { lifecycle: 'RETIRED', value: 'قيمة 1' },
      { lifecycle: 'ACTIVE', value: 'قيمة 2\u202e' },
    ]);
    const evidence = await owner.query<{ count: number }>(
      `select count(*)::integer as count from audit.events
       where event_type = 'CONFIGURATION_ACTIVATED'`,
    );
    expect(evidence.rows[0]?.count).toBe(2);
  });

  it('keeps active values immutable and enforces one active revision', async () => {
    await expect(
      owner.query(
        `update config.configuration_revisions
         set value_json = '{"synthetic":"tampered"}'::jsonb
         where lifecycle = 'ACTIVE'`,
      ),
    ).rejects.toMatchObject({ code: '55000' });
    const active = await owner.query<{ count: number }>(
      `select count(*)::integer as count from config.configuration_revisions
       where definition_code = 'CFG-001' and lifecycle = 'ACTIVE'`,
    );
    expect(active.rows[0]?.count).toBe(1);
  });
});

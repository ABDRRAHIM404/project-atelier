import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withActorTransaction } from '../../src/platform/database';
import type { ResolvedActorContext } from '../../src/shared/kernel';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

type MatrixCase = Readonly<{
  actor: ResolvedActorContext;
  auditCount: number;
  businessProfileCount: number;
  customerCount: number;
  idempotencyCount: number;
  name: string;
}>;

describe('generated P1 RLS authorization matrix', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('authorization_matrix');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    await owner.query(`insert into config.business_profile (singleton_key) values (true)`);
    await owner.query(
      `insert into iam.external_identities
         (provider, provider_subject, principal_id, verified_email_snapshot)
       values ('clerk', 'synthetic_customer_a', $1, 'customer-a@example.invalid')`,
      [p1FixtureIds.customerAPrincipal],
    );
    await owner.query(
      `insert into audit.events
         (event_type, actor_kind, actor_principal_id, target_type, operation,
          outcome, correlation_id, metadata_json)
       values
         ('MATRIX_FIXTURE', 'manager', $1, 'AuthorizationMatrix', 'CREATE_FIXTURE',
          'SUCCEEDED', '71000000-0000-4000-8000-000000000001', '{}'::jsonb)`,
      [p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into ops.idempotency_records
         (scope_actor_kind, scope_principal_id, api_version, operation, target_type,
          target_id, idempotency_key, request_digest, lease_expires_at)
       values
         ('customer', $1, 'v1', 'MATRIX_TEST', 'Customer', $2,
          'matrix-key-customer-a', repeat('a', 64), clock_timestamp() + interval '1 minute')`,
      [p1FixtureIds.customerAPrincipal, p1FixtureIds.customerA],
    );
    await owner.query(
      `insert into ops.jobs
         (handler_type, handler_version, dedupe_key, payload_json, payload_schema_version,
          max_attempts)
       values ('MATRIX_JOB', 1, 'matrix-job', '{}'::jsonb, 1, 3)`,
    );
    pool = new Pool({ connectionString: database.connectionString, max: 8 });
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  const cases: readonly MatrixCase[] = [
    {
      actor: p1ActorContexts.visitor,
      auditCount: 0,
      businessProfileCount: 1,
      customerCount: 0,
      idempotencyCount: 0,
      name: 'Visitor',
    },
    {
      actor: p1ActorContexts.customerA,
      auditCount: 0,
      businessProfileCount: 1,
      customerCount: 1,
      idempotencyCount: 1,
      name: 'Customer A',
    },
    {
      actor: p1ActorContexts.customerB,
      auditCount: 0,
      businessProfileCount: 1,
      customerCount: 1,
      idempotencyCount: 0,
      name: 'Customer B',
    },
    {
      actor: p1ActorContexts.managerPassword,
      auditCount: 0,
      businessProfileCount: 1,
      customerCount: 2,
      idempotencyCount: 0,
      name: 'Manager without MFA',
    },
    {
      actor: p1ActorContexts.managerMfa,
      auditCount: 1,
      businessProfileCount: 1,
      customerCount: 2,
      idempotencyCount: 0,
      name: 'Manager with MFA',
    },
  ];

  it.each(cases)('$name receives only the approved representative rows', async (matrixCase) => {
    const counts = await withActorTransaction(pool, matrixCase.actor, async (transaction) => {
      const customers = await transaction.query<{ count: number }>(
        'select count(*)::integer as count from iam.customers',
      );
      const business = await transaction.query<{ count: number }>(
        'select count(*)::integer as count from config.business_profile',
      );
      const audit = await transaction.query<{ count: number }>(
        'select count(*)::integer as count from audit.events',
      );
      const idempotency = await transaction.query<{ count: number }>(
        'select count(*)::integer as count from ops.idempotency_records',
      );
      return {
        audit: audit.rows[0]?.count,
        business: business.rows[0]?.count,
        customers: customers.rows[0]?.count,
        idempotency: idempotency.rows[0]?.count,
      };
    });
    expect(counts).toEqual({
      audit: matrixCase.auditCount,
      business: matrixCase.businessProfileCount,
      customers: matrixCase.customerCount,
      idempotency: matrixCase.idempotencyCount,
    });
  });

  it('keeps system jobs inside the operations boundary', async () => {
    const jobs = await withActorTransaction(pool, p1ActorContexts.systemJob, (transaction) =>
      transaction.query<{ count: number }>('select count(*)::integer as count from ops.jobs'),
    );
    expect(jobs.rows[0]?.count).toBe(1);

    await expect(
      withActorTransaction(pool, p1ActorContexts.systemJob, (transaction) =>
        transaction.query('select id from iam.customers'),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('permits a signed provider actor to synchronize identities but not browse Customer profiles', async () => {
    const result = await withActorTransaction(
      pool,
      p1ActorContexts.providerWebhook,
      async (transaction) => {
        const mappings = await transaction.query<{ count: number }>(
          'select count(*)::integer as count from iam.external_identities',
        );
        const customers = await transaction.query<{ count: number }>(
          'select count(*)::integer as count from iam.customers',
        );
        return { customers: customers.rows[0]?.count, mappings: mappings.rows[0]?.count };
      },
    );
    expect(result).toEqual({ customers: 0, mappings: 1 });
  });

  it('maintains isolation across a burst of pooled concurrent actors', async () => {
    const actors = Array.from({ length: 40 }, (_, index) =>
      index % 2 === 0 ? p1ActorContexts.customerA : p1ActorContexts.customerB,
    );
    const visible = await Promise.all(
      actors.map((actor) =>
        withActorTransaction(pool, actor, (transaction) =>
          transaction.query<{ id: string }>('select id from iam.customers'),
        ),
      ),
    );
    expect(
      visible.every((result, index) => {
        const expected = index % 2 === 0 ? p1FixtureIds.customerA : p1FixtureIds.customerB;
        return result.rows.length === 1 && result.rows[0]?.id === expected;
      }),
    ).toBe(true);
  });
});

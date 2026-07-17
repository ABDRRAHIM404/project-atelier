import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withActorTransaction } from '../../src/platform/database';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

describe('transaction-local actor context and RLS', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('rls_context');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = new Pool({ connectionString: database.connectionString, max: 4 });
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('fails closed when the runtime role has no resolved actor context', async () => {
    const result = await owner.query<{ count: number }>(
      `begin;
       set local role atelier_runtime;
       select count(*)::integer as count from iam.customers;
       rollback;`,
    );
    const selected = Array.isArray(result)
      ? result.find((item) => item.command === 'SELECT')
      : result;
    expect(selected?.rows[0]?.count).toBe(0);
  });

  it('shows each customer only their own profile and hides guessed identifiers', async () => {
    const [customerA, customerB] = await Promise.all([
      withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
        transaction.query<{ id: string }>('select id from iam.customers order by id'),
      ),
      withActorTransaction(pool, p1ActorContexts.customerB, (transaction) =>
        transaction.query<{ id: string }>('select id from iam.customers order by id'),
      ),
    ]);
    expect(customerA.rows.map(({ id }) => id)).toEqual([p1FixtureIds.customerA]);
    expect(customerB.rows.map(({ id }) => id)).toEqual([p1FixtureIds.customerB]);

    const guessed = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      transaction.query<{ id: string }>('select id from iam.customers where id = $1', [
        p1FixtureIds.customerB,
      ]),
    );
    expect(guessed.rows).toEqual([]);
  });

  it('does not leak actor context when a pooled connection is reused', async () => {
    const singleConnectionPool = new Pool({ connectionString: database.connectionString, max: 1 });
    try {
      await withActorTransaction(singleConnectionPool, p1ActorContexts.customerA, (transaction) =>
        transaction.query('select id from iam.customers'),
      );

      const neutral = await singleConnectionPool.query<{
        actor_kind: string;
        current_role: string;
        principal_id: string;
      }>(
        `select
           current_role,
           current_setting('atelier.actor_kind', true) as actor_kind,
           current_setting('atelier.principal_id', true) as principal_id`,
      );
      expect(neutral.rows[0]).toEqual({
        actor_kind: '',
        current_role: 'postgres',
        principal_id: '',
      });

      const customerB = await withActorTransaction(
        singleConnectionPool,
        p1ActorContexts.customerB,
        (transaction) => transaction.query<{ id: string }>('select id from iam.customers'),
      );
      expect(customerB.rows.map(({ id }) => id)).toEqual([p1FixtureIds.customerB]);
    } finally {
      await singleConnectionPool.end();
    }
  });

  it('does not give a manager write authority merely through row visibility', async () => {
    const update = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      transaction.query(
        `update iam.customers set preferred_locale = 'en' where id = $1 returning id`,
        [p1FixtureIds.customerA],
      ),
    );
    expect(update.rowCount).toBe(0);
  });
});

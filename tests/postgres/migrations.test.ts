import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyVerifiedMigrations,
  readVerifiedMigrationChain,
} from '../../scripts/database/migration-manifest.mjs';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

describe('Lean V1 PostgreSQL migration foundation', () => {
  let database: IsolatedPostgresDatabase;
  let client: Client;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('migration_foundation');
    client = new Client({ connectionString: database.connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
    await database?.dispose();
  });

  it('runs on the production PostgreSQL major and applies from empty', async () => {
    const version = await client.query<{ server_version: string }>('show server_version');
    expect(version.rows[0]?.server_version).toBe('17.6');

    const tables = await client.query<{ schema_name: string; table_name: string }>(
      `select schemaname as schema_name, tablename as table_name
       from pg_tables
       where schemaname in ('iam', 'config', 'audit', 'ops', 'cms', 'catalog', 'files',
         'projects', 'quotes', 'orders', 'payments', 'production', 'fulfilment',
         'messaging', 'notifications')
       order by schemaname, tablename`,
    );
    expect(tables.rows).toHaveLength(63);
    expect(tables.rows).toContainEqual({ schema_name: 'iam', table_name: 'principals' });
    expect(tables.rows).toContainEqual({ schema_name: 'ops', table_name: 'outbox_events' });
  });

  it('matches the immutable ordered repository manifest', async () => {
    const migrations = await readVerifiedMigrationChain();
    expect(
      migrations.map(({ file, id, transactionSafe }) => ({ file, id, transactionSafe })),
    ).toEqual([
      {
        file: '20260716000100_p1_trusted_foundation.sql',
        id: '20260716000100',
        transactionSafe: true,
      },
      {
        file: '20260716000200_p2_discovery_content_files.sql',
        id: '20260716000200',
        transactionSafe: true,
      },
      {
        file: '20260716000300_lean_core_workflow.sql',
        id: '20260716000300',
        transactionSafe: true,
      },
      {
        file: '20260716000400_customer_fulfilment_details.sql',
        id: '20260716000400',
        transactionSafe: true,
      },
    ]);

    await expect(applyVerifiedMigrations(client)).resolves.toHaveLength(4);
    const history = await client.query<{ name: string; version: string }>(
      `select version, name from supabase_migrations.schema_migrations order by version`,
    );
    expect(history.rows).toEqual([
      { name: 'p1_trusted_foundation', version: '20260716000100' },
      { name: 'p2_discovery_content_files', version: '20260716000200' },
      { name: 'lean_core_workflow', version: '20260716000300' },
      { name: 'customer_fulfilment_details', version: '20260716000400' },
    ]);
  });

  it('creates non-owner, non-bypass application roles', async () => {
    const roles = await client.query<{
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolinherit: boolean;
      rolname: string;
      rolsuper: boolean;
    }>(
      `select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolbypassrls
       from pg_roles
       where rolname in ('atelier_runtime', 'atelier_job', 'atelier_identity_resolver')
       order by rolname`,
    );
    expect(roles.rows).toEqual([
      {
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolname: 'atelier_identity_resolver',
        rolsuper: false,
      },
      {
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolname: 'atelier_job',
        rolsuper: false,
      },
      {
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolname: 'atelier_runtime',
        rolsuper: false,
      },
    ]);

    const ownership = await client.query<{ forbidden_owner_count: number }>(
      `select count(*)::integer as forbidden_owner_count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_roles r on r.oid = c.relowner
       where n.nspname in ('iam', 'config', 'audit', 'ops', 'cms', 'catalog', 'files',
         'projects', 'quotes', 'orders', 'payments', 'production', 'fulfilment',
         'messaging', 'notifications')
         and r.rolname in ('atelier_runtime', 'atelier_job', 'atelier_identity_resolver')`,
    );
    expect(ownership.rows[0]?.forbidden_owner_count).toBe(0);

    const resolverPrivileges = await client.query<{
      can_execute_resolver: boolean;
      can_select_identity_table: boolean;
    }>(
      `select
         has_function_privilege(
           'atelier_identity_resolver',
           'iam.resolve_external_identity(text,text)',
           'EXECUTE'
         ) as can_execute_resolver,
         has_table_privilege(
           'atelier_identity_resolver',
           'iam.external_identities',
           'SELECT'
         ) as can_select_identity_table`,
    );
    expect(resolverPrivileges.rows[0]).toEqual({
      can_execute_resolver: true,
      can_select_identity_table: false,
    });

    const jobPrivileges = await client.query<{
      can_select_customers: boolean;
      can_select_jobs: boolean;
    }>(
      `select
         has_table_privilege('atelier_job', 'iam.customers', 'SELECT') as can_select_customers,
         has_table_privilege('atelier_job', 'ops.jobs', 'SELECT') as can_select_jobs`,
    );
    expect(jobPrivileges.rows[0]).toEqual({
      can_select_customers: false,
      can_select_jobs: true,
    });
  });

  it('forces RLS on every application relation', async () => {
    const rls = await client.query<{
      forced_count: number;
      relation_count: number;
      secured_count: number;
    }>(
      `select
         count(*)::integer as relation_count,
         count(*) filter (where c.relrowsecurity)::integer as secured_count,
         count(*) filter (where c.relforcerowsecurity)::integer as forced_count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'r'
         and n.nspname in ('iam', 'config', 'audit', 'ops', 'cms', 'catalog', 'files',
         'projects', 'quotes', 'orders', 'payments', 'production', 'fulfilment',
         'messaging', 'notifications')`,
    );
    expect(rls.rows[0]).toEqual({ forced_count: 63, relation_count: 63, secured_count: 63 });
  });

  it('registers configuration decisions without inventing values', async () => {
    const result = await client.query<{
      active_count: number;
      definitions: number;
      profiles: number;
    }>(
      `select
         (select count(*)::integer from config.configuration_definitions) as definitions,
         (select count(*)::integer from config.configuration_revisions where lifecycle = 'ACTIVE') as active_count,
         (select count(*)::integer from config.business_profile) as profiles`,
    );
    expect(result.rows[0]).toEqual({ active_count: 0, definitions: 8, profiles: 0 });
  });

  it('isolates concurrent disposable databases', async () => {
    const [left, right] = await Promise.all([
      createIsolatedPostgresDatabase('parallel_left'),
      createIsolatedPostgresDatabase('parallel_right'),
    ]);
    try {
      expect(left.name).not.toBe(right.name);
      const [leftClient, rightClient] = [
        new Client({ connectionString: left.connectionString }),
        new Client({ connectionString: right.connectionString }),
      ];
      await Promise.all([leftClient.connect(), rightClient.connect()]);
      try {
        await leftClient.query(`insert into config.business_profile (singleton_key) values (true)`);
        const counts = await Promise.all([
          leftClient.query<{ count: number }>(
            'select count(*)::integer as count from config.business_profile',
          ),
          rightClient.query<{ count: number }>(
            'select count(*)::integer as count from config.business_profile',
          ),
        ]);
        expect(counts.map((result) => result.rows[0]?.count)).toEqual([1, 0]);
      } finally {
        await Promise.all([leftClient.end(), rightClient.end()]);
      }
    } finally {
      await Promise.all([left.dispose(), right.dispose()]);
    }
  });
});

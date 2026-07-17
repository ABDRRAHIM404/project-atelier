import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

describe('P1 PostgreSQL conventions', () => {
  let database: IsolatedPostgresDatabase;
  let client: Client;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('data_conventions');
    client = new Client({ connectionString: database.connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
    await database?.dispose();
  });

  it('uses timezone-aware instants, integer versions, and no floating-point data', async () => {
    const invalidTimes = await client.query(
      `select table_schema, table_name, column_name
       from information_schema.columns
       where table_schema in ('iam', 'config', 'audit', 'ops')
         and column_name like '%\\_at' escape '\\'
         and data_type <> 'timestamp with time zone'`,
    );
    expect(invalidTimes.rows).toEqual([]);

    const invalidVersions = await client.query(
      `select table_schema, table_name
       from information_schema.columns
       where table_schema in ('iam', 'config', 'audit', 'ops')
         and column_name = 'record_version'
         and (data_type <> 'integer' or is_nullable <> 'NO')`,
    );
    expect(invalidVersions.rows).toEqual([]);

    const floatingPoint = await client.query(
      `select table_schema, table_name, column_name
       from information_schema.columns
       where table_schema in ('iam', 'config', 'audit', 'ops')
         and data_type in ('real', 'double precision')`,
    );
    expect(floatingPoint.rows).toEqual([]);
  });

  it('pairs every bounded JSON document with an explicit schema version', async () => {
    const columns = await client.query<{ column_name: string; table_name: string }>(
      `select table_name, column_name
       from information_schema.columns
       where table_schema in ('config', 'audit', 'ops')
         and data_type = 'jsonb'
       order by table_name, column_name`,
    );
    expect(columns.rows).toEqual([
      { column_name: 'value_json', table_name: 'configuration_revisions' },
      { column_name: 'metadata_json', table_name: 'events' },
      { column_name: 'response_json', table_name: 'idempotency_records' },
      { column_name: 'safe_diagnostic_json', table_name: 'job_attempts' },
      { column_name: 'payload_json', table_name: 'jobs' },
      { column_name: 'payload_json', table_name: 'outbox_events' },
    ]);

    const missingSchemaVersions = await client.query(
      `with json_columns as (
         select table_schema, table_name, column_name,
           regexp_replace(column_name, '_json$', '_schema_version') as expected_schema_column
         from information_schema.columns
         where table_schema in ('config', 'audit', 'ops') and data_type = 'jsonb'
       )
       select j.*
       from json_columns j
       where not exists (
         select 1 from information_schema.columns c
         where c.table_schema = j.table_schema
           and c.table_name = j.table_name
           and c.column_name = j.expected_schema_column
       )`,
    );
    expect(missingSchemaVersions.rows).toEqual([]);
  });

  it('contains no cascading foreign key deletion', async () => {
    const cascades = await client.query(
      `select conname
       from pg_constraint
       where contype = 'f' and confdeltype = 'c'
         and connamespace in (
           select oid from pg_namespace where nspname in ('iam', 'config', 'audit', 'ops')
         )`,
    );
    expect(cascades.rows).toEqual([]);
  });
});

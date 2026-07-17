import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

import { applyVerifiedMigrations } from '../../scripts/database/migration-manifest.mjs';
import { assertSafeTestEnvironment } from './isolated-test-environment';

const SAFE_DATABASE_NAME = /^atelier_test_[a-z0-9_]+$/u;

function adminUrl(): URL {
  assertSafeTestEnvironment();
  const candidate = process.env.ATELIER_TEST_POSTGRES_ADMIN_URL;
  if (!candidate) throw new Error('PostgreSQL tests must run through npm run test:postgres.');
  const url = new URL(candidate);
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('PostgreSQL test teardown is restricted to a loopback host.');
  }
  if (url.pathname !== '/postgres') {
    throw new Error('PostgreSQL test administration must target the disposable postgres database.');
  }
  return url;
}

function quotedIdentifier(identifier: string): string {
  if (!SAFE_DATABASE_NAME.test(identifier))
    throw new Error('Unsafe PostgreSQL test database name.');
  return `"${identifier}"`;
}

export type IsolatedPostgresDatabase = Readonly<{
  connectionString: string;
  dispose: () => Promise<void>;
  name: string;
}>;

export async function createIsolatedPostgresDatabase(
  label: string,
): Promise<IsolatedPostgresDatabase> {
  const safeLabel = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '_')
    .replaceAll(/^_|_$/gu, '');
  const name = `atelier_test_${safeLabel}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const adminConnectionString = adminUrl().toString();
  const admin = new Client({ connectionString: adminConnectionString });
  await admin.connect();
  await admin.query(`create database ${quotedIdentifier(name)} template template0 encoding 'UTF8'`);
  await admin.end();

  const databaseUrl = adminUrl();
  databaseUrl.pathname = `/${name}`;
  const client = new Client({ connectionString: databaseUrl.toString() });
  await client.connect();
  try {
    await applyVerifiedMigrations(client);
  } finally {
    await client.end();
  }

  let disposed = false;
  return Object.freeze({
    connectionString: databaseUrl.toString(),
    name,
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      const teardown = new Client({ connectionString: adminConnectionString });
      await teardown.connect();
      try {
        await teardown.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
          [name],
        );
        await teardown.query(`drop database ${quotedIdentifier(name)}`);
      } finally {
        await teardown.end();
      }
    },
  });
}

export async function createRestoredPostgresClone(
  sourceDatabaseName: string,
  label: string,
): Promise<IsolatedPostgresDatabase> {
  if (!SAFE_DATABASE_NAME.test(sourceDatabaseName)) {
    throw new Error('Unsafe PostgreSQL source database name.');
  }
  const safeLabel = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '_')
    .replaceAll(/^_|_$/gu, '');
  const name = `atelier_test_${safeLabel}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const adminConnectionString = adminUrl().toString();
  const admin = new Client({ connectionString: adminConnectionString });
  await admin.connect();
  try {
    await admin.query(
      `create database ${quotedIdentifier(name)} template ${quotedIdentifier(sourceDatabaseName)}`,
    );
  } finally {
    await admin.end();
  }

  const databaseUrl = adminUrl();
  databaseUrl.pathname = `/${name}`;
  let disposed = false;
  return Object.freeze({
    connectionString: databaseUrl.toString(),
    name,
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      const teardown = new Client({ connectionString: adminConnectionString });
      await teardown.connect();
      try {
        await teardown.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
          [name],
        );
        await teardown.query(`drop database ${quotedIdentifier(name)}`);
      } finally {
        await teardown.end();
      }
    },
  });
}

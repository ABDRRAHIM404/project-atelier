import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MIGRATION_FILE_PATTERN = /^(?<id>[0-9]{14})_(?<name>[a-z0-9_]+)\.sql$/u;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function readVerifiedMigrationChain(projectRoot = process.cwd()) {
  const migrationsDirectory = path.join(projectRoot, 'supabase', 'migrations');
  const manifestPath = path.join(migrationsDirectory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (manifest.manifestVersion !== 1 || !Array.isArray(manifest.migrations)) {
    throw new Error('The migration manifest is missing or has an unsupported version.');
  }

  const directoryFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const manifestFiles = manifest.migrations.map((migration) => migration.file);

  if (JSON.stringify(directoryFiles) !== JSON.stringify(manifestFiles)) {
    throw new Error('Migration files and the ordered repository manifest do not agree.');
  }

  let previousId = '';
  const verified = [];

  for (const migration of manifest.migrations) {
    const match = MIGRATION_FILE_PATTERN.exec(migration.file);
    if (!match?.groups || match.groups.id !== migration.id || migration.id <= previousId) {
      throw new Error(`Invalid or unordered migration identity: ${migration.file}`);
    }
    if (!migration.transactionSafe) {
      throw new Error(
        `The P1 harness cannot apply a non-transactional migration: ${migration.file}`,
      );
    }

    const sql = await readFile(path.join(migrationsDirectory, migration.file), 'utf8');
    const actualChecksum = sha256(sql);
    if (actualChecksum !== migration.checksumSha256) {
      throw new Error(`Migration checksum mismatch: ${migration.file}`);
    }

    verified.push(Object.freeze({ ...migration, sql }));
    previousId = migration.id;
  }

  return Object.freeze(verified);
}

export async function applyVerifiedMigrations(client, projectRoot = process.cwd()) {
  const migrations = await readVerifiedMigrationChain(projectRoot);

  await client.query('begin');
  try {
    await client.query("set local lock_timeout = '4s'");
    await client.query('create schema if not exists supabase_migrations');
    await client.query(
      `create table if not exists supabase_migrations.schema_migrations
         (version text not null primary key)`,
    );
    await client.query(
      'alter table supabase_migrations.schema_migrations add column if not exists statements text[]',
    );
    await client.query(
      'alter table supabase_migrations.schema_migrations add column if not exists name text',
    );
    // Supabase provides these roles and this schema in hosted environments.
    // The local PostgreSQL harness supplies only the contracts used by migrations.
    await client.query(
      `do $bootstrap$
       begin
         if not exists (select 1 from pg_roles where rolname = 'authenticated') then
           create role authenticated nologin;
         end if;
         if not exists (select 1 from pg_roles where rolname = 'service_role') then
           create role service_role nologin;
         end if;
       end
       $bootstrap$`,
    );
    await client.query('create schema if not exists storage');
    await client.query(
      `create table if not exists storage.buckets (
         id text primary key,
         name text not null unique,
         public boolean not null default false,
         file_size_limit bigint,
         allowed_mime_types text[]
       )`,
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }

  const history = await client.query(
    "select version, coalesce(name, '') as name from supabase_migrations.schema_migrations order by version",
  );
  const repositoryIds = new Set(migrations.map((migration) => migration.id));
  const unexpected = history.rows.filter((migration) => !repositoryIds.has(migration.version));
  if (unexpected.length > 0) {
    throw new Error('Database migration history contains versions absent from the repository.');
  }
  const applied = new Set(history.rows.map((migration) => migration.version));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await client.query('begin');
    try {
      await client.query("set local lock_timeout = '4s'");
      await client.query(migration.sql);
      const name = migration.file.slice(migration.id.length + 1, -'.sql'.length);
      await client.query(
        `insert into supabase_migrations.schema_migrations(version, name, statements)
         values ($1, $2, $3)`,
        [migration.id, name, [migration.sql]],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  const appliedHistory = await client.query(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  if (
    JSON.stringify(appliedHistory.rows.map((migration) => migration.version)) !==
    JSON.stringify(migrations.map((migration) => migration.id))
  ) {
    throw new Error('Database and repository migration history do not agree.');
  }

  return migrations;
}
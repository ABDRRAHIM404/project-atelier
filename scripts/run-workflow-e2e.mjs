import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

import { applyVerifiedMigrations } from './database/migration-manifest.mjs';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: options.stdio ?? 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}.`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? 1}.`));
    });
  });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a port.');
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Next.js server exited before becoming ready.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while the local server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Next.js server did not become ready in time.');
}

if (process.env.SKIP_E2E_BUILD !== 'true') {
  await run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    env: { APP_ENV: 'test' },
  });
}

const directory = await mkdtemp(path.join(tmpdir(), 'atelier-workflow-e2e-'));
const postgresPort = await reservePort();
const applicationPort = 3000;
const password = randomUUID();
const database = new EmbeddedPostgres({
  databaseDir: path.join(directory, 'postgres'),
  password,
  persistent: false,
  port: postgresPort,
  postgresFlags: ['-c', 'timezone=UTC'],
  user: 'postgres',
});
let server;

try {
  await database.initialise();
  await database.start();
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${postgresPort}/postgres`;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await applyVerifiedMigrations(client);
  } finally {
    await client.end();
  }

  await run(process.execPath, ['scripts/seed-local-demo.mjs'], {
    env: { APP_ENV: 'test', DATABASE_URL: databaseUrl },
  });

  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', String(applicationPort)],
    {
      env: {
        ...process.env,
        ALLOW_DEMO_AUTH: 'true',
        APP_ENV: 'test',
        DATABASE_URL: databaseUrl,
        PORT: String(applicationPort),
      },
      stdio: 'inherit',
    },
  );
  await waitForServer(`http://127.0.0.1:${applicationPort}`, server);
  await run(
    path.resolve('node_modules/.bin/playwright'),
    ['test', 'tests/e2e/workflow.spec.ts', '--config=playwright.workflow.config.ts'],
    { env: { CI: 'false' } },
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  await database.stop().catch(() => undefined);
  await rm(directory, { force: true, recursive: true });
}

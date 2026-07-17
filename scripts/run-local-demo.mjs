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

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...environment },
      stdio: 'inherit',
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

const directory = await mkdtemp(path.join(tmpdir(), 'atelier-local-demo-'));
const postgresPort = await reservePort();
const password = randomUUID();
const database = new EmbeddedPostgres({
  databaseDir: path.join(directory, 'postgres'),
  password,
  persistent: false,
  port: postgresPort,
  postgresFlags: ['-c', 'timezone=UTC'],
  user: 'postgres',
});
let application;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  if (application && application.exitCode === null) {
    application.kill('SIGTERM');
    await new Promise((resolve) => application.once('exit', resolve));
  }
  await database.stop().catch(() => undefined);
  await rm(directory, { force: true, recursive: true });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void stop().finally(() => process.exit(0));
  });
}

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
    APP_ENV: 'development',
    DATABASE_URL: databaseUrl,
  });

  process.stdout.write('\nProject Atelier demo: http://127.0.0.1:3000\n');
  process.stdout.write('Use the customer/manager role switch inside the dashboard.\n\n');
  application = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], {
    env: {
      ...process.env,
      ALLOW_DEMO_AUTH: 'true',
      APP_ENV: 'development',
      DATABASE_URL: databaseUrl,
      PRIVATE_UPLOADS_READY: 'false',
    },
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    application.once('error', reject);
    application.once('exit', (code, signal) => {
      if (signal === 'SIGTERM' || code === 0) resolve();
      else reject(new Error(`Next.js demo exited with ${code ?? signal ?? 'unknown status'}.`));
    });
  });
} finally {
  await stop();
}

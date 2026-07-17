import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import EmbeddedPostgres from 'embedded-postgres';

async function createPostgresTestDirectory() {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL tests cannot run in a production application environment.');
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'project-atelier-postgres-test-'));
  return {
    path: directory,
    dispose: () => rm(directory, { force: true, recursive: true }),
  };
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not reserve a PostgreSQL test port.');
  }
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function runVitest(arguments_) {
  const executable = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vitest.cmd' : 'vitest',
  );
  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      env: { ...process.env, APP_ENV: 'test' },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Vitest terminated by ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

const environment = await createPostgresTestDirectory();
const port = await reservePort();
const ephemeralCredential = randomUUID();
const database = new EmbeddedPostgres({
  databaseDir: path.join(environment.path, 'postgres'),
  onError: (message) => {
    if (process.env.DEBUG_POSTGRES_TESTS === 'true') console.error(message);
  },
  onLog: (message) => {
    if (process.env.DEBUG_POSTGRES_TESTS === 'true') console.log(message);
  },
  password: ephemeralCredential,
  persistent: false,
  port,
  postgresFlags: ['-c', 'timezone=UTC'],
  user: 'postgres',
});

let exitCode = 1;
try {
  await database.initialise();
  await database.start();
  process.env.ATELIER_TEST_POSTGRES_ADMIN_URL = `postgresql://postgres:${ephemeralCredential}@127.0.0.1:${port}/postgres`;

  const requested = process.argv.slice(2);
  const mode = requested.shift() ?? 'postgres';
  if (mode !== 'all' && mode !== 'postgres') {
    throw new Error(`Unsupported PostgreSQL test mode: ${mode}`);
  }
  const vitestArguments = ['run'];
  if (mode === 'postgres') vitestArguments.push('--project', 'postgres');
  vitestArguments.push(...requested);
  exitCode = await runVitest(vitestArguments);
} finally {
  delete process.env.ATELIER_TEST_POSTGRES_ADMIN_URL;
  await database.stop().catch(() => undefined);
  await environment.dispose();
}

if (exitCode !== 0) process.exit(exitCode);

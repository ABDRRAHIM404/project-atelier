import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const environment = {
  ...process.env,
  APP_ENV: 'test',
  CHROME_PATH: chromium.executablePath(),
};

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, ['node_modules/@lhci/cli/src/cli.js', 'autorun']);
run(process.execPath, ['scripts/check-lighthouse-budgets.mjs']);

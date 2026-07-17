import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { runQualityCheck } from './run-p0-quality-gate.mjs';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const p1TaskIds = Object.freeze([
  'DAT-001',
  'DAT-002',
  'DAT-003',
  'DAT-004',
  'DAT-005',
  'DAT-006',
  'DAT-007',
  'IAM-001',
  'IAM-002',
  'IAM-003',
  'IAM-004',
  'IAM-005',
  'OPS-001',
  'TST-004',
  'TST-005',
  'TST-006',
]);

const checkDefinitions = Object.freeze([
  {
    id: 'migration-integrity',
    taskIds: ['DAT-001', 'DAT-007', 'TST-004'],
    requirementIds: ['G1-Migration-Chain', 'G1-Drift'],
    command: npmCommand,
    arguments: ['run', 'migrations:check'],
    artifacts: [],
  },
  {
    id: 'static',
    taskIds: ['DAT-001', 'IAM-001', 'IAM-005', 'OPS-001'],
    requirementIds: ['DoD-Static', 'G1-Boundaries'],
    command: npmCommand,
    arguments: ['run', 'verify:static'],
    artifacts: [],
  },
  {
    id: 'boundary-tests',
    taskIds: ['IAM-001', 'IAM-005', 'OPS-001'],
    requirementIds: ['G1-Boundaries'],
    command: npmCommand,
    arguments: ['run', 'test:boundaries'],
    artifacts: [],
  },
  {
    id: 'tooling-tests',
    taskIds: ['TST-004', 'TST-005', 'TST-006'],
    requirementIds: ['G1-Gate-Failure-Blocking'],
    command: npmCommand,
    arguments: ['run', 'test:tooling'],
    artifacts: [],
  },
  {
    id: 'unit-tests',
    taskIds: ['DAT-003', 'DAT-004', 'DAT-005', 'IAM-001', 'IAM-005', 'OPS-001'],
    requirementIds: ['DoD-Unit'],
    command: npmCommand,
    arguments: ['run', 'test:unit'],
    artifacts: [],
  },
  {
    id: 'integration-tests',
    taskIds: ['IAM-001', 'IAM-002', 'IAM-003', 'IAM-004', 'OPS-001', 'TST-006'],
    requirementIds: ['DoD-Integration', 'G1-Provider-Contracts'],
    command: npmCommand,
    arguments: ['run', 'test:integration'],
    artifacts: [],
  },
  {
    id: 'postgres-authorization-recovery',
    taskIds: [
      'DAT-001',
      'DAT-002',
      'DAT-003',
      'DAT-004',
      'DAT-005',
      'DAT-006',
      'DAT-007',
      'TST-004',
      'TST-005',
      'TST-006',
    ],
    requirementIds: ['G1-PostgreSQL', 'G1-RLS', 'G1-Durability', 'G1-Recovery'],
    command: npmCommand,
    arguments: ['run', 'test:postgres'],
    artifacts: [],
  },
  {
    id: 'coverage',
    taskIds: ['TST-004', 'TST-005', 'TST-006'],
    requirementIds: ['G1-Test-Evidence'],
    command: npmCommand,
    arguments: ['run', 'test:coverage'],
    artifacts: ['coverage/'],
  },
  {
    id: 'production-build',
    taskIds: ['IAM-003', 'IAM-004', 'IAM-005', 'OPS-001'],
    requirementIds: ['DoD-Production-Build'],
    command: npmCommand,
    arguments: ['run', 'build'],
    artifacts: [],
  },
  {
    id: 'browser-accessibility',
    taskIds: ['IAM-003', 'IAM-004', 'IAM-005'],
    requirementIds: ['DoD-Playwright', 'Q-A11Y-001', 'Q-L10N-002', 'G1-Auth-Paths'],
    command: npmCommand,
    arguments: ['run', 'test:e2e'],
    artifacts: ['playwright-report/', 'test-results/'],
  },
  {
    id: 'performance-regression',
    taskIds: ['IAM-003', 'IAM-004'],
    requirementIds: ['Q-WEB-001', 'Q-PERF-001'],
    command: npmCommand,
    arguments: ['run', 'test:performance'],
    artifacts: ['quality/evidence/runs/lighthouse/'],
  },
  {
    id: 'secret-scan',
    taskIds: ['DAT-007', 'IAM-001', 'IAM-002', 'OPS-001'],
    requirementIds: ['DoD-No-Secrets'],
    command: npmCommand,
    arguments: ['run', 'scan:secrets'],
    artifacts: [],
  },
  {
    id: 'dependency-audit',
    taskIds: ['DAT-001', 'IAM-001'],
    requirementIds: ['DoD-Supply-Chain'],
    command: npmCommand,
    arguments: ['audit'],
    artifacts: [],
  },
]);

function commandLabel(definition) {
  return [definition.command, ...definition.arguments].join(' ');
}

function notRunCheck(definition) {
  return {
    id: definition.id,
    taskIds: definition.taskIds,
    requirementIds: definition.requirementIds,
    command: commandLabel(definition),
    result: 'not-run',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    exitCode: null,
    artifacts: definition.artifacts,
    exception: null,
  };
}

function currentCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function createEvidence({ checks, owner, runId }) {
  return {
    schemaVersion: '1.0',
    runId,
    generatedAt: new Date().toISOString(),
    commit: currentCommit(),
    environment: {
      name: process.env.CI === 'true' ? 'ci' : 'local',
      ci: process.env.CI === 'true',
      node: process.version,
      platform: os.platform(),
      architecture: os.arch(),
    },
    owner,
    tasks: p1TaskIds,
    overallResult: checks.every((check) => check.result === 'passed') ? 'passed' : 'failed',
    checks,
  };
}

function evidenceMarkdown(evidence) {
  return [
    '# P1 G1 Quality Gate Evidence',
    '',
    `- Run: ${evidence.runId}`,
    `- Generated: ${evidence.generatedAt}`,
    `- Owner: ${evidence.owner}`,
    `- Environment: ${evidence.environment.name}`,
    `- Commit: ${evidence.commit ?? 'unavailable'}`,
    `- Result: ${evidence.overallResult}`,
    '',
    '| Check | Result | Exit code | Duration (ms) |',
    '|---|---|---:|---:|',
    ...evidence.checks.map(
      (check) =>
        `| ${check.id} | ${check.result} | ${check.exitCode ?? '—'} | ${check.durationMs ?? '—'} |`,
    ),
    '',
    'The JSON evidence file is authoritative and conforms to quality-evidence.schema.json.',
    '',
  ].join('\n');
}

async function writeEvidence(evidence) {
  const directory = path.resolve(process.cwd(), 'quality/evidence/runs');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(directory, 'p1-quality-gate.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    ),
    writeFile(path.join(directory, 'p1-quality-gate.md'), evidenceMarkdown(evidence), 'utf8'),
  ]);
}

const owner = process.env.QUALITY_OWNER?.trim() || 'local-operator';
const runId = process.env.QUALITY_RUN_ID?.trim() || `${Date.now()}-${randomUUID()}`;
const checks = [];

for (const definition of checkDefinitions) {
  console.log(`\n=== ${definition.id}: ${commandLabel(definition)} ===`);
  const result = runQualityCheck(definition);
  checks.push(result);
  if (result.result === 'failed') {
    checks.push(...checkDefinitions.slice(checks.length).map(notRunCheck));
    break;
  }
}

const evidence = createEvidence({ checks, owner, runId });
await writeEvidence(evidence);
console.log(`\nP1 G1 quality gate: ${evidence.overallResult.toUpperCase()}`);
if (evidence.overallResult !== 'passed') process.exitCode = 1;

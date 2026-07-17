import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const p0TaskIds = Object.freeze([
  'FND-001',
  'FND-002',
  'FND-003',
  'FND-004',
  'FND-005',
  'FND-006',
  'FND-007',
  'FND-008',
  'TST-001',
  'TST-002',
  'TST-003',
]);

const checkDefinitions = Object.freeze([
  {
    id: 'static',
    taskIds: ['FND-001', 'FND-002', 'FND-005', 'FND-006', 'FND-007', 'FND-008'],
    requirementIds: ['DoD-Static', 'G0-Boundaries'],
    command: npmCommand,
    arguments: ['run', 'verify:static'],
    artifacts: [],
  },
  {
    id: 'boundary-tests',
    taskIds: ['FND-002', 'FND-008'],
    requirementIds: ['G0-Boundaries'],
    command: npmCommand,
    arguments: ['run', 'test:boundaries'],
    artifacts: [],
  },
  {
    id: 'tooling-tests',
    taskIds: ['FND-008', 'TST-003'],
    requirementIds: ['T0-Failure-Blocking', 'TST-003-Evidence'],
    command: npmCommand,
    arguments: ['run', 'test:tooling'],
    artifacts: [],
  },
  {
    id: 'unit-tests',
    taskIds: ['FND-003', 'FND-004', 'FND-005', 'FND-006', 'FND-007', 'TST-001'],
    requirementIds: ['DoD-Unit'],
    command: npmCommand,
    arguments: ['run', 'test:unit'],
    artifacts: [],
  },
  {
    id: 'integration-tests',
    taskIds: ['TST-001'],
    requirementIds: ['DoD-Integration', 'G0-Isolation'],
    command: npmCommand,
    arguments: ['run', 'test:integration'],
    artifacts: [],
  },
  {
    id: 'coverage',
    taskIds: ['TST-001', 'TST-003'],
    requirementIds: ['G0-Test-Evidence'],
    command: npmCommand,
    arguments: ['run', 'test:coverage'],
    artifacts: ['coverage/'],
  },
  {
    id: 'production-build',
    taskIds: ['FND-001', 'FND-005', 'FND-006', 'FND-008'],
    requirementIds: ['DoD-Production-Build'],
    command: npmCommand,
    arguments: ['run', 'build'],
    artifacts: [],
  },
  {
    id: 'browser-accessibility',
    taskIds: ['FND-005', 'FND-008', 'TST-002'],
    requirementIds: ['Q-A11Y-001', 'Q-A11Y-002', 'Q-L10N-002', 'Q-L10N-003', 'Browser-Matrix-P0'],
    command: npmCommand,
    arguments: ['run', 'test:e2e'],
    artifacts: ['playwright-report/', 'test-results/'],
  },
  {
    id: 'performance',
    taskIds: ['FND-008'],
    requirementIds: [
      'Q-WEB-001',
      'Q-WEB-003',
      'Q-PERF-001',
      'Q-PERF-002',
      'Q-PERF-003',
      'Q-PERF-004',
      'Q-PERF-005',
    ],
    command: npmCommand,
    arguments: ['run', 'test:performance'],
    artifacts: ['quality/evidence/runs/lighthouse/'],
  },
  {
    id: 'secret-scan',
    taskIds: ['FND-006', 'FND-007', 'FND-008'],
    requirementIds: ['DoD-No-Secrets'],
    command: npmCommand,
    arguments: ['run', 'scan:secrets'],
    artifacts: [],
  },
  {
    id: 'dependency-audit',
    taskIds: ['FND-001', 'FND-008'],
    requirementIds: ['DoD-Supply-Chain'],
    command: npmCommand,
    arguments: ['audit'],
    artifacts: [],
  },
]);

function commandLabel(definition) {
  return [definition.command, ...definition.arguments].join(' ');
}

export function runQualityCheck(definition, options = {}) {
  const startedAt = new Date();
  const result = spawnSync(definition.command, definition.arguments, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
  });
  const finishedAt = new Date();
  const exitCode = result.status ?? 1;

  return {
    id: definition.id,
    taskIds: definition.taskIds,
    requirementIds: definition.requirementIds,
    command: commandLabel(definition),
    result: exitCode === 0 && result.error === undefined ? 'passed' : 'failed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    exitCode,
    artifacts: definition.artifacts,
    exception: null,
  };
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

export function createEvidence({ checks, generatedAt = new Date(), runId, owner }) {
  return {
    schemaVersion: '1.0',
    runId,
    generatedAt: generatedAt.toISOString(),
    commit: currentCommit(),
    environment: {
      name: process.env.CI === 'true' ? 'ci' : 'local',
      ci: process.env.CI === 'true',
      node: process.version,
      platform: os.platform(),
      architecture: os.arch(),
    },
    owner,
    tasks: p0TaskIds,
    overallResult: checks.every((check) => check.result === 'passed') ? 'passed' : 'failed',
    checks,
  };
}

function evidenceMarkdown(evidence) {
  const rows = evidence.checks.map(
    (check) =>
      `| ${check.id} | ${check.result} | ${check.exitCode ?? '—'} | ${check.durationMs ?? '—'} |`,
  );

  return [
    '# P0 Quality Gate Evidence',
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
    ...rows,
    '',
    'The JSON evidence file is authoritative and conforms to quality-evidence.schema.json.',
    '',
  ].join('\n');
}

async function writeEvidence(evidence) {
  const outputDirectory = path.resolve(process.cwd(), 'quality/evidence/runs');
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, 'p0-quality-gate.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    ),
    writeFile(path.join(outputDirectory, 'p0-quality-gate.md'), evidenceMarkdown(evidence), 'utf8'),
  ]);
}

async function main() {
  const owner = process.env.QUALITY_OWNER?.trim() || 'local-operator';
  const runId = process.env.QUALITY_RUN_ID?.trim() || `${Date.now()}-${randomUUID()}`;
  const checks = [];

  for (const definition of checkDefinitions) {
    console.log(`\n=== ${definition.id}: ${commandLabel(definition)} ===`);
    const result = runQualityCheck(definition);
    checks.push(result);

    if (result.result === 'failed') {
      const remainingDefinitions = checkDefinitions.slice(checks.length);
      checks.push(...remainingDefinitions.map(notRunCheck));
      break;
    }
  }

  const evidence = createEvidence({ checks, owner, runId });
  await writeEvidence(evidence);
  console.log(`\nP0 quality gate: ${evidence.overallResult.toUpperCase()}`);

  if (evidence.overallResult !== 'passed') process.exitCode = 1;
}

if (process.argv[1]?.endsWith('run-p0-quality-gate.mjs')) {
  await main();
}

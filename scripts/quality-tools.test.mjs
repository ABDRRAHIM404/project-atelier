import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evaluateResourceBudgets } from './check-lighthouse-budgets.mjs';
import { findSecretFindings } from './check-secrets.mjs';
import { createEvidence, runQualityCheck } from './run-p0-quality-gate.mjs';

function lighthouseItems(overrides = {}) {
  const values = {
    image: 10_000,
    media: 0,
    script: 100_000,
    stylesheet: 10_000,
    total: 200_000,
    ...overrides,
  };

  return Object.entries(values).map(([resourceType, transferSize]) => ({
    resourceType,
    transferSize,
  }));
}

test('performance budget evaluator rejects an oversized resource', () => {
  const results = evaluateResourceBudgets(lighthouseItems({ script: 300_000 }));

  assert.equal(results.find((result) => result.id === 'Q-PERF-001')?.passed, false);
});

test('secret scanner detects credentials without exposing their value', () => {
  const syntheticCredential = ['AKIA', 'A'.repeat(16)].join('');
  const findings = findSecretFindings(`value=${syntheticCredential}`);

  assert.deepEqual(
    findings.map((finding) => finding.id),
    ['aws-access-key'],
  );
  assert.equal(JSON.stringify(findings).includes(syntheticCredential), false);
});

test('quality runner preserves a deliberate non-zero exit as a failed check', () => {
  const check = runQualityCheck(
    {
      id: 'deliberate-failure',
      taskIds: ['FND-008'],
      requirementIds: ['T0-Failure-Blocking'],
      command: process.execPath,
      arguments: ['--eval', 'process.exit(7)'],
      artifacts: [],
    },
    { stdio: 'ignore' },
  );

  assert.equal(check.result, 'failed');
  assert.equal(check.exitCode, 7);
});

test('evidence links the task, requirement, environment, result, owner and exception field', () => {
  const evidence = createEvidence({
    checks: [
      {
        id: 'example',
        taskIds: ['TST-003'],
        requirementIds: ['TST-003-Evidence'],
        command: 'example',
        result: 'passed',
        startedAt: '2026-07-16T00:00:00.000Z',
        finishedAt: '2026-07-16T00:00:01.000Z',
        durationMs: 1_000,
        exitCode: 0,
        artifacts: [],
        exception: null,
      },
    ],
    generatedAt: new Date('2026-07-16T00:00:01.000Z'),
    owner: 'test-owner',
    runId: 'test-run',
  });

  assert.equal(evidence.owner, 'test-owner');
  assert.deepEqual(evidence.checks[0]?.taskIds, ['TST-003']);
  assert.deepEqual(evidence.checks[0]?.requirementIds, ['TST-003-Evidence']);
  assert.equal(evidence.checks[0]?.exception, null);
  assert.equal(evidence.overallResult, 'passed');
});

test('evidence schema requires exception governance metadata', async () => {
  const schema = JSON.parse(
    await readFile('quality/evidence/quality-evidence.schema.json', 'utf8'),
  );

  assert.deepEqual(schema.$defs.exception.required, [
    'owner',
    'reason',
    'approvedBy',
    'expiresAt',
    'compensatingControls',
  ]);
});

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const budgetBytes = Object.freeze({
  nonMedia: 500 * 1024,
  script: 200 * 1024,
  stylesheet: 75 * 1024,
  total: 1.5 * 1024 * 1024,
});

function resourceBytes(items, resourceType) {
  const resource = items.find((item) => item.resourceType === resourceType);

  if (typeof resource?.transferSize !== 'number') {
    throw new Error(`Lighthouse report is missing ${resourceType} transfer size.`);
  }

  return resource.transferSize;
}

async function latestLighthouseReport(reportDirectory) {
  const entries = await readdir(reportDirectory, { withFileTypes: true });
  const reportNames = entries
    .filter((entry) => entry.isFile() && /^lhr-.*\.json$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latestReportName = reportNames.at(-1);

  if (latestReportName === undefined) {
    throw new Error(`No Lighthouse result was found in ${reportDirectory}.`);
  }

  return path.join(reportDirectory, latestReportName);
}

export function evaluateResourceBudgets(resourceItems) {
  const actualBytes = {
    image: resourceBytes(resourceItems, 'image'),
    media: resourceBytes(resourceItems, 'media'),
    script: resourceBytes(resourceItems, 'script'),
    stylesheet: resourceBytes(resourceItems, 'stylesheet'),
    total: resourceBytes(resourceItems, 'total'),
  };
  const nonMediaBytes = actualBytes.total - actualBytes.image - actualBytes.media;
  const checks = [
    { actual: actualBytes.script, budget: budgetBytes.script, id: 'Q-PERF-001' },
    { actual: actualBytes.stylesheet, budget: budgetBytes.stylesheet, id: 'Q-PERF-002' },
    { actual: nonMediaBytes, budget: budgetBytes.nonMedia, id: 'Q-PERF-003' },
    { actual: actualBytes.total, budget: budgetBytes.total, id: 'Q-PERF-004' },
  ];

  return checks.map((check) => ({ ...check, passed: check.actual <= check.budget }));
}

async function main() {
  const reportPath = await latestLighthouseReport(
    path.resolve(process.cwd(), process.argv[2] ?? '.lighthouseci'),
  );
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const items = report.audits?.['resource-summary']?.details?.items;

  if (!Array.isArray(items)) {
    throw new Error('Lighthouse result has no resource-summary items.');
  }

  const checks = evaluateResourceBudgets(items);

  for (const check of checks) {
    console.log(
      `${check.id}: ${check.actual} / ${check.budget} transferred bytes — ${check.passed ? 'PASS' : 'FAIL'}`,
    );
  }

  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('check-lighthouse-budgets.mjs')) {
  await main();
}

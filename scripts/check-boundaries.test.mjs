import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { validateSourceText } from './check-boundaries.mjs';

const projectRoot = '/workspace';

function validate(sourcePath, sourceText) {
  return validateSourceText({
    projectRoot,
    sourcePath: path.join(projectRoot, sourcePath),
    sourceText,
  });
}

test('allows pure domain code to import shared values', () => {
  const violations = validate(
    'src/modules/orders/domain/order.ts',
    "import type { Money } from '@/shared/kernel/money';",
  );

  assert.deepEqual(violations, []);
});

test('rejects framework and provider imports from pure layers', () => {
  const framework = validate(
    'src/modules/orders/domain/order.ts',
    "import { cookies } from 'next/headers';",
  );
  const provider = validate(
    'src/modules/orders/application/create-order.ts',
    "import { clerkClient } from '@clerk/nextjs/server';",
  );

  assert.equal(framework.length, 1);
  assert.equal(provider.length, 1);
  assert.match(framework[0].message, /cannot import framework or provider/);
});

test('rejects internal cross-module imports while allowing public contracts', () => {
  const internal = validate(
    'src/modules/orders/application/create-order.ts',
    "import { verify } from '@/modules/payments/infrastructure/payment-repository';",
  );
  const publicContract = validate(
    'src/modules/orders/application/create-order.ts',
    "import type { PaymentReadContract } from '@/modules/payments';",
  );

  assert.equal(internal.length, 1);
  assert.match(internal[0].message, /public root contract/);
  assert.deepEqual(publicContract, []);
});

test('rejects App Router imports of module internals', () => {
  const violations = validate(
    'src/app/orders/page.tsx',
    "import { repository } from '@/modules/orders/infrastructure/order-repository';",
  );

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /App Router adapters/);
});

test('rejects shared dependencies on modules or providers', () => {
  const moduleDependency = validate(
    'src/shared/kernel/order-reference.ts',
    "export { Order } from '@/modules/orders/domain/order';",
  );
  const providerDependency = validate(
    'src/shared/kernel/trace.ts',
    "const sdk = import('@sentry/nextjs');",
  );

  assert.equal(moduleDependency.length, 1);
  assert.equal(providerDependency.length, 1);
});

test('rejects reverse dependencies inside a module', () => {
  const domainToPort = validate(
    'src/modules/orders/domain/order.ts',
    "import type { OrderRepository } from '../ports/order-repository';",
  );
  const publicToInfrastructure = validate(
    'src/modules/orders/index.ts',
    "export { SqlOrderRepository } from './infrastructure/sql-order-repository';",
  );

  assert.equal(domainToPort.length, 1);
  assert.equal(publicToInfrastructure.length, 1);
});

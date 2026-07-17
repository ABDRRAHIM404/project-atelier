import { beforeAll } from 'vitest';

import { assertSafeTestEnvironment } from '../support/isolated-test-environment';

beforeAll(() => {
  assertSafeTestEnvironment();
});

import { describe, expect, it } from 'vitest';

import { assertSafeTestEnvironment } from '../support/isolated-test-environment';

describe('test platform safety', () => {
  it('rejects production application environments', () => {
    expect(() => assertSafeTestEnvironment({ APP_ENV: 'production', NODE_ENV: 'test' })).toThrow(
      'Tests must not run with a production application environment.',
    );
    expect(() => assertSafeTestEnvironment({ APP_ENV: 'test', NODE_ENV: 'production' })).toThrow(
      'Tests must not run with a production application environment.',
    );
  });

  it('accepts an explicit test environment', () => {
    expect(() => assertSafeTestEnvironment({ APP_ENV: 'test', NODE_ENV: 'test' })).not.toThrow();
  });
});

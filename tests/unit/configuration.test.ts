import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  configurationKeys,
  evaluateConfigurationReadiness,
  requireConfigurationValue,
} from '../../src/modules/business-configuration';
import {
  parseApplicationEnvironment,
  publicEnvironment,
  requireApplicationEnvironment,
} from '../../src/platform/config';

describe('business configuration readiness', () => {
  it('recognizes only the approved unresolved configuration groups', () => {
    expect(configurationKeys).toEqual([
      'CFG-001',
      'CFG-002',
      'CFG-003',
      'CFG-004',
      'CFG-005',
      'CFG-006',
      'CFG-007',
      'CFG-008',
    ]);
  });

  it('fails closed when a required policy value has not been resolved', () => {
    expect(evaluateConfigurationReadiness(['CFG-002', 'CFG-003'], new Set(['CFG-002']))).toEqual({
      missingKeys: ['CFG-003'],
      ready: false,
    });
    expect(requireConfigurationValue('CFG-003', undefined)).toEqual({
      error: { code: 'CONFIGURATION_REQUIRED', key: 'CFG-003' },
      ok: false,
    });
    expect(requireConfigurationValue('CFG-002', { currency: 'SAR' })).toEqual({
      ok: true,
      value: { currency: 'SAR' },
    });
  });

  it('reports readiness without duplicating keys', () => {
    expect(
      evaluateConfigurationReadiness(['CFG-001', 'CFG-001'], new Set(configurationKeys)),
    ).toEqual({ ready: true });
  });
});

describe('environment safety', () => {
  it('parses every explicit technical environment and rejects missing values', () => {
    for (const appEnvironment of ['development', 'test', 'staging', 'production'] as const) {
      expect(parseApplicationEnvironment({ APP_ENV: appEnvironment })).toEqual({
        ok: true,
        value: { appEnvironment },
      });
    }

    expect(parseApplicationEnvironment({})).toEqual({
      error: { code: 'MISSING_ENVIRONMENT_VALUE', variables: ['APP_ENV'] },
      ok: false,
    });
  });

  it('returns safe diagnostics without echoing invalid values or unrelated secrets', () => {
    const secret = 'secret-value-that-must-not-escape';
    const result = parseApplicationEnvironment({
      APP_ENV: secret,
      DATABASE_URL: secret,
      PROVIDER_TOKEN: secret,
    });

    expect(result).toEqual({
      error: { code: 'INVALID_ENVIRONMENT_VALUE', variables: ['APP_ENV'] },
      ok: false,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(() => requireApplicationEnvironment({ APP_ENV: secret })).toThrow(
      'Environment configuration failed: INVALID_ENVIRONMENT_VALUE (APP_ENV)',
    );

    try {
      requireApplicationEnvironment({ APP_ENV: secret });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(secret);
      expect(String(error)).not.toContain(secret);
    }
  });

  it('exports no browser-visible environment values in P0', () => {
    expect(publicEnvironment).toEqual({});
    expect(Object.keys(publicEnvironment)).toHaveLength(0);
  });

  it('marks the process-environment reader as server-only', async () => {
    const source = await readFile(
      new URL('../../src/platform/config/server-environment.ts', import.meta.url),
      'utf8',
    );

    expect(source).toMatch(/^import 'server-only';/u);
  });
});

import { err, ok, type Result } from '../../../shared/kernel';

export const configurationKeys = [
  'CFG-001',
  'CFG-002',
  'CFG-003',
  'CFG-004',
  'CFG-005',
  'CFG-006',
  'CFG-007',
  'CFG-008',
] as const;

export type ConfigurationKey = (typeof configurationKeys)[number];

export type ConfigurationReadiness =
  Readonly<{ ready: true }> | Readonly<{ missingKeys: readonly ConfigurationKey[]; ready: false }>;

export type MissingConfiguration<Key extends ConfigurationKey> = Readonly<{
  code: 'CONFIGURATION_REQUIRED';
  key: Key;
}>;

export function evaluateConfigurationReadiness(
  requiredKeys: readonly ConfigurationKey[],
  resolvedKeys: ReadonlySet<ConfigurationKey>,
): ConfigurationReadiness {
  const missingKeys = [...new Set(requiredKeys)].filter((key) => !resolvedKeys.has(key));

  return missingKeys.length === 0
    ? Object.freeze({ ready: true })
    : Object.freeze({ missingKeys: Object.freeze(missingKeys), ready: false });
}

export function requireConfigurationValue<Key extends ConfigurationKey, Value>(
  key: Key,
  value: Value | undefined,
): Result<Value, MissingConfiguration<Key>> {
  return value === undefined ? err({ code: 'CONFIGURATION_REQUIRED', key }) : ok(value);
}

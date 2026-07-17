import { z } from 'zod';

import { err, ok, type Result } from '../../shared/kernel';
import { defineSchemaContract } from '../../shared/validation';

export const applicationEnvironmentNames = [
  'development',
  'test',
  'staging',
  'production',
] as const;

export type ApplicationEnvironmentName = (typeof applicationEnvironmentNames)[number];

export type ApplicationEnvironment = Readonly<{
  appEnvironment: ApplicationEnvironmentName;
}>;

export type EnvironmentFailure = Readonly<{
  code: 'INVALID_ENVIRONMENT_VALUE' | 'MISSING_ENVIRONMENT_VALUE';
  variables: readonly ['APP_ENV'];
}>;

export class EnvironmentConfigurationError extends Error {
  override readonly name = 'EnvironmentConfigurationError';

  constructor(readonly failure: EnvironmentFailure) {
    super(`Environment configuration failed: ${failure.code} (${failure.variables.join(', ')})`);
  }
}

const environmentContract = defineSchemaContract({
  name: 'ApplicationEnvironment',
  owner: 'delivery-platform',
  schema: z.strictObject({ APP_ENV: z.enum(applicationEnvironmentNames) }),
  version: 1,
});

export function parseApplicationEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): Result<ApplicationEnvironment, EnvironmentFailure> {
  if (!source.APP_ENV) {
    return err({ code: 'MISSING_ENVIRONMENT_VALUE', variables: ['APP_ENV'] });
  }

  const parsed = environmentContract.parse({ APP_ENV: source.APP_ENV });

  return parsed.ok
    ? ok(Object.freeze({ appEnvironment: parsed.value.APP_ENV }))
    : err({ code: 'INVALID_ENVIRONMENT_VALUE', variables: ['APP_ENV'] });
}

export function requireApplicationEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): ApplicationEnvironment {
  const parsed = parseApplicationEnvironment(source);

  if (!parsed.ok) {
    throw new EnvironmentConfigurationError(parsed.error);
  }

  return parsed.value;
}

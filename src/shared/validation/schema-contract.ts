import type { ZodType, output } from 'zod';

import { err, ok, type Result } from '../kernel';
import { validationIssueFromZod, type ValidationIssue } from './issues';

export type SchemaContract<
  Owner extends string,
  Name extends string,
  Schema extends ZodType,
> = Readonly<{
  name: Name;
  owner: Owner;
  parse(input: unknown): Result<output<Schema>, readonly ValidationIssue[]>;
  schema: Schema;
  version: number;
}>;

export function defineSchemaContract<
  const Owner extends string,
  const Name extends string,
  Schema extends ZodType,
>(definition: {
  name: Name;
  owner: Owner;
  schema: Schema;
  version: number;
}): SchemaContract<Owner, Name, Schema> {
  if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
    throw new Error('Schema contract versions must be positive safe integers.');
  }

  return Object.freeze({
    name: definition.name,
    owner: definition.owner,
    parse(input: unknown) {
      const result = definition.schema.safeParse(input);

      return result.success
        ? ok(result.data)
        : err(Object.freeze(result.error.issues.map(validationIssueFromZod)));
    },
    schema: definition.schema,
    version: definition.version,
  });
}

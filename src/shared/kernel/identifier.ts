import { err, ok, type Result } from './result';

declare const identifierBrand: unique symbol;

export type Identifier<Entity extends string = string> = string & {
  readonly [identifierBrand]: Entity;
};

export type IdentifierFailure = Readonly<{
  code: 'INVALID_IDENTIFIER';
}>;

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function parseIdentifier<Entity extends string>(
  candidate: string,
): Result<Identifier<Entity>, IdentifierFailure> {
  if (!CANONICAL_UUID_PATTERN.test(candidate)) {
    return err({ code: 'INVALID_IDENTIFIER' });
  }

  return ok(candidate as Identifier<Entity>);
}

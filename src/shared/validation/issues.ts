import type { $ZodIssue } from 'zod/v4/core';

export const validationIssueCodes = [
  'INVALID_TYPE',
  'INVALID_FORMAT',
  'OUT_OF_RANGE',
  'UNRECOGNIZED_FIELD',
  'INVALID_VALUE',
  'DOMAIN_RULE_FAILED',
] as const;

export type ValidationIssueCode = (typeof validationIssueCodes)[number];

export type ValidationIssue = Readonly<{
  code: ValidationIssueCode;
  pointer: string;
}>;

const SAFE_POINTER_SEGMENT = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

export function jsonPointerFromPath(path: readonly PropertyKey[]): string {
  const segments: string[] = [];

  for (const segment of path) {
    if (typeof segment === 'number' && Number.isSafeInteger(segment) && segment >= 0) {
      segments.push(String(segment));
      continue;
    }

    if (typeof segment === 'string' && SAFE_POINTER_SEGMENT.test(segment)) {
      segments.push(segment.replaceAll('~', '~0').replaceAll('/', '~1'));
      continue;
    }

    return '';
  }

  return segments.length === 0 ? '' : `/${segments.join('/')}`;
}

export function validationIssueFromZod(issue: $ZodIssue): ValidationIssue {
  let code: ValidationIssueCode;

  switch (issue.code) {
    case 'invalid_type':
      code = 'INVALID_TYPE';
      break;
    case 'invalid_format':
      code = 'INVALID_FORMAT';
      break;
    case 'too_big':
    case 'too_small':
      code = 'OUT_OF_RANGE';
      break;
    case 'unrecognized_keys':
      code = 'UNRECOGNIZED_FIELD';
      break;
    case 'custom':
      code = 'DOMAIN_RULE_FAILED';
      break;
    default:
      code = 'INVALID_VALUE';
  }

  return Object.freeze({ code, pointer: jsonPointerFromPath(issue.path) });
}

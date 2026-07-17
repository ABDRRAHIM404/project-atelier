import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  createProblemDetails,
  problemCatalog,
  problemCodes,
  problemDetailsSchema,
  type ProblemDescriptor,
  type ProblemTranslator,
} from '../../src/shared/errors';
import { parseIdentifier, parseRecordVersion } from '../../src/shared/kernel';
import {
  defineSchemaContract,
  jsonPointerFromPath,
  validationIssueCodes,
} from '../../src/shared/validation';

function correlationId() {
  const result = parseIdentifier<'Correlation'>('bed8ad16-73d4-4c58-9f4d-7c7b2f7e50fa');
  if (!result.ok) {
    throw new Error('Test correlation ID must be valid.');
  }

  return result.value;
}

describe('canonical schema contracts', () => {
  const exampleContract = defineSchemaContract({
    name: 'ExampleInput',
    owner: 'shared-test',
    schema: z.strictObject({
      count: z.number().int().min(1),
      email: z.email(),
    }),
    version: 1,
  });

  it('returns parsed output for the owning versioned schema', () => {
    expect(exampleContract.parse({ count: 1, email: 'test@example.invalid' })).toEqual({
      ok: true,
      value: { count: 1, email: 'test@example.invalid' },
    });
    expect(exampleContract.owner).toBe('shared-test');
    expect(exampleContract.name).toBe('ExampleInput');
    expect(exampleContract.version).toBe(1);
  });

  it('maps validation failures to ordered stable issues without raw values', () => {
    const secret = 'do-not-echo-this-value';
    const parsed = exampleContract.parse({ count: 0, email: secret, unexpected: secret });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.error).toEqual([
      { code: 'OUT_OF_RANGE', pointer: '/count' },
      { code: 'INVALID_FORMAT', pointer: '/email' },
      { code: 'UNRECOGNIZED_FIELD', pointer: '' },
    ]);
    expect(JSON.stringify(parsed.error)).not.toContain(secret);
  });

  it('fails immediately for an invalid schema version', () => {
    expect(() =>
      defineSchemaContract({
        name: 'InvalidVersion',
        owner: 'shared-test',
        schema: z.string(),
        version: 0,
      }),
    ).toThrow('Schema contract versions must be positive safe integers.');
  });

  it('creates only safe JSON pointers', () => {
    expect(jsonPointerFromPath(['items', 0, 'name'])).toBe('/items/0/name');
    expect(jsonPointerFromPath(['unsafe/value'])).toBe('');
    expect(jsonPointerFromPath([Symbol('unsafe')])).toBe('');
  });
});

describe('RFC 9457 problem details', () => {
  it('implements every accepted catalogue code with valid status and Arabic fallback', () => {
    expect(Object.keys(problemCatalog)).toEqual(problemCodes);

    for (const code of problemCodes) {
      const problem = createProblemDetails(
        { code },
        { correlationId: correlationId(), instance: '/api/v1/example?secret=hidden' },
      );

      expect(problemDetailsSchema.safeParse(problem).success, code).toBe(true);
      expect(problem.code).toBe(code);
      expect(problem.instance).toBe('/api/v1/example');
      expect(problem.title).toMatch(/[\u0600-\u06ff]/u);
      expect(problem.detail).toMatch(/[\u0600-\u06ff]/u);
      expect(problem.status).toBe(problemCatalog[code].status);
      expect(problem.retryable).toBe(
        problemCatalog[code].retryable && !('idempotencyRequiredForRetry' in problemCatalog[code]),
      );
    }
  });

  it('localizes safe fields while falling back to Arabic for missing or failed translations', () => {
    const translator: ProblemTranslator = {
      translateIssue: () => undefined,
      translateProblem: (_code, part) => (part === 'title' ? 'Translated title' : undefined),
    };
    const problem = createProblemDetails(
      {
        code: 'VALIDATION_FAILED',
        issues: [{ code: 'INVALID_FORMAT', pointer: '/email' }],
      },
      { correlationId: correlationId(), instance: '/api/v1/me', translator },
    );

    expect(problem.title).toBe('Translated title');
    expect(problem.detail).toMatch(/[\u0600-\u06ff]/u);
    expect(problem.errors).toEqual([
      { code: 'INVALID_FORMAT', message: 'تنسيق القيمة غير صحيح.', pointer: '/email' },
    ]);

    const throwingTranslator: ProblemTranslator = {
      translateIssue: () => {
        throw new Error('translation unavailable');
      },
      translateProblem: () => {
        throw new Error('translation unavailable');
      },
    };
    const fallback = createProblemDetails(
      { code: 'INTERNAL_ERROR' },
      {
        correlationId: correlationId(),
        instance: '/api/v1/example',
        translator: throwingTranslator,
      },
    );
    expect(fallback.title).toMatch(/[\u0600-\u06ff]/u);
    expect(fallback.detail).toMatch(/[\u0600-\u06ff]/u);
  });

  it('enforces retry and authorized current-version semantics', () => {
    const version = parseRecordVersion(7);
    if (!version.ok) {
      throw new Error('Test version must be valid.');
    }

    const conflict = createProblemDetails(
      { code: 'VERSION_CONFLICT', currentVersion: version.value, retryAfter: 30 },
      { correlationId: correlationId(), instance: '/api/v1/projects/example' },
    );
    expect(conflict.currentVersion).toBe(7);
    expect(conflict).not.toHaveProperty('retryAfter');

    const unavailable = createProblemDetails(
      { code: 'DATA_SERVICE_UNAVAILABLE', currentVersion: version.value, retryAfter: 30 },
      { correlationId: correlationId(), instance: '/api/v1/projects/example' },
    );
    expect(unavailable.retryAfter).toBe(30);
    expect(unavailable).not.toHaveProperty('currentVersion');

    const uncertainTimeout = createProblemDetails(
      { code: 'DEPENDENCY_TIMEOUT', retryAfter: 30 },
      { correlationId: correlationId(), instance: '/api/v1/projects/example' },
    );
    expect(uncertainTimeout.retryable).toBe(false);
    expect(uncertainTimeout).not.toHaveProperty('retryAfter');

    const idempotentTimeout = createProblemDetails(
      {
        code: 'DEPENDENCY_TIMEOUT',
        idempotentRetryPermitted: true,
        retryAfter: 30,
      },
      { correlationId: correlationId(), instance: '/api/v1/projects/example' },
    );
    expect(idempotentTimeout.retryable).toBe(true);
    expect(idempotentTimeout.retryAfter).toBe(30);
  });

  it('does not serialize arbitrary causes, secrets, query data, or stack traces', () => {
    const secret = 'project-atelier-secret-sentinel';
    const descriptor = {
      cause: new Error(secret),
      code: 'INTERNAL_ERROR',
      detail: secret,
      stack: secret,
    } as unknown as ProblemDescriptor;

    const problem = createProblemDetails(descriptor, {
      correlationId: correlationId(),
      instance: `https://attacker.invalid/path?token=${secret}`,
    });
    const serialized = JSON.stringify(problem);

    expect(problem.instance).toBe('/');
    expect(serialized).not.toContain(secret);
    expect(problemDetailsSchema.safeParse({ ...problem, stack: secret }).success).toBe(false);
  });

  it('keeps the issue-code catalogue stable and complete', () => {
    expect(validationIssueCodes).toEqual([
      'INVALID_TYPE',
      'INVALID_FORMAT',
      'OUT_OF_RANGE',
      'UNRECOGNIZED_FIELD',
      'INVALID_VALUE',
      'DOMAIN_RULE_FAILED',
    ]);
  });
});

const SENSITIVE_KEY_PATTERN =
  /(?:authorization|body|content|cookie|credential|email|password|payment.?proof|presigned|private.?key|raw|secret|session|token)/iu;
const SAFE_CATEGORY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | Readonly<{ [key: string]: JsonValue }>;

export class UnsafeOperationalDataError extends Error {
  readonly code = 'UNSAFE_OPERATIONAL_DATA';

  constructor(message: string) {
    super(message);
    this.name = 'UnsafeOperationalDataError';
  }
}

function canonicalize(value: JsonValue, depth: number): string {
  if (depth > 12) {
    throw new UnsafeOperationalDataError('Operational JSON exceeds the maximum nesting depth.');
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new UnsafeOperationalDataError('Operational JSON contains a non-finite number.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, depth + 1)).join(',')}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left === right ? 0 : left < right ? -1 : 1,
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item, depth + 1)}`)
    .join(',')}}`;
}

export function canonicalJson(value: JsonValue): string {
  return canonicalize(value, 0);
}

function assertSafeValue(value: JsonValue, depth: number): void {
  if (depth > 8) {
    throw new UnsafeOperationalDataError('Operational payload exceeds the maximum nesting depth.');
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new UnsafeOperationalDataError('Operational payload contains a non-finite number.');
  }

  if (Array.isArray(value)) {
    for (const item of value) assertSafeValue(item, depth + 1);
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new UnsafeOperationalDataError(
          'Operational payload contains a prohibited sensitive field.',
        );
      }
      assertSafeValue(item, depth + 1);
    }
  }
}

export function assertSafeOperationalPayload(
  value: Readonly<{ [key: string]: JsonValue }>,
  maximumBytes = 8_192,
): void {
  assertSafeValue(value, 0);
  if (Buffer.byteLength(canonicalJson(value), 'utf8') > maximumBytes) {
    throw new UnsafeOperationalDataError('Operational payload exceeds its safe size limit.');
  }
}

export function assertSafeCategory(candidate: string, field: string): void {
  if (!SAFE_CATEGORY_PATTERN.test(candidate)) {
    throw new UnsafeOperationalDataError(`${field} is not a safe operational category.`);
  }
}

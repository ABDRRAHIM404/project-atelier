import type {
  TelemetryAttributes,
  TelemetryAttributeValue,
} from '../../modules/audit-and-operations';

const allowedAttributeKeys = new Set([
  'actorType',
  'attempt',
  'deviceClass',
  'environment',
  'errorCode',
  'latencyMs',
  'locale',
  'module',
  'operation',
  'outcome',
  'providerCategory',
  'queueState',
  'release',
  'resourceType',
  'stateTransition',
]);

const safeCategoryPattern = /^[A-Za-z0-9._:-]{1,128}$/u;

function isSafeAttributeValue(value: unknown): value is TelemetryAttributeValue {
  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return typeof value === 'string' && safeCategoryPattern.test(value);
}

export function sanitizeTelemetryAttributes(input: unknown): TelemetryAttributes {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({});
  }

  const safe: Record<string, TelemetryAttributeValue> = {};
  let redactedFieldCount = 0;

  for (const [key, value] of Object.entries(input)) {
    if (allowedAttributeKeys.has(key) && isSafeAttributeValue(value)) {
      safe[key] = value;
    } else {
      redactedFieldCount += 1;
    }
  }

  if (redactedFieldCount > 0) {
    safe.redactedFieldCount = redactedFieldCount;
  }

  return Object.freeze(safe) as TelemetryAttributes;
}

export function safeTelemetryName(candidate: string, fallback: string): string {
  return safeCategoryPattern.test(candidate) ? candidate : fallback;
}

export function safeErrorCategory(error: unknown): string {
  return error instanceof Error ? safeTelemetryName(error.name, 'Error') : 'NonErrorException';
}

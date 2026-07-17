import { err, ok, type Result } from './result';

declare const instantBrand: unique symbol;
declare const timeZoneBrand: unique symbol;

export type UtcInstant = string & {
  readonly [instantBrand]: 'UtcInstant';
};

export type IanaTimeZone = string & {
  readonly [timeZoneBrand]: 'IanaTimeZone';
};

export type TimeFailure = Readonly<{
  code: 'INVALID_IANA_TIME_ZONE' | 'INVALID_UTC_INSTANT';
}>;

export interface Clock {
  now(): UtcInstant;
}

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export function parseUtcInstant(candidate: string): Result<UtcInstant, TimeFailure> {
  if (!UTC_INSTANT_PATTERN.test(candidate)) {
    return err({ code: 'INVALID_UTC_INSTANT' });
  }

  const canonicalCandidate = candidate.includes('.') ? candidate : candidate.replace('Z', '.000Z');
  const parsed = new Date(candidate);

  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== canonicalCandidate) {
    return err({ code: 'INVALID_UTC_INSTANT' });
  }

  return ok(parsed.toISOString() as UtcInstant);
}

export function utcInstantFromDate(candidate: Date): Result<UtcInstant, TimeFailure> {
  return Number.isFinite(candidate.getTime())
    ? ok(candidate.toISOString() as UtcInstant)
    : err({ code: 'INVALID_UTC_INSTANT' });
}

export function parseIanaTimeZone(candidate: string): Result<IanaTimeZone, TimeFailure> {
  try {
    const canonical = new Intl.DateTimeFormat('en', { timeZone: candidate }).resolvedOptions()
      .timeZone;

    return ok(canonical as IanaTimeZone);
  } catch {
    return err({ code: 'INVALID_IANA_TIME_ZONE' });
  }
}

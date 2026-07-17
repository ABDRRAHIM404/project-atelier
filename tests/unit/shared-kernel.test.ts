import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  MAX_SIGNED_64_BIT,
  MIN_SIGNED_64_BIT,
  addMoney,
  compareMoney,
  createCurrencyConfiguration,
  createMoney,
  flatMapResult,
  localeDirection,
  mapResult,
  nextRecordVersion,
  ok,
  parseCurrencyCode,
  parseEnabledLocale,
  parseIanaTimeZone,
  parseIdentifier,
  parseKnownLocale,
  parseRecordVersion,
  parseUtcInstant,
  principalActor,
  subtractMoney,
  trustedActor,
  utcInstantFromDate,
  validateEnabledLocales,
  visitorActor,
} from '../../src/shared/kernel';

function currency(code: string) {
  const result = parseCurrencyCode(code);
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error('Test currency must be valid.');
  }

  return result.value;
}

function money(amountMinor: bigint, code = 'SAR') {
  const result = createMoney(amountMinor, currency(code));
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error('Test money must be valid.');
  }

  return result.value;
}

describe('Money', () => {
  it('preserves exact integer arithmetic for configured SAR values', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ max: 1_000_000_000_000n, min: -1_000_000_000_000n }),
        fc.bigInt({ max: 1_000_000_000_000n, min: -1_000_000_000_000n }),
        (left, right) => {
          expect(addMoney(money(left), money(right))).toEqual({
            ok: true,
            value: { amountMinor: left + right, currency: 'SAR' },
          });
          expect(subtractMoney(money(left), money(right))).toEqual({
            ok: true,
            value: { amountMinor: left - right, currency: 'SAR' },
          });
        },
      ),
    );
  });

  it('rejects overflow and mixed currencies', () => {
    expect(createMoney(MAX_SIGNED_64_BIT + 1n, currency('SAR'))).toEqual({
      error: { code: 'AMOUNT_OUT_OF_RANGE' },
      ok: false,
    });
    expect(createMoney(MIN_SIGNED_64_BIT - 1n, currency('SAR'))).toEqual({
      error: { code: 'AMOUNT_OUT_OF_RANGE' },
      ok: false,
    });
    expect(addMoney(money(1n, 'SAR'), money(1n, 'USD'))).toEqual({
      error: { code: 'CURRENCY_MISMATCH' },
      ok: false,
    });
    expect(compareMoney(money(1n), money(2n))).toEqual({ ok: true, value: -1 });
  });

  it('requires uppercase ISO-style currency codes without hard-coding a default', () => {
    expect(parseCurrencyCode('SAR')).toEqual({ ok: true, value: 'SAR' });
    expect(parseCurrencyCode('sar')).toEqual({
      error: { code: 'INVALID_CURRENCY_CODE' },
      ok: false,
    });
  });

  it('takes the SAR default from configuration and requires it to be supported', () => {
    const sar = currency('SAR');
    const configuration = createCurrencyConfiguration(sar, [sar, sar]);

    expect(configuration).toEqual({
      ok: true,
      value: { defaultCurrency: 'SAR', supportedCurrencies: ['SAR'] },
    });
    expect(createCurrencyConfiguration(sar, [currency('USD')])).toEqual({
      error: { code: 'DEFAULT_CURRENCY_NOT_SUPPORTED' },
      ok: false,
    });
  });
});

describe('identifiers and versions', () => {
  it('accepts canonical UUIDs and rejects display references', () => {
    fc.assert(
      fc.property(fc.uuid(), (candidate) => {
        expect(parseIdentifier(candidate).ok).toBe(true);
      }),
    );
    expect(parseIdentifier('ORDER-123')).toEqual({
      error: { code: 'INVALID_IDENTIFIER' },
      ok: false,
    });
  });

  it('accepts only positive safe record versions and increments exactly', () => {
    fc.assert(
      fc.property(fc.integer({ max: 1_000_000, min: 1 }), (candidate) => {
        const parsed = parseRecordVersion(candidate);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
          expect(nextRecordVersion(parsed.value)).toEqual({ ok: true, value: candidate + 1 });
        }
      }),
    );
    expect(parseRecordVersion(0).ok).toBe(false);
    expect(parseRecordVersion(1.5).ok).toBe(false);
    const maximum = parseRecordVersion(Number.MAX_SAFE_INTEGER);
    expect(maximum.ok).toBe(true);
    if (maximum.ok) {
      expect(nextRecordVersion(maximum.value)).toEqual({
        error: { code: 'RECORD_VERSION_OVERFLOW' },
        ok: false,
      });
    }
  });
});

describe('locale and time', () => {
  it('keeps Arabic required and RTL while optional English remains gated', () => {
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('en')).toBe('ltr');
    expect(validateEnabledLocales(['en'])).toEqual({
      error: { code: 'MISSING_REQUIRED_LOCALE' },
      ok: false,
    });
    expect(parseEnabledLocale('en', ['ar'])).toEqual({
      error: { code: 'DISABLED_LOCALE' },
      ok: false,
    });
    expect(parseKnownLocale('fr')).toEqual({
      error: { code: 'INVALID_LOCALE' },
      ok: false,
    });
    expect(validateEnabledLocales(['ar', 'en', 'ar'])).toEqual({
      ok: true,
      value: ['ar', 'en'],
    });
    expect(parseEnabledLocale('ar', ['ar'])).toEqual({ ok: true, value: 'ar' });
  });

  it('normalizes valid dates to canonical UTC and rejects local or invalid instants', () => {
    fc.assert(
      fc.property(
        fc.date({
          max: new Date('9999-12-31T23:59:59.999Z'),
          min: new Date('0000-01-01T00:00:00.000Z'),
          noInvalidDate: true,
        }),
        (candidate) => {
          const instant = utcInstantFromDate(candidate);
          expect(instant.ok).toBe(true);
          if (instant.ok) {
            expect(parseUtcInstant(instant.value)).toEqual(instant);
            expect(instant.value.endsWith('Z')).toBe(true);
          }
        },
      ),
    );
    expect(parseUtcInstant('2026-07-16T12:00:00')).toEqual({
      error: { code: 'INVALID_UTC_INSTANT' },
      ok: false,
    });
    expect(parseUtcInstant('2026-02-30T12:00:00Z').ok).toBe(false);
  });

  it('validates configured IANA time zones without assuming one', () => {
    expect(parseIanaTimeZone('Africa/Casablanca').ok).toBe(true);
    expect(parseIanaTimeZone('not/a-time-zone')).toEqual({
      error: { code: 'INVALID_IANA_TIME_ZONE' },
      ok: false,
    });
  });
});

describe('actor and result contracts', () => {
  it('represents public and trusted actor categories without provider types', () => {
    const principal = parseIdentifier<'Principal'>('7ab5b10e-2e61-4d59-8c31-f0d895f74f09');
    expect(principal.ok).toBe(true);
    if (!principal.ok) {
      return;
    }

    expect(visitorActor()).toEqual({ kind: 'visitor' });
    expect(principalActor('customer', principal.value)).toEqual({
      kind: 'customer',
      principalId: principal.value,
    });
    expect(trustedActor('system_job')).toEqual({ kind: 'system_job' });
  });

  it('maps successful results and preserves failures', () => {
    expect(mapResult(ok(2), (value) => value * 3)).toEqual({ ok: true, value: 6 });
    expect(flatMapResult(ok(2), (value) => ok(value.toString()))).toEqual({
      ok: true,
      value: '2',
    });
    const failure = parseKnownLocale('fr');
    expect(mapResult(failure, () => 'unreachable')).toBe(failure);
    expect(flatMapResult(failure, () => ok('unreachable'))).toBe(failure);
  });
});

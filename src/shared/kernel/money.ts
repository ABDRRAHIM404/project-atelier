import { err, ok, type Result } from './result';

declare const currencyCodeBrand: unique symbol;

export type CurrencyCode = string & {
  readonly [currencyCodeBrand]: 'CurrencyCode';
};

export type Money = Readonly<{
  amountMinor: bigint;
  currency: CurrencyCode;
}>;

export type CurrencyConfiguration = Readonly<{
  defaultCurrency: CurrencyCode;
  supportedCurrencies: readonly CurrencyCode[];
}>;

export type CurrencyFailure = Readonly<{
  code: 'DEFAULT_CURRENCY_NOT_SUPPORTED' | 'INVALID_CURRENCY_CODE';
}>;

export type MoneyFailure = Readonly<{
  code: 'AMOUNT_OUT_OF_RANGE' | 'CURRENCY_MISMATCH';
}>;

export const MIN_SIGNED_64_BIT = -(2n ** 63n);
export const MAX_SIGNED_64_BIT = 2n ** 63n - 1n;

const ISO_4217_CODE_PATTERN = /^[A-Z]{3}$/u;

export function parseCurrencyCode(candidate: string): Result<CurrencyCode, CurrencyFailure> {
  if (!ISO_4217_CODE_PATTERN.test(candidate)) {
    return err({ code: 'INVALID_CURRENCY_CODE' });
  }

  return ok(candidate as CurrencyCode);
}

export function createCurrencyConfiguration(
  defaultCurrency: CurrencyCode,
  supportedCurrencies: readonly CurrencyCode[],
): Result<CurrencyConfiguration, CurrencyFailure> {
  const uniqueCurrencies = Object.freeze([...new Set(supportedCurrencies)]);

  if (!uniqueCurrencies.includes(defaultCurrency)) {
    return err({ code: 'DEFAULT_CURRENCY_NOT_SUPPORTED' });
  }

  return ok(Object.freeze({ defaultCurrency, supportedCurrencies: uniqueCurrencies }));
}

export function createMoney(
  amountMinor: bigint,
  currency: CurrencyCode,
): Result<Money, MoneyFailure> {
  if (amountMinor < MIN_SIGNED_64_BIT || amountMinor > MAX_SIGNED_64_BIT) {
    return err({ code: 'AMOUNT_OUT_OF_RANGE' });
  }

  return ok(Object.freeze({ amountMinor, currency }));
}

export function addMoney(left: Money, right: Money): Result<Money, MoneyFailure> {
  if (left.currency !== right.currency) {
    return err({ code: 'CURRENCY_MISMATCH' });
  }

  return createMoney(left.amountMinor + right.amountMinor, left.currency);
}

export function subtractMoney(left: Money, right: Money): Result<Money, MoneyFailure> {
  if (left.currency !== right.currency) {
    return err({ code: 'CURRENCY_MISMATCH' });
  }

  return createMoney(left.amountMinor - right.amountMinor, left.currency);
}

export function compareMoney(left: Money, right: Money): Result<-1 | 0 | 1, MoneyFailure> {
  if (left.currency !== right.currency) {
    return err({ code: 'CURRENCY_MISMATCH' });
  }

  return ok(
    left.amountMinor === right.amountMinor ? 0 : left.amountMinor < right.amountMinor ? -1 : 1,
  );
}

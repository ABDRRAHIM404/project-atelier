import { err, ok, type Result } from './result';

export const knownLocales = ['ar', 'en'] as const;
export const requiredLocale = 'ar' as const;

export type AppLocale = (typeof knownLocales)[number];
export type TextDirection = 'ltr' | 'rtl';

export type LocaleFailure = Readonly<{
  code: 'DISABLED_LOCALE' | 'INVALID_LOCALE' | 'MISSING_REQUIRED_LOCALE';
}>;

export function parseKnownLocale(candidate: string): Result<AppLocale, LocaleFailure> {
  return candidate === 'ar' || candidate === 'en' ? ok(candidate) : err({ code: 'INVALID_LOCALE' });
}

export function localeDirection(locale: AppLocale): TextDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function validateEnabledLocales(
  locales: readonly AppLocale[],
): Result<readonly AppLocale[], LocaleFailure> {
  if (!locales.includes(requiredLocale)) {
    return err({ code: 'MISSING_REQUIRED_LOCALE' });
  }

  return ok(Object.freeze([...new Set(locales)]));
}

export function parseEnabledLocale(
  candidate: string,
  enabledLocales: readonly AppLocale[],
): Result<AppLocale, LocaleFailure> {
  const parsed = parseKnownLocale(candidate);

  if (!parsed.ok) {
    return parsed;
  }

  return enabledLocales.includes(parsed.value) ? parsed : err({ code: 'DISABLED_LOCALE' });
}

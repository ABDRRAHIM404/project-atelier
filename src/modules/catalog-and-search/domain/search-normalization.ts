import { err, ok, type AppLocale, type Result } from '../../../shared/kernel';

export type CatalogSearchFailure = Readonly<{
  code: 'SEARCH_QUERY_EMPTY' | 'SEARCH_QUERY_UNSUPPORTED_LOCALE';
}>;

const ARABIC_COMBINING_MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu;
const ARABIC_TATWEEL = /\u0640/gu;
const NON_SEARCH_CHARACTER = /[^\p{L}\p{N}]+/gu;
const WHITESPACE = /\s+/gu;

export function normalizeArabicCatalogSearchText(candidate: string): string {
  return candidate
    .normalize('NFKC')
    .replaceAll(ARABIC_COMBINING_MARKS, '')
    .replaceAll(ARABIC_TATWEEL, '')
    .replaceAll(/[إأآٱ]/gu, 'ا')
    .replaceAll(/ى/gu, 'ي')
    .replaceAll(/ؤ/gu, 'و')
    .replaceAll(/ئ/gu, 'ي')
    .replaceAll(NON_SEARCH_CHARACTER, ' ')
    .replaceAll(WHITESPACE, ' ')
    .trim();
}

export function normalizeCatalogSearchText(candidate: string, locale: AppLocale): string {
  const normalized =
    locale === 'ar'
      ? normalizeArabicCatalogSearchText(candidate)
      : candidate
          .normalize('NFKC')
          .toLocaleLowerCase('en')
          .replaceAll(NON_SEARCH_CHARACTER, ' ')
          .replaceAll(WHITESPACE, ' ')
          .trim();
  return normalized.toLocaleLowerCase(locale);
}

export function catalogSearchQueryTokens(
  candidate: string,
  locale: AppLocale,
): Result<readonly string[], CatalogSearchFailure> {
  if (locale !== 'ar' && locale !== 'en') {
    return err({ code: 'SEARCH_QUERY_UNSUPPORTED_LOCALE' });
  }
  const normalized = normalizeCatalogSearchText(candidate, locale);
  if (!normalized) return err({ code: 'SEARCH_QUERY_EMPTY' });
  return ok(Object.freeze(normalized.split(' ').filter(Boolean)));
}

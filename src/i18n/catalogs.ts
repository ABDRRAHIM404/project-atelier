import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';
import { err, ok, parseEnabledLocale, type AppLocale, type Result } from '../shared/kernel';

export type AppMessages = typeof arMessages;

export const defaultLocale = 'ar' as const satisfies AppLocale;
export const initiallyEnabledLocales = ['ar'] as const satisfies readonly AppLocale[];

const catalogs = Object.freeze({
  ar: arMessages,
  en: enMessages,
}) satisfies Readonly<Record<AppLocale, AppMessages>>;

export function loadMessages(
  candidate: string,
  enabledLocales: readonly AppLocale[] = initiallyEnabledLocales,
): Result<AppMessages, Readonly<{ code: 'LOCALE_NOT_AVAILABLE' }>> {
  const locale = parseEnabledLocale(candidate, enabledLocales);

  return locale.ok ? ok(catalogs[locale.value]) : err({ code: 'LOCALE_NOT_AVAILABLE' });
}

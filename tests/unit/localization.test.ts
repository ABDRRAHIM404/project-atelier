import { describe, expect, it } from 'vitest';

import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';
import { defaultLocale, initiallyEnabledLocales, loadMessages } from '../../src/i18n/catalogs';
import { failOnMissingMessage } from '../../src/i18n/error-handling';

function messageKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    messageKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe('Arabic-first localization', () => {
  it('uses Arabic as the only initially enabled locale and renders it RTL', () => {
    expect(defaultLocale).toBe('ar');
    expect(initiallyEnabledLocales).toEqual(['ar']);
    expect(loadMessages('ar')).toEqual({ ok: true, value: arMessages });
  });

  it('keeps the complete optional English catalogue behind locale configuration', () => {
    expect(messageKeys(enMessages).sort()).toEqual(messageKeys(arMessages).sort());
    expect(loadMessages('en')).toEqual({
      error: { code: 'LOCALE_NOT_AVAILABLE' },
      ok: false,
    });
    expect(loadMessages('en', ['ar', 'en'])).toEqual({ ok: true, value: enMessages });
  });

  it('has no French Version 1 runtime locale', () => {
    expect(loadMessages('fr', ['ar', 'en'])).toEqual({
      error: { code: 'LOCALE_NOT_AVAILABLE' },
      ok: false,
    });
  });

  it('fails instead of rendering a missing raw message key', () => {
    expect(() => failOnMissingMessage()).toThrow('A required localized message is unavailable.');
  });
});

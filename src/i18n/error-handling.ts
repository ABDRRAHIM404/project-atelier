import type { IntlError } from 'next-intl';

export function failOnInternationalizationError(error: IntlError): never {
  throw error;
}

export function failOnMissingMessage(): never {
  throw new Error('A required localized message is unavailable.');
}

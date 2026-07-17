import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, initiallyEnabledLocales, loadMessages } from './catalogs';
import { failOnInternationalizationError, failOnMissingMessage } from './error-handling';

export default getRequestConfig(async () => {
  const messages = loadMessages(defaultLocale, initiallyEnabledLocales);

  if (!messages.ok) {
    throw new Error('The required Arabic message catalogue is unavailable.');
  }

  return {
    getMessageFallback: failOnMissingMessage,
    locale: defaultLocale,
    messages: messages.value,
    onError: failOnInternationalizationError,
  };
});

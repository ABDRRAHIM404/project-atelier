'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import type { AppLocale } from '../shared/kernel';
import type { AppMessages } from './catalogs';
import { failOnInternationalizationError, failOnMissingMessage } from './error-handling';

type LocalizationProviderProps = Readonly<{
  children: ReactNode;
  locale: AppLocale;
  messages: AppMessages;
}>;

export function LocalizationProvider({ children, locale, messages }: LocalizationProviderProps) {
  return (
    <NextIntlClientProvider
      getMessageFallback={failOnMissingMessage}
      locale={locale}
      messages={messages}
      onError={failOnInternationalizationError}
    >
      {children}
    </NextIntlClientProvider>
  );
}

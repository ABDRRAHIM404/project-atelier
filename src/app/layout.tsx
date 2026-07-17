import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LocalizationProvider } from '../i18n/provider';
import { localeDirection } from '../shared/kernel';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslations('Metadata');

  return {
    description: translate('description'),
    title: translate('title'),
  };
}

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale();
  const messages = await getMessages();
  const translate = await getTranslations('Accessibility');

  return (
    <ClerkProvider>
      <html data-scroll-behavior="smooth" dir={localeDirection(locale)} lang={locale}>
        <body>
          <a className="skip-link" href="#main-content">
            {translate('skipToContent')}
          </a>

          <LocalizationProvider locale={locale} messages={messages}>
            {children}
          </LocalizationProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
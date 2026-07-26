import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LocalizationProvider } from '../i18n/provider';
import { localeDirection } from '../shared/kernel';
import './globals.css';

const themeBootstrapScript = `
  (() => {
    const storageKey = 'project-atelier-theme';
    let theme;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark') theme = stored;
    } catch {}
    if (!theme) {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#121815' : '#fff8ed'
    );
  })();
`;

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

  const document = (
    <html
      data-scroll-behavior="smooth"
      dir={localeDirection(locale)}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <meta content="#fff8ed" name="theme-color" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          {translate('skipToContent')}
        </a>

        <LocalizationProvider locale={locale} messages={messages}>
          {children}
        </LocalizationProvider>
      </body>
    </html>
  );
  const demoAuthenticationEnabled =
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging';

  return demoAuthenticationEnabled ? (
    document
  ) : (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: 'var(--surface)',
          colorBorder: 'var(--line)',
          colorDanger: 'var(--danger)',
          colorForeground: 'var(--ink)',
          colorInput: 'var(--field-background)',
          colorInputForeground: 'var(--ink)',
          colorMuted: 'var(--surface-soft)',
          colorMutedForeground: 'var(--muted)',
          colorPrimary: 'var(--brand)',
          colorSuccess: 'var(--success)',
        },
      }}
    >
      {document}
    </ClerkProvider>
  );
}

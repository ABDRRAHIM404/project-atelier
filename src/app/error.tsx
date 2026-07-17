'use client';

import { useTranslations } from 'next-intl';

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ErrorPage({ reset }: ErrorPageProps) {
  const translate = useTranslations('Error');

  return (
    <main id="main-content" tabIndex={-1}>
      <h1>{translate('title')}</h1>
      <p>{translate('description')}</p>
      <button onClick={reset} type="button">
        {translate('retry')}
      </button>
    </main>
  );
}

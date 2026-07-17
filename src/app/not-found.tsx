import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const translate = await getTranslations('NotFound');

  return (
    <main id="main-content" tabIndex={-1}>
      <h1>{translate('title')}</h1>
      <p>{translate('description')}</p>
    </main>
  );
}

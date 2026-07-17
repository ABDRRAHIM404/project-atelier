import { getTranslations } from 'next-intl/server';

export default async function Loading() {
  const translate = await getTranslations('Loading');

  return (
    <main aria-busy="true" id="main-content" tabIndex={-1}>
      <p role="status">{translate('label')}</p>
    </main>
  );
}

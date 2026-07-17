import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { StorefrontShell } from '../_components/storefront-shell';

export const metadata: Metadata = {
  description: 'خطوات طلب الأثاث المصمم حسب الطلب من بيتي بذوقي.',
  title: 'طريقة العمل | بيتي بذوقي',
};

export default async function HowItWorksPage() {
  const translate = await getTranslations('Storefront.process');

  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1}>
        <section className="page-hero section-shell" aria-labelledby="process-title">
          <p className="eyebrow">{translate('eyebrow')}</p>
          <h1 id="process-title">{translate('title')}</h1>
          <p>{translate('description')}</p>
        </section>

        <section className="section section-shell">
          <ol className="process-list">
            <li>
              <span>01</span>
              <div>
                <h2>{translate('stepOneTitle')}</h2>
                <p>{translate('stepOneDescription')}</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h2>{translate('stepTwoTitle')}</h2>
                <p>{translate('stepTwoDescription')}</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h2>{translate('stepThreeTitle')}</h2>
                <p>{translate('stepThreeDescription')}</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h2>{translate('stepFourTitle')}</h2>
                <p>{translate('stepFourDescription')}</p>
              </div>
            </li>
            <li>
              <span>05</span>
              <div>
                <h2>{translate('stepFiveTitle')}</h2>
                <p>{translate('stepFiveDescription')}</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="section section-shell">
          <div className="journey-callout">
            <div>
              <p className="eyebrow">{translate('ctaEyebrow')}</p>
              <h2>{translate('ctaTitle')}</h2>
              <p>{translate('ctaDescription')}</p>
            </div>
            <Link className="button" href="/catalog">
              {translate('ctaAction')}
            </Link>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}

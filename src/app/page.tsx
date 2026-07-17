import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ProductCard } from './_components/product-card';
import { StorefrontShell } from './_components/storefront-shell';
import { listStorefrontProducts } from '../platform/storefront/catalog-reader';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const translate = await getTranslations('Storefront.home');
  const products = (await listStorefrontProducts()).slice(0, 3);

  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1}>
        <section className="hero section-shell" aria-labelledby="hero-title">
          <div className="hero__content">
            <p className="eyebrow">{translate('eyebrow')}</p>
            <h1 id="hero-title">{translate('title')}</h1>
            <p className="hero__lead">{translate('description')}</p>
            <div className="button-row">
              <Link className="button" href="/catalog">
                {translate('primaryAction')}
              </Link>
              <Link className="button button--secondary" href="/how-it-works">
                {translate('secondaryAction')}
              </Link>
            </div>
            <ul className="hero__highlights" aria-label={translate('highlightsLabel')}>
              <li>{translate('highlightOne')}</li>
              <li>{translate('highlightTwo')}</li>
              <li>{translate('highlightThree')}</li>
            </ul>
          </div>
          <div className="hero__visual hero__visual--brand">
            <Image
              alt="شعار بيتي بذوقي مع هوية أثاث سعودية معاصرة"
              className="hero__brand-image"
              height={838}
              priority
              sizes="(max-width: 950px) 100vw, 46vw"
              src="/brand-banner.png"
              width={1536}
            />
            <div className="hero__visual-note">
              <span>{translate('visualNoteLabel')}</span>
              <strong>{translate('visualNoteValue')}</strong>
            </div>
          </div>
        </section>

        <section className="section section-shell" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{translate('featuredEyebrow')}</p>
              <h2 id="featured-title">{translate('featuredTitle')}</h2>
            </div>
            <Link className="text-link" href="/catalog">
              {translate('viewAll')}
            </Link>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="section section--tinted" aria-labelledby="difference-title">
          <div className="section-shell">
            <div className="section-heading section-heading--centered">
              <div>
                <p className="eyebrow">{translate('differenceEyebrow')}</p>
                <h2 id="difference-title">{translate('differenceTitle')}</h2>
              </div>
            </div>
            <div className="value-grid">
              <article>
                <span className="value-grid__number">01</span>
                <h3>{translate('differenceOneTitle')}</h3>
                <p>{translate('differenceOneDescription')}</p>
              </article>
              <article>
                <span className="value-grid__number">02</span>
                <h3>{translate('differenceTwoTitle')}</h3>
                <p>{translate('differenceTwoDescription')}</p>
              </article>
              <article>
                <span className="value-grid__number">03</span>
                <h3>{translate('differenceThreeTitle')}</h3>
                <p>{translate('differenceThreeDescription')}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-shell" aria-labelledby="journey-title">
          <div className="journey-callout">
            <div>
              <p className="eyebrow">{translate('journeyEyebrow')}</p>
              <h2 id="journey-title">{translate('journeyTitle')}</h2>
              <p>{translate('journeyDescription')}</p>
            </div>
            <Link className="button" href="/how-it-works">
              {translate('journeyAction')}
            </Link>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}

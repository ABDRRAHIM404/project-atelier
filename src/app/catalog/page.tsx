import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ProductCard } from '../_components/product-card';
import { StorefrontShell } from '../_components/storefront-shell';
import {
  listStorefrontProducts,
  storefrontFurnitureFilters,
} from '../../platform/storefront/catalog-reader';

export const metadata: Metadata = {
  description: 'استكشف تصاميم أثاث تُنفذ حسب المقاس والخامة واللون.',
  title: 'التصاميم | بيتي بذوقي',
};

type CatalogPageProps = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

function single(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function filterHref(query: string, furnitureType?: string): string {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (furnitureType) parameters.set('type', furnitureType);
  const value = parameters.toString();
  return value ? `/catalog?${value}` : '/catalog';
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const parameters = await searchParams;
  const query = single(parameters.q).trim();
  const furnitureType = single(parameters.type).trim();
  const translate = await getTranslations('Storefront.catalog');
  const products = await listStorefrontProducts({
    ...(furnitureType ? { furnitureType } : {}),
    ...(query ? { query } : {}),
  });

  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1}>
        <section className="page-hero catalog-hero section-shell" aria-labelledby="catalog-title">
          <div className="catalog-hero__content">
            <p className="eyebrow">{translate('eyebrow')}</p>
            <h1 id="catalog-title">{translate('title')}</h1>
            <p>{translate('description')}</p>
          </div>
          <div className="catalog-hero__visual" aria-hidden="true">
            <div className="catalog-hero__arch">
              <span className="catalog-hero__lamp" />
              <div className="catalog-hero__sofa">
                <span className="catalog-hero__cushion catalog-hero__cushion--one" />
                <span className="catalog-hero__cushion catalog-hero__cushion--two" />
                <span className="catalog-hero__cushion catalog-hero__cushion--three" />
              </div>
              <span className="catalog-hero__table" />
            </div>
          </div>
        </section>

        <section className="catalog-layout section-shell" aria-label={translate('resultsLabel')}>
          <form className="search-form" action="/catalog" role="search">
            <label htmlFor="catalog-search">{translate('searchLabel')}</label>
            <div className="search-form__control">
              <input
                defaultValue={query}
                id="catalog-search"
                name="q"
                placeholder={translate('searchPlaceholder')}
                type="search"
              />
              {furnitureType ? <input name="type" type="hidden" value={furnitureType} /> : null}
              <button className="button button--small" type="submit">
                {translate('searchAction')}
              </button>
            </div>
          </form>

          <div className="filter-row" aria-label={translate('filterLabel')}>
            <Link
              className={!furnitureType ? 'filter-chip filter-chip--active' : 'filter-chip'}
              href={filterHref(query)}
            >
              {translate('all')}
            </Link>
            {storefrontFurnitureFilters.map((filter) => (
              <Link
                className={
                  furnitureType === filter.value ? 'filter-chip filter-chip--active' : 'filter-chip'
                }
                href={filterHref(query, filter.value)}
                key={filter.value}
              >
                {filter.label}
              </Link>
            ))}
          </div>

          <div className="catalog-summary" aria-live="polite">
            <strong>{translate('count', { count: products.length })}</strong>
            {query ? <span>{translate('querySummary', { query })}</span> : null}
          </div>

          <aside className="custom-design-callout">
            <div>
              <p className="eyebrow">لم تجد ما تبحث عنه؟</p>
              <h2>أرسل لنا تصميمك الخاص</h2>
              <p>ارفع صورة أو مخططًا، وسيراجع المدير إمكانية التنفيذ ثم يرسل لك السعر والمدة.</p>
            </div>
            <Link className="button" href="/custom-design">رفع تصميمي</Link>
          </aside>

          {products.length > 0 ? (
            <div className="product-grid product-grid--catalog">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>{translate('emptyTitle')}</h2>
              <p>{translate('emptyDescription')}</p>
              <Link className="button button--secondary" href="/catalog">
                {translate('clearFilters')}
              </Link>
            </div>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}

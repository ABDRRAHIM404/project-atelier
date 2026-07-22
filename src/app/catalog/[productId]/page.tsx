import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ProductVisual } from '../../_components/product-visual';
import { StorefrontShell } from '../../_components/storefront-shell';
import { getStorefrontProduct } from '../../../platform/storefront/catalog-reader';

type ProductPageProps = Readonly<{
  params: Promise<Readonly<{ productId: string }>>;
}>;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await getStorefrontProduct(productId);

  return product
    ? { description: product.description, title: `${product.name} | بيتي بذوقي` }
    : { title: 'التصميم غير موجود | بيتي بذوقي' };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const product = await getStorefrontProduct(productId);
  if (!product) notFound();
  const translate = await getTranslations('Storefront.product');

  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1}>
        <section className="product-detail section-shell" aria-labelledby="product-title">
          <div className="product-detail__visual">
            {product.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={product.imageAlt ?? product.name}
                  src={product.imageUrl}
                  style={{ height: '100%', objectFit: 'cover', width: '100%' }}
                />
              </>
            ) : (
              <ProductVisual label={product.name} visual={product.visual} />
            )}
          </div>
          <div className="product-detail__content">
            <nav className="breadcrumbs" aria-label={translate('breadcrumbsLabel')}>
              <Link href="/">{translate('home')}</Link>
              <span aria-hidden="true">/</span>
              <Link href="/catalog">{translate('catalog')}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{product.name}</span>
            </nav>
            <p className="eyebrow">{product.categoryLabel}</p>
            <h1 id="product-title">{product.name}</h1>
            <p className="product-detail__lead">{product.description}</p>
            <div className="product-detail__status">
              <span>{translate('madeToOrder')}</span>
              <span>{translate('managerReviewed')}</span>
            </div>
            <div className="product-detail__actions">
              <Link className="button" href={`/workspace?productId=${product.id}`}>
                خصص هذا التصميم
              </Link>
              <Link className="button button--secondary" href="/catalog">
                {translate('backAction')}
              </Link>
            </div>
          </div>
        </section>

        <section
          className="section section--tinted"
          id="customization"
          aria-labelledby="options-title"
        >
          <div className="section-shell detail-grid">
            <div>
              <p className="eyebrow">{translate('customizationEyebrow')}</p>
              <h2 id="options-title">{translate('customizationTitle')}</h2>
              <p>{translate('customizationDescription')}</p>
            </div>
            <ul className="feature-list">
              <li>
                <strong>{translate('dimensionsTitle')}</strong>
                <span>{translate('dimensionsDescription')}</span>
              </li>
              <li>
                <strong>{translate('materialsTitle')}</strong>
                <span>{translate('materialsDescription')}</span>
              </li>
              <li>
                <strong>{translate('colorsTitle')}</strong>
                <span>{translate('colorsDescription')}</span>
              </li>
              <li>
                <strong>{translate('quotationTitle')}</strong>
                <span>{translate('quotationDescription')}</span>
              </li>
            </ul>
          </div>
        </section>

        {product.productionInformation ? (
          <section className="section section-shell" aria-labelledby="production-title">
            <div className="information-card">
              <p className="eyebrow">{translate('productionEyebrow')}</p>
              <h2 id="production-title">{translate('productionTitle')}</h2>
              <p>{product.productionInformation}</p>
            </div>
          </section>
        ) : null}
      </main>
    </StorefrontShell>
  );
}

import Link from 'next/link';

import type { StorefrontProduct } from '../../platform/storefront/catalog-reader';
import { ProductVisual } from './product-visual';

type ProductCardProps = Readonly<{
  product: StorefrontProduct;
}>;

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <Link className="product-card__visual-link" href={`/catalog/${product.id}`}>
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
      </Link>
      <div className="product-card__body">
        <p className="eyebrow">{product.categoryLabel}</p>
        <h3>
          <Link href={`/catalog/${product.id}`}>{product.name}</Link>
        </h3>
        <p>{product.description}</p>
        <div className="product-card__footer">
          <span>يُنفذ حسب الطلب</span>
          <Link className="text-link" href={`/catalog/${product.id}`}>
            عرض التفاصيل
          </Link>
        </div>
        <Link className="button button--small product-card__customize" href={`/workspace?productId=${product.id}`}>
          خصص هذا التصميم
        </Link>
      </div>
    </article>
  );
}
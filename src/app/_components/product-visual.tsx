import type { StorefrontProduct } from '../../platform/storefront/catalog-reader';

type ProductVisualProps = Readonly<{
  label: string;
  visual: StorefrontProduct['visual'];
}>;

export function ProductVisual({ label, visual }: ProductVisualProps) {
  return (
    <div className={`product-visual product-visual--${visual}`} role="img" aria-label={label}>
      <span className="product-visual__backdrop" aria-hidden="true" />
      <span className="product-visual__object" aria-hidden="true" />
      <span className="product-visual__detail" aria-hidden="true" />
    </div>
  );
}

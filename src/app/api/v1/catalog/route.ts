import { listStorefrontProducts } from '../../../../platform/storefront/catalog-reader';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const products = await listStorefrontProducts();
  return Response.json(
    { products },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}

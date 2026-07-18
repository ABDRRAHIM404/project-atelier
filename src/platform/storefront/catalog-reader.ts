import 'server-only';

import type { Pool } from 'pg';

import { createDatabasePool, withActorTransaction } from '../database';
import { mapStorefrontProductRow } from '../workflow';

type StorefrontVisual = 'bed' | 'cabinet' | 'chair' | 'shelf' | 'sofa' | 'table' | 'tv-unit';

export type StorefrontProduct = Readonly<{
  categoryLabel: string;
  description: string;
  furnitureType: string;
  furnitureTypeLabel: string;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  name: string;
  productionInformation?: string;
  visual: StorefrontVisual;
}>;

const typePresentation: Readonly<
  Record<string, Readonly<{ label: string; visual: StorefrontVisual }>>
> = Object.freeze({
  BED: Object.freeze({ label: 'أسرة', visual: 'bed' }),
  CABINET: Object.freeze({ label: 'خزائن', visual: 'cabinet' }),
  CHAIR: Object.freeze({ label: 'كراسي', visual: 'chair' }),
  COFFEE_TABLE: Object.freeze({ label: 'طاولات قهوة', visual: 'table' }),
  CUSTOM_FURNITURE: Object.freeze({ label: 'أثاث مخصص', visual: 'shelf' }),
  DINING_TABLE: Object.freeze({ label: 'طاولات طعام', visual: 'table' }),
  SALON: Object.freeze({ label: 'مجالس', visual: 'sofa' }),
  SHELF: Object.freeze({ label: 'رفوف', visual: 'shelf' }),
  SOFA: Object.freeze({ label: 'كنب', visual: 'sofa' }),
  TV_UNIT: Object.freeze({ label: 'وحدات تلفاز', visual: 'tv-unit' }),
  WARDROBE: Object.freeze({ label: 'دواليب', visual: 'cabinet' }),
});

const demoProducts: readonly StorefrontProduct[] = Object.freeze([
  Object.freeze({
    categoryLabel: 'غرفة المعيشة',
    description: 'كنبة هادئة بخطوط نظيفة، تُنفذ بالمقاس والخامة واللون المناسب لمساحتك.',
    furnitureType: 'SOFA',
    furnitureTypeLabel: 'كنب',
    id: '11111111-1111-4111-8111-111111111111',
    name: 'كنبة سكينة',
    productionInformation: 'يحدد وقت التنفيذ بعد مراجعة المقاس والخامة.',
    visual: 'sofa',
  }),
  Object.freeze({
    categoryLabel: 'غرفة النوم',
    description: 'سرير بطابع دافئ ولوح خلفي قابل للتخصيص ليتناسب مع تصميم الغرفة.',
    furnitureType: 'BED',
    furnitureTypeLabel: 'أسرة',
    id: '22222222-2222-4222-8222-222222222222',
    name: 'سرير هدوء',
    productionInformation: 'التنفيذ حسب المقاسات النهائية المعتمدة.',
    visual: 'bed',
  }),
  Object.freeze({
    categoryLabel: 'غرفة الطعام',
    description: 'طاولة تجمع بين بساطة الشكل ومتانة الاستخدام اليومي، بعدد مقاعد تختاره.',
    furnitureType: 'DINING_TABLE',
    furnitureTypeLabel: 'طاولات طعام',
    id: '33333333-3333-4333-8333-333333333333',
    name: 'طاولة لَمّة',
    productionInformation: 'تُراجع سماكة السطح ونوع القاعدة قبل التسعير.',
    visual: 'table',
  }),
  Object.freeze({
    categoryLabel: 'التخزين',
    description: 'دولاب عملي بتقسيمات داخلية تُبنى حول احتياجك ومساحة الجدار المتاحة.',
    furnitureType: 'WARDROBE',
    furnitureTypeLabel: 'دواليب',
    id: '44444444-4444-4444-8444-444444444444',
    name: 'دولاب ترتيب',
    productionInformation: 'تُعتمد التقسيمات والأبواب بعد معاينة المتطلبات.',
    visual: 'cabinet',
  }),
  Object.freeze({
    categoryLabel: 'غرفة المعيشة',
    description: 'وحدة تلفاز خفيفة بصريًا مع تخزين مخفي ومساحات منظمة للأجهزة والأسلاك.',
    furnitureType: 'TV_UNIT',
    furnitureTypeLabel: 'وحدات تلفاز',
    id: '55555555-5555-4555-8555-555555555555',
    name: 'وحدة مشهد',
    productionInformation: 'تُحدد الفتحات والمقاسات وفق الأجهزة وموقع التوصيلات.',
    visual: 'tv-unit',
  }),
  Object.freeze({
    categoryLabel: 'أثاث مخصص',
    description: 'مكتبة جدارية مرنة تجمع العرض والتخزين وتُصمم لتستفيد من كامل المساحة.',
    furnitureType: 'SHELF',
    furnitureTypeLabel: 'رفوف',
    id: '66666666-6666-4666-8666-666666666666',
    name: 'مكتبة أفق',
    productionInformation: 'التكوين النهائي يعتمد على أبعاد الجدار والاستخدام المطلوب.',
    visual: 'shelf',
  }),
]);

type CatalogRow = Readonly<{
  description: string | null;
  furniture_type: string;
  id: string;
  image_alt: string | null;
  image_url: string | null;
  name: string | null;
  production_information: string | null;
}>;

const visitorContext = Object.freeze({
  actor: Object.freeze({ kind: 'visitor' as const }),
  assurance: 'anonymous' as const,
});

function presentationFor(furnitureType: string) {
  return (
    typePresentation[furnitureType] ??
    Object.freeze({ label: 'أثاث مخصص', visual: 'shelf' as const })
  );
}

function mapDatabaseProduct(row: CatalogRow): StorefrontProduct | undefined {
  const name = row.name?.trim();
  if (!name) return undefined;
  const presentation = presentationFor(row.furniture_type);
  const mapped = mapStorefrontProductRow({
    description: row.description,
    furniture_type: row.furniture_type,
    id: row.id,
    image_alt: row.image_alt,
    image_url: row.image_url,
    name: row.name,
    production_information: row.production_information,
  });

  return Object.freeze({
    categoryLabel: presentation.label,
    description: mapped.description,
    furnitureType: mapped.furnitureType,
    furnitureTypeLabel: presentation.label,
    id: mapped.id,
    name: mapped.name,
    ...(mapped.productionInformation ? { productionInformation: mapped.productionInformation } : {}),
    visual: mapped.visual,
    ...(mapped.imageUrl ? { imageUrl: mapped.imageUrl } : {}),
    ...(mapped.imageAlt ? { imageAlt: mapped.imageAlt } : {}),
  });
}

let storefrontPool: Pool | undefined;

function databasePool(connectionString: string): Pool {
  storefrontPool ??= createDatabasePool({
    applicationName: 'project-atelier-storefront',
    connectionString,
    maxConnections: 5,
    statementTimeoutMilliseconds: 5_000,
  });
  return storefrontPool;
}

async function readPublishedProducts(): Promise<readonly StorefrontProduct[]> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.APP_ENV === 'development' || process.env.APP_ENV === 'test') {
      return demoProducts;
    }
    throw new Error('DATABASE_URL is required outside development and test.');
  }

  return withActorTransaction(
    databasePool(connectionString),
    visitorContext,
    async (transaction) => {
      const result = await transaction.query<CatalogRow>(
        `select p.id, p.furniture_type, p.production_information,
                nullif(t.content_json ->> 'name', '') as name,
                nullif(t.content_json ->> 'description', '') as description,
                pi.public_url as image_url,
                pi.alt_text as image_alt
         from catalog.products p
         join cms.localized_resources r on r.id = p.localized_resource_id
         join cms.translation_revisions t on t.id = r.current_ar_revision_id
         left join lateral (
           select pi.public_url, pi.alt_text
           from catalog.product_images pi
           where pi.product_id = p.id and pi.is_primary
           order by pi.sort_order, pi.created_at, pi.id
           limit 1
         ) pi on true
         where p.lifecycle = 'PUBLISHED'
           and t.lifecycle = 'PUBLISHED'
           and not t.stale_source
         order by p.published_at desc nulls last, p.id
         limit 100`,
      );

      return Object.freeze(
        result.rows
          .map(mapDatabaseProduct)
          .filter((product): product is StorefrontProduct => Boolean(product)),
      );
    },
  );
}

function normalized(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .toLocaleLowerCase('ar')
    .trim();
}

export async function listStorefrontProducts(
  filters: Readonly<{ furnitureType?: string; query?: string }> = {},
): Promise<readonly StorefrontProduct[]> {
  const products = await readPublishedProducts();
  const query = filters.query ? normalized(filters.query) : '';

  return Object.freeze(
    products.filter((product) => {
      if (filters.furnitureType && product.furnitureType !== filters.furnitureType) return false;
      if (!query) return true;
      return normalized(
        `${product.name} ${product.description} ${product.furnitureTypeLabel}`,
      ).includes(query);
    }),
  );
}

export async function getStorefrontProduct(
  productId: string,
): Promise<StorefrontProduct | undefined> {
  const products = await readPublishedProducts();
  return products.find((product) => product.id === productId);
}

export const storefrontFurnitureFilters = Object.freeze(
  Object.entries(typePresentation).map(([value, presentation]) =>
    Object.freeze({ label: presentation.label, value }),
  ),
);

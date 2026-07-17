import {
  createMoney,
  err,
  ok,
  parseCurrencyCode,
  parseIdentifier,
  parseRecordVersion,
  type AppLocale,
  type Identifier,
  type Money,
  type RecordVersion,
  type Result,
  type UtcInstant,
} from '../../../shared/kernel';

export const catalogProductLifecycles = [
  'DRAFT',
  'PUBLISHED',
  'HIDDEN',
  'TEMPORARILY_UNAVAILABLE',
  'ARCHIVED',
] as const;

export type CatalogProductLifecycle = (typeof catalogProductLifecycles)[number];

export const catalogManagedResourceKinds = [
  'CATEGORY',
  'COLLECTION',
  'MATERIAL',
  'COLOR',
  'PRODUCT_OPTION',
  'PRODUCT_OPTION_VALUE',
] as const;

export type CatalogManagedResourceKind = (typeof catalogManagedResourceKinds)[number];
export type CatalogManagedResourceLifecycle = 'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED';
export type CatalogResourceId<Entity extends string = string> = Identifier<Entity>;
export type FurnitureTypeCode = string & { readonly FurnitureTypeCode: unique symbol };

export type CatalogTranslation = Readonly<{
  description?: string;
  locale: AppLocale;
  name: string;
  revisionId: Identifier<'TranslationRevision'>;
}>;

export type CatalogManagedResource<
  Entity extends string,
  Kind extends CatalogManagedResourceKind,
> = Readonly<{
  createdAt: UtcInstant;
  id: Identifier<Entity>;
  kind: Kind;
  lifecycle: CatalogManagedResourceLifecycle;
  localizedResourceId: Identifier<'LocalizedResource'>;
  recordVersion: RecordVersion;
  sortOrder: number;
  updatedAt: UtcInstant;
}>;

export type CatalogCollection = CatalogManagedResource<'Collection', 'COLLECTION'>;
export type CatalogMaterial = CatalogManagedResource<'Material', 'MATERIAL'>;
export type CatalogColor = CatalogManagedResource<'Color', 'COLOR'> &
  Readonly<{ displayValue?: string }>;
export type CatalogProductOption = CatalogManagedResource<'ProductOption', 'PRODUCT_OPTION'> &
  Readonly<{
    productId: Identifier<'Product'>;
    required: boolean;
  }>;
export type CatalogProductOptionValue = CatalogManagedResource<
  'ProductOptionValue',
  'PRODUCT_OPTION_VALUE'
> &
  Readonly<{
    machineValue: string;
    optionId: Identifier<'ProductOption'>;
  }>;

export type CatalogProduct = Readonly<{
  categoryId: Identifier<'Category'>;
  createdAt: UtcInstant;
  furnitureType: FurnitureTypeCode;
  id: Identifier<'Product'>;
  lifecycle: CatalogProductLifecycle;
  localizedResourceId: Identifier<'LocalizedResource'>;
  productionInformation?: string;
  recordVersion: RecordVersion;
  startingPrice: Money;
  updatedAt: UtcInstant;
}>;

export type CatalogResourceSummary = Readonly<{
  id: string;
  kind: CatalogManagedResourceKind | 'PRODUCT';
  lifecycle: CatalogManagedResourceLifecycle | CatalogProductLifecycle;
  localizedResourceId: string;
  recordVersion: number;
}>;

export type PublicCatalogProductCard = Readonly<{
  categoryId: string;
  description?: string;
  furnitureType: string;
  id: string;
  locale: AppLocale;
  name: string;
  startingPrice: Money;
}>;

export type PublicCatalogProduct = PublicCatalogProductCard &
  Readonly<{
    collectionIds: readonly string[];
    colorIds: readonly string[];
    dimensionRules: readonly unknown[];
    materialIds: readonly string[];
    options: readonly unknown[];
    productionInformation?: string;
  }>;

export type CatalogModelFailure = Readonly<{
  code:
    | 'CATALOG_AMOUNT_INVALID'
    | 'CATALOG_CURRENCY_INVALID'
    | 'CATALOG_FURNITURE_TYPE_INVALID'
    | 'CATALOG_IDENTIFIER_INVALID'
    | 'CATALOG_SORT_ORDER_INVALID'
    | 'CATALOG_VERSION_INVALID';
}>;

type ManagedDraftInput = Readonly<{
  createdAt: UtcInstant;
  id: string;
  kind: CatalogManagedResourceKind;
  localizedResourceId: string;
  sortOrder: number;
  updatedAt: UtcInstant;
}>;

const FURNITURE_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/u;

export function parseFurnitureTypeCode(
  candidate: string,
): Result<FurnitureTypeCode, CatalogModelFailure> {
  return FURNITURE_TYPE_PATTERN.test(candidate)
    ? ok(candidate as FurnitureTypeCode)
    : err({ code: 'CATALOG_FURNITURE_TYPE_INVALID' });
}

export function createManagedResourceDraft(
  input: ManagedDraftInput,
): Result<CatalogManagedResource<string, CatalogManagedResourceKind>, CatalogModelFailure> {
  const id = parseIdentifier<string>(input.id);
  const localizedResourceId = parseIdentifier<'LocalizedResource'>(input.localizedResourceId);
  const version = parseRecordVersion(1);
  if (!id.ok || !localizedResourceId.ok) return err({ code: 'CATALOG_IDENTIFIER_INVALID' });
  if (!version.ok) return err({ code: 'CATALOG_VERSION_INVALID' });
  if (!Number.isSafeInteger(input.sortOrder)) return err({ code: 'CATALOG_SORT_ORDER_INVALID' });

  return ok(
    Object.freeze({
      createdAt: input.createdAt,
      id: id.value,
      kind: input.kind,
      lifecycle: 'DRAFT',
      localizedResourceId: localizedResourceId.value,
      recordVersion: version.value,
      sortOrder: input.sortOrder,
      updatedAt: input.updatedAt,
    }),
  );
}

type ProductDraftModelInput = Readonly<{
  amountMinor: bigint;
  categoryId: string;
  createdAt: UtcInstant;
  currency: string;
  furnitureType: string;
  id: string;
  localizedResourceId: string;
  productionInformation?: string;
  updatedAt: UtcInstant;
}>;

export function createCatalogProductDraft(
  input: ProductDraftModelInput,
): Result<CatalogProduct, CatalogModelFailure> {
  const id = parseIdentifier<'Product'>(input.id);
  const categoryId = parseIdentifier<'Category'>(input.categoryId);
  const localizedResourceId = parseIdentifier<'LocalizedResource'>(input.localizedResourceId);
  const currency = parseCurrencyCode(input.currency);
  const furnitureType = parseFurnitureTypeCode(input.furnitureType);
  const version = parseRecordVersion(1);
  if (!id.ok || !categoryId.ok || !localizedResourceId.ok) {
    return err({ code: 'CATALOG_IDENTIFIER_INVALID' });
  }
  if (!currency.ok) return err({ code: 'CATALOG_CURRENCY_INVALID' });
  if (!furnitureType.ok) return furnitureType;
  if (!version.ok) return err({ code: 'CATALOG_VERSION_INVALID' });
  const startingPrice = createMoney(input.amountMinor, currency.value);
  if (!startingPrice.ok || input.amountMinor < 0n) {
    return err({ code: 'CATALOG_AMOUNT_INVALID' });
  }

  return ok(
    Object.freeze({
      categoryId: categoryId.value,
      createdAt: input.createdAt,
      furnitureType: furnitureType.value,
      id: id.value,
      lifecycle: 'DRAFT',
      localizedResourceId: localizedResourceId.value,
      ...(input.productionInformation
        ? { productionInformation: input.productionInformation }
        : {}),
      recordVersion: version.value,
      startingPrice: startingPrice.value,
      updatedAt: input.updatedAt,
    }),
  );
}

export function isPublicCatalogLifecycle(lifecycle: CatalogProductLifecycle): boolean {
  return lifecycle === 'PUBLISHED';
}

import type { ActorScopedTransaction } from '../../../platform/database';
import type { AppLocale, Money, RecordVersion, UtcInstant } from '../../../shared/kernel';
import type {
  CatalogConfigurationInput,
  DimensionRule,
  ProductConfigurationDefinition,
  ProductOptionDependency,
  ProductOptionExclusion,
} from '../domain/configuration';
import type {
  CatalogManagedResourceKind,
  CatalogManagedResourceLifecycle,
  CatalogProduct,
  CatalogProductLifecycle,
  CatalogResourceSummary,
  FurnitureTypeCode,
  PublicCatalogProduct,
  PublicCatalogProductCard,
} from '../domain/model';

export type ManagedResourceDraftInput = Readonly<{
  id: string;
  kind: CatalogManagedResourceKind;
  localizedResourceId: string;
  sortOrder: number;
}>;

export type ProductDraftInput = Readonly<{
  categoryId: string;
  furnitureType: FurnitureTypeCode;
  id: string;
  localizedResourceId: string;
  productionInformation?: string;
  startingPrice: Money;
}>;

export type CatalogProductConfigurationSnapshot = Readonly<{
  colorIds: readonly string[];
  collectionIds: readonly string[];
  dependencies: readonly ProductOptionDependency[];
  dimensionRules: readonly DimensionRule[];
  exclusions: readonly ProductOptionExclusion[];
  materialIds: readonly string[];
  options: ProductConfigurationDefinition['options'];
}>;

export type CatalogManagerProductView = Readonly<{
  configuration: CatalogProductConfigurationSnapshot;
  product: CatalogProduct;
}>;

export interface CatalogWritePersistence {
  archiveResource(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
    expectedVersion: number,
  ): Promise<CatalogResourceSummary | undefined>;
  createManagedResourceDraft(
    transaction: ActorScopedTransaction,
    input: ManagedResourceDraftInput,
  ): Promise<CatalogResourceSummary>;
  createProductDraft(
    transaction: ActorScopedTransaction,
    input: ProductDraftInput,
  ): Promise<CatalogProduct>;
  findProductForUpdate(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<CatalogManagerProductView | undefined>;
  findResourceForUpdate(
    transaction: ActorScopedTransaction,
    resourceKind: CatalogManagedResourceKind | 'PRODUCT',
    resourceId: string,
  ): Promise<CatalogResourceSummary | undefined>;
  publicationReadiness(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
  ): Promise<
    Omit<CatalogPublicationReadinessRecord, 'arabicApproved' | 'mediaReady'> &
      Readonly<{ dependentLocalizedResourceIds: readonly string[] }>
  >;
  replaceProductConfiguration(
    transaction: ActorScopedTransaction,
    productId: string,
    configuration: CatalogProductConfigurationSnapshot,
    expectedVersion: number,
  ): Promise<CatalogManagerProductView | undefined>;
  transitionResource(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
    destination: CatalogManagedResourceLifecycle | CatalogProductLifecycle,
    expectedVersion: number,
  ): Promise<CatalogResourceSummary | undefined>;
  updateProductDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      categoryId: string;
      expectedVersion: number;
      furnitureType: FurnitureTypeCode;
      productId: string;
      productionInformation?: string;
      startingPrice: Money;
    }>,
  ): Promise<CatalogManagerProductView | undefined>;
}

type CatalogPublicationReadinessRecord = Readonly<{
  arabicApproved: boolean;
  categoryPublished: boolean;
  configurationValid: boolean;
  hasCollection: boolean;
  mediaReady: boolean;
}>;

export type CatalogListCursor = Readonly<{
  productId: string;
}>;

export type CatalogSearchCursor = Readonly<{
  productId: string;
  rank: string;
}>;

export type PublicCatalogProductRecord = Readonly<{
  categoryId: string;
  collectionIds: readonly string[];
  colorIds: readonly string[];
  configuration: CatalogProductConfigurationSnapshot;
  furnitureType: string;
  id: string;
  localizedResourceId: string;
  materialIds: readonly string[];
  productionInformation?: string;
  startingPrice: Money;
}>;

export type PublicCatalogPage = Readonly<{
  hasMore: boolean;
  items: readonly PublicCatalogProductCard[];
  nextCursor: CatalogListCursor | null;
}>;

export interface CatalogPublicReadPersistence {
  findPublicProduct(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<PublicCatalogProductRecord | undefined>;
  listPublicProducts(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      categoryId?: string;
      collectionId?: string;
      cursor?: CatalogListCursor;
      limit: number;
    }>,
  ): Promise<Readonly<{ hasMore: boolean; items: readonly PublicCatalogProductRecord[] }>>;
}

export type CatalogSearchDocument = Readonly<{
  description?: string;
  locale: AppLocale;
  name: string;
  normalizedText: string;
  productId: string;
  sourceTranslationRevisionId: string;
}>;

export type CatalogSearchHit = Readonly<{
  description?: string;
  locale: AppLocale;
  name: string;
  productId: string;
  rank: string;
}>;

export interface CatalogSearchPersistence {
  deleteProductLocaleDocument(
    transaction: ActorScopedTransaction,
    productId: string,
    locale: AppLocale,
  ): Promise<number>;
  deleteProductDocuments(transaction: ActorScopedTransaction, productId: string): Promise<number>;
  findProjectionSource(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<
    | Readonly<{
        lifecycle: CatalogProductLifecycle;
        localizedResourceId: string;
        recordVersion: RecordVersion;
      }>
    | undefined
  >;
  search(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      cursor?: CatalogSearchCursor;
      limit: number;
      locale: AppLocale;
      normalizedQuery: string;
    }>,
  ): Promise<Readonly<{ hasMore: boolean; hits: readonly CatalogSearchHit[] }>>;
  upsertDocument(
    transaction: ActorScopedTransaction,
    document: CatalogSearchDocument,
  ): Promise<Readonly<{ changed: boolean }>>;
}

export interface CatalogPersistence
  extends CatalogPublicReadPersistence, CatalogSearchPersistence, CatalogWritePersistence {
  loadConfigurationDefinition(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<ProductConfigurationDefinition | undefined>;
  validateConfiguration(
    transaction: ActorScopedTransaction,
    input: CatalogConfigurationInput,
  ): Promise<ProductConfigurationDefinition | undefined>;
}

export type CatalogPersistenceClock = Readonly<{ now: () => UtcInstant }>;

export type CatalogPublicProductAssembler = (
  record: PublicCatalogProductRecord,
  localized: Readonly<{ description?: string; locale: AppLocale; name: string }>,
) => PublicCatalogProduct;

import { err, ok, type AppLocale, type Result } from '../../../shared/kernel';
import type { ActorScopedTransaction } from '../../../platform/database';
import {
  catalogSearchQueryTokens,
  normalizeCatalogSearchText,
} from '../domain/search-normalization';
import type { PublicCatalogProduct, PublicCatalogProductCard } from '../domain/model';
import type { CatalogLocalizationReadPort } from '../ports/integration';
import type {
  CatalogListCursor,
  CatalogPublicReadPersistence,
  CatalogSearchCursor,
  CatalogSearchPersistence,
  PublicCatalogProductRecord,
} from '../ports/persistence';

export type CatalogListQuery = Readonly<{
  categoryId?: string;
  collectionId?: string;
  cursor?: CatalogListCursor;
  limit: number;
  locale: AppLocale;
}>;

export type CatalogDetailQuery = Readonly<{
  locale: AppLocale;
  productId: string;
}>;

export type CatalogSearchQuery = Readonly<{
  cursor?: CatalogSearchCursor;
  limit: number;
  locale: AppLocale;
  query: string;
}>;

export type CatalogQueryFailure = Readonly<{
  code: 'LOCALE_NOT_AVAILABLE' | 'RESOURCE_NOT_FOUND' | 'VALIDATION_FAILED';
}>;

function validPageLimit(limit: number): boolean {
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100;
}

function card(
  record: PublicCatalogProductRecord,
  translation: Readonly<{ description?: string; locale: AppLocale; name: string }>,
): PublicCatalogProductCard {
  return Object.freeze({
    categoryId: record.categoryId,
    ...(translation.description ? { description: translation.description } : {}),
    furnitureType: record.furnitureType,
    id: record.id,
    locale: translation.locale,
    name: translation.name,
    startingPrice: record.startingPrice,
  });
}

export class CatalogQueryService {
  constructor(
    private readonly catalog: CatalogPublicReadPersistence,
    private readonly searchPersistence: CatalogSearchPersistence,
    private readonly localization: CatalogLocalizationReadPort,
  ) {}

  async list(
    transaction: ActorScopedTransaction,
    query: CatalogListQuery,
  ): Promise<
    Result<
      Readonly<{
        hasMore: boolean;
        items: readonly PublicCatalogProductCard[];
        nextCursor: CatalogListCursor | null;
      }>,
      CatalogQueryFailure
    >
  > {
    if (!validPageLimit(query.limit)) return err({ code: 'VALIDATION_FAILED' });
    const page = await this.catalog.listPublicProducts(transaction, query);
    const translated = await Promise.all(
      page.items.map(async (item) => {
        const translation = await this.localization.findPublished(
          transaction,
          item.localizedResourceId,
          query.locale,
        );
        return translation?.humanApproved && !translation.stale
          ? card(item, translation)
          : undefined;
      }),
    );
    const items = Object.freeze(
      translated.filter((item): item is PublicCatalogProductCard => Boolean(item)),
    );
    const lastSourceItem = page.items.at(-1);
    return ok(
      Object.freeze({
        hasMore: page.hasMore,
        items,
        nextCursor:
          page.hasMore && lastSourceItem ? Object.freeze({ productId: lastSourceItem.id }) : null,
      }),
    );
  }

  async detail(
    transaction: ActorScopedTransaction,
    query: CatalogDetailQuery,
  ): Promise<Result<PublicCatalogProduct, CatalogQueryFailure>> {
    const record = await this.catalog.findPublicProduct(transaction, query.productId);
    if (!record) return err({ code: 'RESOURCE_NOT_FOUND' });
    const translation = await this.localization.findPublished(
      transaction,
      record.localizedResourceId,
      query.locale,
    );
    if (!translation?.humanApproved || translation.stale) {
      return err({ code: 'LOCALE_NOT_AVAILABLE' });
    }
    return ok(
      Object.freeze({
        ...card(record, translation),
        collectionIds: record.collectionIds,
        colorIds: record.colorIds,
        dimensionRules: record.configuration.dimensionRules,
        materialIds: record.materialIds,
        options: record.configuration.options,
        ...(record.productionInformation
          ? { productionInformation: record.productionInformation }
          : {}),
      }),
    );
  }

  async search(
    transaction: ActorScopedTransaction,
    query: CatalogSearchQuery,
  ): Promise<
    Result<
      Readonly<{
        hasMore: boolean;
        items: readonly Readonly<{
          description?: string;
          id: string;
          locale: AppLocale;
          name: string;
          rank: string;
        }>[];
        nextCursor: CatalogSearchCursor | null;
      }>,
      CatalogQueryFailure
    >
  > {
    if (!validPageLimit(query.limit) || !catalogSearchQueryTokens(query.query, query.locale).ok) {
      return err({ code: 'VALIDATION_FAILED' });
    }
    const page = await this.searchPersistence.search(transaction, {
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
      locale: query.locale,
      normalizedQuery: normalizeCatalogSearchText(query.query, query.locale),
    });
    const last = page.hits.at(-1);
    return ok(
      Object.freeze({
        hasMore: page.hasMore,
        items: Object.freeze(
          page.hits.map((hit) =>
            Object.freeze({
              ...(hit.description ? { description: hit.description } : {}),
              id: hit.productId,
              locale: hit.locale,
              name: hit.name,
              rank: hit.rank,
            }),
          ),
        ),
        nextCursor:
          page.hasMore && last
            ? Object.freeze({ productId: last.productId, rank: last.rank })
            : null,
      }),
    );
  }
}

import { err, ok, type Result } from '../../../shared/kernel';
import type { ActorScopedTransaction } from '../../../platform/database';
import { normalizeCatalogSearchText } from '../domain/search-normalization';
import type { CatalogLocalizationReadPort } from '../ports/integration';
import type { CatalogSearchPersistence } from '../ports/persistence';

export type SearchProjectionRefreshResult = Readonly<{
  documentsChanged: number;
  productId: string;
  result: 'REMOVED' | 'UPDATED';
}>;

export class CatalogSearchProjectionService {
  constructor(
    private readonly persistence: CatalogSearchPersistence,
    private readonly localization: CatalogLocalizationReadPort,
  ) {}

  async refreshProduct(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<
    Result<SearchProjectionRefreshResult, Readonly<{ code: 'FORBIDDEN' | 'RESOURCE_NOT_FOUND' }>>
  > {
    if (transaction.actorContext.actor.kind !== 'system_job') {
      return err({ code: 'FORBIDDEN' });
    }
    const product = await this.persistence.findProjectionSource(transaction, productId);
    if (!product) return err({ code: 'RESOURCE_NOT_FOUND' });
    if (product.lifecycle !== 'PUBLISHED') {
      const removed = await this.persistence.deleteProductDocuments(transaction, productId);
      return ok({ documentsChanged: removed, productId, result: 'REMOVED' });
    }

    const arabic = await this.localization.findPublished(
      transaction,
      product.localizedResourceId,
      'ar',
    );
    if (!arabic?.humanApproved || arabic.stale) {
      const removed = await this.persistence.deleteProductDocuments(transaction, productId);
      return ok({ documentsChanged: removed, productId, result: 'REMOVED' });
    }
    const english = await this.localization.findPublished(
      transaction,
      product.localizedResourceId,
      'en',
    );
    let changed = 0;
    if (!english?.humanApproved || english.stale) {
      changed += await this.persistence.deleteProductLocaleDocument(transaction, productId, 'en');
    }
    const translations = [arabic, english?.humanApproved && !english.stale ? english : undefined];
    for (const translation of translations) {
      if (!translation) continue;
      const normalizedText = normalizeCatalogSearchText(
        `${translation.name} ${translation.description ?? ''}`,
        translation.locale,
      );
      const result = await this.persistence.upsertDocument(transaction, {
        ...(translation.description ? { description: translation.description } : {}),
        locale: translation.locale,
        name: translation.name,
        normalizedText,
        productId,
        sourceTranslationRevisionId: translation.revisionId,
      });
      if (result.changed) changed += 1;
    }
    return ok({ documentsChanged: changed, productId, result: 'UPDATED' });
  }
}

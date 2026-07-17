import type { ActorScopedTransaction } from '../../../platform/database';
import type { AppLocale, UtcInstant } from '../../../shared/kernel';
import type { CatalogManagedResourceKind } from '../domain/model';

export type CatalogTranslationCandidate = Readonly<{
  description?: string;
  humanApproved: boolean;
  locale: AppLocale;
  name: string;
  revisionId: string;
  sourceRevisionId?: string;
  stale: boolean;
  state: 'APPROVED' | 'PUBLISHED';
}>;

export interface CatalogLocalizationReadPort {
  findPublicationCandidate(
    transaction: ActorScopedTransaction,
    localizedResourceId: string,
    locale: AppLocale,
  ): Promise<CatalogTranslationCandidate | undefined>;
  findPublished(
    transaction: ActorScopedTransaction,
    localizedResourceId: string,
    locale: AppLocale,
  ): Promise<CatalogTranslationCandidate | undefined>;
}

export interface CatalogPublicMediaReadPort {
  publicationReady(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<Readonly<{ ready: boolean }>>;
}

export type CatalogPublicationReadiness = Readonly<{
  arabicApproved: boolean;
  categoryPublished: boolean;
  configurationValid: boolean;
  hasCollection: boolean;
  mediaReady: boolean;
}>;

export interface CatalogAuditPort {
  catalogChanged(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      correlationId: string;
      eventType: string;
      occurredAt: UtcInstant;
      operation: string;
      resourceId: string;
      resourceKind: CatalogManagedResourceKind | 'PRODUCT';
      stateAfter?: string;
      stateBefore?: string;
    }>,
  ): Promise<void>;
}

export interface CatalogInvalidationPort {
  catalogChanged(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      availableAt: UtcInstant;
      correlationId: string;
      eventType: 'CATALOG_PUBLICATION_CHANGED' | 'CATALOG_RESOURCE_CHANGED';
      resourceId: string;
      resourceKind: CatalogManagedResourceKind | 'PRODUCT';
      revision: number;
    }>,
  ): Promise<void>;
}

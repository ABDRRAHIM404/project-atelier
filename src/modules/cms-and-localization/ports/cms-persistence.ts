import type { ActorScopedTransaction } from '../../../platform/database';
import type { AppLocale, UtcInstant } from '../../../shared/kernel';
import type {
  CmsBlock,
  CmsContent,
  CmsContentKind,
  CmsContentVersion,
  TranslationDocument,
  TranslationRevision,
} from '../domain/content';

export interface CmsPersistence {
  createContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      blocks: readonly CmsBlock[];
      contentDigest: string;
      kind: CmsContentKind;
      managerPrincipalId: string;
      slug: string;
    }>,
  ): Promise<Readonly<{ content: CmsContent; version: CmsContentVersion }>>;
  createDraftVersion(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      contentId: string;
      managerPrincipalId: string;
      sourceVersionId: string;
    }>,
  ): Promise<CmsContentVersion | undefined>;
  createTranslationDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      content: TranslationDocument;
      contentDigest: string;
      locale: AppLocale;
      managerPrincipalId: string;
      priorRevisionId?: string;
      resourceId: string;
      sourceArabicRevisionId?: string;
    }>,
  ): Promise<TranslationRevision>;
  findContent(
    transaction: ActorScopedTransaction,
    contentId: string,
    lock?: boolean,
  ): Promise<CmsContent | undefined>;
  findContentVersion(
    transaction: ActorScopedTransaction,
    versionId: string,
    lock?: boolean,
  ): Promise<CmsContentVersion | undefined>;
  findVersionByLocalizedResource(
    transaction: ActorScopedTransaction,
    resourceId: string,
  ): Promise<CmsContentVersion | undefined>;
  findTranslation(
    transaction: ActorScopedTransaction,
    translationId: string,
    lock?: boolean,
  ): Promise<TranslationRevision | undefined>;
  findTranslationForResource(
    transaction: ActorScopedTransaction,
    resourceId: string,
    locale: AppLocale,
    lifecycle: TranslationRevision['lifecycle'],
  ): Promise<TranslationRevision | undefined>;
  publishContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      contentId: string;
      expectedContentVersion: number;
      managerPrincipalId: string;
      publishedAt: UtcInstant;
      translationIds: readonly string[];
      versionId: string;
    }>,
  ): Promise<Readonly<{ content: CmsContent; version: CmsContentVersion }> | undefined>;
  setTranslationLifecycle(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      approvedAt?: UtcInstant;
      expectedVersion: number;
      lifecycle: TranslationRevision['lifecycle'];
      managerPrincipalId: string;
      reviewNote?: string;
      reviewedAt?: UtcInstant;
      translationId: string;
    }>,
  ): Promise<TranslationRevision | undefined>;
  updateDraftTranslation(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      content: TranslationDocument;
      contentDigest: string;
      expectedVersion: number;
      managerPrincipalId: string;
      sourceArabicRevisionId?: string;
      translationId: string;
    }>,
  ): Promise<TranslationRevision | undefined>;
  updateDraftVersion(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      blocks: readonly CmsBlock[];
      contentDigest: string;
      expectedVersion: number;
      managerPrincipalId: string;
      versionId: string;
    }>,
  ): Promise<CmsContentVersion | undefined>;
  hideContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      contentId: string;
      expectedVersion: number;
      managerPrincipalId: string;
    }>,
  ): Promise<CmsContent | undefined>;
}

export type PublicContent = Readonly<{
  blocks: readonly CmsBlock[];
  contentId: string;
  contentVersionId: string;
  localizedResourceId: string;
  locale: AppLocale;
  slug: string;
  translation: TranslationDocument;
  translationRevisionId: string;
}>;

export interface PublicCmsQuery {
  findCurrentPublished(
    transaction: ActorScopedTransaction,
    slug: string,
    locale: AppLocale,
  ): Promise<PublicContent | undefined>;
}

import type { ActorScopedTransaction } from '../../../platform/database';
import type { AppLocale, UtcInstant } from '../../../shared/kernel';
import type { CmsContentKind, CmsFailure } from '../domain/content';

export interface CmsPublicationPolicy {
  canCreateEnglish(resourceId: string): Promise<boolean>;
  canHideLegalContent(
    input: Readonly<{
      contentId: string;
      kind: CmsContentKind;
      slug: string;
    }>,
  ): Promise<boolean>;
  canPublishEnglish(resourceId: string): Promise<boolean>;
  canPublishLegalContent(
    input: Readonly<{
      contentId: string;
      kind: CmsContentKind;
      slug: string;
    }>,
  ): Promise<boolean>;
  englishReadBehavior(resourceId: string): Promise<'ARABIC_FALLBACK' | 'UNAVAILABLE'>;
}

export interface CmsAuditPort {
  record(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      correlationId: string;
      eventType: string;
      occurredAt: UtcInstant;
      operation: string;
      stateAfter?: string;
      stateBefore?: string;
      targetId: string;
      targetType: 'CmsContent' | 'CmsContentVersion' | 'TranslationRevision';
    }>,
  ): Promise<void>;
}

export interface CmsOutboxPort {
  recordCacheInvalidation(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      contentId: string;
      contentVersionId?: string;
      correlationId: string;
      locale?: AppLocale;
      occurredAt: UtcInstant;
      slug: string;
    }>,
  ): Promise<void>;
}

export type CmsPolicyFailure = Extract<CmsFailure, { code: 'POLICY_ACTION_NOT_ENABLED' }>;

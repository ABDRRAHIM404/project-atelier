import { err, ok, parseKnownLocale, type Result, type UtcInstant } from '../../../shared/kernel';
import type { ActorScopedTransaction } from '../../../platform/database';
import {
  cmsContentDigest,
  isLegalContentKind,
  parseCmsBlocks,
  parseCmsContentKind,
  parseCmsSlug,
  parseTranslationDocument,
  requiredTranslationKeys,
  type CmsContent,
  type CmsContentVersion,
  type CmsFailure,
  type TranslationRevision,
} from '../domain/content';
import { requireHumanManagerMfa } from '../domain/editorial-authorization';
import type { CmsPersistence, PublicCmsQuery, PublicContent } from '../ports/cms-persistence';
import type {
  CmsAuditPort,
  CmsOutboxPort,
  CmsPublicationPolicy,
} from '../ports/publication-effects';

type CommandMeta = Readonly<{ correlationId: string; occurredAt: UtcInstant }>;

async function audit(
  port: CmsAuditPort,
  transaction: ActorScopedTransaction,
  meta: CommandMeta,
  input: Parameters<CmsAuditPort['record']>[1],
): Promise<void> {
  await port.record(transaction, { ...input, ...meta });
}

export class CmsEditorialService {
  constructor(
    private readonly persistence: CmsPersistence,
    private readonly auditPort: CmsAuditPort,
    private readonly outbox: CmsOutboxPort,
    private readonly policy: CmsPublicationPolicy,
  ) {}

  async createContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      blocks: unknown;
      kind: string;
      slug: string;
    }> &
      CommandMeta,
  ): Promise<Result<Readonly<{ content: CmsContent; version: CmsContentVersion }>, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const kind = parseCmsContentKind(input.kind);
    if (!kind.ok) return kind;
    const slug = parseCmsSlug(input.slug);
    if (!slug.ok) return slug;
    const blocks = parseCmsBlocks(input.blocks);
    if (!blocks.ok) return blocks;
    const created = await this.persistence.createContent(transaction, {
      blocks: blocks.value,
      contentDigest: cmsContentDigest(blocks.value),
      kind: kind.value,
      managerPrincipalId: actor.value.principalId,
      slug: slug.value,
    });
    await audit(this.auditPort, transaction, input, {
      correlationId: input.correlationId,
      eventType: 'CMS_CONTENT_CREATED',
      occurredAt: input.occurredAt,
      operation: 'CREATE_CMS_CONTENT',
      stateAfter: 'DRAFT',
      targetId: created.content.id,
      targetType: 'CmsContent',
    });
    return ok(created);
  }

  async createDraftVersion(
    transaction: ActorScopedTransaction,
    input: Readonly<{ contentId: string; sourceVersionId: string }> & CommandMeta,
  ): Promise<Result<CmsContentVersion, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const source = await this.persistence.findContentVersion(transaction, input.sourceVersionId);
    if (!source || source.contentId !== input.contentId) return err({ code: 'NOT_FOUND' });
    const created = await this.persistence.createDraftVersion(transaction, {
      contentId: input.contentId,
      managerPrincipalId: actor.value.principalId,
      sourceVersionId: input.sourceVersionId,
    });
    if (!created) return err({ code: 'VERSION_CONFLICT' });
    await audit(this.auditPort, transaction, input, {
      correlationId: input.correlationId,
      eventType: 'CMS_CONTENT_VERSION_CREATED',
      occurredAt: input.occurredAt,
      operation: 'CREATE_CMS_CONTENT_VERSION',
      stateAfter: 'DRAFT',
      targetId: created.id,
      targetType: 'CmsContentVersion',
    });
    return ok(created);
  }

  async updateDraftVersion(
    transaction: ActorScopedTransaction,
    input: Readonly<{ blocks: unknown; expectedVersion: number; versionId: string }> & CommandMeta,
  ): Promise<Result<CmsContentVersion, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const current = await this.persistence.findContentVersion(transaction, input.versionId);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.lifecycle !== 'DRAFT') return err({ code: 'IMMUTABLE_RECORD' });
    const blocks = parseCmsBlocks(input.blocks);
    if (!blocks.ok) return blocks;
    const updated = await this.persistence.updateDraftVersion(transaction, {
      blocks: blocks.value,
      contentDigest: cmsContentDigest(blocks.value),
      expectedVersion: input.expectedVersion,
      managerPrincipalId: actor.value.principalId,
      versionId: input.versionId,
    });
    if (!updated) return err({ code: 'VERSION_CONFLICT' });
    await audit(this.auditPort, transaction, input, {
      correlationId: input.correlationId,
      eventType: 'CMS_CONTENT_DRAFT_UPDATED',
      occurredAt: input.occurredAt,
      operation: 'UPDATE_CMS_CONTENT_DRAFT',
      stateAfter: 'DRAFT',
      stateBefore: 'DRAFT',
      targetId: updated.id,
      targetType: 'CmsContentVersion',
    });
    return ok(updated);
  }

  async publishContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      contentId: string;
      expectedContentVersion: number;
      versionId: string;
    }> &
      CommandMeta,
  ): Promise<Result<Readonly<{ content: CmsContent; version: CmsContentVersion }>, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const content = await this.persistence.findContent(transaction, input.contentId, true);
    const version = await this.persistence.findContentVersion(transaction, input.versionId, true);
    if (!content || !version || version.contentId !== content.id) return err({ code: 'NOT_FOUND' });
    if (version.lifecycle !== 'DRAFT') return err({ code: 'IMMUTABLE_RECORD' });
    if (
      isLegalContentKind(content.kind) &&
      !(await this.policy.canPublishLegalContent({
        contentId: content.id,
        kind: content.kind,
        slug: content.slug,
      }))
    ) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }

    const arabic = await this.persistence.findTranslationForResource(
      transaction,
      version.localizedResourceId,
      'ar',
      'APPROVED',
    );
    if (!arabic || arabic.staleSource) return err({ code: 'CONTENT_NOT_APPROVED' });
    const completeArabic = parseTranslationDocument(
      arabic.content,
      requiredTranslationKeys(version.blocks),
    );
    if (!completeArabic.ok) return err({ code: 'CONTENT_NOT_APPROVED' });

    const translationIds = [arabic.id];
    const english = await this.persistence.findTranslationForResource(
      transaction,
      version.localizedResourceId,
      'en',
      'APPROVED',
    );
    if (english && (await this.policy.canPublishEnglish(version.localizedResourceId))) {
      if (english.staleSource || english.sourceArabicRevisionId !== arabic.id) {
        return err({ code: 'CONTENT_NOT_APPROVED' });
      }
      const completeEnglish = parseTranslationDocument(
        english.content,
        requiredTranslationKeys(version.blocks),
      );
      if (!completeEnglish.ok) return err({ code: 'CONTENT_NOT_APPROVED' });
      translationIds.push(english.id);
    }

    const published = await this.persistence.publishContent(transaction, {
      contentId: content.id,
      expectedContentVersion: input.expectedContentVersion,
      managerPrincipalId: actor.value.principalId,
      publishedAt: input.occurredAt,
      translationIds,
      versionId: version.id,
    });
    if (!published) return err({ code: 'VERSION_CONFLICT' });
    await audit(this.auditPort, transaction, input, {
      correlationId: input.correlationId,
      eventType: 'CMS_CONTENT_PUBLISHED',
      occurredAt: input.occurredAt,
      operation: 'PUBLISH_CMS_CONTENT',
      stateAfter: 'PUBLISHED',
      stateBefore: content.visibility,
      targetId: content.id,
      targetType: 'CmsContent',
    });
    await this.outbox.recordCacheInvalidation(transaction, {
      contentId: content.id,
      contentVersionId: version.id,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      slug: content.slug,
    });
    return ok(published);
  }

  async hideContent(
    transaction: ActorScopedTransaction,
    input: Readonly<{ contentId: string; expectedVersion: number }> & CommandMeta,
  ): Promise<Result<CmsContent, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const content = await this.persistence.findContent(transaction, input.contentId, true);
    if (!content) return err({ code: 'NOT_FOUND' });
    if (
      isLegalContentKind(content.kind) &&
      !(await this.policy.canHideLegalContent({
        contentId: content.id,
        kind: content.kind,
        slug: content.slug,
      }))
    ) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }
    if (content.visibility !== 'PUBLISHED') return err({ code: 'INVALID_TRANSITION' });
    const hidden = await this.persistence.hideContent(transaction, {
      contentId: content.id,
      expectedVersion: input.expectedVersion,
      managerPrincipalId: actor.value.principalId,
    });
    if (!hidden) return err({ code: 'VERSION_CONFLICT' });
    await audit(this.auditPort, transaction, input, {
      correlationId: input.correlationId,
      eventType: 'CMS_CONTENT_HIDDEN',
      occurredAt: input.occurredAt,
      operation: 'HIDE_CMS_CONTENT',
      stateAfter: 'HIDDEN',
      stateBefore: content.visibility,
      targetId: content.id,
      targetType: 'CmsContent',
    });
    await this.outbox.recordCacheInvalidation(transaction, {
      contentId: content.id,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      slug: content.slug,
    });
    return ok(hidden);
  }
}

export class TranslationEditorialService {
  constructor(
    private readonly persistence: CmsPersistence,
    private readonly auditPort: CmsAuditPort,
    private readonly policy: CmsPublicationPolicy,
  ) {}

  async createDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      content: unknown;
      locale: string;
      priorRevisionId?: string;
      resourceId: string;
      sourceArabicRevisionId?: string;
    }> &
      CommandMeta,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const locale = parseKnownLocale(input.locale);
    if (!locale.ok) return err({ code: 'INVALID_LOCALE' });
    const parsed = parseTranslationDocument(input.content);
    if (!parsed.ok) return parsed;
    const source = input.sourceArabicRevisionId
      ? await this.persistence.findTranslation(transaction, input.sourceArabicRevisionId)
      : undefined;
    if (locale.value === 'ar' && input.sourceArabicRevisionId) {
      return err({ code: 'INVALID_CONTENT' });
    }
    if (
      locale.value === 'en' &&
      (!source || source.locale !== 'ar' || source.resourceId !== input.resourceId)
    ) {
      return err({ code: 'INVALID_CONTENT' });
    }
    if (locale.value === 'en' && !(await this.policy.canCreateEnglish(input.resourceId))) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }
    const created = await this.persistence.createTranslationDraft(transaction, {
      content: parsed.value,
      contentDigest: cmsContentDigest(parsed.value),
      locale: locale.value,
      managerPrincipalId: actor.value.principalId,
      ...(input.priorRevisionId ? { priorRevisionId: input.priorRevisionId } : {}),
      resourceId: input.resourceId,
      ...(input.sourceArabicRevisionId
        ? { sourceArabicRevisionId: input.sourceArabicRevisionId }
        : {}),
    });
    await this.recordTransition(transaction, input, created, undefined, 'DRAFT', 'CREATED');
    return ok(created);
  }

  async updateDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      content: unknown;
      expectedVersion: number;
      sourceArabicRevisionId?: string;
      translationId: string;
    }> &
      CommandMeta,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const current = await this.persistence.findTranslation(transaction, input.translationId);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.lifecycle !== 'DRAFT') return err({ code: 'IMMUTABLE_RECORD' });
    const parsed = parseTranslationDocument(input.content);
    if (!parsed.ok) return parsed;
    if (current.locale === 'en') {
      const sourceId = input.sourceArabicRevisionId ?? current.sourceArabicRevisionId;
      const source = sourceId
        ? await this.persistence.findTranslation(transaction, sourceId)
        : undefined;
      if (!source || source.locale !== 'ar' || source.resourceId !== current.resourceId) {
        return err({ code: 'INVALID_CONTENT' });
      }
    }
    const updated = await this.persistence.updateDraftTranslation(transaction, {
      content: parsed.value,
      contentDigest: cmsContentDigest(parsed.value),
      expectedVersion: input.expectedVersion,
      managerPrincipalId: actor.value.principalId,
      ...(input.sourceArabicRevisionId
        ? { sourceArabicRevisionId: input.sourceArabicRevisionId }
        : {}),
      translationId: input.translationId,
    });
    if (!updated) return err({ code: 'VERSION_CONFLICT' });
    await this.recordTransition(transaction, input, updated, 'DRAFT', 'DRAFT', 'UPDATED');
    return ok(updated);
  }

  requestReview(
    transaction: ActorScopedTransaction,
    input: Readonly<{ expectedVersion: number; translationId: string }> & CommandMeta,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    return this.transition(transaction, input, 'DRAFT', 'IN_REVIEW', 'REVIEW_REQUESTED');
  }

  requestChanges(
    transaction: ActorScopedTransaction,
    input: Readonly<{ expectedVersion: number; reviewNote?: string; translationId: string }> &
      CommandMeta,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    return this.transition(
      transaction,
      input,
      'IN_REVIEW',
      'DRAFT',
      'CHANGES_REQUESTED',
      input.reviewNote,
    );
  }

  approve(
    transaction: ActorScopedTransaction,
    input: Readonly<{ expectedVersion: number; translationId: string }> & CommandMeta,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    return this.transition(transaction, input, 'IN_REVIEW', 'APPROVED', 'APPROVED');
  }

  private async transition(
    transaction: ActorScopedTransaction,
    input: Readonly<{ expectedVersion: number; translationId: string }> & CommandMeta,
    start: TranslationRevision['lifecycle'],
    destination: TranslationRevision['lifecycle'],
    action: string,
    reviewNote?: string,
  ): Promise<Result<TranslationRevision, CmsFailure>> {
    const actor = requireHumanManagerMfa(transaction.actorContext);
    if (!actor.ok) return actor;
    const current = await this.persistence.findTranslation(transaction, input.translationId, true);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.lifecycle === 'APPROVED' || current.lifecycle === 'PUBLISHED') {
      return err({ code: 'IMMUTABLE_RECORD' });
    }
    if (current.lifecycle !== start) return err({ code: 'INVALID_TRANSITION' });
    if (current.locale === 'en' && destination === 'APPROVED') {
      const source = current.sourceArabicRevisionId
        ? await this.persistence.findTranslation(transaction, current.sourceArabicRevisionId)
        : undefined;
      if (!source || (source.lifecycle !== 'APPROVED' && source.lifecycle !== 'PUBLISHED')) {
        return err({ code: 'CONTENT_NOT_APPROVED' });
      }
    }
    const updated = await this.persistence.setTranslationLifecycle(transaction, {
      ...(destination === 'APPROVED' ? { approvedAt: input.occurredAt } : {}),
      expectedVersion: input.expectedVersion,
      lifecycle: destination,
      managerPrincipalId: actor.value.principalId,
      ...(reviewNote ? { reviewNote } : {}),
      ...(destination === 'IN_REVIEW' || destination === 'DRAFT'
        ? { reviewedAt: input.occurredAt }
        : {}),
      translationId: input.translationId,
    });
    if (!updated) return err({ code: 'VERSION_CONFLICT' });
    await this.recordTransition(transaction, input, updated, start, destination, action);
    return ok(updated);
  }

  private async recordTransition(
    transaction: ActorScopedTransaction,
    meta: CommandMeta,
    translation: TranslationRevision,
    start: string | undefined,
    destination: string,
    action: string,
  ): Promise<void> {
    await audit(this.auditPort, transaction, meta, {
      correlationId: meta.correlationId,
      eventType: `TRANSLATION_${action}`,
      occurredAt: meta.occurredAt,
      operation: `${action}_TRANSLATION`,
      stateAfter: destination,
      ...(start ? { stateBefore: start } : {}),
      targetId: translation.id,
      targetType: 'TranslationRevision',
    });
  }
}

export class PublicCmsService {
  constructor(
    private readonly query: PublicCmsQuery,
    private readonly policy: CmsPublicationPolicy,
  ) {}

  async findBySlug(
    transaction: ActorScopedTransaction,
    slugInput: string,
    localeInput: string,
  ): Promise<Result<PublicContent, CmsFailure>> {
    const slug = parseCmsSlug(slugInput);
    if (!slug.ok) return err({ code: 'NOT_FOUND' });
    const locale = parseKnownLocale(localeInput);
    if (!locale.ok) return err({ code: 'INVALID_LOCALE' });
    const exact = await this.query.findCurrentPublished(transaction, slug.value, locale.value);
    if (exact) return ok(exact);
    if (locale.value === 'ar') return err({ code: 'NOT_FOUND' });
    const arabic = await this.query.findCurrentPublished(transaction, slug.value, 'ar');
    if (!arabic) return err({ code: 'NOT_FOUND' });
    return (await this.policy.englishReadBehavior(arabic.localizedResourceId)) === 'ARABIC_FALLBACK'
      ? ok(arabic)
      : err({ code: 'NOT_FOUND' });
  }
}

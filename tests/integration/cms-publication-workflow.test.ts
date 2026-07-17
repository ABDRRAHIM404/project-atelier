import { describe, expect, it, vi } from 'vitest';

import type { ActorScopedTransaction } from '../../src/platform/database';
import {
  CmsEditorialService,
  PublicCmsService,
  TranslationEditorialService,
  cmsContentDigest,
  type CmsAuditPort,
  type CmsBlock,
  type CmsOutboxPort,
  type CmsContent,
  type CmsContentVersion,
  type CmsPersistence,
  type CmsPublicationPolicy,
  type PublicCmsQuery,
  type PublicContent,
  type TranslationRevision,
} from '../../src/modules/cms-and-localization';
import { parseIdentifier, parseUtcInstant } from '../../src/shared/kernel';

const principal = parseIdentifier<'Principal'>('10000000-0000-4000-8000-000000000001');
const now = parseUtcInstant('2026-07-16T12:00:00.000Z');
if (!principal.ok || !now.ok) throw new Error('Invalid CMS integration constants.');

const transaction = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_mfa',
  },
} as ActorScopedTransaction;

const visitor = {
  actorContext: { actor: { kind: 'visitor' }, assurance: 'anonymous' },
} as ActorScopedTransaction;

const contentId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const resourceId = '40000000-0000-4000-8000-000000000001';
const arabicId = '50000000-0000-4000-8000-000000000001';
const englishId = '50000000-0000-4000-8000-000000000002';

const blocks: readonly CmsBlock[] = Object.freeze([
  Object.freeze({ blockId: 'welcome', enabled: true, type: 'HERO' }),
]);

function harness(options: Readonly<{ englishEnabled: boolean }>) {
  let content: CmsContent | undefined;
  let version: CmsContentVersion | undefined;
  const translations = new Map<string, TranslationRevision>();
  const publicContent = new Map<string, PublicContent>();
  const auditEvents: string[] = [];
  const invalidations: string[] = [];
  let translationSequence = 0;

  const persistence = {
    createContent: vi.fn(async (_transaction, input) => {
      content = Object.freeze({
        id: contentId,
        kind: input.kind,
        recordVersion: 1,
        slug: input.slug,
        visibility: 'DRAFT',
      });
      version = Object.freeze({
        blockSchemaVersion: 1,
        blocks: input.blocks,
        contentDigest: input.contentDigest,
        contentId,
        id: versionId,
        lifecycle: 'DRAFT',
        localizedResourceId: resourceId,
        recordVersion: 1,
        revisionNumber: 1,
      });
      return Object.freeze({ content, version });
    }),
    createDraftVersion: vi.fn(async () => undefined),
    createTranslationDraft: vi.fn(async (_transaction, input) => {
      translationSequence += 1;
      const id = input.locale === 'ar' ? arabicId : englishId;
      const revision = Object.freeze({
        content: input.content,
        contentDigest: input.contentDigest,
        contentSchemaVersion: 1 as const,
        id,
        lifecycle: 'DRAFT' as const,
        locale: input.locale,
        ...(input.priorRevisionId ? { priorRevisionId: input.priorRevisionId } : {}),
        recordVersion: 1,
        resourceId: input.resourceId,
        revisionNumber: translationSequence,
        ...(input.sourceArabicRevisionId
          ? { sourceArabicRevisionId: input.sourceArabicRevisionId }
          : {}),
        staleSource: false,
      });
      translations.set(id, revision);
      return revision;
    }),
    findContent: vi.fn(async () => content),
    findContentVersion: vi.fn(async (unusedTransaction, id) =>
      id === version?.id ? version : undefined,
    ),
    findTranslation: vi.fn(async (unusedTransaction, id) => translations.get(id)),
    findTranslationForResource: vi.fn(
      async (unusedTransaction, requestedResource, locale, lifecycle) =>
        [...translations.values()]
          .filter(
            (item) =>
              item.resourceId === requestedResource &&
              item.locale === locale &&
              item.lifecycle === lifecycle,
          )
          .sort((left, right) => right.revisionNumber - left.revisionNumber)[0],
    ),
    findVersionByLocalizedResource: vi.fn(async () => version),
    hideContent: vi.fn(async () => undefined),
    publishContent: vi.fn(async (_transaction, input) => {
      if (!content || !version || content.recordVersion !== input.expectedContentVersion) {
        return undefined;
      }
      version = Object.freeze({ ...version, lifecycle: 'PUBLISHED', recordVersion: 2 });
      content = Object.freeze({
        ...content,
        currentPublishedVersionId: version.id,
        recordVersion: 2,
        visibility: 'PUBLISHED',
      });
      for (const id of input.translationIds) {
        const translation = translations.get(id);
        if (!translation) return undefined;
        const published = Object.freeze({
          ...translation,
          id: `${translation.id.slice(0, -1)}${translation.locale === 'ar' ? '8' : '9'}`,
          lifecycle: 'PUBLISHED' as const,
          priorRevisionId: translation.id,
          recordVersion: 1,
          revisionNumber: translation.revisionNumber + 10,
        });
        translations.set(published.id, published);
        publicContent.set(`${content.slug}:${translation.locale}`, {
          blocks: version.blocks,
          contentId: content.id,
          contentVersionId: version.id,
          locale: translation.locale,
          localizedResourceId: version.localizedResourceId,
          slug: content.slug,
          translation: translation.content,
          translationRevisionId: published.id,
        });
      }
      return Object.freeze({ content, version });
    }),
    setTranslationLifecycle: vi.fn(async (_transaction, input) => {
      const current = translations.get(input.translationId);
      if (!current || current.recordVersion !== input.expectedVersion) return undefined;
      const updated = Object.freeze({
        ...current,
        ...(input.lifecycle === 'APPROVED'
          ? { approvedByPrincipalId: input.managerPrincipalId }
          : {}),
        lifecycle: input.lifecycle,
        recordVersion: current.recordVersion + 1,
      });
      translations.set(updated.id, updated);
      return updated;
    }),
    updateDraftTranslation: vi.fn(async () => undefined),
    updateDraftVersion: vi.fn(async () => undefined),
  } as CmsPersistence;

  const audit: CmsAuditPort = {
    record: vi.fn(async (_transaction, input) => {
      auditEvents.push(input.eventType);
    }),
  };
  const cache: CmsOutboxPort = {
    recordCacheInvalidation: vi.fn(async (_transaction, input) => {
      invalidations.push(input.slug);
    }),
  };
  const policy: CmsPublicationPolicy = {
    canCreateEnglish: vi.fn(async () => options.englishEnabled),
    canHideLegalContent: vi.fn(async () => false),
    canPublishEnglish: vi.fn(async () => options.englishEnabled),
    canPublishLegalContent: vi.fn(async () => false),
    englishReadBehavior: vi.fn(async () =>
      options.englishEnabled ? 'ARABIC_FALLBACK' : 'UNAVAILABLE',
    ),
  };
  const query: PublicCmsQuery = {
    findCurrentPublished: vi.fn(async (_transaction, slug, locale) =>
      publicContent.get(`${slug}:${locale}`),
    ),
  };
  return {
    auditEvents,
    cache,
    contentService: new CmsEditorialService(persistence, audit, cache, policy),
    invalidations,
    persistence,
    publicService: new PublicCmsService(query, policy),
    translationService: new TranslationEditorialService(persistence, audit, policy),
    translations,
  };
}

const commandMeta = {
  correlationId: '60000000-0000-4000-8000-000000000001',
  occurredAt: now.value,
};

async function reviewAndApprove(
  service: TranslationEditorialService,
  translationId: string,
): Promise<void> {
  const review = await service.requestReview(transaction, {
    ...commandMeta,
    expectedVersion: 1,
    translationId,
  });
  expect(review.ok).toBe(true);
  const approve = await service.approve(transaction, {
    ...commandMeta,
    expectedVersion: 2,
    translationId,
  });
  expect(approve.ok).toBe(true);
}

describe('CMS publication integration contract', () => {
  it('publishes a complete Arabic version atomically and exposes only its public projection', async () => {
    const app = harness({ englishEnabled: false });
    const created = await app.contentService.createContent(transaction, {
      ...commandMeta,
      blocks,
      kind: 'HOME',
      slug: 'home',
    });
    expect(created.ok).toBe(true);
    const arabic = await app.translationService.createDraft(transaction, {
      ...commandMeta,
      content: {
        entries: { 'welcome.body': 'أثاث يصنع لك', 'welcome.heading': 'بيتي بذوقي' },
      },
      locale: 'ar',
      resourceId,
    });
    expect(arabic.ok).toBe(true);
    await reviewAndApprove(app.translationService, arabicId);

    const published = await app.contentService.publishContent(transaction, {
      ...commandMeta,
      contentId,
      expectedContentVersion: 1,
      versionId,
    });
    expect(published.ok && published.value.content.visibility).toBe('PUBLISHED');
    const publicResult = await app.publicService.findBySlug(visitor, 'home', 'ar');
    expect(publicResult.ok && publicResult.value.translation.entries['welcome.heading']).toBe(
      'بيتي بذوقي',
    );
    expect(app.invalidations).toEqual(['home']);
    expect(app.auditEvents).toEqual([
      'CMS_CONTENT_CREATED',
      'TRANSLATION_CREATED',
      'TRANSLATION_REVIEW_REQUESTED',
      'TRANSLATION_APPROVED',
      'CMS_CONTENT_PUBLISHED',
    ]);
  });

  it('publishes optional English only when enabled and source-linked to approved Arabic', async () => {
    const app = harness({ englishEnabled: true });
    await app.contentService.createContent(transaction, {
      ...commandMeta,
      blocks,
      kind: 'ABOUT',
      slug: 'about',
    });
    await app.translationService.createDraft(transaction, {
      ...commandMeta,
      content: { entries: { 'welcome.body': 'حرفية سعودية', 'welcome.heading': 'من نحن' } },
      locale: 'ar',
      resourceId,
    });
    await reviewAndApprove(app.translationService, arabicId);
    const english = await app.translationService.createDraft(transaction, {
      ...commandMeta,
      content: { entries: { 'welcome.body': 'Saudi craft', 'welcome.heading': 'About us' } },
      locale: 'en',
      resourceId,
      sourceArabicRevisionId: arabicId,
    });
    expect(english.ok).toBe(true);
    await reviewAndApprove(app.translationService, englishId);
    const published = await app.contentService.publishContent(transaction, {
      ...commandMeta,
      contentId,
      expectedContentVersion: 1,
      versionId,
    });
    expect(published.ok).toBe(true);
    const publicEnglish = await app.publicService.findBySlug(visitor, 'about', 'en');
    expect(publicEnglish.ok && publicEnglish.value.locale).toBe('en');
  });

  it('rejects stale English and keeps the draft unpublished with no invalidation intent', async () => {
    const app = harness({ englishEnabled: true });
    await app.contentService.createContent(transaction, {
      ...commandMeta,
      blocks,
      kind: 'FAQ',
      slug: 'faq',
    });
    await app.translationService.createDraft(transaction, {
      ...commandMeta,
      content: { entries: { 'welcome.body': 'نص', 'welcome.heading': 'أسئلة' } },
      locale: 'ar',
      resourceId,
    });
    await reviewAndApprove(app.translationService, arabicId);
    const staleEnglish: TranslationRevision = Object.freeze({
      content: Object.freeze({
        entries: Object.freeze({ 'welcome.body': 'Text', 'welcome.heading': 'FAQ' }),
      }),
      contentDigest: cmsContentDigest({
        entries: { 'welcome.body': 'Text', 'welcome.heading': 'FAQ' },
      }),
      contentSchemaVersion: 1,
      id: englishId,
      lifecycle: 'APPROVED',
      locale: 'en',
      recordVersion: 3,
      resourceId,
      revisionNumber: 2,
      sourceArabicRevisionId: '70000000-0000-4000-8000-000000000001',
      staleSource: true,
    });
    app.translations.set(englishId, staleEnglish);
    await expect(
      app.contentService.publishContent(transaction, {
        ...commandMeta,
        contentId,
        expectedContentVersion: 1,
        versionId,
      }),
    ).resolves.toEqual({ error: { code: 'CONTENT_NOT_APPROVED' }, ok: false });
    expect(app.invalidations).toEqual([]);
    expect(app.persistence.publishContent).not.toHaveBeenCalled();
  });
});

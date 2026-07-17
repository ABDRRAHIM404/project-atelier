import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CmsEditorialService,
  PublicCmsService,
  TranslationEditorialService,
  type CmsAuditPort,
  type CmsOutboxPort,
  type CmsPublicationPolicy,
} from '../../src/modules/cms-and-localization';
import { PostgresCmsRepository } from '../../src/modules/cms-and-localization/infrastructure/postgres/cms-repository';
import { AuditRecorder, DurableEventRecorder } from '../../src/modules/audit-and-operations';
import { PostgresAuditAndOperationsRepository } from '../../src/modules/audit-and-operations/infrastructure/postgres/repositories';
import { withActorTransaction } from '../../src/platform/database';
import { parseUtcInstant } from '../../src/shared/kernel';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

function instant(value: string) {
  const result = parseUtcInstant(value);
  if (!result.ok) throw new Error('Invalid CMS test instant.');
  return result.value;
}

const occurredAt = instant('2026-07-16T12:00:00.000Z');
const correlationId = '60000000-0000-4000-8000-000000000001';
const blocks = Object.freeze([
  Object.freeze({ blockId: 'welcome', enabled: true, type: 'HERO' as const }),
]);
const arabicDocument = Object.freeze({
  entries: Object.freeze({
    'welcome.body': 'أثاث مصنوع بعناية',
    'welcome.heading': 'بيتي بذوقي',
  }),
});

describe('CMS PostgreSQL publication, history, and RLS', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  let contentService: CmsEditorialService;
  let translationService: TranslationEditorialService;
  let publicService: PublicCmsService;
  const repository = new PostgresCmsRepository();
  let englishEnabled = true;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('cms_publication');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = new Pool({ connectionString: database.connectionString, max: 8 });

    const operations = new PostgresAuditAndOperationsRepository();
    const auditRecorder = new AuditRecorder(operations);
    const durableRecorder = new DurableEventRecorder(operations, operations);
    const audit: CmsAuditPort = {
      record: async (transaction, input) => {
        await auditRecorder.record(transaction, {
          correlationId: input.correlationId,
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          operation: input.operation,
          outcome: 'SUCCEEDED',
          ...(input.stateAfter ? { stateAfter: input.stateAfter } : {}),
          ...(input.stateBefore ? { stateBefore: input.stateBefore } : {}),
          targetId: input.targetId,
          targetType: input.targetType,
        });
      },
    };
    const outbox: CmsOutboxPort = {
      recordCacheInvalidation: async (transaction, input) => {
        await durableRecorder.recordOutbox(transaction, {
          aggregateId: input.contentId,
          aggregateType: 'CmsContent',
          availableAt: input.occurredAt,
          correlationId: input.correlationId,
          dedupeKey: `cms-cache:${input.contentId}:${input.contentVersionId ?? 'hidden'}:${input.locale ?? 'all'}`,
          eventSchemaVersion: 1,
          eventType: 'CMS_PUBLIC_CACHE_INVALIDATION_REQUESTED',
          payload: Object.freeze({
            aggregate_id: input.contentId,
            locale: input.locale ?? 'all',
            revision_id: input.contentVersionId ?? null,
            slug: input.slug,
          }),
          payloadSchemaVersion: 1,
        });
      },
    };
    const policy: CmsPublicationPolicy = {
      canCreateEnglish: async () => englishEnabled,
      canHideLegalContent: async () => false,
      canPublishEnglish: async () => englishEnabled,
      canPublishLegalContent: async () => false,
      englishReadBehavior: async () => (englishEnabled ? 'ARABIC_FALLBACK' : 'UNAVAILABLE'),
    };
    contentService = new CmsEditorialService(repository, audit, outbox, policy);
    translationService = new TranslationEditorialService(repository, audit, policy);
    publicService = new PublicCmsService(repository, policy);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  async function createApprovedTranslation(
    resourceId: string,
    locale: 'ar' | 'en',
    content: Readonly<{ entries: Readonly<Record<string, string>> }>,
    sourceArabicRevisionId?: string,
  ) {
    const draft = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      translationService.createDraft(transaction, {
        content,
        correlationId,
        locale,
        occurredAt,
        resourceId,
        ...(sourceArabicRevisionId ? { sourceArabicRevisionId } : {}),
      }),
    );
    if (!draft.ok) throw new Error(`Translation draft failed: ${draft.error.code}`);
    const review = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      translationService.requestReview(transaction, {
        correlationId,
        expectedVersion: draft.value.recordVersion,
        occurredAt,
        translationId: draft.value.id,
      }),
    );
    if (!review.ok) throw new Error(`Translation review failed: ${review.error.code}`);
    const approved = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      translationService.approve(transaction, {
        correlationId,
        expectedVersion: review.value.recordVersion,
        occurredAt,
        translationId: review.value.id,
      }),
    );
    if (!approved.ok) throw new Error(`Translation approval failed: ${approved.error.code}`);
    return approved.value;
  }

  it('publishes Arabic and optional source-linked English with durable evidence', async () => {
    const created = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      contentService.createContent(transaction, {
        blocks,
        correlationId,
        kind: 'HOME',
        occurredAt,
        slug: 'home',
      }),
    );
    if (!created.ok) throw new Error(`CMS create failed: ${created.error.code}`);
    const arabic = await createApprovedTranslation(
      created.value.version.localizedResourceId,
      'ar',
      arabicDocument,
    );
    await createApprovedTranslation(
      created.value.version.localizedResourceId,
      'en',
      Object.freeze({
        entries: Object.freeze({
          'welcome.body': 'Furniture made with care',
          'welcome.heading': 'Bayti Bithawqi',
        }),
      }),
      arabic.id,
    );

    const published = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      contentService.publishContent(transaction, {
        contentId: created.value.content.id,
        correlationId,
        expectedContentVersion: created.value.content.recordVersion,
        occurredAt,
        versionId: created.value.version.id,
      }),
    );
    expect(published.ok).toBe(true);

    const arabicPublic = await withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
      publicService.findBySlug(transaction, 'home', 'ar'),
    );
    const englishPublic = await withActorTransaction(
      pool,
      p1ActorContexts.customerA,
      (transaction) => publicService.findBySlug(transaction, 'home', 'en'),
    );
    expect(arabicPublic.ok && arabicPublic.value.translation.entries['welcome.heading']).toBe(
      'بيتي بذوقي',
    );
    expect(englishPublic.ok && englishPublic.value.locale).toBe('en');

    const pointers = await owner.query<{
      arabic_source: string | null;
      current_ar_revision_id: string;
      current_en_revision_id: string;
    }>(
      `select r.current_ar_revision_id, r.current_en_revision_id,
              en.source_arabic_revision_id as arabic_source
       from cms.localized_resources r
       join cms.translation_revisions en on en.id = r.current_en_revision_id
       where r.id = $1`,
      [created.value.version.localizedResourceId],
    );
    expect(pointers.rows[0]?.arabic_source).toBe(pointers.rows[0]?.current_ar_revision_id);

    const evidence = await owner.query<{ audits: number; outbox: number }>(
      `select
         (select count(*)::integer from audit.events
          where target_id = $1 and event_type = 'CMS_CONTENT_PUBLISHED') as audits,
         (select count(*)::integer from ops.outbox_events
          where aggregate_id = $1 and event_type = 'CMS_PUBLIC_CACHE_INVALIDATION_REQUESTED') as outbox`,
      [created.value.content.id],
    );
    expect(evidence.rows[0]).toEqual({ audits: 1, outbox: 1 });
  });

  it('keeps drafts private and denies password-only Manager writes at both service and RLS', async () => {
    const serviceResult = await withActorTransaction(
      pool,
      p1ActorContexts.managerPassword,
      (transaction) =>
        contentService.createContent(transaction, {
          blocks,
          correlationId,
          kind: 'ABOUT',
          occurredAt,
          slug: 'password-denied',
        }),
    );
    expect(serviceResult).toEqual({ error: { code: 'MANAGER_MFA_REQUIRED' }, ok: false });
    await expect(
      withActorTransaction(pool, p1ActorContexts.managerPassword, (transaction) =>
        transaction.query(
          `insert into cms.contents
             (kind, slug, created_by_principal_id, updated_by_principal_id)
           values ('ABOUT', 'rls-denied', $1, $1)`,
          [p1FixtureIds.managerPrincipal],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    const draft = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      contentService.createContent(transaction, {
        blocks,
        correlationId,
        kind: 'ABOUT',
        occurredAt,
        slug: 'draft-about',
      }),
    );
    if (!draft.ok) throw new Error('Draft fixture failed.');
    const visitorRead = await withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
      repository.findContent(transaction, draft.value.content.id),
    );
    expect(visitorRead).toBeUndefined();
  });

  it('enforces optimistic concurrency, immutable approval/publication history, and no French rows', async () => {
    const approved = await owner.query<{ id: string }>(
      `select id from cms.translation_revisions where lifecycle = 'APPROVED' limit 1`,
    );
    await expect(
      owner.query(
        `update cms.translation_revisions set content_json = '{"entries":{"x":"tamper"}}'
         where id = $1`,
        [approved.rows[0]?.id],
      ),
    ).rejects.toMatchObject({ code: '55000' });
    const publishedVersion = await owner.query<{ id: string }>(
      `select id from cms.content_versions where lifecycle = 'PUBLISHED' limit 1`,
    );
    await expect(
      owner.query(`update cms.content_versions set blocks_json = '[]' where id = $1`, [
        publishedVersion.rows[0]?.id,
      ]),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      owner.query(
        `insert into cms.translation_revisions
           (resource_id, locale, revision_number, lifecycle, content_schema_version,
            content_json, content_digest, authored_by_principal_id)
         select id, 'fr', 999, 'DRAFT', 1, '{"entries":{"x":"texte"}}', $1, $2
         from cms.localized_resources limit 1`,
        ['a'.repeat(64), p1FixtureIds.managerPrincipal],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    const stale = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      repository.updateDraftVersion(transaction, {
        blocks,
        contentDigest: 'b'.repeat(64),
        expectedVersion: 999,
        managerPrincipalId: p1FixtureIds.managerPrincipal,
        versionId: publishedVersion.rows[0]?.id ?? '',
      }),
    );
    expect(stale).toBeUndefined();
  });

  it('switches current content to a new immutable version without rewriting history', async () => {
    englishEnabled = false;
    const current = await owner.query<{
      content_id: string;
      content_version_id: string;
      record_version: number;
    }>(
      `select c.id as content_id, c.current_published_version_id as content_version_id,
              c.record_version
       from cms.contents c where slug = 'home'`,
    );
    const row = current.rows[0];
    if (!row) throw new Error('Published CMS fixture missing.');
    const draft = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      contentService.createDraftVersion(transaction, {
        contentId: row.content_id,
        correlationId,
        occurredAt,
        sourceVersionId: row.content_version_id,
      }),
    );
    if (!draft.ok) throw new Error(`Replacement draft failed: ${draft.error.code}`);
    await createApprovedTranslation(
      draft.value.localizedResourceId,
      'ar',
      Object.freeze({
        entries: Object.freeze({
          'welcome.body': 'نسخة عربية مصححة',
          'welcome.heading': 'بيتي بذوقي الآن',
        }),
      }),
    );
    const published = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      contentService.publishContent(transaction, {
        contentId: row.content_id,
        correlationId: '60000000-0000-4000-8000-000000000002',
        expectedContentVersion: row.record_version,
        occurredAt: instant('2026-07-16T13:00:00.000Z'),
        versionId: draft.value.id,
      }),
    );
    expect(published.ok).toBe(true);
    const currentArabic = await withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
      publicService.findBySlug(transaction, 'home', 'ar'),
    );
    expect(currentArabic.ok && currentArabic.value.translation.entries['welcome.heading']).toBe(
      'بيتي بذوقي الآن',
    );
    const history = await owner.query<{ count: number }>(
      `select count(*)::integer as count from cms.content_versions
       where content_id = $1 and lifecycle = 'PUBLISHED'`,
      [row.content_id],
    );
    expect(history.rows[0]?.count).toBe(2);
    await expect(
      owner.query(`delete from cms.content_versions where id = $1`, [row.content_version_id]),
    ).rejects.toMatchObject({ code: '55000' });
  });
});

import type { QueryResultRow } from 'pg';

import type { ActorScopedTransaction } from '../../../../platform/database';
import type { AppLocale } from '../../../../shared/kernel';
import type {
  CmsBlock,
  CmsContent,
  CmsContentKind,
  CmsContentVersion,
  TranslationDocument,
  TranslationLifecycle,
  TranslationRevision,
} from '../../domain/content';
import type { CmsPersistence, PublicCmsQuery, PublicContent } from '../../ports/cms-persistence';

type ContentRow = QueryResultRow & {
  current_published_version_id: string | null;
  id: string;
  kind: CmsContentKind;
  record_version: number;
  slug: string;
  visibility: CmsContent['visibility'];
};

type ContentVersionRow = QueryResultRow & {
  block_schema_version: 1;
  blocks_json: readonly CmsBlock[];
  content_digest: string;
  content_id: string;
  id: string;
  lifecycle: CmsContentVersion['lifecycle'];
  localized_resource_id: string;
  record_version: number;
  revision_number: number;
};

type TranslationRow = QueryResultRow & {
  approved_by_principal_id: string | null;
  content_digest: string;
  content_json: TranslationDocument;
  content_schema_version: 1;
  id: string;
  lifecycle: TranslationLifecycle;
  locale: AppLocale;
  prior_revision_id: string | null;
  record_version: number;
  resource_id: string;
  revision_number: number;
  source_arabic_revision_id: string | null;
  stale_source: boolean;
};

type PublishableTranslationRow = TranslationRow & {
  approved_at: Date;
  authored_by_principal_id: string;
  reviewed_at: Date | null;
  reviewed_by_principal_id: string | null;
};

const contentSelection = `
  select id, kind, slug, visibility, current_published_version_id, record_version
  from cms.contents`;

const contentVersionSelection = `
  select id, content_id, revision_number, block_schema_version, blocks_json,
         localized_resource_id, lifecycle, content_digest, record_version
  from cms.content_versions`;

const translationSelection = `
  select id, resource_id, locale, revision_number, lifecycle, content_schema_version,
         content_json, source_arabic_revision_id, prior_revision_id, stale_source,
         content_digest, approved_by_principal_id, record_version
  from cms.translation_revisions`;

function toContent(row: ContentRow): CmsContent {
  return Object.freeze({
    ...(row.current_published_version_id
      ? { currentPublishedVersionId: row.current_published_version_id }
      : {}),
    id: row.id,
    kind: row.kind,
    recordVersion: row.record_version,
    slug: row.slug,
    visibility: row.visibility,
  });
}

function toVersion(row: ContentVersionRow): CmsContentVersion {
  return Object.freeze({
    blockSchemaVersion: row.block_schema_version,
    blocks: Object.freeze(row.blocks_json.map((block) => Object.freeze({ ...block }))),
    contentDigest: row.content_digest,
    contentId: row.content_id,
    id: row.id,
    lifecycle: row.lifecycle,
    localizedResourceId: row.localized_resource_id,
    recordVersion: row.record_version,
    revisionNumber: row.revision_number,
  });
}

function toTranslation(row: TranslationRow): TranslationRevision {
  return Object.freeze({
    ...(row.approved_by_principal_id
      ? { approvedByPrincipalId: row.approved_by_principal_id }
      : {}),
    content: Object.freeze({ entries: Object.freeze({ ...row.content_json.entries }) }),
    contentDigest: row.content_digest,
    contentSchemaVersion: row.content_schema_version,
    id: row.id,
    lifecycle: row.lifecycle,
    locale: row.locale,
    ...(row.prior_revision_id ? { priorRevisionId: row.prior_revision_id } : {}),
    recordVersion: row.record_version,
    resourceId: row.resource_id,
    revisionNumber: row.revision_number,
    ...(row.source_arabic_revision_id
      ? { sourceArabicRevisionId: row.source_arabic_revision_id }
      : {}),
    staleSource: row.stale_source,
  });
}

async function nextTranslationRevision(
  transaction: ActorScopedTransaction,
  resourceId: string,
  locale: AppLocale,
): Promise<number> {
  await transaction.query(
    `select pg_advisory_xact_lock(hashtextextended('cms:translation:' || $1 || ':' || $2, 0))`,
    [resourceId, locale],
  );
  const result = await transaction.query<{ revision_number: number }>(
    `select coalesce(max(revision_number), 0)::integer + 1 as revision_number
     from cms.translation_revisions where resource_id = $1 and locale = $2`,
    [resourceId, locale],
  );
  return result.rows[0]?.revision_number ?? 1;
}

export class PostgresCmsRepository implements CmsPersistence, PublicCmsQuery {
  async createContent(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['createContent']>[1],
  ): Promise<Readonly<{ content: CmsContent; version: CmsContentVersion }>> {
    const resource = await transaction.query<{ id: string }>(
      `insert into cms.localized_resources (resource_type, created_by_principal_id)
       values ('CMS_CONTENT', $1) returning id`,
      [input.managerPrincipalId],
    );
    const resourceId = resource.rows[0]?.id;
    if (!resourceId) throw new Error('CMS localized resource insert returned no row.');
    const contentResult = await transaction.query<ContentRow>(
      `insert into cms.contents
         (kind, slug, visibility, created_by_principal_id, updated_by_principal_id)
       values ($1, $2, 'DRAFT', $3, $3)
       returning id, kind, slug, visibility, current_published_version_id, record_version`,
      [input.kind, input.slug, input.managerPrincipalId],
    );
    const contentRow = contentResult.rows[0];
    if (!contentRow) throw new Error('CMS content insert returned no row.');
    const versionResult = await transaction.query<ContentVersionRow>(
      `insert into cms.content_versions
         (content_id, revision_number, block_schema_version, blocks_json,
          localized_resource_id, lifecycle, content_digest, created_by_principal_id)
       values ($1, 1, 1, $2, $3, 'DRAFT', $4, $5)
       returning id, content_id, revision_number, block_schema_version, blocks_json,
                 localized_resource_id, lifecycle, content_digest, record_version`,
      [
        contentRow.id,
        JSON.stringify(input.blocks),
        resourceId,
        input.contentDigest,
        input.managerPrincipalId,
      ],
    );
    const versionRow = versionResult.rows[0];
    if (!versionRow) throw new Error('CMS content version insert returned no row.');
    return Object.freeze({ content: toContent(contentRow), version: toVersion(versionRow) });
  }

  async createDraftVersion(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['createDraftVersion']>[1],
  ): Promise<CmsContentVersion | undefined> {
    await transaction.query(
      `select pg_advisory_xact_lock(hashtextextended('cms:content:' || $1, 0))`,
      [input.contentId],
    );
    const resource = await transaction.query<{ id: string }>(
      `insert into cms.localized_resources (resource_type, created_by_principal_id)
       select 'CMS_CONTENT', $3
       from cms.content_versions where id = $1 and content_id = $2
       returning id`,
      [input.sourceVersionId, input.contentId, input.managerPrincipalId],
    );
    const resourceId = resource.rows[0]?.id;
    if (!resourceId) return undefined;
    const inserted = await transaction.query<ContentVersionRow>(
      `insert into cms.content_versions
         (content_id, revision_number, block_schema_version, blocks_json,
          localized_resource_id, lifecycle, content_digest, prior_version_id,
          created_by_principal_id)
       select source.content_id,
              (select coalesce(max(v.revision_number), 0) + 1
               from cms.content_versions v where v.content_id = source.content_id),
              source.block_schema_version, source.blocks_json, $3, 'DRAFT',
              source.content_digest, source.id, $4
       from cms.content_versions source
       where source.id = $1 and source.content_id = $2
       returning id, content_id, revision_number, block_schema_version, blocks_json,
                 localized_resource_id, lifecycle, content_digest, record_version`,
      [input.sourceVersionId, input.contentId, resourceId, input.managerPrincipalId],
    );
    const row = inserted.rows[0];
    return row ? toVersion(row) : undefined;
  }

  async createTranslationDraft(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['createTranslationDraft']>[1],
  ): Promise<TranslationRevision> {
    const revisionNumber = await nextTranslationRevision(
      transaction,
      input.resourceId,
      input.locale,
    );
    const inserted = await transaction.query<TranslationRow>(
      `insert into cms.translation_revisions
         (resource_id, locale, revision_number, lifecycle, content_schema_version,
          content_json, source_arabic_revision_id, prior_revision_id, stale_source,
          content_digest, authored_by_principal_id)
       values ($1, $2, $3, 'DRAFT', 1, $4, $5, $6, false, $7, $8)
       returning id, resource_id, locale, revision_number, lifecycle, content_schema_version,
                 content_json, source_arabic_revision_id, prior_revision_id, stale_source,
                 content_digest, approved_by_principal_id, record_version`,
      [
        input.resourceId,
        input.locale,
        revisionNumber,
        JSON.stringify(input.content),
        input.sourceArabicRevisionId ?? null,
        input.priorRevisionId ?? null,
        input.contentDigest,
        input.managerPrincipalId,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error('CMS translation insert returned no row.');
    return toTranslation(row);
  }

  async findContent(
    transaction: ActorScopedTransaction,
    contentId: string,
    lock = false,
  ): Promise<CmsContent | undefined> {
    const result = await transaction.query<ContentRow>(
      `${contentSelection} where id = $1${lock ? ' for update' : ''}`,
      [contentId],
    );
    const row = result.rows[0];
    return row ? toContent(row) : undefined;
  }

  async findContentVersion(
    transaction: ActorScopedTransaction,
    versionId: string,
    lock = false,
  ): Promise<CmsContentVersion | undefined> {
    const result = await transaction.query<ContentVersionRow>(
      `${contentVersionSelection} where id = $1${lock ? ' for update' : ''}`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? toVersion(row) : undefined;
  }

  async findVersionByLocalizedResource(
    transaction: ActorScopedTransaction,
    resourceId: string,
  ): Promise<CmsContentVersion | undefined> {
    const result = await transaction.query<ContentVersionRow>(
      `${contentVersionSelection} where localized_resource_id = $1`,
      [resourceId],
    );
    const row = result.rows[0];
    return row ? toVersion(row) : undefined;
  }

  async findTranslation(
    transaction: ActorScopedTransaction,
    translationId: string,
    lock = false,
  ): Promise<TranslationRevision | undefined> {
    const result = await transaction.query<TranslationRow>(
      `${translationSelection} where id = $1${lock ? ' for update' : ''}`,
      [translationId],
    );
    const row = result.rows[0];
    return row ? toTranslation(row) : undefined;
  }

  async findTranslationForResource(
    transaction: ActorScopedTransaction,
    resourceId: string,
    locale: AppLocale,
    lifecycle: TranslationLifecycle,
  ): Promise<TranslationRevision | undefined> {
    const result = await transaction.query<TranslationRow>(
      `${translationSelection}
       where resource_id = $1 and locale = $2 and lifecycle = $3
       order by revision_number desc limit 1`,
      [resourceId, locale, lifecycle],
    );
    const row = result.rows[0];
    return row ? toTranslation(row) : undefined;
  }

  async updateDraftVersion(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['updateDraftVersion']>[1],
  ): Promise<CmsContentVersion | undefined> {
    const result = await transaction.query<ContentVersionRow>(
      `update cms.content_versions
       set blocks_json = $2, content_digest = $3, updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT' and record_version = $4
       returning id, content_id, revision_number, block_schema_version, blocks_json,
                 localized_resource_id, lifecycle, content_digest, record_version`,
      [input.versionId, JSON.stringify(input.blocks), input.contentDigest, input.expectedVersion],
    );
    const row = result.rows[0];
    return row ? toVersion(row) : undefined;
  }

  async updateDraftTranslation(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['updateDraftTranslation']>[1],
  ): Promise<TranslationRevision | undefined> {
    const result = await transaction.query<TranslationRow>(
      `update cms.translation_revisions
       set content_json = $2, content_digest = $3,
           source_arabic_revision_id = coalesce($4, source_arabic_revision_id),
           stale_source = false, updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT' and record_version = $5
       returning id, resource_id, locale, revision_number, lifecycle, content_schema_version,
                 content_json, source_arabic_revision_id, prior_revision_id, stale_source,
                 content_digest, approved_by_principal_id, record_version`,
      [
        input.translationId,
        JSON.stringify(input.content),
        input.contentDigest,
        input.sourceArabicRevisionId ?? null,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row ? toTranslation(row) : undefined;
  }

  async setTranslationLifecycle(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['setTranslationLifecycle']>[1],
  ): Promise<TranslationRevision | undefined> {
    const result = await transaction.query<TranslationRow>(
      `update cms.translation_revisions
       set lifecycle = $2,
           reviewed_by_principal_id = case when $2 in ('DRAFT', 'IN_REVIEW') then $3
                                           else reviewed_by_principal_id end,
           reviewed_at = coalesce($4, reviewed_at), review_note = coalesce($5, review_note),
           approved_by_principal_id = case when $2 = 'APPROVED' then $3
                                           else approved_by_principal_id end,
           approved_at = coalesce($6, approved_at), updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and record_version = $7 and lifecycle in ('DRAFT', 'IN_REVIEW')
       returning id, resource_id, locale, revision_number, lifecycle, content_schema_version,
                 content_json, source_arabic_revision_id, prior_revision_id, stale_source,
                 content_digest, approved_by_principal_id, record_version`,
      [
        input.translationId,
        input.lifecycle,
        input.managerPrincipalId,
        input.reviewedAt ?? null,
        input.reviewNote ?? null,
        input.approvedAt ?? null,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row ? toTranslation(row) : undefined;
  }

  async publishContent(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['publishContent']>[1],
  ): Promise<Readonly<{ content: CmsContent; version: CmsContentVersion }> | undefined> {
    const lockedContent = await transaction.query<ContentRow>(
      `${contentSelection} where id = $1 and record_version = $2 for update`,
      [input.contentId, input.expectedContentVersion],
    );
    if (!lockedContent.rows[0]) return undefined;
    const locked = await transaction.query<ContentVersionRow>(
      `${contentVersionSelection}
       where id = $1 and content_id = $2 and lifecycle = 'DRAFT' for update`,
      [input.versionId, input.contentId],
    );
    const versionRow = locked.rows[0];
    if (!versionRow) return undefined;

    const approved = await transaction.query<PublishableTranslationRow>(
      `${translationSelection.replace(
        'from cms.translation_revisions',
        `, authored_by_principal_id, reviewed_by_principal_id, reviewed_at, approved_at
         from cms.translation_revisions`,
      )}
       where id = any($1::uuid[]) and resource_id = $2 and lifecycle = 'APPROVED'
       order by locale for update`,
      [input.translationIds, versionRow.localized_resource_id],
    );
    if (approved.rowCount !== input.translationIds.length) return undefined;

    let publishedArabicRevisionId: string | undefined;
    for (const source of approved.rows) {
      const revisionNumber = await nextTranslationRevision(
        transaction,
        source.resource_id,
        source.locale,
      );
      const published = await transaction.query<{ id: string }>(
        `insert into cms.translation_revisions
           (resource_id, locale, revision_number, lifecycle, content_schema_version,
            content_json, source_arabic_revision_id, prior_revision_id, stale_source,
            content_digest, authored_by_principal_id, reviewed_by_principal_id,
            approved_by_principal_id, published_by_principal_id, reviewed_at,
            approved_at, published_at, review_note)
         values ($1, $2, $3, 'PUBLISHED', $4, $5, $6, $7, $8, $9, $10,
                 $11, $12, $13, $14, $15, $16, $17)
         returning id`,
        [
          source.resource_id,
          source.locale,
          revisionNumber,
          source.content_schema_version,
          JSON.stringify(source.content_json),
          source.locale === 'en' ? publishedArabicRevisionId : null,
          source.id,
          source.stale_source,
          source.content_digest,
          source.authored_by_principal_id,
          source.reviewed_by_principal_id,
          source.approved_by_principal_id,
          input.managerPrincipalId,
          source.reviewed_at,
          source.approved_at,
          input.publishedAt,
          null,
        ],
      );
      const publishedId = published.rows[0]?.id;
      if (!publishedId) throw new Error('Published CMS translation insert returned no row.');
      if (source.locale === 'ar') publishedArabicRevisionId = publishedId;
      if (source.locale === 'en' && !publishedArabicRevisionId) {
        throw new Error('English CMS publication requires its published Arabic source.');
      }
      const pointerColumn =
        source.locale === 'ar' ? 'current_ar_revision_id' : 'current_en_revision_id';
      await transaction.query(
        `update cms.localized_resources
         set ${pointerColumn} = $2, record_version = record_version + 1
         where id = $1`,
        [source.resource_id, publishedId],
      );
    }

    const publishedVersion = await transaction.query<ContentVersionRow>(
      `update cms.content_versions
       set lifecycle = 'PUBLISHED', published_by_principal_id = $2, published_at = $3,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT'
       returning id, content_id, revision_number, block_schema_version, blocks_json,
                 localized_resource_id, lifecycle, content_digest, record_version`,
      [input.versionId, input.managerPrincipalId, input.publishedAt],
    );
    const newVersion = publishedVersion.rows[0];
    if (!newVersion) throw new Error('CMS publication lost its locked draft version.');
    const publishedContent = await transaction.query<ContentRow>(
      `update cms.contents
       set visibility = 'PUBLISHED', current_published_version_id = $2,
           updated_by_principal_id = $3, updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and record_version = $4
       returning id, kind, slug, visibility, current_published_version_id, record_version`,
      [input.contentId, input.versionId, input.managerPrincipalId, input.expectedContentVersion],
    );
    const newContent = publishedContent.rows[0];
    if (!newContent) throw new Error('CMS publication lost its locked content identity.');
    return Object.freeze({ content: toContent(newContent), version: toVersion(newVersion) });
  }

  async hideContent(
    transaction: ActorScopedTransaction,
    input: Parameters<CmsPersistence['hideContent']>[1],
  ): Promise<CmsContent | undefined> {
    const result = await transaction.query<ContentRow>(
      `update cms.contents
       set visibility = 'HIDDEN', updated_by_principal_id = $2,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and visibility = 'PUBLISHED' and record_version = $3
       returning id, kind, slug, visibility, current_published_version_id, record_version`,
      [input.contentId, input.managerPrincipalId, input.expectedVersion],
    );
    const row = result.rows[0];
    return row ? toContent(row) : undefined;
  }

  async findCurrentPublished(
    transaction: ActorScopedTransaction,
    slug: string,
    locale: AppLocale,
  ): Promise<PublicContent | undefined> {
    const pointerColumn = locale === 'ar' ? 'current_ar_revision_id' : 'current_en_revision_id';
    const result = await transaction.query<
      QueryResultRow & {
        blocks_json: readonly CmsBlock[];
        content_id: string;
        content_version_id: string;
        content_json: TranslationDocument;
        localized_resource_id: string;
        locale: AppLocale;
        slug: string;
        translation_revision_id: string;
      }
    >(
      `select c.id as content_id, c.slug, v.id as content_version_id,
              v.localized_resource_id, v.blocks_json, tr.locale,
              tr.id as translation_revision_id, tr.content_json
       from cms.contents c
       join cms.content_versions v on v.id = c.current_published_version_id
       join cms.localized_resources lr on lr.id = v.localized_resource_id
       join cms.translation_revisions tr on tr.id = lr.${pointerColumn}
       where c.slug = $1 and c.visibility = 'PUBLISHED'
         and v.lifecycle = 'PUBLISHED' and tr.lifecycle = 'PUBLISHED'`,
      [slug],
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          blocks: Object.freeze(row.blocks_json.map((block) => Object.freeze({ ...block }))),
          contentId: row.content_id,
          contentVersionId: row.content_version_id,
          locale: row.locale,
          localizedResourceId: row.localized_resource_id,
          slug: row.slug,
          translation: Object.freeze({
            entries: Object.freeze({ ...row.content_json.entries }),
          }),
          translationRevisionId: row.translation_revision_id,
        })
      : undefined;
  }
}

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { CmsBlock, CmsContentKind, TranslationDocument } from '../../domain/content';

export const cmsSchema = pgSchema('cms');

const createdAt = () =>
  timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull();

export const localizedResources = cmsSchema.table(
  'localized_resources',
  {
    id: uuid().defaultRandom().primaryKey(),
    resourceType: text('resource_type').notNull(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    currentArabicRevisionId: uuid('current_ar_revision_id'),
    currentEnglishRevisionId: uuid('current_en_revision_id'),
    createdAt: createdAt(),
    recordVersion: integer('record_version').default(1).notNull(),
  },
  (table) => [
    check('localized_resources_record_version_positive', sql`${table.recordVersion} > 0`),
  ],
);

export const translationRevisions = cmsSchema.table(
  'translation_revisions',
  {
    id: uuid().defaultRandom().primaryKey(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => localizedResources.id, { onDelete: 'restrict' }),
    locale: text().notNull().$type<'ar' | 'en'>(),
    revisionNumber: integer('revision_number').notNull(),
    lifecycle: text().notNull().$type<'APPROVED' | 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'>(),
    contentSchemaVersion: integer('content_schema_version').notNull(),
    contentJson: jsonb('content_json').notNull().$type<TranslationDocument>(),
    sourceArabicRevisionId: uuid('source_arabic_revision_id'),
    priorRevisionId: uuid('prior_revision_id'),
    staleSource: boolean('stale_source').default(false).notNull(),
    contentDigest: text('content_digest').notNull(),
    authoredByPrincipalId: uuid('authored_by_principal_id').notNull(),
    reviewedByPrincipalId: uuid('reviewed_by_principal_id'),
    approvedByPrincipalId: uuid('approved_by_principal_id'),
    publishedByPrincipalId: uuid('published_by_principal_id'),
    reviewedAt: timestamp('reviewed_at', { mode: 'date', withTimezone: true }),
    approvedAt: timestamp('approved_at', { mode: 'date', withTimezone: true }),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    reviewNote: text('review_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('translation_revisions_resource_locale_sequence_unique').on(
      table.resourceId,
      table.locale,
      table.revisionNumber,
    ),
    check('translation_revisions_locale_allowed', sql`${table.locale} in ('ar', 'en')`),
    check('translation_revisions_revision_positive', sql`${table.revisionNumber} > 0`),
    check('translation_revisions_record_version_positive', sql`${table.recordVersion} > 0`),
    check('translation_revisions_schema_version_positive', sql`${table.contentSchemaVersion} > 0`),
  ],
);

export const contents = cmsSchema.table(
  'contents',
  {
    id: uuid().defaultRandom().primaryKey(),
    kind: text().notNull().$type<CmsContentKind>(),
    slug: text().notNull(),
    visibility: text().notNull().$type<'DRAFT' | 'HIDDEN' | 'PUBLISHED'>(),
    currentPublishedVersionId: uuid('current_published_version_id'),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('contents_slug_unique').on(table.slug),
    check('contents_record_version_positive', sql`${table.recordVersion} > 0`),
  ],
);

export const contentVersions = cmsSchema.table(
  'content_versions',
  {
    id: uuid().defaultRandom().primaryKey(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contents.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    blockSchemaVersion: integer('block_schema_version').notNull(),
    blocksJson: jsonb('blocks_json').notNull().$type<readonly CmsBlock[]>(),
    localizedResourceId: uuid('localized_resource_id')
      .notNull()
      .references(() => localizedResources.id, { onDelete: 'restrict' }),
    lifecycle: text().notNull().$type<'DRAFT' | 'PUBLISHED'>(),
    contentDigest: text('content_digest').notNull(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    publishedByPrincipalId: uuid('published_by_principal_id'),
    createdAt: createdAt(),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('content_versions_content_sequence_unique').on(
      table.contentId,
      table.revisionNumber,
    ),
    uniqueIndex('content_versions_localized_resource_unique').on(table.localizedResourceId),
    check('content_versions_revision_positive', sql`${table.revisionNumber} > 0`),
    check('content_versions_schema_version_positive', sql`${table.blockSchemaVersion} > 0`),
    check('content_versions_record_version_positive', sql`${table.recordVersion} > 0`),
  ],
);

export const cmsTables = Object.freeze({
  contents,
  contentVersions,
  localizedResources,
  translationRevisions,
});

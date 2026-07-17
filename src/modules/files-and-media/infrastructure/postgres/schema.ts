import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const filesSchema = pgSchema('files');
const createdAt = () => timestamp('created_at', { mode: 'date', withTimezone: true }).notNull();
const updatedAt = () => timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull();

export const uploadIntents = filesSchema.table(
  'upload_intents',
  {
    id: uuid().defaultRandom().primaryKey(),
    requestingPrincipalId: uuid('requesting_principal_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    purpose: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    classification: text().notNull(),
    declaredDisplayFilename: text('declared_display_filename').notNull(),
    declaredMediaType: text('declared_media_type').notNull(),
    declaredSize: bigint('declared_size', { mode: 'number' }).notNull(),
    expectedChecksum: text('expected_checksum'),
    generatedObjectKey: text('generated_object_key').notNull(),
    expectedZone: text('expected_zone').notNull().$type<'QUARANTINE'>(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    lifecycle: text().notNull().$type<'CANCELLED' | 'EXPIRED' | 'FINALIZED' | 'PENDING'>(),
    finalizedAt: timestamp('finalized_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    unique('upload_intents_idempotency_unique').on(
      table.requestingPrincipalId,
      table.idempotencyKey,
    ),
    uniqueIndex('upload_intents_object_key_unique').on(table.generatedObjectKey),
  ],
);

export const fileObjects = filesSchema.table(
  'file_objects',
  {
    id: uuid().defaultRandom().primaryKey(),
    uploadIntentId: uuid('upload_intent_id')
      .notNull()
      .references(() => uploadIntents.id, { onDelete: 'restrict' }),
    uploaderPrincipalId: uuid('uploader_principal_id').notNull(),
    classification: text().notNull(),
    purpose: text().notNull(),
    logicalZone: text('logical_zone').notNull(),
    storageContainer: text('storage_container').notNull(),
    objectKey: text('object_key').notNull(),
    objectVersion: text('object_version').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    declaredMediaType: text('declared_media_type').notNull(),
    detectedMediaType: text('detected_media_type').notNull(),
    checksum: text().notNull(),
    lifecycle: text().notNull(),
    scanState: text('scan_state').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('file_objects_upload_intent_unique').on(table.uploadIntentId),
    unique('file_objects_version_unique').on(
      table.logicalZone,
      table.storageContainer,
      table.objectKey,
      table.objectVersion,
    ),
  ],
);

export const scanEvents = filesSchema.table(
  'scan_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    fileObjectId: uuid('file_object_id')
      .notNull()
      .references(() => fileObjects.id, { onDelete: 'restrict' }),
    provider: text().notNull(),
    providerEventId: text('provider_event_id').notNull(),
    payloadDigest: text('payload_digest').notNull(),
    signatureVerified: boolean('signature_verified').notNull(),
    outcome: text().notNull(),
    safeReasonCode: text('safe_reason_code'),
    safeMetadataJson: jsonb('safe_metadata_json').notNull(),
    providerOccurredAt: timestamp('provider_occurred_at', { mode: 'date', withTimezone: true }),
    receivedAt: timestamp('received_at', { mode: 'date', withTimezone: true }).notNull(),
    correlationId: uuid('correlation_id').notNull(),
  },
  (table) => [
    unique('scan_events_provider_event_unique').on(table.provider, table.providerEventId),
  ],
);

export const attachments = filesSchema.table('attachments', {
  id: uuid().defaultRandom().primaryKey(),
  fileObjectId: uuid('file_object_id')
    .notNull()
    .references(() => fileObjects.id, { onDelete: 'restrict' }),
  uploaderPrincipalId: uuid('uploader_principal_id').notNull(),
  ownerCustomerId: uuid('owner_customer_id'),
  attachmentKind: text('attachment_kind').notNull(),
  availability: text().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

export const publicMediaDerivatives = filesSchema.table(
  'public_media_derivatives',
  {
    id: uuid().defaultRandom().primaryKey(),
    sourceFileObjectId: uuid('source_file_object_id')
      .notNull()
      .references(() => fileObjects.id, { onDelete: 'restrict' }),
    variantKind: text('variant_kind').notNull(),
    storageContainer: text('storage_container').notNull(),
    objectKey: text('object_key').notNull(),
    objectVersion: text('object_version').notNull(),
    deliveryPath: text('delivery_path').notNull(),
    mediaType: text('media_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    checksum: text().notNull(),
    lifecycle: text().notNull(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    publishedByPrincipalId: uuid('published_by_principal_id'),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('public_media_derivatives_delivery_path_unique').on(table.deliveryPath),
    unique('public_media_derivatives_object_unique').on(
      table.storageContainer,
      table.objectKey,
      table.objectVersion,
    ),
  ],
);

export const catalogMedia = filesSchema.table('catalog_media', {
  id: uuid().defaultRandom().primaryKey(),
  derivativeId: uuid('derivative_id')
    .notNull()
    .references(() => publicMediaDerivatives.id, { onDelete: 'restrict' }),
  productId: uuid('product_id'),
  collectionId: uuid('collection_id'),
  altTextAr: text('alt_text_ar').notNull(),
  altTextEn: text('alt_text_en'),
  sortOrder: integer('sort_order').notNull(),
  isPrimary: boolean('is_primary').notNull(),
  createdAt: createdAt(),
});

export const cmsMedia = filesSchema.table('cms_media', {
  id: uuid().defaultRandom().primaryKey(),
  derivativeId: uuid('derivative_id')
    .notNull()
    .references(() => publicMediaDerivatives.id, { onDelete: 'restrict' }),
  contentId: uuid('content_id').notNull(),
  altTextAr: text('alt_text_ar').notNull(),
  altTextEn: text('alt_text_en'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: createdAt(),
});

export const reconciliationFindings = filesSchema.table('reconciliation_findings', {
  id: uuid().defaultRandom().primaryKey(),
  findingType: text('finding_type').notNull(),
  fileObjectId: uuid('file_object_id').references(() => fileObjects.id, {
    onDelete: 'restrict',
  }),
  expectedZone: text('expected_zone'),
  expectedContainer: text('expected_container'),
  expectedKey: text('expected_key'),
  expectedVersion: text('expected_version'),
  observedSchemaVersion: integer('observed_schema_version').notNull(),
  observedJson: jsonb('observed_json').notNull(),
  status: text().notNull().$type<'OPEN' | 'RESOLVED'>(),
  safeReasonCode: text('safe_reason_code').notNull(),
  firstObservedAt: timestamp('first_observed_at', { mode: 'date', withTimezone: true }).notNull(),
  lastObservedAt: timestamp('last_observed_at', { mode: 'date', withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { mode: 'date', withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

export const fileTables = Object.freeze({
  attachments,
  catalogMedia,
  cmsMedia,
  fileObjects,
  publicMediaDerivatives,
  reconciliationFindings,
  scanEvents,
  uploadIntents,
});

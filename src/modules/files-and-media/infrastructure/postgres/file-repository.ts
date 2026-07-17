import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';

import type { ActorScopedTransaction } from '../../../../platform/database';
import { utcInstantFromDate, type Identifier, type UtcInstant } from '../../../../shared/kernel';
import {
  fileClassifications,
  fileLifecycleStates,
  fileLogicalZones,
  filePurposes,
  scanStates,
  type FileClassification,
  type FileLifecycle,
  type FileLogicalZone,
  type FileObject,
  type FileObjectId,
  type FilePurpose,
  type FileTarget,
  type PublicMediaDerivative,
  type ScanState,
  type UploadIntent,
  type VerifiedScanEvent,
} from '../../domain/file-lifecycle';
import type {
  ExpectedStorageObject,
  FileAccessRecord,
  FileRepository,
  ReconciliationFindingDraft,
  ScanEventRegistration,
  UploadIntentDraft,
  UploadIntentRegistration,
} from '../../ports/persistence';

type UploadIntentRow = QueryResultRow & {
  classification: string;
  declared_display_filename: string;
  declared_media_type: string;
  declared_size: string;
  expected_checksum: string | null;
  expected_zone: string;
  expires_at: Date;
  generated_object_key: string;
  id: string;
  idempotency_key: string;
  lifecycle: string;
  purpose: string;
  requesting_principal_id: string;
  target_id: string;
  target_type: string;
};

type FileObjectRow = QueryResultRow & {
  byte_size: string;
  checksum: string;
  classification: string;
  declared_media_type: string;
  detected_media_type: string;
  id: string;
  lifecycle: string;
  logical_zone: string;
  object_key: string;
  object_version: string;
  purpose: string;
  scan_state: string;
  storage_container: string;
  uploader_principal_id: string;
};

function instant(value: Date): UtcInstant {
  const parsed = utcInstantFromDate(value);
  if (!parsed.ok) throw new Error('PostgreSQL returned an invalid timestamp.');
  return parsed.value;
}

function oneOf<Value extends string>(
  candidate: string,
  values: readonly Value[],
  label: string,
): Value {
  if (!values.includes(candidate as Value))
    throw new Error(`PostgreSQL returned invalid ${label}.`);
  return candidate as Value;
}

function target(type: string, id: string): FileTarget {
  if (type === 'PRODUCT') {
    return Object.freeze({ id: id as Identifier<'Product'>, type });
  }
  if (type === 'COLLECTION') {
    return Object.freeze({ id: id as Identifier<'Collection'>, type });
  }
  if (type === 'CMS_CONTENT') {
    return Object.freeze({ id: id as Identifier<'CmsContent'>, type });
  }
  throw new Error('PostgreSQL returned an unsupported P2 file target.');
}

function uploadIntent(row: UploadIntentRow): UploadIntent {
  const purpose = oneOf(row.purpose, filePurposes, 'file purpose');
  if (purpose !== 'CATALOG_MEDIA' && purpose !== 'CMS_MEDIA') {
    throw new Error('P2 upload intent contains a disabled external purpose.');
  }
  if (row.classification !== 'PUBLIC_MEDIA_SOURCE' || row.expected_zone !== 'QUARANTINE') {
    throw new Error('P2 upload intent has an invalid storage classification.');
  }
  const lifecycle = oneOf(
    row.lifecycle,
    ['CANCELLED', 'EXPIRED', 'FINALIZED', 'PENDING'] as const,
    'upload lifecycle',
  );
  return Object.freeze({
    classification: 'PUBLIC_MEDIA_SOURCE',
    declaredDisplayFilename: row.declared_display_filename,
    declaredMediaType: row.declared_media_type,
    declaredSize: Number(row.declared_size),
    ...(row.expected_checksum ? { expectedChecksum: row.expected_checksum } : {}),
    expectedZone: 'QUARANTINE',
    expiresAt: instant(row.expires_at),
    generatedObjectKey: row.generated_object_key,
    id: row.id as UploadIntent['id'],
    idempotencyKey: row.idempotency_key,
    lifecycle,
    purpose,
    requestingPrincipalId: row.requesting_principal_id as Identifier<'Principal'>,
    target: target(row.target_type, row.target_id),
  });
}

function fileObject(row: FileObjectRow): FileObject {
  return Object.freeze({
    byteSize: Number(row.byte_size),
    checksumSha256: row.checksum,
    classification: oneOf(
      row.classification,
      fileClassifications,
      'file classification',
    ) as FileClassification,
    declaredMediaType: row.declared_media_type,
    detectedMediaType: row.detected_media_type,
    id: row.id as FileObjectId,
    lifecycle: oneOf(row.lifecycle, fileLifecycleStates, 'file lifecycle') as FileLifecycle,
    objectKey: row.object_key,
    purpose: oneOf(row.purpose, filePurposes, 'file purpose') as FilePurpose,
    scanState: oneOf(row.scan_state, scanStates, 'scan state') as ScanState,
    storageContainer: row.storage_container,
    uploaderPrincipalId: row.uploader_principal_id as Identifier<'Principal'>,
    versionId: row.object_version,
    zone: oneOf(row.logical_zone, fileLogicalZones, 'logical zone') as FileLogicalZone,
  });
}

function semanticallyMatches(existing: UploadIntent, draft: UploadIntentDraft): boolean {
  return (
    existing.requestingPrincipalId === draft.requestingPrincipalId &&
    existing.purpose === draft.purpose &&
    existing.target.type === draft.target.type &&
    existing.target.id === draft.target.id &&
    existing.classification === draft.classification &&
    existing.declaredDisplayFilename === draft.declaredDisplayFilename &&
    existing.declaredMediaType === draft.declaredMediaType &&
    existing.declaredSize === draft.declaredSize &&
    existing.expectedChecksum === draft.expectedChecksum
  );
}

function extensionFor(mediaType: string): string {
  switch (mediaType) {
    case 'image/avif':
      return 'avif';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error('Unsupported public derivative media type.');
  }
}

export class PostgresFileRepository implements FileRepository {
  async createOrResolveUploadIntent(
    transaction: ActorScopedTransaction,
    draft: UploadIntentDraft,
  ): Promise<UploadIntentRegistration> {
    const id = randomUUID();
    const inserted = await transaction.query<UploadIntentRow>(
      `insert into files.upload_intents (
         id, requesting_principal_id, idempotency_key, purpose, target_type, target_id,
         classification, declared_display_filename, declared_media_type, declared_size,
         expected_checksum, generated_object_key, expected_zone, expires_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (requesting_principal_id, idempotency_key) do nothing
       returning *`,
      [
        id,
        draft.requestingPrincipalId,
        draft.idempotencyKey,
        draft.purpose,
        draft.target.type,
        draft.target.id,
        draft.classification,
        draft.declaredDisplayFilename,
        draft.declaredMediaType,
        draft.declaredSize,
        draft.expectedChecksum ?? null,
        draft.generatedObjectKey,
        draft.expectedZone,
        draft.expiresAt,
      ],
    );
    if (inserted.rows[0]) {
      return Object.freeze({ intent: uploadIntent(inserted.rows[0]), kind: 'CREATED' });
    }
    const existing = await transaction.query<UploadIntentRow>(
      `select * from files.upload_intents
       where requesting_principal_id = $1 and idempotency_key = $2`,
      [draft.requestingPrincipalId, draft.idempotencyKey],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('Upload intent idempotency row could not be resolved.');
    const mapped = uploadIntent(row);
    return semanticallyMatches(mapped, draft)
      ? Object.freeze({ intent: mapped, kind: 'EXISTING' })
      : Object.freeze({ kind: 'CONFLICT' });
  }

  async findUploadIntent(
    transaction: ActorScopedTransaction,
    uploadIntentId: UploadIntent['id'],
  ): Promise<UploadIntent | undefined> {
    const result = await transaction.query<UploadIntentRow>(
      'select * from files.upload_intents where id = $1',
      [uploadIntentId],
    );
    return result.rows[0] ? uploadIntent(result.rows[0]) : undefined;
  }

  async findFileByUploadIntent(
    transaction: ActorScopedTransaction,
    uploadIntentId: UploadIntent['id'],
  ): Promise<FileObject | undefined> {
    const result = await transaction.query<FileObjectRow>(
      'select * from files.file_objects where upload_intent_id = $1',
      [uploadIntentId],
    );
    return result.rows[0] ? fileObject(result.rows[0]) : undefined;
  }

  async finalizeUpload(
    transaction: ActorScopedTransaction,
    input: Parameters<FileRepository['finalizeUpload']>[1],
  ): Promise<FileObject> {
    const locked = await transaction.query<UploadIntentRow>(
      'select * from files.upload_intents where id = $1 for update',
      [input.intent.id],
    );
    const row = locked.rows[0];
    if (!row) throw new Error('Upload intent disappeared during finalization.');
    const current = uploadIntent(row);
    const existing = await this.findFileByUploadIntent(transaction, current.id);
    if (existing) {
      if (
        existing.objectKey !== input.object.objectKey ||
        existing.versionId !== input.object.versionId ||
        existing.checksumSha256 !== input.object.checksumSha256
      ) {
        throw new Error('Upload intent was finalized with a different object version.');
      }
      return existing;
    }
    if (current.lifecycle !== 'PENDING') throw new Error('Upload intent is not pending.');

    const id = randomUUID();
    const inserted = await transaction.query<FileObjectRow>(
      `insert into files.file_objects (
         id, upload_intent_id, uploader_principal_id, classification, purpose,
         logical_zone, storage_container, object_key, object_version, byte_size,
         declared_media_type, detected_media_type, checksum, lifecycle, scan_state
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'SCAN_PENDING','PENDING')
       returning *`,
      [
        id,
        current.id,
        current.requestingPrincipalId,
        current.classification,
        current.purpose,
        input.object.zone,
        input.object.storageContainer,
        input.object.objectKey,
        input.object.versionId,
        input.object.byteSize,
        current.declaredMediaType,
        input.detectedMediaType,
        input.object.checksumSha256,
      ],
    );
    const finalized = await transaction.query(
      `update files.upload_intents
       set lifecycle = 'FINALIZED', finalized_at = clock_timestamp(),
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and lifecycle = 'PENDING' and expires_at > clock_timestamp()`,
      [current.id],
    );
    if (finalized.rowCount !== 1 || !inserted.rows[0]) {
      throw new Error('Upload finalization did not commit exactly one object.');
    }
    return fileObject(inserted.rows[0]);
  }

  async applyVerifiedScanEvent(
    transaction: ActorScopedTransaction,
    event: VerifiedScanEvent,
  ): Promise<ScanEventRegistration> {
    const result = await transaction.query<{ result: string }>(
      `select files.apply_scan_result(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
       ) as result`,
      [
        event.storageObject.storageContainer,
        event.storageObject.objectKey,
        event.storageObject.versionId,
        event.provider,
        event.providerEventId,
        event.payloadDigest,
        event.outcome,
        event.occurredAt,
        event.safeReasonCode ?? null,
        JSON.stringify(event.safeMetadata),
        event.correlationId,
      ],
    );
    const status = result.rows[0]?.result;
    if (
      status !== 'CLEAN' &&
      status !== 'DUPLICATE' &&
      status !== 'IGNORED_TERMINAL' &&
      status !== 'NOT_FOUND' &&
      status !== 'PENDING' &&
      status !== 'QUARANTINED'
    ) {
      throw new Error('File scan function returned an invalid result.');
    }
    return Object.freeze({
      kind: status === 'DUPLICATE' ? 'DUPLICATE' : 'APPLIED',
      recoveryFindingCreated: status === 'PENDING',
      result: status,
    });
  }

  async findAccessRecord(
    transaction: ActorScopedTransaction,
    fileObjectId: FileObjectId,
  ): Promise<FileAccessRecord | undefined> {
    const result = await transaction.query<
      FileObjectRow & { target_id: string; target_type: string }
    >(
      `select f.*, i.target_type, i.target_id
       from files.file_objects f
       join files.upload_intents i on i.id = f.upload_intent_id
       where f.id = $1`,
      [fileObjectId],
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({ file: fileObject(row), target: target(row.target_type, row.target_id) })
      : undefined;
  }

  async publishDerivative(
    transaction: ActorScopedTransaction,
    input: Parameters<FileRepository['publishDerivative']>[1],
  ): Promise<PublicMediaDerivative> {
    if (transaction.actorContext.actor.kind !== 'manager') {
      throw new Error('Only the Manager can publish media.');
    }
    const locked = await transaction.query<FileObjectRow>(
      'select * from files.file_objects where id = $1 for key share',
      [input.source.file.id],
    );
    const source = locked.rows[0] ? fileObject(locked.rows[0]) : undefined;
    if (
      !source ||
      source.lifecycle !== 'CLEAN' ||
      source.scanState !== 'CLEAN' ||
      source.classification !== 'PUBLIC_MEDIA_SOURCE'
    ) {
      throw new Error('Only a clean public media source can be published.');
    }
    if (
      input.altTextAr.trim().length === 0 ||
      input.altTextAr.trim().length > 300 ||
      (input.altTextEn !== undefined &&
        (input.altTextEn.trim().length === 0 || input.altTextEn.trim().length > 300)) ||
      !Number.isSafeInteger(input.sortOrder) ||
      input.sortOrder < 0
    ) {
      throw new Error('Public media metadata is invalid.');
    }

    const id = randomUUID();
    const deliveryPath = `/media/${id}.${extensionFor(input.derivative.detectedMediaType)}`;
    const inserted = await transaction.query<{ id: string }>(
      `insert into files.public_media_derivatives (
         id, source_file_object_id, variant_kind, storage_container, object_key,
         object_version, delivery_path, media_type, byte_size, width, height,
         checksum, lifecycle, created_by_principal_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'READY',$13)
       on conflict (storage_container, object_key, object_version) do nothing
       returning id`,
      [
        id,
        source.id,
        input.derivative.variantKind,
        input.derivative.storageContainer,
        input.derivative.objectKey,
        input.derivative.versionId,
        deliveryPath,
        input.derivative.detectedMediaType,
        input.derivative.byteSize,
        input.derivative.width,
        input.derivative.height,
        input.derivative.checksumSha256,
        transaction.actorContext.actor.principalId,
      ],
    );
    const derivativeId =
      inserted.rows[0]?.id ??
      (
        await transaction.query<{ id: string }>(
          `select id from files.public_media_derivatives
       where storage_container = $1 and object_key = $2 and object_version = $3`,
          [
            input.derivative.storageContainer,
            input.derivative.objectKey,
            input.derivative.versionId,
          ],
        )
      ).rows[0]?.id;
    if (!derivativeId) throw new Error('Public derivative could not be resolved.');

    if (input.source.target.type === 'CMS_CONTENT') {
      const existing = await transaction.query(
        'select 1 from files.cms_media where derivative_id = $1 and content_id = $2',
        [derivativeId, input.source.target.id],
      );
      if (existing.rowCount === 0) {
        await transaction.query(
          `insert into files.cms_media (
             derivative_id, content_id, alt_text_ar, alt_text_en, sort_order
           ) values ($1,$2,$3,$4,$5)`,
          [
            derivativeId,
            input.source.target.id,
            input.altTextAr,
            input.altTextEn ?? null,
            input.sortOrder,
          ],
        );
      }
    } else {
      const productId = input.source.target.type === 'PRODUCT' ? input.source.target.id : null;
      const collectionId =
        input.source.target.type === 'COLLECTION' ? input.source.target.id : null;
      const existing = await transaction.query(
        `select 1 from files.catalog_media
         where derivative_id = $1
           and product_id is not distinct from $2::uuid
           and collection_id is not distinct from $3::uuid`,
        [derivativeId, productId, collectionId],
      );
      if (existing.rowCount === 0) {
        await transaction.query(
          `insert into files.catalog_media (
             derivative_id, product_id, collection_id, alt_text_ar, alt_text_en,
             sort_order, is_primary
           ) values ($1,$2,$3,$4,$5,$6,$7)`,
          [
            derivativeId,
            productId,
            collectionId,
            input.altTextAr,
            input.altTextEn ?? null,
            input.sortOrder,
            input.isPrimary,
          ],
        );
      }
    }
    const published = await transaction.query<{
      byte_size: string;
      checksum: string;
      delivery_path: string;
      height: number;
      id: string;
      lifecycle: 'PUBLISHED';
      media_type: string;
      object_key: string;
      object_version: string;
      source_file_object_id: string;
      storage_container: string;
      variant_kind: 'GALLERY' | 'HERO' | 'THUMBNAIL';
      width: number;
    }>(
      `update files.public_media_derivatives
       set lifecycle = 'PUBLISHED', published_by_principal_id = $2,
           published_at = clock_timestamp(), updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and lifecycle = 'READY'
       returning *`,
      [derivativeId, transaction.actorContext.actor.principalId],
    );
    const row =
      published.rows[0] ??
      (
        await transaction.query<(typeof published.rows)[number]>(
          `select * from files.public_media_derivatives
       where id = $1 and lifecycle = 'PUBLISHED'`,
          [derivativeId],
        )
      ).rows[0];
    if (!row) throw new Error('Public derivative was not published.');
    return Object.freeze({
      byteSize: Number(row.byte_size),
      checksumSha256: row.checksum,
      deliveryPath: row.delivery_path,
      detectedMediaType: row.media_type,
      height: row.height,
      id: row.id as PublicMediaDerivative['id'],
      lifecycle: row.lifecycle,
      objectKey: row.object_key,
      sourceFileObjectId: row.source_file_object_id as FileObjectId,
      storageContainer: row.storage_container,
      variantKind: row.variant_kind,
      versionId: row.object_version,
      width: row.width,
    });
  }

  async listExpectedStorageObjects(
    transaction: ActorScopedTransaction,
    input: Parameters<FileRepository['listExpectedStorageObjects']>[1],
  ): Promise<
    Readonly<{ items: readonly ExpectedStorageObject[]; nextFileObjectId?: FileObjectId }>
  > {
    const result = await transaction.query<{
      byte_size: string;
      checksum: string;
      file_object_id: string;
      object_key: string;
      object_version: string;
      storage_container: string;
      zone: string;
    }>(
      `select * from (
         select id as file_object_id, logical_zone as zone, storage_container,
                object_key, object_version, byte_size, checksum
         from files.file_objects where logical_zone = $1
         union all
         select source_file_object_id as file_object_id, 'PUBLIC_MEDIA' as zone,
                storage_container, object_key, object_version, byte_size, checksum
         from files.public_media_derivatives where $1 = 'PUBLIC_MEDIA'
       ) expected
       order by object_key, object_version
       limit $2`,
      [input.zone, input.limit],
    );
    return Object.freeze({
      items: Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            byteSize: Number(row.byte_size),
            checksumSha256: row.checksum,
            fileObjectId: row.file_object_id as FileObjectId,
            objectKey: row.object_key,
            storageContainer: row.storage_container,
            versionId: row.object_version,
            zone: oneOf(row.zone, fileLogicalZones, 'storage zone'),
          }),
        ),
      ),
    });
  }

  async recordReconciliationFinding(
    transaction: ActorScopedTransaction,
    finding: ReconciliationFindingDraft,
  ): Promise<Readonly<{ id: Identifier<'FileReconciliationFinding'>; inserted: boolean }>> {
    const findingType =
      finding.findingType === 'MISSING_OBJECT'
        ? 'MISSING_OBJECT'
        : finding.findingType === 'ORPHAN_OBJECT'
          ? 'UNEXPECTED_OBJECT'
          : finding.expected?.byteSize !== finding.observed?.byteSize
            ? 'SIZE_MISMATCH'
            : 'CHECKSUM_MISMATCH';
    const expected = finding.expected;
    const observedJson = JSON.stringify(finding.observed ?? {});
    const existing = await transaction.query<{ id: string }>(
      `select id from files.reconciliation_findings
       where status = 'OPEN' and finding_type = $1
         and file_object_id is not distinct from $2::uuid
         and expected_zone is not distinct from $3
         and expected_container is not distinct from $4
         and expected_key is not distinct from $5
         and expected_version is not distinct from $6
       order by first_observed_at limit 1 for update`,
      [
        findingType,
        finding.fileObjectId ?? null,
        expected?.zone ?? null,
        expected?.storageContainer ?? null,
        expected?.objectKey ?? null,
        expected?.versionId ?? null,
      ],
    );
    const existingId = existing.rows[0]?.id;
    if (existingId) {
      await transaction.query(
        `update files.reconciliation_findings
         set observed_json = $2::jsonb, last_observed_at = $3,
             updated_at = clock_timestamp(), record_version = record_version + 1
         where id = $1`,
        [existingId, observedJson, finding.observedAt],
      );
      return Object.freeze({
        id: existingId as Identifier<'FileReconciliationFinding'>,
        inserted: false,
      });
    }
    const id = randomUUID();
    await transaction.query(
      `insert into files.reconciliation_findings (
         id, finding_type, file_object_id, expected_zone, expected_container,
         expected_key, expected_version, observed_schema_version, observed_json,
         safe_reason_code, first_observed_at, last_observed_at
       ) values ($1,$2,$3,$4,$5,$6,$7,1,$8::jsonb,$9,$10,$10)`,
      [
        id,
        findingType,
        finding.fileObjectId ?? null,
        expected?.zone ?? null,
        expected?.storageContainer ?? null,
        expected?.objectKey ?? null,
        expected?.versionId ?? null,
        observedJson,
        finding.safeReasonCode,
        finding.observedAt,
      ],
    );
    return Object.freeze({
      id: id as Identifier<'FileReconciliationFinding'>,
      inserted: true,
    });
  }

  async recordUnsafeFinalization(
    transaction: ActorScopedTransaction,
    input: Parameters<FileRepository['recordUnsafeFinalization']>[1],
  ): Promise<void> {
    await this.recordReconciliationFinding(transaction, {
      expected: {
        byteSize: input.intent.declaredSize,
        checksumSha256: input.intent.expectedChecksum ?? '',
        objectKey: input.intent.generatedObjectKey,
        storageContainer: input.object?.storageContainer ?? '',
        versionId: input.object?.versionId ?? '',
        zone: input.intent.expectedZone,
      },
      findingType: input.object ? 'METADATA_MISMATCH' : 'MISSING_OBJECT',
      ...(input.object ? { observed: input.object } : {}),
      observedAt: input.observedAt,
      safeReasonCode: input.reason,
    });
  }
}

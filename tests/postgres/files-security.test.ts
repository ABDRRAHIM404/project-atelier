import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  ExactStoredObject,
  FileAccessRecord,
  UploadIntentDraft,
  VerifiedScanEvent,
} from '../../src/modules/files-and-media';
import { PostgresFileRepository } from '../../src/modules/files-and-media/infrastructure/postgres/file-repository';
import { withActorTransaction } from '../../src/platform/database';
import { parseIdentifier, parseUtcInstant, type Identifier } from '../../src/shared/kernel';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

function id<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Invalid file PostgreSQL fixture identifier.');
  return parsed.value;
}

function instant(value: string) {
  const parsed = parseUtcInstant(value);
  if (!parsed.ok) throw new Error('Invalid file PostgreSQL fixture timestamp.');
  return parsed.value;
}

const categoryResourceId = '51000000-0000-4000-8000-000000000001';
const productResourceId = '51000000-0000-4000-8000-000000000002';
const categoryId = '52000000-0000-4000-8000-000000000001';
const productId = id<'Product'>('53000000-0000-4000-8000-000000000001');
const correlationId = id<'Correlation'>('54000000-0000-4000-8000-000000000001');
const repository = new PostgresFileRepository();

function draft(sequence: number): UploadIntentDraft {
  return Object.freeze({
    classification: 'PUBLIC_MEDIA_SOURCE',
    declaredDisplayFilename: `كرسي-${sequence}.png`,
    declaredMediaType: 'image/png',
    declaredSize: 24,
    expectedChecksum: String(sequence).repeat(64),
    expectedZone: 'QUARANTINE',
    expiresAt: instant('2099-07-16T12:02:00.000Z'),
    generatedObjectKey: `objects/catalog-media/fixture-object-${sequence}`,
    idempotencyKey: `file-pg-intent-${sequence}`,
    purpose: 'CATALOG_MEDIA',
    requestingPrincipalId: p1FixtureIds.managerPrincipal,
    target: Object.freeze({ id: productId, type: 'PRODUCT' }),
  });
}

function objectFor(intentDraft: UploadIntentDraft, sequence: number): ExactStoredObject {
  return Object.freeze({
    byteSize: 24,
    checksumSha256: String(sequence).repeat(64),
    contentType: 'image/png',
    metadata: Object.freeze({
      'atelier-intent-id': '',
      'atelier-purpose': 'CATALOG_MEDIA',
    }),
    objectKey: intentDraft.generatedObjectKey,
    storageContainer: 'atelier-test-quarantine',
    versionId: `version-${sequence}`,
    zone: 'QUARANTINE',
  });
}

function scanEvent(
  object: ExactStoredObject,
  sequence: number,
  outcome: VerifiedScanEvent['outcome'],
): VerifiedScanEvent {
  return Object.freeze({
    correlationId,
    eventType: 'GUARDDUTY_SCAN_RESULT',
    occurredAt: instant(`2026-07-16T12:0${sequence}:00.000Z`),
    outcome,
    payloadDigest: sequence.toString(16).padStart(2, '0').repeat(32),
    provider: 'guardduty',
    providerEventId: `guardduty-event-${sequence}`,
    safeMetadata: Object.freeze({ detector: 'fixture' }),
    safeReasonCode: `SCAN_${outcome}`,
    storageObject: Object.freeze({
      objectKey: object.objectKey,
      storageContainer: object.storageContainer,
      versionId: object.versionId,
    }),
  });
}

describe('Files PostgreSQL lifecycle, RLS, publication, and recovery', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('files_security');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    await owner.query(
      `insert into cms.localized_resources
         (id, resource_type, created_by_principal_id)
       values ($1, 'CATEGORY', $3), ($2, 'PRODUCT', $3)`,
      [categoryResourceId, productResourceId, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into catalog.categories
         (id, localized_resource_id, lifecycle, created_by_principal_id, updated_by_principal_id)
       values ($1, $2, 'PUBLISHED', $3, $3)`,
      [categoryId, categoryResourceId, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type, lifecycle,
          starting_amount_minor, currency_code, created_by_principal_id,
          updated_by_principal_id, published_at)
       values ($1, $2, $3, 'CHAIR', 'PUBLISHED', 10000, 'SAR', $4, $4, clock_timestamp())`,
      [productId, productResourceId, categoryId, p1FixtureIds.managerPrincipal],
    );
    pool = new Pool({ connectionString: database.connectionString, max: 6 });
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  async function createFinalizedFile(sequence: number): Promise<FileAccessRecord> {
    return withActorTransaction(pool, p1ActorContexts.managerMfa, async (transaction) => {
      const intentDraft = draft(sequence);
      const registration = await repository.createOrResolveUploadIntent(transaction, intentDraft);
      if (registration.kind === 'CONFLICT') throw new Error('Unexpected upload conflict.');
      const baseObject = objectFor(intentDraft, sequence);
      const exact = {
        ...baseObject,
        metadata: { ...baseObject.metadata, 'atelier-intent-id': registration.intent.id },
      };
      await repository.finalizeUpload(transaction, {
        detectedMediaType: 'image/png',
        intent: registration.intent,
        object: exact,
      });
      const record = await repository.findAccessRecord(
        transaction,
        (await repository.findFileByUploadIntent(transaction, registration.intent.id))!.id,
      );
      if (!record) throw new Error('Finalized file was not visible to its Manager.');
      return record;
    });
  }

  it('allows only an MFA Manager to register P2 catalog/CMS media metadata', async () => {
    await expect(
      withActorTransaction(pool, p1ActorContexts.managerPassword, (transaction) =>
        repository.createOrResolveUploadIntent(transaction, draft(7)),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
        transaction.query(
          `insert into files.upload_intents
             (requesting_principal_id, idempotency_key, purpose, target_type, target_id,
              classification, declared_display_filename, declared_media_type, declared_size,
              generated_object_key, expires_at)
           values ($1, 'customer-disabled', 'REQUEST_REFERENCE', 'PRODUCT', $2,
                   'PRIVATE_CUSTOMER', 'reference.png', 'image/png', 24,
                   'objects/customer/reference-disabled', clock_timestamp() + interval '2 minutes')`,
          [p1FixtureIds.customerAPrincipal, productId],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });

    const first = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      repository.createOrResolveUploadIntent(transaction, draft(1)),
    );
    const replay = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      repository.createOrResolveUploadIntent(transaction, draft(1)),
    );
    expect(first.kind).toBe('CREATED');
    expect(replay.kind).toBe('EXISTING');
  });

  it('deduplicates exact provider events, records scan gaps, and keeps malicious terminal', async () => {
    const record = await createFinalizedFile(2);
    const exact = objectFor(draft(2), 2);
    const failed = scanEvent(exact, 2, 'FAILED');
    await expect(
      withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
        repository.applyVerifiedScanEvent(transaction, failed),
      ),
    ).resolves.toMatchObject({ recoveryFindingCreated: true, result: 'PENDING' });
    const duplicate = await withActorTransaction(
      pool,
      p1ActorContexts.providerWebhook,
      (transaction) => repository.applyVerifiedScanEvent(transaction, failed),
    );
    expect(duplicate).toMatchObject({ kind: 'DUPLICATE', result: 'DUPLICATE' });
    await expect(
      withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
        repository.applyVerifiedScanEvent(transaction, {
          ...failed,
          payloadDigest: 'f'.repeat(64),
        }),
      ),
    ).rejects.toMatchObject({ code: '23505' });

    const clean = scanEvent(exact, 3, 'CLEAN');
    await withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
      repository.applyVerifiedScanEvent(transaction, clean),
    );
    const malicious = scanEvent(exact, 4, 'MALICIOUS');
    await withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
      repository.applyVerifiedScanEvent(transaction, malicious),
    );
    const ignored = await withActorTransaction(
      pool,
      p1ActorContexts.providerWebhook,
      (transaction) => repository.applyVerifiedScanEvent(transaction, scanEvent(exact, 5, 'CLEAN')),
    );
    expect(ignored.result).toBe('IGNORED_TERMINAL');

    const state = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      repository.findAccessRecord(transaction, record.file.id),
    );
    expect(state?.file).toMatchObject({ lifecycle: 'QUARANTINED', scanState: 'MALICIOUS' });
    const gaps = await withActorTransaction(pool, p1ActorContexts.operator, (transaction) =>
      transaction.query<{ count: number }>(
        `select count(*)::integer as count from files.reconciliation_findings
         where file_object_id = $1 and finding_type = 'EVENT_GAP' and status = 'OPEN'`,
        [record.file.id],
      ),
    );
    expect(gaps.rows[0]?.count).toBe(1);
  });

  it('publishes only a clean optimized derivative while raw sources remain inaccessible', async () => {
    const record = await createFinalizedFile(6);
    const exact = objectFor(draft(6), 6);
    await withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
      repository.applyVerifiedScanEvent(transaction, scanEvent(exact, 6, 'CLEAN')),
    );
    const cleanRecord = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      async (transaction) =>
        (await repository.findAccessRecord(transaction, record.file.id)) as FileAccessRecord,
    );
    const published = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      repository.publishDerivative(transaction, {
        altTextAr: 'كرسي خشبي',
        derivative: {
          byteSize: 24,
          checksumSha256: 'e'.repeat(64),
          detectedMediaType: 'image/png',
          height: 240,
          objectKey: 'objects/public-media/optimized-chair-six',
          storageContainer: 'atelier-test-public',
          variantKind: 'GALLERY',
          versionId: 'public-version-6',
          width: 320,
        },
        isPrimary: true,
        sortOrder: 0,
        source: cleanRecord,
      }),
    );
    expect(published.lifecycle).toBe('PUBLISHED');

    const visible = await withActorTransaction(
      pool,
      p1ActorContexts.visitor,
      async (transaction) => {
        const media = await transaction.query<{ alt_text_ar: string; delivery_path: string }>(
          `select m.alt_text_ar, d.delivery_path
         from files.catalog_media m
         join files.public_media_derivatives d on d.id = m.derivative_id
         where m.product_id = $1`,
          [productId],
        );
        const raw = await transaction.query<{ count: number }>(
          'select count(*)::integer as count from files.file_objects',
        );
        return { media: media.rows, raw: raw.rows[0]?.count };
      },
    );
    expect(visible).toEqual({
      media: [{ alt_text_ar: 'كرسي خشبي', delivery_path: published.deliveryPath }],
      raw: 0,
    });
  });

  it('rejects direct publication from a malicious source and protects scan history', async () => {
    const malicious = await createFinalizedFile(8);
    const exact = objectFor(draft(8), 8);
    await withActorTransaction(pool, p1ActorContexts.providerWebhook, (transaction) =>
      repository.applyVerifiedScanEvent(transaction, scanEvent(exact, 8, 'MALICIOUS')),
    );
    await expect(
      withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
        transaction.query(
          `insert into files.public_media_derivatives
             (source_file_object_id, variant_kind, storage_container, object_key,
              object_version, delivery_path, media_type, byte_size, width, height,
              checksum, lifecycle, created_by_principal_id, published_by_principal_id, published_at)
           values ($1, 'GALLERY', 'atelier-test-public', 'objects/public-media/unsafe-eight',
                   'public-version-8', '/media/unsafe-eight.png', 'image/png', 24, 320, 240,
                   repeat('8', 64), 'PUBLISHED', $2, $2, clock_timestamp())`,
          [malicious.file.id, p1FixtureIds.managerPrincipal],
        ),
      ),
    ).rejects.toMatchObject({ code: '23514' });

    const scanId = await owner.query<{ id: string }>(
      'select id from files.scan_events where file_object_id = $1 limit 1',
      [malicious.file.id],
    );
    await expect(
      owner.query('update files.scan_events set safe_reason_code = $2 where id = $1', [
        scanId.rows[0]?.id,
        'ALTERED',
      ]),
    ).rejects.toMatchObject({ code: '55000' });
  });

  it('records exact missing/version/metadata findings without assigning ownership', async () => {
    const record = await createFinalizedFile(9);
    const result = await withActorTransaction(
      pool,
      p1ActorContexts.systemJob,
      async (transaction) => {
        const expected = await repository.listExpectedStorageObjects(transaction, {
          limit: 10,
          zone: 'QUARANTINE',
        });
        const item = expected.items.find((candidate) => candidate.fileObjectId === record.file.id);
        if (!item) throw new Error('Expected file was not available for reconciliation.');
        const inserted = await repository.recordReconciliationFinding(transaction, {
          expected: item,
          fileObjectId: item.fileObjectId,
          findingType: 'MISSING_OBJECT',
          observedAt: instant('2026-07-16T12:09:00.000Z'),
          safeReasonCode: 'STORAGE_OBJECT_MISSING',
        });
        const replay = await repository.recordReconciliationFinding(transaction, {
          expected: item,
          fileObjectId: item.fileObjectId,
          findingType: 'MISSING_OBJECT',
          observedAt: instant('2026-07-16T12:10:00.000Z'),
          safeReasonCode: 'STORAGE_OBJECT_MISSING',
        });
        return { inserted, replay };
      },
    );
    expect(result).toMatchObject({ inserted: { inserted: true }, replay: { inserted: false } });
  });
});

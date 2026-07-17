import { describe, expect, it, vi } from 'vitest';

import {
  FileAccessService,
  FileReconciliationService,
  FileScanService,
  FileUploadService,
  PublicMediaService,
  type ExactStoredObject,
  type FileAccessRecord,
  type FileObject,
  type FileRepository,
  type PublicMediaDerivative,
  type UploadIntent,
  type VerifiedScanEvent,
} from '../../src/modules/files-and-media';
import type { FilePolicyPort } from '../../src/modules/files-and-media/ports/file-policy';
import type { FileParentAuthorizationPort } from '../../src/modules/files-and-media/ports/parent-authorization';
import type {
  StorageInventoryPort,
  StorageKeyFactory,
  StorageObjectPort,
} from '../../src/modules/files-and-media/ports/storage';
import type { FileSecurityRecorderPort } from '../../src/modules/files-and-media/ports/telemetry';
import type { ActorScopedTransaction } from '../../src/platform/database';
import {
  err,
  ok,
  parseIdentifier,
  parseUtcInstant,
  type Identifier,
  type ResolvedActorContext,
  type UtcInstant,
} from '../../src/shared/kernel';

function id<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Invalid test identifier.');
  return parsed.value;
}

function at(value: string): UtcInstant {
  const parsed = parseUtcInstant(value);
  if (!parsed.ok) throw new Error('Invalid test timestamp.');
  return parsed.value;
}

function transaction(actorContext: ResolvedActorContext): ActorScopedTransaction {
  return {
    actorContext,
    orm: undefined as never,
    query: vi.fn() as never,
  };
}

const managerPrincipal = id<'Principal'>('40000000-0000-4000-8000-000000000001');
const customerPrincipal = id<'Principal'>('40000000-0000-4000-8000-000000000002');
const customerId = id<'Customer'>('41000000-0000-4000-8000-000000000001');
const productId = id<'Product'>('50000000-0000-4000-8000-000000000001');
const intentId = id<'UploadIntent'>('60000000-0000-4000-8000-000000000001');
const fileId = id<'FileObject'>('70000000-0000-4000-8000-000000000001');
const derivativeId = id<'PublicMediaDerivative'>('80000000-0000-4000-8000-000000000001');
const findingId = id<'FileReconciliationFinding'>('90000000-0000-4000-8000-000000000001');

const managerMfa = Object.freeze({
  actor: Object.freeze({ kind: 'manager', principalId: managerPrincipal }),
  assurance: 'manager_mfa',
}) satisfies ResolvedActorContext;
const customer = Object.freeze({
  actor: Object.freeze({ kind: 'customer', principalId: customerPrincipal }),
  assurance: 'customer_otp',
  customerId,
}) satisfies ResolvedActorContext;
const provider = Object.freeze({
  actor: Object.freeze({ kind: 'provider_webhook' }),
  assurance: 'provider_signature',
}) satisfies ResolvedActorContext;
const systemJob = Object.freeze({
  actor: Object.freeze({ kind: 'system_job' }),
  assurance: 'system_job',
}) satisfies ResolvedActorContext;
const now = at('2026-07-16T12:00:00.000Z');

const target = Object.freeze({ id: productId, type: 'PRODUCT' as const });
const intent = Object.freeze({
  classification: 'PUBLIC_MEDIA_SOURCE',
  declaredDisplayFilename: 'كرسي.png',
  declaredMediaType: 'image/png',
  declaredSize: 24,
  expectedChecksum: 'a'.repeat(64),
  expectedZone: 'QUARANTINE',
  expiresAt: at('2026-07-16T12:02:00.000Z'),
  generatedObjectKey: 'objects/catalog-media/60000000-0000-4000-8000-000000000001',
  id: intentId,
  idempotencyKey: 'catalog-media-one',
  lifecycle: 'PENDING',
  purpose: 'CATALOG_MEDIA',
  requestingPrincipalId: managerPrincipal,
  target,
}) satisfies UploadIntent;
const exactObject = Object.freeze({
  byteSize: 24,
  checksumSha256: 'a'.repeat(64),
  contentType: 'image/png',
  metadata: Object.freeze({
    'atelier-intent-id': intentId,
    'atelier-purpose': 'CATALOG_MEDIA',
  }),
  objectKey: intent.generatedObjectKey,
  storageContainer: 'atelier-test-quarantine',
  versionId: 'version-1',
  zone: 'QUARANTINE',
}) satisfies ExactStoredObject;
const cleanFile = Object.freeze({
  byteSize: exactObject.byteSize,
  checksumSha256: exactObject.checksumSha256,
  classification: 'PUBLIC_MEDIA_SOURCE',
  declaredMediaType: 'image/png',
  detectedMediaType: 'image/png',
  id: fileId,
  lifecycle: 'CLEAN',
  objectKey: exactObject.objectKey,
  purpose: 'CATALOG_MEDIA',
  scanState: 'CLEAN',
  storageContainer: exactObject.storageContainer,
  uploaderPrincipalId: managerPrincipal,
  versionId: exactObject.versionId,
  zone: 'QUARANTINE',
}) satisfies FileObject;
const accessRecord = Object.freeze({ file: cleanFile, target }) satisfies FileAccessRecord;

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function repository(overrides: Partial<FileRepository> = {}): FileRepository {
  return {
    applyVerifiedScanEvent: vi.fn(async () => ({
      kind: 'APPLIED' as const,
      recoveryFindingCreated: false,
      result: 'CLEAN' as const,
    })),
    createOrResolveUploadIntent: vi.fn(async (_tx, draft) => ({
      intent: Object.freeze({ ...draft, id: intentId, lifecycle: 'PENDING' }),
      kind: 'CREATED' as const,
    })),
    finalizeUpload: vi.fn(async () => ({
      ...cleanFile,
      lifecycle: 'SCAN_PENDING' as const,
      scanState: 'PENDING' as const,
    })),
    findAccessRecord: vi.fn(async () => accessRecord),
    findFileByUploadIntent: vi.fn(async () => undefined),
    findUploadIntent: vi.fn(async () => intent),
    listExpectedStorageObjects: vi.fn(async () => ({ items: [] })),
    publishDerivative: vi.fn(async (_tx, input) =>
      Object.freeze({
        ...input.derivative,
        deliveryPath: `/media/${derivativeId}.png`,
        id: derivativeId,
        lifecycle: 'PUBLISHED',
        sourceFileObjectId: fileId,
      }),
    ),
    recordReconciliationFinding: vi.fn(async () => ({ id: findingId, inserted: true })),
    recordUnsafeFinalization: vi.fn(async () => undefined),
    ...overrides,
  };
}

function policy(): FilePolicyPort {
  return {
    getPrivateDownloadLifetimeSeconds: vi.fn(async () => 60),
    getPublicDerivativeConstraint: vi.fn(async () => ({
      allowedDetectedMediaTypes: ['image/png'],
      capabilityLifetimeSeconds: 60,
      maximumBytes: 1_024,
      maximumHeight: 1_000,
      maximumWidth: 1_000,
      purpose: 'CATALOG_MEDIA' as const,
    })),
    getUploadConstraint: vi.fn(async () => ({
      allowedDeclaredMediaTypes: ['image/png'],
      allowedDetectedMediaTypes: ['image/png'],
      capabilityLifetimeSeconds: 120,
      maximumBytes: 1_024,
      purpose: 'CATALOG_MEDIA' as const,
    })),
  };
}

function parentAuthorization(
  result: Awaited<ReturnType<FileParentAuthorizationPort['authorize']>> = ok(true as const),
): FileParentAuthorizationPort {
  return { authorize: vi.fn(async () => result) };
}

function storage(overrides: Partial<StorageObjectPort> = {}): StorageObjectPort {
  return {
    createDownloadCapability: vi.fn(async (input) => ({
      expiresAt: input.expiresAt,
      method: 'GET' as const,
      url: 'https://signed.invalid/download',
    })),
    createUploadCapability: vi.fn(async (input) => ({
      expiresAt: input.expiresAt,
      headers: {},
      method: 'PUT' as const,
      url: 'https://signed.invalid/upload',
    })),
    inspectObject: vi.fn(async () => exactObject),
    readObjectPrefix: vi.fn(async () => png(320, 240)),
    ...overrides,
  };
}

function recorder(): FileSecurityRecorderPort {
  return { record: vi.fn(async () => undefined) };
}

describe('Files and Media application contracts', () => {
  it('uses the transaction actor, keeps customer purposes disabled, and binds upload capabilities', async () => {
    const repo = repository();
    const objectStorage = storage();
    const service = new FileUploadService(
      { now: () => now },
      policy(),
      parentAuthorization(),
      repo,
      objectStorage,
      { createObjectKey: vi.fn(() => intent.generatedObjectKey) } satisfies StorageKeyFactory,
      recorder(),
    );
    const request = {
      actorContext: managerMfa,
      declaredDisplayFilename: 'كرسي.png',
      declaredMediaType: 'image/png',
      declaredSize: 24,
      expectedChecksum: 'a'.repeat(64),
      idempotencyKey: 'catalog-media-one',
      purpose: 'CATALOG_MEDIA' as const,
      target,
    };
    await expect(service.createIntent(transaction(customer), request)).resolves.toEqual({
      error: { code: 'FORBIDDEN' },
      ok: false,
    });
    expect(repo.createOrResolveUploadIntent).not.toHaveBeenCalled();

    const created = await service.createIntent(transaction(managerMfa), request);
    expect(created).toMatchObject({
      ok: true,
      value: { capability: { method: 'PUT' }, intent: { expectedZone: 'QUARANTINE' } },
    });
    expect(objectStorage.createUploadCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        intentId,
        lifetimeSeconds: 120,
        objectKey: intent.generatedObjectKey,
        purpose: 'CATALOG_MEDIA',
        zone: 'QUARANTINE',
      }),
    );
  });

  it('keeps mismatched finalization unusable and finalizes one exact object version as scan-pending', async () => {
    const unsafe = vi.fn(async () => undefined);
    const finalize = vi.fn(
      async () => ({ ...cleanFile, lifecycle: 'SCAN_PENDING', scanState: 'PENDING' }) as FileObject,
    );
    const repo = repository({ finalizeUpload: finalize, recordUnsafeFinalization: unsafe });
    const service = new FileUploadService(
      { now: () => now },
      policy(),
      parentAuthorization(),
      repo,
      storage(),
      { createObjectKey: () => intent.generatedObjectKey },
      recorder(),
    );
    await expect(
      service.finalize(transaction(managerMfa), {
        actorContext: managerMfa,
        checksumSha256: 'b'.repeat(64),
        intentId,
        objectVersionId: 'version-1',
      }),
    ).resolves.toEqual({ error: { code: 'FILE_INTEGRITY_MISMATCH' }, ok: false });
    expect(unsafe).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();

    const result = await service.finalize(transaction(managerMfa), {
      actorContext: managerMfa,
      checksumSha256: 'a'.repeat(64),
      intentId,
      objectVersionId: 'version-1',
    });
    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: 'SCAN_PENDING', scanState: 'PENDING', versionId: 'version-1' },
    });
    expect(finalize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ object: expect.objectContaining({ versionId: 'version-1' }) }),
    );
  });

  it('accepts only verified provider events and preserves duplicate callback semantics', async () => {
    const verifiedEvent = Object.freeze({
      correlationId: id<'Correlation'>('a0000000-0000-4000-8000-000000000001'),
      eventType: 'GUARDDUTY_SCAN_RESULT',
      occurredAt: now,
      outcome: 'CLEAN',
      payloadDigest: 'c'.repeat(64),
      provider: 'guardduty',
      providerEventId: 'guardduty-event-1',
      safeMetadata: {},
      storageObject: {
        objectKey: exactObject.objectKey,
        storageContainer: exactObject.storageContainer,
        versionId: exactObject.versionId,
      },
    }) satisfies VerifiedScanEvent;
    const apply = vi.fn(async () => ({
      kind: 'DUPLICATE' as const,
      recoveryFindingCreated: false,
      result: 'DUPLICATE' as const,
    }));
    const service = new FileScanService(
      { verify: vi.fn(async () => ok(verifiedEvent)) },
      repository({ applyVerifiedScanEvent: apply }),
      recorder(),
    );
    await expect(
      service.receive(transaction(provider), { headers: new Headers(), rawBody: new Uint8Array() }),
    ).resolves.toEqual({ ok: true, value: { duplicate: true, result: 'DUPLICATE' } });
    expect(apply).toHaveBeenCalledWith(expect.anything(), verifiedEvent);

    const rejected = new FileScanService(
      { verify: vi.fn(async () => err({ code: 'FORBIDDEN' as const })) },
      repository(),
      recorder(),
    );
    await expect(
      rejected.receive(transaction(provider), {
        headers: new Headers(),
        rawBody: new Uint8Array(),
      }),
    ).resolves.toEqual({ error: { code: 'FORBIDDEN' }, ok: false });
  });

  it('issues a private capability only after clean state and parent authorization', async () => {
    const createDownloadCapability = vi.fn(async () => ({
      expiresAt: at('2026-07-16T12:01:00.000Z'),
      method: 'GET' as const,
      url: 'https://signed.invalid/download',
    }));
    const deniedService = new FileAccessService(
      () => now,
      policy(),
      parentAuthorization(err({ code: 'RESOURCE_NOT_FOUND' })),
      repository(),
      storage({ createDownloadCapability }),
      recorder(),
    );
    await expect(
      deniedService.createPrivateDownloadCapability(transaction(customer), {
        actorContext: managerMfa,
        fileObjectId: fileId,
      }),
    ).resolves.toEqual({ error: { code: 'RESOURCE_NOT_FOUND' }, ok: false });
    expect(createDownloadCapability).not.toHaveBeenCalled();

    const service = new FileAccessService(
      () => now,
      policy(),
      parentAuthorization(),
      repository(),
      storage({ createDownloadCapability }),
      recorder(),
    );
    await expect(
      service.createPrivateDownloadCapability(transaction(managerMfa), {
        actorContext: managerMfa,
        fileObjectId: fileId,
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        expiresAt: '2026-07-16T12:01:00.000Z',
        method: 'GET',
        url: 'https://signed.invalid/download',
      },
    });
    expect(createDownloadCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        lifetimeSeconds: 60,
        object: expect.objectContaining({ versionId: 'version-1', zone: 'QUARANTINE' }),
      }),
    );
  });

  it('promotes only a clean, Manager-approved, decoded optimized derivative', async () => {
    const publicObject = Object.freeze({
      ...exactObject,
      byteSize: 24,
      checksumSha256: 'd'.repeat(64),
      contentType: 'image/png',
      metadata: {},
      objectKey: 'objects/public-media/optimized-chair',
      storageContainer: 'atelier-test-public',
      versionId: 'public-version-1',
      zone: 'PUBLIC_MEDIA',
    }) satisfies ExactStoredObject;
    const publishDerivative = vi.fn(
      async (_tx, input) =>
        Object.freeze({
          ...input.derivative,
          deliveryPath: `/media/${derivativeId}.png`,
          id: derivativeId,
          lifecycle: 'PUBLISHED' as const,
          sourceFileObjectId: fileId,
        }) satisfies PublicMediaDerivative,
    );
    const service = new PublicMediaService(
      policy(),
      parentAuthorization(),
      repository({ publishDerivative }),
      storage({ inspectObject: vi.fn(async () => publicObject) }),
      recorder(),
    );
    const request = {
      actorContext: managerMfa,
      altTextAr: 'كرسي خشبي',
      byteSize: 24,
      checksumSha256: 'd'.repeat(64),
      fileObjectId: fileId,
      height: 240,
      isPrimary: true,
      objectKey: publicObject.objectKey,
      sortOrder: 0,
      storageContainer: publicObject.storageContainer,
      variantKind: 'GALLERY' as const,
      versionId: publicObject.versionId,
      width: 320,
    };
    await expect(
      service.publishOptimizedDerivative(transaction(managerMfa), request),
    ).resolves.toMatchObject({
      ok: true,
      value: { deliveryPath: expect.stringMatching(/^\/media\//u), lifecycle: 'PUBLISHED' },
    });
    expect(publishDerivative).toHaveBeenCalledOnce();

    await expect(
      service.publishOptimizedDerivative(transaction(managerMfa), { ...request, width: 321 }),
    ).resolves.toEqual({ error: { code: 'FILE_INTEGRITY_MISMATCH' }, ok: false });
  });

  it('records missing, mismatched and orphan exact object versions only as a system job', async () => {
    const expected = Object.freeze({
      byteSize: 24,
      checksumSha256: 'a'.repeat(64),
      fileObjectId: fileId,
      objectKey: exactObject.objectKey,
      storageContainer: exactObject.storageContainer,
      versionId: exactObject.versionId,
      zone: 'QUARANTINE' as const,
    });
    const second = Object.freeze({
      ...expected,
      fileObjectId: id<'FileObject'>('70000000-0000-4000-8000-000000000002'),
      objectKey: 'objects/catalog-media/second-object',
    });
    const recordFinding = vi.fn(async () => ({ id: findingId, inserted: true }));
    const repo = repository({
      listExpectedStorageObjects: vi.fn(async () => ({ items: [expected, second] })),
      recordReconciliationFinding: recordFinding,
    });
    const inventory = {
      listObjectVersions: vi.fn(async () => ({
        items: [
          { ...expected, byteSize: 25 },
          {
            byteSize: 5,
            objectKey: 'objects/catalog-media/orphan',
            storageContainer: exactObject.storageContainer,
            versionId: 'version-orphan',
            zone: 'QUARANTINE' as const,
          },
        ],
      })),
    } satisfies StorageInventoryPort;
    const service = new FileReconciliationService(() => now, repo, inventory);
    await expect(
      service.reconcileZone(transaction(managerMfa), { limit: 10, zone: 'QUARANTINE' }),
    ).resolves.toEqual({
      error: { code: 'FORBIDDEN' },
      ok: false,
    });
    await expect(
      service.reconcileZone(transaction(systemJob), { limit: 10, zone: 'QUARANTINE' }),
    ).resolves.toEqual({
      ok: true,
      value: { findings: 3, inspectedDatabase: 2, inspectedStorage: 2 },
    });
    expect(recordFinding).toHaveBeenCalledTimes(3);
    expect(recordFinding).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        findingType: 'ORPHAN_OBJECT',
        safeReasonCode: 'STORAGE_OBJECT_ORPHANED',
      }),
    );
  });
});

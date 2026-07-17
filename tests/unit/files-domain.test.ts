import { describe, expect, it } from 'vitest';

import {
  authorizeP2ManagerMediaUpload,
  decideScanTransition,
  detectImage,
  detectMediaType,
  validateFinalizedObject,
  validatePublicDerivative,
  validatePublicDerivativeConstraint,
  validateUploadConstraint,
  validateUploadDeclaration,
  type ExactStoredObject,
  type FileObject,
  type UploadConstraint,
  type UploadIntent,
} from '../../src/modules/files-and-media';
import {
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
  if (!parsed.ok) throw new Error('Invalid test instant.');
  return parsed.value;
}

const managerPrincipal = id<'Principal'>('40000000-0000-4000-8000-000000000001');
const productId = id<'Product'>('50000000-0000-4000-8000-000000000001');
const managerMfa = Object.freeze({
  actor: Object.freeze({ kind: 'manager', principalId: managerPrincipal }),
  assurance: 'manager_mfa',
}) satisfies ResolvedActorContext;
const managerPassword = Object.freeze({
  actor: Object.freeze({ kind: 'manager', principalId: managerPrincipal }),
  assurance: 'manager_password',
}) satisfies ResolvedActorContext;

const constraint = Object.freeze({
  allowedDeclaredMediaTypes: Object.freeze(['image/png', 'image/jpeg']),
  allowedDetectedMediaTypes: Object.freeze(['image/png', 'image/jpeg']),
  capabilityLifetimeSeconds: 120,
  maximumBytes: 1_024,
  purpose: 'CATALOG_MEDIA',
}) satisfies UploadConstraint;

const uploadIntent = Object.freeze({
  classification: 'PUBLIC_MEDIA_SOURCE',
  declaredDisplayFilename: 'كرسي.png',
  declaredMediaType: 'image/png',
  declaredSize: 8,
  expectedChecksum: 'a'.repeat(64),
  expectedZone: 'QUARANTINE',
  expiresAt: at('2026-07-16T12:10:00.000Z'),
  generatedObjectKey: 'objects/catalog-media/00000000-0000-4000-8000-000000000001',
  id: id<'UploadIntent'>('60000000-0000-4000-8000-000000000001'),
  idempotencyKey: 'files-domain-intent-key',
  lifecycle: 'PENDING',
  purpose: 'CATALOG_MEDIA',
  requestingPrincipalId: managerPrincipal,
  target: Object.freeze({ id: productId, type: 'PRODUCT' }),
}) satisfies UploadIntent;

const exactObject = Object.freeze({
  byteSize: 8,
  checksumSha256: 'a'.repeat(64),
  contentType: 'image/png',
  metadata: Object.freeze({
    'atelier-intent-id': uploadIntent.id,
    'atelier-purpose': uploadIntent.purpose,
  }),
  objectKey: uploadIntent.generatedObjectKey,
  storageContainer: 'atelier-test-quarantine',
  versionId: 'version-1',
  zone: 'QUARANTINE',
}) satisfies ExactStoredObject;

describe('Files and Media domain controls', () => {
  it('allows only an MFA-authenticated Manager to create P2 catalog/CMS media intents', () => {
    expect(
      authorizeP2ManagerMediaUpload(managerMfa, 'CATALOG_MEDIA', {
        id: productId,
        type: 'PRODUCT',
      }),
    ).toMatchObject({ ok: true, value: { classification: 'PUBLIC_MEDIA_SOURCE' } });
    expect(
      authorizeP2ManagerMediaUpload(managerPassword, 'CATALOG_MEDIA', {
        id: productId,
        type: 'PRODUCT',
      }),
    ).toEqual({ error: { code: 'AUTH_ASSURANCE_REQUIRED' }, ok: false });
    expect(
      authorizeP2ManagerMediaUpload(managerMfa, 'PAYMENT_PROOF', {
        id: productId,
        type: 'PRODUCT',
      }),
    ).toEqual({ error: { code: 'FORBIDDEN' }, ok: false });
  });

  it('fails closed for absent or invalid technical constraints', () => {
    expect(validateUploadConstraint({ ...constraint, maximumBytes: 0 })).toEqual({
      error: { code: 'POLICY_ACTION_NOT_ENABLED' },
      ok: false,
    });
    expect(
      validatePublicDerivativeConstraint({
        allowedDetectedMediaTypes: [],
        capabilityLifetimeSeconds: 60,
        maximumBytes: 100,
        maximumHeight: 100,
        maximumWidth: 100,
        purpose: 'CATALOG_MEDIA',
      }),
    ).toEqual({ error: { code: 'POLICY_ACTION_NOT_ENABLED' }, ok: false });
  });

  it('validates declarations without trusting filenames, extensions, or browser MIME values', () => {
    expect(
      validateUploadDeclaration(
        {
          declaredDisplayFilename: '../chair.png',
          declaredMediaType: 'image/png',
          declaredSize: 8,
        },
        constraint,
      ),
    ).toEqual({ error: { code: 'FILE_REJECTED' }, ok: false });
    expect(
      validateUploadDeclaration(
        {
          declaredDisplayFilename: 'chair.svg',
          declaredMediaType: 'image/svg+xml',
          declaredSize: 8,
        },
        constraint,
      ),
    ).toEqual({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' }, ok: false });
    expect(
      validateUploadDeclaration(
        {
          declaredDisplayFilename: 'chair.png',
          declaredMediaType: 'image/png',
          declaredSize: 2_048,
        },
        constraint,
      ),
    ).toEqual({ error: { code: 'FILE_TOO_LARGE' }, ok: false });
  });

  it('detects content signatures rather than extensions', () => {
    expect(detectMediaType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe(
      'image/png',
    );
    expect(detectMediaType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(detectMediaType(new TextEncoder().encode('RIFF1234WEBP'))).toBe('image/webp');
    expect(detectMediaType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(detectMediaType(new TextEncoder().encode('<svg>'))).toBeUndefined();
  });

  it('reads bounded raster dimensions and rejects an undecodable claimed image', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    new DataView(png.buffer).setUint32(16, 320);
    new DataView(png.buffer).setUint32(20, 240);
    expect(detectImage(png)).toEqual({ height: 240, mediaType: 'image/png', width: 320 });
    expect(detectImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBeUndefined();
  });

  it('binds finalization to exact zone, key, version metadata, byte count, checksum, and signature', () => {
    expect(
      validateFinalizedObject(
        uploadIntent,
        exactObject,
        'image/png',
        constraint,
        at('2026-07-16T12:00:00.000Z'),
      ),
    ).toEqual({ ok: true, value: { detectedMediaType: 'image/png' } });
    expect(
      validateFinalizedObject(
        uploadIntent,
        { ...exactObject, versionId: '' },
        'image/png',
        constraint,
        at('2026-07-16T12:00:00.000Z'),
      ),
    ).toEqual({ error: { code: 'FILE_INTEGRITY_MISMATCH' }, ok: false });
    expect(
      validateFinalizedObject(
        uploadIntent,
        exactObject,
        'application/pdf',
        constraint,
        at('2026-07-16T12:00:00.000Z'),
      ),
    ).toEqual({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' }, ok: false });
    expect(
      validateFinalizedObject(
        uploadIntent,
        exactObject,
        'image/png',
        constraint,
        at('2026-07-16T12:10:00.000Z'),
      ),
    ).toEqual({ error: { code: 'UPLOAD_CAPABILITY_EXPIRED' }, ok: false });
  });

  it('keeps malicious verdicts terminal and never treats unknown/failed scans as clean', () => {
    const pending = { lifecycle: 'SCAN_PENDING', scanState: 'PENDING' } as const;
    expect(
      decideScanTransition(pending, {
        occurredAt: at('2026-07-16T12:00:00.000Z'),
        outcome: 'UNKNOWN',
      }),
    ).toEqual({ lifecycle: 'SCAN_PENDING', openRecoveryFinding: true, scanState: 'UNKNOWN' });
    const malicious = decideScanTransition(pending, {
      occurredAt: at('2026-07-16T12:01:00.000Z'),
      outcome: 'MALICIOUS',
    });
    expect(malicious).toEqual({
      lifecycle: 'QUARANTINED',
      openRecoveryFinding: true,
      scanState: 'MALICIOUS',
    });
    expect(
      decideScanTransition(
        { lifecycle: malicious.lifecycle, scanState: malicious.scanState },
        { occurredAt: at('2026-07-16T12:02:00.000Z'), outcome: 'CLEAN' },
      ),
    ).toEqual({
      lifecycle: 'QUARANTINED',
      openRecoveryFinding: false,
      scanState: 'MALICIOUS',
    });
  });

  it('publishes only clean public-media sources within configured derivative limits', () => {
    const source = Object.freeze({
      byteSize: 8,
      checksumSha256: 'a'.repeat(64),
      classification: 'PUBLIC_MEDIA_SOURCE',
      declaredMediaType: 'image/png',
      detectedMediaType: 'image/png',
      id: id<'FileObject'>('70000000-0000-4000-8000-000000000001'),
      lifecycle: 'CLEAN',
      objectKey: uploadIntent.generatedObjectKey,
      purpose: 'CATALOG_MEDIA',
      scanState: 'CLEAN',
      storageContainer: 'atelier-test-quarantine',
      uploaderPrincipalId: managerPrincipal,
      versionId: 'version-1',
      zone: 'QUARANTINE',
    }) satisfies FileObject;
    const derivative = {
      byteSize: 80,
      checksumSha256: 'b'.repeat(64),
      detectedMediaType: 'image/webp',
      height: 100,
      objectKey: 'objects/public/optimized.webp',
      storageContainer: 'atelier-test-public',
      variantKind: 'THUMBNAIL',
      versionId: 'public-version-1',
      width: 100,
    } as const;
    const publicConstraint = {
      allowedDetectedMediaTypes: ['image/webp'],
      capabilityLifetimeSeconds: 60,
      maximumBytes: 100,
      maximumHeight: 200,
      maximumWidth: 200,
      purpose: 'CATALOG_MEDIA',
    } as const;
    expect(validatePublicDerivative(source, derivative, publicConstraint)).toEqual({
      ok: true,
      value: true,
    });
    expect(
      validatePublicDerivative(
        { ...source, classification: 'SENSITIVE_PAYMENT', purpose: 'PAYMENT_PROOF' },
        derivative,
        publicConstraint,
      ),
    ).toEqual({ error: { code: 'FORBIDDEN' }, ok: false });
    expect(
      validatePublicDerivative(source, { ...derivative, byteSize: 101 }, publicConstraint),
    ).toEqual({ error: { code: 'FILE_TOO_LARGE' }, ok: false });
  });
});

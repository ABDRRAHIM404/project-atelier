import {
  err,
  ok,
  type Identifier,
  type ResolvedActorContext,
  type Result,
  type UtcInstant,
} from '../../../shared/kernel';

export const filePurposes = [
  'REQUEST_REFERENCE',
  'MESSAGE_ATTACHMENT',
  'PAYMENT_PROOF',
  'HANDOFF_PROOF',
  'CATALOG_MEDIA',
  'CMS_MEDIA',
] as const;

export const fileClassifications = [
  'PUBLIC_MEDIA_SOURCE',
  'PRIVATE_CUSTOMER',
  'SENSITIVE_PAYMENT',
  'RESTRICTED_OPERATIONS',
] as const;
export const fileLogicalZones = [
  'QUARANTINE',
  'PRIVATE_CUSTOMER',
  'SENSITIVE_PAYMENT',
  'RESTRICTED_OPERATIONS',
  'PUBLIC_MEDIA',
] as const;
export const fileLifecycleStates = [
  'PENDING_UPLOAD',
  'UPLOADED',
  'SCAN_PENDING',
  'CLEAN',
  'QUARANTINED',
  'REJECTED',
] as const;
export const scanOutcomes = ['CLEAN', 'MALICIOUS', 'FAILED', 'UNKNOWN', 'UNSUPPORTED'] as const;
export const scanStates = ['PENDING', 'CLEAN', 'MALICIOUS', 'FAILED', 'UNKNOWN'] as const;

export type FilePurpose = (typeof filePurposes)[number];
export type FileClassification = (typeof fileClassifications)[number];
export type FileLogicalZone = (typeof fileLogicalZones)[number];
export type FileLifecycle = (typeof fileLifecycleStates)[number];
export type ScanOutcome = (typeof scanOutcomes)[number];
export type ScanState = (typeof scanStates)[number];

export type UploadIntentId = Identifier<'UploadIntent'>;
export type FileObjectId = Identifier<'FileObject'>;
export type AttachmentId = Identifier<'Attachment'>;
export type PublicMediaDerivativeId = Identifier<'PublicMediaDerivative'>;
export type ReconciliationFindingId = Identifier<'FileReconciliationFinding'>;

export type FileTarget =
  | Readonly<{ id: Identifier<'Product'>; type: 'PRODUCT' }>
  | Readonly<{ id: Identifier<'Collection'>; type: 'COLLECTION' }>
  | Readonly<{ id: Identifier<'CmsContent'>; type: 'CMS_CONTENT' }>;

export type FileFailureCode =
  | 'AUTH_ASSURANCE_REQUIRED'
  | 'FILE_INTEGRITY_MISMATCH'
  | 'FILE_QUARANTINED'
  | 'FILE_REJECTED'
  | 'FILE_SCAN_PENDING'
  | 'FILE_TOO_LARGE'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVALID_STATE_TRANSITION'
  | 'POLICY_ACTION_NOT_ENABLED'
  | 'RESOURCE_NOT_FOUND'
  | 'STORAGE_SERVICE_UNAVAILABLE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UPLOAD_CAPABILITY_EXPIRED';

export type FileFailure = Readonly<{
  code: FileFailureCode;
}>;

export type UploadConstraint = Readonly<{
  allowedDeclaredMediaTypes: readonly string[];
  allowedDetectedMediaTypes: readonly string[];
  capabilityLifetimeSeconds: number;
  maximumBytes: number;
  purpose: 'CATALOG_MEDIA' | 'CMS_MEDIA';
}>;

export type PublicDerivativeConstraint = Readonly<{
  allowedDetectedMediaTypes: readonly string[];
  capabilityLifetimeSeconds: number;
  maximumBytes: number;
  maximumHeight: number;
  maximumWidth: number;
  purpose: 'CATALOG_MEDIA' | 'CMS_MEDIA';
}>;

export type UploadIntent = Readonly<{
  classification: 'PUBLIC_MEDIA_SOURCE';
  declaredDisplayFilename: string;
  declaredMediaType: string;
  declaredSize: number;
  expectedChecksum?: string;
  expectedZone: 'QUARANTINE';
  expiresAt: UtcInstant;
  generatedObjectKey: string;
  id: UploadIntentId;
  idempotencyKey: string;
  lifecycle: 'CANCELLED' | 'EXPIRED' | 'FINALIZED' | 'PENDING';
  purpose: 'CATALOG_MEDIA' | 'CMS_MEDIA';
  requestingPrincipalId: Identifier<'Principal'>;
  target: FileTarget;
}>;

export type ExactStoredObject = Readonly<{
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  metadata: Readonly<Record<string, string>>;
  objectKey: string;
  storageContainer: string;
  versionId: string;
  zone: FileLogicalZone;
}>;

export type FileObject = Readonly<{
  byteSize: number;
  checksumSha256: string;
  classification: FileClassification;
  declaredMediaType: string;
  detectedMediaType: string;
  id: FileObjectId;
  lifecycle: FileLifecycle;
  objectKey: string;
  purpose: FilePurpose;
  scanState: ScanState;
  storageContainer: string;
  uploaderPrincipalId: Identifier<'Principal'>;
  versionId: string;
  zone: FileLogicalZone;
}>;

export type VerifiedScanEvent = Readonly<{
  correlationId: Identifier<'Correlation'>;
  eventType: string;
  occurredAt: UtcInstant;
  outcome: ScanOutcome;
  payloadDigest: string;
  provider: string;
  providerEventId: string;
  safeMetadata: Readonly<Record<string, string>>;
  safeReasonCode?: string;
  storageObject: Readonly<{
    objectKey: string;
    storageContainer: string;
    versionId: string;
  }>;
}>;

export type ScanTransition = Readonly<{
  lifecycle: 'CLEAN' | 'QUARANTINED' | 'SCAN_PENDING';
  openRecoveryFinding: boolean;
  scanState: Exclude<ScanState, 'PENDING'>;
}>;

export type PublicMediaDerivative = Readonly<{
  byteSize: number;
  checksumSha256: string;
  detectedMediaType: string;
  height: number;
  id: PublicMediaDerivativeId;
  lifecycle: 'PUBLISHED' | 'READY' | 'RETIRED';
  deliveryPath: string;
  objectKey: string;
  sourceFileObjectId: FileObjectId;
  storageContainer: string;
  versionId: string;
  variantKind: 'GALLERY' | 'HERO' | 'THUMBNAIL';
  width: number;
}>;

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;
const UNSAFE_DISPLAY_FILENAME = /[\u0000-\u001f\u007f/\\]/u;

function configuredPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateUploadConstraint(
  constraint: UploadConstraint,
): Result<UploadConstraint, FileFailure> {
  if (
    !configuredPositiveInteger(constraint.maximumBytes) ||
    !configuredPositiveInteger(constraint.capabilityLifetimeSeconds) ||
    constraint.allowedDeclaredMediaTypes.length === 0 ||
    constraint.allowedDetectedMediaTypes.length === 0 ||
    [...constraint.allowedDeclaredMediaTypes, ...constraint.allowedDetectedMediaTypes].some(
      (mediaType) => !MEDIA_TYPE.test(mediaType),
    )
  ) {
    return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
  }
  return ok(constraint);
}

export function validatePublicDerivativeConstraint(
  constraint: PublicDerivativeConstraint,
): Result<PublicDerivativeConstraint, FileFailure> {
  if (
    !configuredPositiveInteger(constraint.maximumBytes) ||
    !configuredPositiveInteger(constraint.maximumWidth) ||
    !configuredPositiveInteger(constraint.maximumHeight) ||
    !configuredPositiveInteger(constraint.capabilityLifetimeSeconds) ||
    constraint.allowedDetectedMediaTypes.length === 0 ||
    constraint.allowedDetectedMediaTypes.some((mediaType) => !MEDIA_TYPE.test(mediaType))
  ) {
    return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
  }
  return ok(constraint);
}

export function authorizeP2ManagerMediaUpload(
  context: ResolvedActorContext,
  purpose: FilePurpose,
  target: FileTarget,
): Result<
  Readonly<{
    classification: 'PUBLIC_MEDIA_SOURCE';
    purpose: 'CATALOG_MEDIA' | 'CMS_MEDIA';
  }>,
  FileFailure
> {
  if (context.actor.kind !== 'manager') return err({ code: 'FORBIDDEN' });
  if (context.assurance !== 'manager_mfa') return err({ code: 'AUTH_ASSURANCE_REQUIRED' });

  if (purpose === 'CATALOG_MEDIA' && (target.type === 'PRODUCT' || target.type === 'COLLECTION')) {
    return ok(Object.freeze({ classification: 'PUBLIC_MEDIA_SOURCE', purpose }));
  }
  if (purpose === 'CMS_MEDIA' && target.type === 'CMS_CONTENT') {
    return ok(Object.freeze({ classification: 'PUBLIC_MEDIA_SOURCE', purpose }));
  }
  return err({ code: 'FORBIDDEN' });
}

export function validateUploadDeclaration(
  input: Readonly<{
    declaredDisplayFilename: string;
    declaredMediaType: string;
    declaredSize: number;
    expectedChecksum?: string;
  }>,
  constraint: UploadConstraint,
): Result<Readonly<{ displayFilename: string; mediaType: string }>, FileFailure> {
  if (
    input.declaredDisplayFilename.trim().length === 0 ||
    input.declaredDisplayFilename === '.' ||
    input.declaredDisplayFilename === '..' ||
    UNSAFE_DISPLAY_FILENAME.test(input.declaredDisplayFilename)
  ) {
    return err({ code: 'FILE_REJECTED' });
  }
  if (!MEDIA_TYPE.test(input.declaredMediaType)) {
    return err({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  if (!constraint.allowedDeclaredMediaTypes.includes(input.declaredMediaType)) {
    return err({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  if (!Number.isSafeInteger(input.declaredSize) || input.declaredSize <= 0) {
    return err({ code: 'FILE_INTEGRITY_MISMATCH' });
  }
  if (input.declaredSize > constraint.maximumBytes) return err({ code: 'FILE_TOO_LARGE' });
  if (input.expectedChecksum !== undefined && !SHA256_HEX.test(input.expectedChecksum)) {
    return err({ code: 'FILE_INTEGRITY_MISMATCH' });
  }
  return ok(
    Object.freeze({
      displayFilename: input.declaredDisplayFilename.normalize('NFC'),
      mediaType: input.declaredMediaType,
    }),
  );
}

export function detectMediaType(prefix: Uint8Array): string | undefined {
  if (
    prefix.length >= 8 &&
    prefix[0] === 0x89 &&
    prefix[1] === 0x50 &&
    prefix[2] === 0x4e &&
    prefix[3] === 0x47 &&
    prefix[4] === 0x0d &&
    prefix[5] === 0x0a &&
    prefix[6] === 0x1a &&
    prefix[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    prefix.length >= 12 &&
    String.fromCharCode(...prefix.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...prefix.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (prefix.length >= 5 && String.fromCharCode(...prefix.slice(0, 5)) === '%PDF-') {
    return 'application/pdf';
  }
  return undefined;
}

export type DetectedImage = Readonly<{
  height: number;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
}>;

function unsigned24LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

/** Reads dimensions from bounded, non-executing raster headers. */
export function detectImage(prefix: Uint8Array): DetectedImage | undefined {
  const mediaType = detectMediaType(prefix);
  if (mediaType === 'image/png' && prefix.length >= 24) {
    const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width > 0 && height > 0 ? Object.freeze({ height, mediaType, width }) : undefined;
  }
  if (mediaType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < prefix.length) {
      if (prefix[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = prefix[offset + 1];
      offset += 2;
      if (marker === undefined || marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
      if (marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > prefix.length) return undefined;
      const segmentLength = ((prefix[offset] ?? 0) << 8) | (prefix[offset + 1] ?? 0);
      if (segmentLength < 2 || offset + segmentLength > prefix.length) return undefined;
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame && segmentLength >= 7) {
        const height = ((prefix[offset + 3] ?? 0) << 8) | (prefix[offset + 4] ?? 0);
        const width = ((prefix[offset + 5] ?? 0) << 8) | (prefix[offset + 6] ?? 0);
        return width > 0 && height > 0 ? Object.freeze({ height, mediaType, width }) : undefined;
      }
      offset += segmentLength;
    }
    return undefined;
  }
  if (mediaType === 'image/webp' && prefix.length >= 30) {
    const chunk = String.fromCharCode(...prefix.slice(12, 16));
    if (chunk === 'VP8X') {
      return Object.freeze({
        height: unsigned24LittleEndian(prefix, 27) + 1,
        mediaType,
        width: unsigned24LittleEndian(prefix, 24) + 1,
      });
    }
    if (chunk === 'VP8 ') {
      const width = (((prefix[27] ?? 0) << 8) | (prefix[26] ?? 0)) & 0x3fff;
      const height = (((prefix[29] ?? 0) << 8) | (prefix[28] ?? 0)) & 0x3fff;
      return width > 0 && height > 0 ? Object.freeze({ height, mediaType, width }) : undefined;
    }
    if (chunk === 'VP8L' && prefix.length >= 25 && prefix[20] === 0x2f) {
      const bits =
        (prefix[21] ?? 0) |
        ((prefix[22] ?? 0) << 8) |
        ((prefix[23] ?? 0) << 16) |
        ((prefix[24] ?? 0) << 24);
      return Object.freeze({
        height: ((bits >>> 14) & 0x3fff) + 1,
        mediaType,
        width: (bits & 0x3fff) + 1,
      });
    }
  }
  return undefined;
}

export function validatePublicMediaMetadata(
  input: Readonly<{
    altTextAr: string;
    altTextEn?: string;
    sortOrder: number;
  }>,
): Result<true, FileFailure> {
  if (
    input.altTextAr.trim().length === 0 ||
    input.altTextAr.trim().length > 300 ||
    (input.altTextEn !== undefined &&
      (input.altTextEn.trim().length === 0 || input.altTextEn.trim().length > 300)) ||
    !Number.isSafeInteger(input.sortOrder) ||
    input.sortOrder < 0
  ) {
    return err({ code: 'FILE_REJECTED' });
  }
  return ok(true);
}

export function validateFinalizedObject(
  intent: UploadIntent,
  object: ExactStoredObject,
  detectedMediaType: string | undefined,
  constraint: UploadConstraint,
  now: UtcInstant,
): Result<Readonly<{ detectedMediaType: string }>, FileFailure> {
  if (intent.lifecycle === 'FINALIZED') return err({ code: 'INVALID_STATE_TRANSITION' });
  if (intent.lifecycle !== 'PENDING' || intent.expiresAt <= now) {
    return err({ code: 'UPLOAD_CAPABILITY_EXPIRED' });
  }
  if (
    object.zone !== intent.expectedZone ||
    object.objectKey !== intent.generatedObjectKey ||
    object.byteSize !== intent.declaredSize ||
    object.contentType !== intent.declaredMediaType ||
    object.metadata['atelier-intent-id'] !== intent.id ||
    object.metadata['atelier-purpose'] !== intent.purpose ||
    object.storageContainer.trim().length === 0 ||
    object.versionId.trim().length === 0 ||
    !SHA256_HEX.test(object.checksumSha256) ||
    (intent.expectedChecksum !== undefined && object.checksumSha256 !== intent.expectedChecksum)
  ) {
    return err({ code: 'FILE_INTEGRITY_MISMATCH' });
  }
  if (object.byteSize > constraint.maximumBytes) return err({ code: 'FILE_TOO_LARGE' });
  if (!detectedMediaType || !constraint.allowedDetectedMediaTypes.includes(detectedMediaType)) {
    return err({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  return ok(Object.freeze({ detectedMediaType }));
}

export function decideScanTransition(
  current: Readonly<{
    latestDecisiveOccurredAt?: UtcInstant;
    lifecycle: FileLifecycle;
    scanState: ScanState;
  }>,
  event: Pick<VerifiedScanEvent, 'occurredAt' | 'outcome'>,
): ScanTransition {
  if (current.scanState === 'MALICIOUS' || current.lifecycle === 'REJECTED') {
    return Object.freeze({
      lifecycle: 'QUARANTINED',
      openRecoveryFinding: false,
      scanState: 'MALICIOUS',
    });
  }
  if (event.outcome === 'MALICIOUS') {
    return Object.freeze({
      lifecycle: 'QUARANTINED',
      openRecoveryFinding: true,
      scanState: 'MALICIOUS',
    });
  }
  const eventIsOlder =
    current.latestDecisiveOccurredAt !== undefined &&
    event.occurredAt < current.latestDecisiveOccurredAt;
  if (event.outcome === 'CLEAN') {
    if (eventIsOlder && current.scanState !== 'PENDING') {
      return Object.freeze({
        lifecycle: current.lifecycle === 'CLEAN' ? 'CLEAN' : 'QUARANTINED',
        openRecoveryFinding: false,
        scanState: current.scanState,
      });
    }
    return Object.freeze({ lifecycle: 'CLEAN', openRecoveryFinding: false, scanState: 'CLEAN' });
  }
  if (current.scanState === 'CLEAN') {
    return Object.freeze({ lifecycle: 'CLEAN', openRecoveryFinding: true, scanState: 'CLEAN' });
  }
  return Object.freeze({
    lifecycle: 'SCAN_PENDING',
    openRecoveryFinding: true,
    scanState: event.outcome === 'UNSUPPORTED' ? 'UNKNOWN' : event.outcome,
  });
}

export function validatePublicDerivative(
  source: FileObject,
  derivative: Omit<
    PublicMediaDerivative,
    'deliveryPath' | 'id' | 'lifecycle' | 'sourceFileObjectId'
  >,
  constraint: PublicDerivativeConstraint,
): Result<true, FileFailure> {
  if (source.lifecycle !== 'CLEAN' || source.scanState !== 'CLEAN') {
    return err({
      code: source.lifecycle === 'QUARANTINED' ? 'FILE_QUARANTINED' : 'FILE_SCAN_PENDING',
    });
  }
  if (
    source.classification !== 'PUBLIC_MEDIA_SOURCE' ||
    (source.purpose !== 'CATALOG_MEDIA' && source.purpose !== 'CMS_MEDIA') ||
    source.purpose !== constraint.purpose
  ) {
    return err({ code: 'FORBIDDEN' });
  }
  if (!constraint.allowedDetectedMediaTypes.includes(derivative.detectedMediaType)) {
    return err({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  if (
    derivative.byteSize <= 0 ||
    derivative.byteSize > constraint.maximumBytes ||
    derivative.width <= 0 ||
    derivative.width > constraint.maximumWidth ||
    derivative.height <= 0 ||
    derivative.height > constraint.maximumHeight
  ) {
    return err({ code: 'FILE_TOO_LARGE' });
  }
  if (
    derivative.storageContainer.trim().length === 0 ||
    derivative.objectKey.trim().length === 0 ||
    derivative.versionId.trim().length === 0 ||
    !SHA256_HEX.test(derivative.checksumSha256)
  ) {
    return err({ code: 'FILE_INTEGRITY_MISMATCH' });
  }
  return ok(true);
}

import type { ActorScopedTransaction } from '../../../platform/database';
import type { Identifier, UtcInstant } from '../../../shared/kernel';
import type {
  ExactStoredObject,
  FileFailureCode,
  FileLogicalZone,
  FileObject,
  FileObjectId,
  FileTarget,
  PublicMediaDerivative,
  UploadIntent,
  VerifiedScanEvent,
} from '../domain/file-lifecycle';

export type UploadIntentDraft = Omit<UploadIntent, 'id' | 'lifecycle'>;

export type UploadIntentRegistration =
  Readonly<{ intent: UploadIntent; kind: 'CREATED' | 'EXISTING' }> | Readonly<{ kind: 'CONFLICT' }>;

export type ScanEventRegistration = Readonly<{
  kind: 'APPLIED' | 'DUPLICATE';
  recoveryFindingCreated: boolean;
  result: 'CLEAN' | 'DUPLICATE' | 'IGNORED_TERMINAL' | 'NOT_FOUND' | 'PENDING' | 'QUARANTINED';
}>;

export type FileAccessRecord = Readonly<{
  file: FileObject;
  target: FileTarget;
}>;

export type ExpectedStorageObject = Readonly<{
  byteSize: number;
  checksumSha256: string;
  fileObjectId: FileObjectId;
  objectKey: string;
  storageContainer: string;
  versionId: string;
  zone: FileLogicalZone;
}>;

export type ReconciliationFindingDraft = Readonly<{
  expected?: Partial<ExpectedStorageObject>;
  fileObjectId?: FileObjectId;
  findingType: 'METADATA_MISMATCH' | 'MISSING_OBJECT' | 'ORPHAN_OBJECT';
  observed?: Readonly<{
    byteSize: number;
    checksumSha256?: string;
    objectKey: string;
    storageContainer: string;
    versionId: string;
    zone: FileLogicalZone;
  }>;
  observedAt: UtcInstant;
  safeReasonCode: string;
}>;

export interface FileRepository {
  applyVerifiedScanEvent(
    transaction: ActorScopedTransaction,
    event: VerifiedScanEvent,
  ): Promise<ScanEventRegistration>;
  createOrResolveUploadIntent(
    transaction: ActorScopedTransaction,
    draft: UploadIntentDraft,
  ): Promise<UploadIntentRegistration>;
  finalizeUpload(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      detectedMediaType: string;
      intent: UploadIntent;
      object: ExactStoredObject;
    }>,
  ): Promise<FileObject>;
  findAccessRecord(
    transaction: ActorScopedTransaction,
    fileObjectId: FileObjectId,
  ): Promise<FileAccessRecord | undefined>;
  findFileByUploadIntent(
    transaction: ActorScopedTransaction,
    uploadIntentId: UploadIntent['id'],
  ): Promise<FileObject | undefined>;
  findUploadIntent(
    transaction: ActorScopedTransaction,
    uploadIntentId: UploadIntent['id'],
  ): Promise<UploadIntent | undefined>;
  listExpectedStorageObjects(
    transaction: ActorScopedTransaction,
    input: Readonly<{ afterFileObjectId?: FileObjectId; limit: number; zone: FileLogicalZone }>,
  ): Promise<
    Readonly<{ items: readonly ExpectedStorageObject[]; nextFileObjectId?: FileObjectId }>
  >;
  publishDerivative(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      altTextAr: string;
      altTextEn?: string;
      derivative: Omit<
        PublicMediaDerivative,
        'deliveryPath' | 'id' | 'lifecycle' | 'sourceFileObjectId'
      >;
      isPrimary: boolean;
      sortOrder: number;
      source: FileAccessRecord;
    }>,
  ): Promise<PublicMediaDerivative>;
  recordReconciliationFinding(
    transaction: ActorScopedTransaction,
    finding: ReconciliationFindingDraft,
  ): Promise<Readonly<{ id: Identifier<'FileReconciliationFinding'>; inserted: boolean }>>;
  recordUnsafeFinalization(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      intent: UploadIntent;
      object?: ExactStoredObject;
      observedAt: UtcInstant;
      reason: FileFailureCode;
    }>,
  ): Promise<void>;
}

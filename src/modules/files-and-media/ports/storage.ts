import type { UtcInstant } from '../../../shared/kernel';
import type {
  ExactStoredObject,
  FileLogicalZone,
  FilePurpose,
  UploadIntentId,
} from '../domain/file-lifecycle';

export type UploadCapability = Readonly<{
  expiresAt: UtcInstant;
  headers: Readonly<Record<string, string>>;
  method: 'PUT';
  url: string;
}>;

export type DownloadCapability = Readonly<{
  expiresAt: UtcInstant;
  method: 'GET';
  url: string;
}>;

export interface StorageObjectPort {
  createDownloadCapability(
    input: Readonly<{
      expiresAt: UtcInstant;
      lifetimeSeconds: number;
      object: Pick<ExactStoredObject, 'objectKey' | 'storageContainer' | 'versionId' | 'zone'>;
    }>,
  ): Promise<DownloadCapability>;
  createUploadCapability(
    input: Readonly<{
      declaredMediaType: string;
      declaredSize: number;
      expectedChecksum?: string;
      expiresAt: UtcInstant;
      intentId: UploadIntentId;
      lifetimeSeconds: number;
      objectKey: string;
      purpose: FilePurpose;
      zone: 'QUARANTINE';
    }>,
  ): Promise<UploadCapability>;
  inspectObject(
    input: Readonly<{
      objectKey: string;
      versionId: string;
      zone: FileLogicalZone;
    }>,
  ): Promise<ExactStoredObject>;
  readObjectPrefix(
    object: Pick<ExactStoredObject, 'objectKey' | 'storageContainer' | 'versionId' | 'zone'>,
    maximumBytes: number,
  ): Promise<Uint8Array>;
}

export type StorageInventoryObject = Readonly<{
  byteSize: number;
  checksumSha256?: string;
  objectKey: string;
  storageContainer: string;
  versionId: string;
  zone: FileLogicalZone;
}>;

export interface StorageInventoryPort {
  listObjectVersions(
    input: Readonly<{
      cursor?: string;
      limit: number;
      zone: FileLogicalZone;
    }>,
  ): Promise<Readonly<{ items: readonly StorageInventoryObject[]; nextCursor?: string }>>;
}

export interface StorageKeyFactory {
  createObjectKey(input: Readonly<{ purpose: FilePurpose }>): string;
}

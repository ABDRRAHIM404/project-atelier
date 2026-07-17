import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { UtcInstant } from '../../../../shared/kernel';
import type { ExactStoredObject, FileLogicalZone, FilePurpose } from '../../domain/file-lifecycle';
import type {
  DownloadCapability,
  StorageInventoryObject,
  StorageInventoryPort,
  StorageKeyFactory,
  StorageObjectPort,
  UploadCapability,
} from '../../ports/storage';

export type S3ZoneConfiguration = Readonly<Record<FileLogicalZone, string>>;
export type S3Presigner = typeof getSignedUrl;

function assertConfiguration(configuration: S3ZoneConfiguration): void {
  for (const bucket of Object.values(configuration)) {
    if (bucket.trim().length === 0) throw new Error('Every storage zone needs an explicit bucket.');
  }
  if (
    configuration.PUBLIC_MEDIA === configuration.QUARANTINE ||
    configuration.PUBLIC_MEDIA === configuration.PRIVATE_CUSTOMER ||
    configuration.PUBLIC_MEDIA === configuration.SENSITIVE_PAYMENT ||
    configuration.PUBLIC_MEDIA === configuration.RESTRICTED_OPERATIONS
  ) {
    throw new Error('The public-media origin must be isolated from protected storage zones.');
  }
}

function checksumHexFromBase64(value: string | undefined): string {
  if (!value) throw new Error('S3 object metadata did not include the required SHA-256 checksum.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32) throw new Error('S3 returned an invalid SHA-256 checksum.');
  return bytes.toString('hex');
}

function checksumBase64FromHex(value: string): string {
  const bytes = Buffer.from(value, 'hex');
  if (bytes.length !== 32) throw new Error('Expected checksum must be SHA-256.');
  return bytes.toString('base64');
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be configured.`);
}

function inventoryCursor(value: Readonly<{ keyMarker: string; versionIdMarker: string }>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseInventoryCursor(
  value: string | undefined,
): Readonly<{ keyMarker: string; versionIdMarker: string }> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('keyMarker' in parsed) ||
      !('versionIdMarker' in parsed) ||
      typeof parsed.keyMarker !== 'string' ||
      typeof parsed.versionIdMarker !== 'string'
    ) {
      throw new Error('Invalid cursor');
    }
    return Object.freeze({
      keyMarker: parsed.keyMarker,
      versionIdMarker: parsed.versionIdMarker,
    });
  } catch {
    throw new Error('Invalid storage inventory cursor.');
  }
}

export class S3StorageAdapter implements StorageObjectPort, StorageInventoryPort {
  constructor(
    private readonly client: S3Client,
    private readonly zones: S3ZoneConfiguration,
    private readonly presign: S3Presigner = getSignedUrl,
  ) {
    assertConfiguration(zones);
  }

  async createUploadCapability(
    input: Readonly<{
      declaredMediaType: string;
      declaredSize: number;
      expectedChecksum?: string;
      expiresAt: UtcInstant;
      intentId: string;
      lifetimeSeconds: number;
      objectKey: string;
      purpose: FilePurpose;
      zone: 'QUARANTINE';
    }>,
  ): Promise<UploadCapability> {
    requirePositiveInteger(input.declaredSize, 'Declared byte size');
    requirePositiveInteger(input.lifetimeSeconds, 'Upload capability lifetime');
    const checksum = input.expectedChecksum
      ? checksumBase64FromHex(input.expectedChecksum)
      : undefined;
    const metadata = {
      'atelier-intent-id': input.intentId,
      'atelier-purpose': input.purpose,
    };
    const command = new PutObjectCommand({
      Bucket: this.zones[input.zone],
      ...(checksum ? { ChecksumSHA256: checksum } : { ChecksumAlgorithm: 'SHA256' }),
      ContentLength: input.declaredSize,
      ContentType: input.declaredMediaType,
      Key: input.objectKey,
      Metadata: metadata,
    });
    const url = await this.presign(this.client, command, {
      expiresIn: input.lifetimeSeconds,
    });
    return Object.freeze({
      expiresAt: input.expiresAt,
      headers: Object.freeze({
        'content-length': String(input.declaredSize),
        'content-type': input.declaredMediaType,
        ...(checksum ? { 'x-amz-checksum-sha256': checksum } : {}),
        ...(!checksum ? { 'x-amz-checksum-algorithm': 'SHA256' } : {}),
        'x-amz-meta-atelier-intent-id': input.intentId,
        'x-amz-meta-atelier-purpose': input.purpose,
      }),
      method: 'PUT',
      url,
    });
  }

  async createDownloadCapability(
    input: Readonly<{
      expiresAt: UtcInstant;
      lifetimeSeconds: number;
      object: Pick<ExactStoredObject, 'objectKey' | 'storageContainer' | 'versionId' | 'zone'>;
    }>,
  ): Promise<DownloadCapability> {
    requirePositiveInteger(input.lifetimeSeconds, 'Download capability lifetime');
    if (this.zones[input.object.zone] !== input.object.storageContainer) {
      throw new Error('The object container does not match its server-owned zone.');
    }
    const command = new GetObjectCommand({
      Bucket: input.object.storageContainer,
      Key: input.object.objectKey,
      VersionId: input.object.versionId,
    });
    const url = await this.presign(this.client, command, {
      expiresIn: input.lifetimeSeconds,
    });
    return Object.freeze({ expiresAt: input.expiresAt, method: 'GET', url });
  }

  async inspectObject(
    input: Readonly<{
      objectKey: string;
      versionId: string;
      zone: FileLogicalZone;
    }>,
  ): Promise<ExactStoredObject> {
    const storageContainer = this.zones[input.zone];
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: storageContainer,
        ChecksumMode: 'ENABLED',
        Key: input.objectKey,
        VersionId: input.versionId,
      }),
    );
    if (
      response.ContentLength === undefined ||
      !response.ContentType ||
      !response.VersionId ||
      response.VersionId !== input.versionId
    ) {
      throw new Error('S3 returned incomplete or mismatched object metadata.');
    }
    return Object.freeze({
      byteSize: response.ContentLength,
      checksumSha256: checksumHexFromBase64(response.ChecksumSHA256),
      contentType: response.ContentType,
      metadata: Object.freeze({ ...(response.Metadata ?? {}) }),
      objectKey: input.objectKey,
      storageContainer,
      versionId: response.VersionId,
      zone: input.zone,
    });
  }

  async readObjectPrefix(
    object: Pick<ExactStoredObject, 'objectKey' | 'storageContainer' | 'versionId' | 'zone'>,
    maximumBytes: number,
  ): Promise<Uint8Array> {
    requirePositiveInteger(maximumBytes, 'Prefix byte limit');
    if (this.zones[object.zone] !== object.storageContainer) {
      throw new Error('The object container does not match its server-owned zone.');
    }
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: object.storageContainer,
        Key: object.objectKey,
        Range: `bytes=0-${maximumBytes - 1}`,
        VersionId: object.versionId,
      }),
    );
    if (!response.Body) throw new Error('S3 object body is unavailable.');
    const bytes = await response.Body.transformToByteArray();
    return bytes.slice(0, maximumBytes);
  }

  async listObjectVersions(
    input: Readonly<{
      cursor?: string;
      limit: number;
      zone: FileLogicalZone;
    }>,
  ): Promise<Readonly<{ items: readonly StorageInventoryObject[]; nextCursor?: string }>> {
    requirePositiveInteger(input.limit, 'Inventory page size');
    const cursor = parseInventoryCursor(input.cursor);
    const storageContainer = this.zones[input.zone];
    const response = await this.client.send(
      new ListObjectVersionsCommand({
        Bucket: storageContainer,
        ...(cursor ? { KeyMarker: cursor.keyMarker, VersionIdMarker: cursor.versionIdMarker } : {}),
        MaxKeys: input.limit,
      }),
    );
    const items = await Promise.all(
      (response.Versions ?? []).map(async (version): Promise<StorageInventoryObject> => {
        if (!version.Key || !version.VersionId || version.Size === undefined) {
          throw new Error('S3 inventory contained an incomplete object version.');
        }
        const metadata = await this.inspectObject({
          objectKey: version.Key,
          versionId: version.VersionId,
          zone: input.zone,
        });
        return Object.freeze({
          byteSize: metadata.byteSize,
          checksumSha256: metadata.checksumSha256,
          objectKey: version.Key,
          storageContainer,
          versionId: version.VersionId,
          zone: input.zone,
        });
      }),
    );
    const nextCursor =
      response.IsTruncated && response.NextKeyMarker && response.NextVersionIdMarker
        ? inventoryCursor({
            keyMarker: response.NextKeyMarker,
            versionIdMarker: response.NextVersionIdMarker,
          })
        : undefined;
    return Object.freeze({
      items: Object.freeze(items),
      ...(nextCursor ? { nextCursor } : {}),
    });
  }
}

export class RandomS3StorageKeyFactory implements StorageKeyFactory {
  createObjectKey(input: Readonly<{ purpose: FilePurpose }>): string {
    return `objects/${input.purpose.toLowerCase().replaceAll('_', '-')}/${randomUUID()}`;
  }
}

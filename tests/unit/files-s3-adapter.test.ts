import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import {
  S3StorageAdapter,
  type S3Presigner,
  type S3ZoneConfiguration,
} from '../../src/modules/files-and-media/infrastructure/s3/s3-storage-adapter';
import { parseIdentifier, parseUtcInstant } from '../../src/shared/kernel';

const zones = Object.freeze({
  PRIVATE_CUSTOMER: 'atelier-test-private',
  PUBLIC_MEDIA: 'atelier-test-public',
  QUARANTINE: 'atelier-test-quarantine',
  RESTRICTED_OPERATIONS: 'atelier-test-restricted',
  SENSITIVE_PAYMENT: 'atelier-test-sensitive',
}) satisfies S3ZoneConfiguration;

function instant(value: string) {
  const parsed = parseUtcInstant(value);
  if (!parsed.ok) throw new Error('Invalid test instant.');
  return parsed.value;
}

function intentId() {
  const parsed = parseIdentifier<'UploadIntent'>('60000000-0000-4000-8000-000000000001');
  if (!parsed.ok) throw new Error('Invalid test intent ID.');
  return parsed.value;
}

describe('S3 storage adapter', () => {
  it('requires public media isolation from quarantine and protected zones', () => {
    expect(
      () =>
        new S3StorageAdapter({} as S3Client, {
          ...zones,
          PUBLIC_MEDIA: zones.QUARANTINE,
        }),
    ).toThrow('isolated');
    expect(
      () =>
        new S3StorageAdapter({} as S3Client, {
          ...zones,
          PUBLIC_MEDIA: zones.PRIVATE_CUSTOMER,
        }),
    ).toThrow('isolated');
  });

  it('asks S3 to calculate SHA-256 when the client does not supply a supported checksum', async () => {
    const presign = vi.fn(async (_client: S3Client, command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toMatchObject({ ChecksumAlgorithm: 'SHA256' });
      return 'https://signed.invalid/upload';
    }) as unknown as S3Presigner;
    const adapter = new S3StorageAdapter({ send: vi.fn() } as unknown as S3Client, zones, presign);
    const capability = await adapter.createUploadCapability({
      declaredMediaType: 'image/png',
      declaredSize: 8,
      expiresAt: instant('2026-07-16T12:02:00.000Z'),
      intentId: intentId(),
      lifetimeSeconds: 120,
      objectKey: 'objects/catalog-media/test-object',
      purpose: 'CATALOG_MEDIA',
      zone: 'QUARANTINE',
    });
    expect(capability.headers).toMatchObject({ 'x-amz-checksum-algorithm': 'SHA256' });
    expect(capability.headers).not.toHaveProperty('x-amz-checksum-sha256');
  });

  it('signs an exact upload command and returns only ephemeral capability details', async () => {
    const client = { send: vi.fn() } as unknown as S3Client;
    const presign = vi.fn(async (_client: S3Client, command: unknown) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      const input = (command as PutObjectCommand).input;
      expect(input).toMatchObject({
        Bucket: zones.QUARANTINE,
        ContentLength: 8,
        ContentType: 'image/png',
        Key: 'objects/catalog-media/test-object',
        Metadata: {
          'atelier-intent-id': intentId(),
          'atelier-purpose': 'CATALOG_MEDIA',
        },
      });
      return 'https://signed.invalid/upload';
    }) as unknown as S3Presigner;
    const adapter = new S3StorageAdapter(client, zones, presign);
    const capability = await adapter.createUploadCapability({
      declaredMediaType: 'image/png',
      declaredSize: 8,
      expectedChecksum: 'a'.repeat(64),
      expiresAt: instant('2026-07-16T12:02:00.000Z'),
      intentId: intentId(),
      lifetimeSeconds: 120,
      objectKey: 'objects/catalog-media/test-object',
      purpose: 'CATALOG_MEDIA',
      zone: 'QUARANTINE',
    });
    expect(capability).toEqual({
      expiresAt: '2026-07-16T12:02:00.000Z',
      headers: {
        'content-length': '8',
        'content-type': 'image/png',
        'x-amz-checksum-sha256': Buffer.from('a'.repeat(64), 'hex').toString('base64'),
        'x-amz-meta-atelier-intent-id': intentId(),
        'x-amz-meta-atelier-purpose': 'CATALOG_MEDIA',
      },
      method: 'PUT',
      url: 'https://signed.invalid/upload',
    });
    expect(presign).toHaveBeenCalledWith(client, expect.any(PutObjectCommand), {
      expiresIn: 120,
    });
  });

  it('pins download capabilities and object inspection to the exact version', async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: zones.QUARANTINE,
          ChecksumMode: 'ENABLED',
          Key: 'objects/catalog-media/test-object',
          VersionId: 'version-1',
        });
        return {
          ChecksumSHA256: Buffer.from('a'.repeat(64), 'hex').toString('base64'),
          ContentLength: 8,
          ContentType: 'image/png',
          Metadata: {
            'atelier-intent-id': intentId(),
            'atelier-purpose': 'CATALOG_MEDIA',
          },
          VersionId: 'version-1',
        };
      }
      throw new Error('Unexpected command.');
    });
    const client = { send } as unknown as S3Client;
    const presign = vi.fn(async (_client: S3Client, command: unknown) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect((command as GetObjectCommand).input.VersionId).toBe('version-1');
      return 'https://signed.invalid/download';
    }) as unknown as S3Presigner;
    const adapter = new S3StorageAdapter(client, zones, presign);
    const object = await adapter.inspectObject({
      objectKey: 'objects/catalog-media/test-object',
      versionId: 'version-1',
      zone: 'QUARANTINE',
    });
    expect(object.checksumSha256).toBe('a'.repeat(64));
    expect(
      await adapter.createDownloadCapability({
        expiresAt: instant('2026-07-16T12:01:00.000Z'),
        lifetimeSeconds: 60,
        object,
      }),
    ).toEqual({
      expiresAt: '2026-07-16T12:01:00.000Z',
      method: 'GET',
      url: 'https://signed.invalid/download',
    });
  });

  it('reads only a bounded exact-version prefix and inventories exact versions', async () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 99, 100]);
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof GetObjectCommand) {
        expect(command.input.Range).toBe('bytes=0-7');
        expect(command.input.VersionId).toBe('version-1');
        return { Body: { transformToByteArray: async () => bytes } };
      }
      if (command instanceof ListObjectVersionsCommand) {
        expect(command.input.MaxKeys).toBe(1);
        return {
          IsTruncated: false,
          Versions: [{ Key: 'objects/catalog-media/test-object', Size: 8, VersionId: 'version-1' }],
        };
      }
      if (command instanceof HeadObjectCommand) {
        return {
          ChecksumSHA256: Buffer.from('a'.repeat(64), 'hex').toString('base64'),
          ContentLength: 8,
          ContentType: 'image/png',
          VersionId: 'version-1',
        };
      }
      throw new Error('Unexpected command.');
    });
    const adapter = new S3StorageAdapter(
      { send } as unknown as S3Client,
      zones,
      vi.fn() as unknown as S3Presigner,
    );
    expect(
      await adapter.readObjectPrefix(
        {
          objectKey: 'objects/catalog-media/test-object',
          storageContainer: zones.QUARANTINE,
          versionId: 'version-1',
          zone: 'QUARANTINE',
        },
        8,
      ),
    ).toEqual(bytes.slice(0, 8));
    const inventory = await adapter.listObjectVersions({ limit: 1, zone: 'QUARANTINE' });
    expect(inventory.items).toEqual([
      {
        byteSize: 8,
        checksumSha256: 'a'.repeat(64),
        objectKey: 'objects/catalog-media/test-object',
        storageContainer: zones.QUARANTINE,
        versionId: 'version-1',
        zone: 'QUARANTINE',
      },
    ]);
  });
});

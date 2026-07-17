import type { ActorScopedTransaction } from '../../../platform/database';
import {
  err,
  ok,
  type ResolvedActorContext,
  type Result,
  type UtcInstant,
} from '../../../shared/kernel';
import type { FileFailure, FileObjectId } from '../domain/file-lifecycle';
import type { FileParentAuthorizationPort } from '../ports/parent-authorization';
import type { FilePolicyPort } from '../ports/file-policy';
import type { FileRepository } from '../ports/persistence';
import type { DownloadCapability, StorageObjectPort } from '../ports/storage';
import type { FileSecurityRecorderPort } from '../ports/telemetry';

function futureInstant(now: UtcInstant, seconds: number): UtcInstant | undefined {
  const value = new Date(new Date(now).getTime() + seconds * 1_000);
  return Number.isFinite(value.getTime()) ? (value.toISOString() as UtcInstant) : undefined;
}

export class FileAccessService {
  constructor(
    private readonly now: () => UtcInstant,
    private readonly policy: FilePolicyPort,
    private readonly parentAuthorization: FileParentAuthorizationPort,
    private readonly repository: FileRepository,
    private readonly storage: StorageObjectPort,
    private readonly securityRecorder: FileSecurityRecorderPort,
  ) {}

  async createPrivateDownloadCapability(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actorContext: ResolvedActorContext;
      fileObjectId: FileObjectId;
    }>,
  ): Promise<Result<DownloadCapability, FileFailure>> {
    const record = await this.repository.findAccessRecord(transaction, input.fileObjectId);
    if (!record) return err({ code: 'RESOURCE_NOT_FOUND' });
    const parent = await this.parentAuthorization.authorize({
      action: 'DOWNLOAD_PRIVATE',
      actorContext: transaction.actorContext,
      purpose: record.file.purpose,
      target: record.target,
    });
    if (!parent.ok) return parent;
    if (record.file.lifecycle === 'QUARANTINED') return err({ code: 'FILE_QUARANTINED' });
    if (record.file.lifecycle !== 'CLEAN' || record.file.scanState !== 'CLEAN') {
      return err({ code: 'FILE_SCAN_PENDING' });
    }
    const lifetimeSeconds = await this.policy.getPrivateDownloadLifetimeSeconds(
      record.file.purpose,
    );
    if (!lifetimeSeconds || !Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds <= 0) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }
    const now = this.now();
    const expiresAt = futureInstant(now, lifetimeSeconds);
    if (!expiresAt) return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    try {
      const capability = await this.storage.createDownloadCapability({
        expiresAt,
        lifetimeSeconds,
        object: {
          objectKey: record.file.objectKey,
          storageContainer: record.file.storageContainer,
          versionId: record.file.versionId,
          zone: record.file.zone,
        },
      });
      await this.securityRecorder.record(transaction, {
        fileObjectId: record.file.id,
        operation: 'PRIVATE_FILE_CAPABILITY_CREATED',
        outcome: 'SUCCEEDED',
        purpose: record.file.purpose,
        targetId: record.target.id,
        targetType: record.target.type,
      });
      return ok(capability);
    } catch {
      return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    }
  }
}

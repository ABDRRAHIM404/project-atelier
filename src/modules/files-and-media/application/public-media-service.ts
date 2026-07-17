import type { ActorScopedTransaction } from '../../../platform/database';
import { err, ok, type ResolvedActorContext, type Result } from '../../../shared/kernel';
import {
  authorizeP2ManagerMediaUpload,
  detectImage,
  validatePublicDerivative,
  validatePublicDerivativeConstraint,
  validatePublicMediaMetadata,
  type ExactStoredObject,
  type FileFailure,
  type FileObjectId,
  type PublicMediaDerivative,
} from '../domain/file-lifecycle';
import type { FileParentAuthorizationPort } from '../ports/parent-authorization';
import type { FilePolicyPort } from '../ports/file-policy';
import type { FileRepository } from '../ports/persistence';
import type { StorageObjectPort } from '../ports/storage';
import type { FileSecurityRecorderPort } from '../ports/telemetry';

export class PublicMediaService {
  constructor(
    private readonly policy: FilePolicyPort,
    private readonly parentAuthorization: FileParentAuthorizationPort,
    private readonly repository: FileRepository,
    private readonly storage: StorageObjectPort,
    private readonly securityRecorder: FileSecurityRecorderPort,
  ) {}

  async publishOptimizedDerivative(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actorContext: ResolvedActorContext;
      altTextAr: string;
      altTextEn?: string;
      byteSize: number;
      checksumSha256: string;
      fileObjectId: FileObjectId;
      height: number;
      objectKey: string;
      storageContainer: string;
      versionId: string;
      width: number;
      variantKind: 'GALLERY' | 'HERO' | 'THUMBNAIL';
      isPrimary: boolean;
      sortOrder: number;
    }>,
  ): Promise<Result<PublicMediaDerivative, FileFailure>> {
    const record = await this.repository.findAccessRecord(transaction, input.fileObjectId);
    if (!record) return err({ code: 'RESOURCE_NOT_FOUND' });
    const authorization = authorizeP2ManagerMediaUpload(
      transaction.actorContext,
      record.file.purpose,
      record.target,
    );
    if (!authorization.ok) return authorization;
    const parent = await this.parentAuthorization.authorize({
      action: 'PROMOTE_PUBLIC',
      actorContext: transaction.actorContext,
      purpose: record.file.purpose,
      target: record.target,
    });
    if (!parent.ok) return parent;
    const metadata = validatePublicMediaMetadata(input);
    if (!metadata.ok) return metadata;

    const configured = await this.policy.getPublicDerivativeConstraint(record.file.purpose);
    if (!configured) return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    const constraint = validatePublicDerivativeConstraint(configured);
    if (!constraint.ok || constraint.value.purpose !== authorization.value.purpose) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }

    let object: ExactStoredObject;
    try {
      object = await this.storage.inspectObject({
        objectKey: input.objectKey,
        versionId: input.versionId,
        zone: 'PUBLIC_MEDIA',
      });
    } catch {
      return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    }
    const prefix = await this.storage.readObjectPrefix(object, 65_536).catch(() => undefined);
    if (!prefix) return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    const detectedImage = detectImage(prefix);
    if (
      object.storageContainer !== input.storageContainer ||
      object.byteSize !== input.byteSize ||
      object.checksumSha256 !== input.checksumSha256 ||
      !detectedImage ||
      object.contentType !== detectedImage.mediaType ||
      detectedImage.width !== input.width ||
      detectedImage.height !== input.height
    ) {
      return err({ code: 'FILE_INTEGRITY_MISMATCH' });
    }
    const derivative = Object.freeze({
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      detectedMediaType: detectedImage.mediaType,
      height: input.height,
      objectKey: input.objectKey,
      storageContainer: input.storageContainer,
      versionId: input.versionId,
      variantKind: input.variantKind,
      width: input.width,
    });
    const valid = validatePublicDerivative(record.file, derivative, constraint.value);
    if (!valid.ok) return valid;

    const published = await this.repository.publishDerivative(transaction, {
      altTextAr: input.altTextAr,
      ...(input.altTextEn === undefined ? {} : { altTextEn: input.altTextEn }),
      derivative,
      isPrimary: input.isPrimary,
      sortOrder: input.sortOrder,
      source: record,
    });
    await this.securityRecorder.record(transaction, {
      fileObjectId: record.file.id,
      operation: 'PUBLIC_MEDIA_PUBLISHED',
      outcome: 'SUCCEEDED',
      purpose: record.file.purpose,
      targetId: record.target.id,
      targetType: record.target.type,
    });
    return ok(published);
  }
}

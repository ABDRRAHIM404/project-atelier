import type { ActorScopedTransaction } from '../../../platform/database';
import {
  err,
  ok,
  type Clock,
  type ResolvedActorContext,
  type Result,
  type UtcInstant,
} from '../../../shared/kernel';
import {
  authorizeP2ManagerMediaUpload,
  detectMediaType,
  validateFinalizedObject,
  validateUploadConstraint,
  validateUploadDeclaration,
  type FileFailure,
  type FileObject,
  type FilePurpose,
  type FileTarget,
  type UploadIntent,
} from '../domain/file-lifecycle';
import type { FileParentAuthorizationPort } from '../ports/parent-authorization';
import type { FilePolicyPort } from '../ports/file-policy';
import type { FileRepository } from '../ports/persistence';
import type { StorageKeyFactory, StorageObjectPort, UploadCapability } from '../ports/storage';
import type { FileSecurityRecorderPort } from '../ports/telemetry';

function futureInstant(now: UtcInstant, seconds: number): UtcInstant | undefined {
  const result = new Date(new Date(now).getTime() + seconds * 1_000);
  return Number.isFinite(result.getTime()) ? (result.toISOString() as UtcInstant) : undefined;
}

function remainingLifetimeSeconds(now: UtcInstant, expiresAt: UtcInstant): number {
  return Math.floor((new Date(expiresAt).getTime() - new Date(now).getTime()) / 1_000);
}

function sameFinalizedObject(
  file: FileObject,
  input: Readonly<{ checksumSha256: string; versionId: string }>,
): boolean {
  return file.versionId === input.versionId && file.checksumSha256 === input.checksumSha256;
}

export class FileUploadService {
  constructor(
    private readonly clock: Clock,
    private readonly policy: FilePolicyPort,
    private readonly parentAuthorization: FileParentAuthorizationPort,
    private readonly repository: FileRepository,
    private readonly storage: StorageObjectPort,
    private readonly keyFactory: StorageKeyFactory,
    private readonly securityRecorder: FileSecurityRecorderPort,
  ) {}

  async createIntent(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actorContext: ResolvedActorContext;
      declaredDisplayFilename: string;
      declaredMediaType: string;
      declaredSize: number;
      expectedChecksum?: string;
      idempotencyKey: string;
      purpose: FilePurpose;
      target: FileTarget;
    }>,
  ): Promise<
    Result<Readonly<{ capability: UploadCapability; intent: UploadIntent }>, FileFailure>
  > {
    const authorization = authorizeP2ManagerMediaUpload(
      transaction.actorContext,
      input.purpose,
      input.target,
    );
    if (!authorization.ok) return authorization;

    const parent = await this.parentAuthorization.authorize({
      action: 'UPLOAD',
      actorContext: transaction.actorContext,
      purpose: input.purpose,
      target: input.target,
    });
    if (!parent.ok) return parent;

    const configured = await this.policy.getUploadConstraint(input.purpose);
    if (!configured) return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    const constraint = validateUploadConstraint(configured);
    if (!constraint.ok || constraint.value.purpose !== authorization.value.purpose) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }
    const declaration = validateUploadDeclaration(input, constraint.value);
    if (!declaration.ok) return declaration;

    const now = this.clock.now();
    const expiresAt = futureInstant(now, constraint.value.capabilityLifetimeSeconds);
    if (
      !expiresAt ||
      input.idempotencyKey.trim().length < 8 ||
      input.idempotencyKey.trim().length > 255
    ) {
      return err({ code: 'FILE_REJECTED' });
    }
    if (transaction.actorContext.actor.kind !== 'manager') return err({ code: 'FORBIDDEN' });
    const registration = await this.repository.createOrResolveUploadIntent(transaction, {
      classification: authorization.value.classification,
      declaredDisplayFilename: declaration.value.displayFilename,
      declaredMediaType: declaration.value.mediaType,
      declaredSize: input.declaredSize,
      ...(input.expectedChecksum === undefined ? {} : { expectedChecksum: input.expectedChecksum }),
      expectedZone: 'QUARANTINE',
      expiresAt,
      generatedObjectKey: this.keyFactory.createObjectKey({ purpose: input.purpose }),
      idempotencyKey: input.idempotencyKey,
      purpose: authorization.value.purpose,
      requestingPrincipalId: transaction.actorContext.actor.principalId,
      target: input.target,
    });
    if (registration.kind === 'CONFLICT') return err({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const remainingLifetime = remainingLifetimeSeconds(now, registration.intent.expiresAt);
    if (registration.intent.lifecycle !== 'PENDING' || remainingLifetime <= 0) {
      return err({ code: 'UPLOAD_CAPABILITY_EXPIRED' });
    }

    try {
      const capability = await this.storage.createUploadCapability({
        declaredMediaType: registration.intent.declaredMediaType,
        declaredSize: registration.intent.declaredSize,
        ...(registration.intent.expectedChecksum === undefined
          ? {}
          : { expectedChecksum: registration.intent.expectedChecksum }),
        expiresAt: registration.intent.expiresAt,
        intentId: registration.intent.id,
        lifetimeSeconds: remainingLifetime,
        objectKey: registration.intent.generatedObjectKey,
        purpose: registration.intent.purpose,
        zone: 'QUARANTINE',
      });
      await this.securityRecorder.record(transaction, {
        operation: 'FILE_UPLOAD_INTENT_CREATED',
        outcome: 'SUCCEEDED',
        purpose: registration.intent.purpose,
        targetId: registration.intent.target.id,
        targetType: registration.intent.target.type,
      });
      return ok(Object.freeze({ capability, intent: registration.intent }));
    } catch {
      await this.securityRecorder.record(transaction, {
        operation: 'FILE_UPLOAD_CAPABILITY_FAILED',
        outcome: 'FAILED',
        purpose: registration.intent.purpose,
        safeReasonCode: 'STORAGE_SERVICE_UNAVAILABLE',
        targetId: registration.intent.target.id,
        targetType: registration.intent.target.type,
      });
      return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    }
  }

  async finalize(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      actorContext: ResolvedActorContext;
      checksumSha256: string;
      intentId: UploadIntent['id'];
      objectVersionId: string;
    }>,
  ): Promise<Result<FileObject, FileFailure>> {
    const intent = await this.repository.findUploadIntent(transaction, input.intentId);
    if (!intent) return err({ code: 'RESOURCE_NOT_FOUND' });
    const authorization = authorizeP2ManagerMediaUpload(
      transaction.actorContext,
      intent.purpose,
      intent.target,
    );
    if (!authorization.ok) return authorization;
    if (
      transaction.actorContext.actor.kind !== 'manager' ||
      transaction.actorContext.actor.principalId !== intent.requestingPrincipalId
    ) {
      return err({ code: 'RESOURCE_NOT_FOUND' });
    }
    const parent = await this.parentAuthorization.authorize({
      action: 'UPLOAD',
      actorContext: transaction.actorContext,
      purpose: intent.purpose,
      target: intent.target,
    });
    if (!parent.ok) return parent;

    const existing = await this.repository.findFileByUploadIntent(transaction, intent.id);
    if (existing) {
      return sameFinalizedObject(existing, {
        checksumSha256: input.checksumSha256,
        versionId: input.objectVersionId,
      })
        ? ok(existing)
        : err({ code: 'FILE_INTEGRITY_MISMATCH' });
    }

    const configured = await this.policy.getUploadConstraint(intent.purpose);
    if (!configured) return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    const constraint = validateUploadConstraint(configured);
    if (!constraint.ok || constraint.value.purpose !== intent.purpose) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }

    let object;
    try {
      object = await this.storage.inspectObject({
        objectKey: intent.generatedObjectKey,
        versionId: input.objectVersionId,
        zone: intent.expectedZone,
      });
    } catch {
      return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    }
    if (object.checksumSha256 !== input.checksumSha256) {
      await this.repository.recordUnsafeFinalization(transaction, {
        intent,
        object,
        observedAt: this.clock.now(),
        reason: 'FILE_INTEGRITY_MISMATCH',
      });
      return err({ code: 'FILE_INTEGRITY_MISMATCH' });
    }
    const prefix = await this.storage.readObjectPrefix(object, 4_096).catch(() => undefined);
    if (!prefix) return err({ code: 'STORAGE_SERVICE_UNAVAILABLE' });
    const validated = validateFinalizedObject(
      intent,
      object,
      detectMediaType(prefix),
      constraint.value,
      this.clock.now(),
    );
    if (!validated.ok) {
      await this.repository.recordUnsafeFinalization(transaction, {
        intent,
        object,
        observedAt: this.clock.now(),
        reason: validated.error.code,
      });
      return validated;
    }

    const file = await this.repository.finalizeUpload(transaction, {
      detectedMediaType: validated.value.detectedMediaType,
      intent,
      object,
    });
    await this.securityRecorder.record(transaction, {
      fileObjectId: file.id,
      operation: 'FILE_UPLOAD_FINALIZED',
      outcome: 'SUCCEEDED',
      purpose: file.purpose,
      targetId: intent.target.id,
      targetType: intent.target.type,
    });
    return ok(file);
  }
}

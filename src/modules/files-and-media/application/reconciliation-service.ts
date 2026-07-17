import type { ActorScopedTransaction } from '../../../platform/database';
import { err, ok, type Result, type UtcInstant } from '../../../shared/kernel';
import type { FileFailure, FileLogicalZone } from '../domain/file-lifecycle';
import type {
  ExpectedStorageObject,
  FileRepository,
  ReconciliationFindingDraft,
} from '../ports/persistence';
import type { StorageInventoryObject, StorageInventoryPort } from '../ports/storage';

function storageIdentity(value: {
  objectKey: string;
  storageContainer: string;
  versionId: string;
  zone: FileLogicalZone;
}): string {
  return `${value.zone}\u0000${value.storageContainer}\u0000${value.objectKey}\u0000${value.versionId}`;
}

function mismatch(expected: ExpectedStorageObject, observed: StorageInventoryObject): boolean {
  return (
    expected.byteSize !== observed.byteSize ||
    (observed.checksumSha256 !== undefined && expected.checksumSha256 !== observed.checksumSha256)
  );
}

export class FileReconciliationService {
  constructor(
    private readonly now: () => UtcInstant,
    private readonly repository: FileRepository,
    private readonly inventory: StorageInventoryPort,
  ) {}

  async reconcileZone(
    transaction: ActorScopedTransaction,
    input: Readonly<{ limit: number; zone: FileLogicalZone }>,
  ): Promise<
    Result<
      Readonly<{ findings: number; inspectedDatabase: number; inspectedStorage: number }>,
      FileFailure
    >
  > {
    if (transaction.actorContext.actor.kind !== 'system_job') return err({ code: 'FORBIDDEN' });
    if (!Number.isSafeInteger(input.limit) || input.limit <= 0) {
      return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
    }
    const [expectedPage, observedPage] = await Promise.all([
      this.repository.listExpectedStorageObjects(transaction, {
        limit: input.limit,
        zone: input.zone,
      }),
      this.inventory.listObjectVersions({ limit: input.limit, zone: input.zone }),
    ]);
    const expected = new Map(expectedPage.items.map((item) => [storageIdentity(item), item]));
    const observed = new Map(observedPage.items.map((item) => [storageIdentity(item), item]));
    const findings: ReconciliationFindingDraft[] = [];
    const observedAt = this.now();

    for (const [identity, expectedObject] of expected) {
      const observedObject = observed.get(identity);
      if (!observedObject) {
        findings.push({
          expected: expectedObject,
          fileObjectId: expectedObject.fileObjectId,
          findingType: 'MISSING_OBJECT',
          observedAt,
          safeReasonCode: 'STORAGE_OBJECT_MISSING',
        });
      } else if (mismatch(expectedObject, observedObject)) {
        findings.push({
          expected: expectedObject,
          fileObjectId: expectedObject.fileObjectId,
          findingType: 'METADATA_MISMATCH',
          observed: observedObject,
          observedAt,
          safeReasonCode: 'STORAGE_METADATA_MISMATCH',
        });
      }
    }
    for (const [identity, observedObject] of observed) {
      if (!expected.has(identity)) {
        findings.push({
          findingType: 'ORPHAN_OBJECT',
          observed: observedObject,
          observedAt,
          safeReasonCode: 'STORAGE_OBJECT_ORPHANED',
        });
      }
    }
    for (const finding of findings) {
      await this.repository.recordReconciliationFinding(transaction, finding);
    }
    return ok(
      Object.freeze({
        findings: findings.length,
        inspectedDatabase: expectedPage.items.length,
        inspectedStorage: observedPage.items.length,
      }),
    );
  }
}

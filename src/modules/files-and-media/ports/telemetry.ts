import type { ActorScopedTransaction } from '../../../platform/database';
import type { FileObjectId, FilePurpose } from '../domain/file-lifecycle';

export interface FileSecurityRecorderPort {
  record(
    transaction: ActorScopedTransaction,
    event: Readonly<{
      fileObjectId?: FileObjectId;
      operation: string;
      outcome: 'DENIED' | 'FAILED' | 'SUCCEEDED';
      purpose?: FilePurpose;
      safeReasonCode?: string;
      targetId?: string;
      targetType: string;
    }>,
  ): Promise<void>;
}

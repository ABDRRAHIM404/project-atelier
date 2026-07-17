import type { ActorScopedTransaction } from '../../../platform/database';
import { err, ok, type Result } from '../../../shared/kernel';
import type { FileFailure } from '../domain/file-lifecycle';
import type { FileRepository } from '../ports/persistence';
import type { ScanEventVerifierPort } from '../ports/scan';
import type { FileSecurityRecorderPort } from '../ports/telemetry';

export class FileScanService {
  constructor(
    private readonly verifier: ScanEventVerifierPort,
    private readonly repository: FileRepository,
    private readonly securityRecorder: FileSecurityRecorderPort,
  ) {}

  async receive(
    transaction: ActorScopedTransaction,
    input: Readonly<{ headers: Headers; rawBody: Uint8Array }>,
  ): Promise<
    Result<
      Readonly<{
        duplicate: boolean;
        result:
          'CLEAN' | 'DUPLICATE' | 'IGNORED_TERMINAL' | 'NOT_FOUND' | 'PENDING' | 'QUARANTINED';
      }>,
      FileFailure
    >
  > {
    if (
      transaction.actorContext.actor.kind !== 'provider_webhook' ||
      transaction.actorContext.assurance !== 'provider_signature'
    ) {
      return err({ code: 'FORBIDDEN' });
    }
    const verified = await this.verifier.verify(input);
    if (!verified.ok) {
      await this.securityRecorder.record(transaction, {
        operation: 'FILE_SCAN_EVENT_REJECTED',
        outcome: 'DENIED',
        safeReasonCode: verified.error.code,
        targetType: 'FILE_SCAN_EVENT',
      });
      return verified;
    }
    const registration = await this.repository.applyVerifiedScanEvent(transaction, verified.value);
    await this.securityRecorder.record(transaction, {
      operation: 'FILE_SCAN_EVENT_APPLIED',
      outcome: 'SUCCEEDED',
      targetType: 'FILE_SCAN_EVENT',
    });
    return ok(
      Object.freeze({
        duplicate: registration.kind === 'DUPLICATE',
        result: registration.result,
      }),
    );
  }
}

import type { Result } from '../../../shared/kernel';
import type { FileFailure, VerifiedScanEvent } from '../domain/file-lifecycle';

export interface ScanEventVerifierPort {
  verify(
    input: Readonly<{ headers: Headers; rawBody: Uint8Array }>,
  ): Promise<Result<VerifiedScanEvent, FileFailure>>;
}

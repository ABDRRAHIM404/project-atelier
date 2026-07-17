import type { ResolvedActorContext, Result } from '../../../shared/kernel';
import type { FileFailure, FilePurpose, FileTarget } from '../domain/file-lifecycle';

export interface FileParentAuthorizationPort {
  authorize(
    input: Readonly<{
      action: 'DOWNLOAD_PRIVATE' | 'PROMOTE_PUBLIC' | 'UPLOAD';
      actorContext: ResolvedActorContext;
      purpose: FilePurpose;
      target: FileTarget;
    }>,
  ): Promise<Result<true, FileFailure>>;
}

import type {
  FilePurpose,
  PublicDerivativeConstraint,
  UploadConstraint,
} from '../domain/file-lifecycle';

export interface FilePolicyPort {
  getPrivateDownloadLifetimeSeconds(purpose: FilePurpose): Promise<number | undefined>;
  getPublicDerivativeConstraint(
    purpose: FilePurpose,
  ): Promise<PublicDerivativeConstraint | undefined>;
  getUploadConstraint(purpose: FilePurpose): Promise<UploadConstraint | undefined>;
}

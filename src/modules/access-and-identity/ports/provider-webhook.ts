import type { Result } from '../../../shared/kernel';
import type { IdentitySynchronizationEvent } from '../domain/identity';

export type ProviderWebhookFailure = Readonly<{
  code: 'IDENTITY_SERVICE_UNAVAILABLE' | 'INVALID_SIGNATURE' | 'MALFORMED_EVENT';
}>;

export interface ProviderWebhookVerifier {
  verify(
    request: Request,
  ): Promise<Result<IdentitySynchronizationEvent | null, ProviderWebhookFailure>>;
}

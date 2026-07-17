import type { Identifier, ResolvedActorContext, Result } from '../../../shared/kernel';
import type {
  IdentityProfile,
  IdentityResolutionFailure,
  IdentitySynchronizationEvent,
  IdentitySynchronizationResult,
  LocalIdentity,
  VerifiedProviderSession,
} from '../domain/identity';

export interface IdentityRepository {
  findByProviderSubject(
    session: Pick<VerifiedProviderSession, 'provider' | 'subject'>,
  ): Promise<Result<LocalIdentity | null, IdentityResolutionFailure>>;
  getProfile(
    identity: LocalIdentity,
    context: ResolvedActorContext,
  ): Promise<Result<IdentityProfile, IdentityResolutionFailure>>;
  provisionCustomer(
    input: Readonly<{
      correlationId: Identifier<'Correlation'>;
      provider: VerifiedProviderSession['provider'];
      subject: VerifiedProviderSession['subject'];
      verifiedEmail: string;
    }>,
  ): Promise<Result<LocalIdentity, IdentityResolutionFailure>>;
}

export interface IdentitySynchronizationRepository {
  synchronize(
    event: IdentitySynchronizationEvent,
    correlationId: Identifier<'Correlation'>,
  ): Promise<Result<IdentitySynchronizationResult, IdentityResolutionFailure>>;
}

import type { Identifier, Result } from '../../../shared/kernel';
import type {
  IdentityResolutionFailure,
  IdentitySynchronizationEvent,
  IdentitySynchronizationResult,
} from '../domain/identity';
import type { IdentitySynchronizationRepository } from '../ports/identity-repository';

export class SynchronizeIdentity {
  constructor(private readonly identities: IdentitySynchronizationRepository) {}

  execute(
    event: IdentitySynchronizationEvent,
    correlationId: Identifier<'Correlation'>,
  ): Promise<Result<IdentitySynchronizationResult, IdentityResolutionFailure>> {
    return this.identities.synchronize(event, correlationId);
  }
}

import { ok, type Identifier, type Result } from '../../../shared/kernel';
import type {
  CurrentIdentity,
  IdentityResolutionFailure,
  VerifiedProviderSession,
} from '../domain/identity';
import type { IdentityRepository } from '../ports/identity-repository';
import type { ProviderUserDirectory } from '../ports/session-authenticator';
import { ActorContextResolver } from './resolve-actor-context';

export class CurrentIdentityResolver {
  private readonly actors: ActorContextResolver;

  constructor(
    private readonly identities: IdentityRepository,
    providerUsers: ProviderUserDirectory,
  ) {
    this.actors = new ActorContextResolver(identities, providerUsers);
  }

  async resolve(
    session: VerifiedProviderSession,
    correlationId: Identifier<'Correlation'>,
  ): Promise<Result<CurrentIdentity, IdentityResolutionFailure>> {
    const resolution = await this.actors.resolveIdentity(session, correlationId);
    if (!resolution.ok) return resolution;

    const profile = await this.identities.getProfile(
      resolution.value.identity,
      resolution.value.context,
    );
    return profile.ok
      ? ok(Object.freeze({ context: resolution.value.context, profile: profile.value }))
      : profile;
  }
}

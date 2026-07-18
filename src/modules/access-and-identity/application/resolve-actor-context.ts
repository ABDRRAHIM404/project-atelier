import {
  err,
  ok,
  type Identifier,
  type ResolvedActorContext,
  type Result,
} from '../../../shared/kernel';
import type {
  IdentityResolutionFailure,
  LocalIdentity,
  VerifiedProviderSession,
} from '../domain/identity';
import type { IdentityRepository } from '../ports/identity-repository';
import type { ProviderUserDirectory } from '../ports/session-authenticator';

function activeContext(
  identity: LocalIdentity,
  session: VerifiedProviderSession,
): Result<ResolvedActorContext, IdentityResolutionFailure> {
  if (identity.accessStatus === 'DISABLED') {
    return err({ code: 'ACCOUNT_DISABLED' });
  }

  if (identity.actorType === 'CUSTOMER') {
    if (session.firstFactorAgeMinutes === null || session.firstFactorAgeMinutes < 0) {
      return err({ code: 'SESSION_INVALID' });
    }
    return ok(
      Object.freeze({
        actor: Object.freeze({ kind: 'customer', principalId: identity.principalId }),
        assurance: 'customer_otp',
        customerId: identity.customerId,
      }),
    );
  }

  if (!identity.managerActive) {
    return err({ code: 'MANAGER_INACTIVE' });
  }

  if (session.firstFactorAgeMinutes === null || session.firstFactorAgeMinutes < 0) {
    return err({ code: 'SESSION_INVALID' });
  }

  return ok(
    Object.freeze({
      actor: Object.freeze({ kind: 'manager', principalId: identity.principalId }),
      assurance: 'manager_mfa',
    }),
  );
}

export class ActorContextResolver {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly providerUsers: ProviderUserDirectory,
  ) {}

  async resolve(
    session: VerifiedProviderSession,
    correlationId: Identifier<'Correlation'>,
  ): Promise<Result<ResolvedActorContext, IdentityResolutionFailure>> {
    const resolution = await this.resolveIdentity(session, correlationId);
    return resolution.ok ? ok(resolution.value.context) : resolution;
  }

  async resolveIdentity(
    session: VerifiedProviderSession,
    correlationId: Identifier<'Correlation'>,
  ): Promise<
    Result<
      Readonly<{ context: ResolvedActorContext; identity: LocalIdentity }>,
      IdentityResolutionFailure
    >
  > {
    const found = await this.identities.findByProviderSubject(session);
    if (!found.ok) return found;

    let identity = found.value;
    if (!identity) {
      const providerUser = await this.providerUsers.getUser(session.subject);
      if (!providerUser.ok) return providerUser;
      if (!providerUser.value.verifiedPrimaryEmail) {
        return err({ code: 'UNMAPPED_IDENTITY' });
      }

      const provisioned = await this.identities.provisionCustomer({
        correlationId,
        provider: session.provider,
        subject: session.subject,
        verifiedEmail: providerUser.value.verifiedPrimaryEmail,
      });
      if (!provisioned.ok) return provisioned;
      identity = provisioned.value;
    }

    const context = activeContext(identity, session);
    return context.ok ? ok(Object.freeze({ context: context.value, identity })) : context;
  }
}

export function reauthenticationSatisfiesPolicy(
  session: VerifiedProviderSession,
  policy: Readonly<{
    firstFactorMaximumAgeMinutes: number;
    secondFactorMaximumAgeMinutes: number;
  }>,
): boolean {
  return (
    session.firstFactorAgeMinutes !== null &&
    session.firstFactorAgeMinutes >= 0 &&
    session.firstFactorAgeMinutes <= policy.firstFactorMaximumAgeMinutes &&
    session.secondFactorAgeMinutes !== null &&
    session.secondFactorAgeMinutes >= 0 &&
    session.secondFactorAgeMinutes <= policy.secondFactorMaximumAgeMinutes
  );
}

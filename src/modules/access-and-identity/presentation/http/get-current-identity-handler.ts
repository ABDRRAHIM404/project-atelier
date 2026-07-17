import { createCorrelationId } from '../../../../platform/observability';
import type { ProblemCode } from '../../../../shared/errors';
import type { IdentityResolutionFailure } from '../../domain/identity';
import type { CurrentIdentityResolver } from '../../application/resolve-current-identity';
import type { SessionAuthenticator } from '../../ports/session-authenticator';
import { identityProblemResponse } from './problem-response';

function problemCode(failure: IdentityResolutionFailure['code']): ProblemCode {
  switch (failure) {
    case 'ACCOUNT_DISABLED':
      return 'ACCOUNT_DISABLED';
    case 'IDENTITY_SERVICE_UNAVAILABLE':
      return 'IDENTITY_SERVICE_UNAVAILABLE';
    case 'MANAGER_INACTIVE':
      return 'FORBIDDEN';
    case 'PROVIDER_EVENT_CONFLICT':
      return 'DEPENDENCY_FAILURE';
    case 'SESSION_INVALID':
    case 'UNMAPPED_IDENTITY':
      return 'SESSION_INVALID';
  }
}

export class GetCurrentIdentityHandler {
  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly identities: CurrentIdentityResolver,
  ) {}

  async handle(request: Request): Promise<Response> {
    const correlationId = createCorrelationId();
    const session = await this.sessions.authenticate(request);
    if (!session.ok) {
      return identityProblemResponse(
        session.error.code === 'AUTHENTICATION_REQUIRED'
          ? 'AUTHENTICATION_REQUIRED'
          : session.error.code === 'SESSION_INVALID'
            ? 'SESSION_INVALID'
            : 'IDENTITY_SERVICE_UNAVAILABLE',
        request,
        correlationId,
      );
    }

    const current = await this.identities.resolve(session.value, correlationId);
    if (!current.ok) {
      return identityProblemResponse(problemCode(current.error.code), request, correlationId);
    }

    const { context, profile } = current.value;
    const representation =
      profile.actorType === 'CUSTOMER'
        ? {
            accessStatus: profile.accessStatus,
            assurance: context.assurance,
            customer: {
              contactEmail: profile.contactEmail,
              id: profile.customerId,
              preferredLocale: profile.preferredLocale,
              verifiedEmail: profile.verifiedEmail,
            },
            principalType: 'CUSTOMER' as const,
            type: 'current-identity' as const,
            version: profile.recordVersion,
          }
        : {
            accessStatus: profile.accessStatus,
            assurance: context.assurance,
            manager: { id: profile.managerId },
            principalType: 'MANAGER' as const,
            type: 'current-identity' as const,
            version: profile.recordVersion,
          };

    return Response.json(representation, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Correlation-ID': correlationId,
      },
      status: 200,
    });
  }
}

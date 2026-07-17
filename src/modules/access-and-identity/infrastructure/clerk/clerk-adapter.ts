import { createClerkClient } from '@clerk/backend';
import { z } from 'zod';
import { err, ok, type Result } from '../../../../shared/kernel';
import type {
  ProviderSessionId,
  ProviderSubject,
  VerifiedProviderSession,
} from '../../domain/identity';
import type {
  ProviderUser,
  ProviderUserDirectory,
  ProviderUserDirectoryFailure,
  SessionAuthenticationFailure,
  SessionAuthenticator,
} from '../../ports/session-authenticator';

export type ClerkAdapterConfiguration = Readonly<{
  authorizedParties: readonly string[];
  publishableKey: string;
  secretKey: string;
}>;

type ClerkSessionEvidence = Readonly<{
  actor: unknown;
  factorVerificationAge: readonly [number, number] | null;
  sessionId: string | null;
  userId: string | null;
}>;

export type ClerkSessionVerifier = (
  request: Request,
) => Promise<Result<ClerkSessionEvidence, SessionAuthenticationFailure>>;

export type ClerkUserReader = (subject: string) => Promise<
  Result<
    Readonly<{
      primaryEmail: string | null;
      primaryEmailVerified: boolean;
      subject: string;
    }>,
    ProviderUserDirectoryFailure
  >
>;

function validProviderIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 255 && !/[\u0000-\u001f\u007f]/u.test(value);
}

const emailAddressSchema = z.email().max(320);
const SESSION_TOKEN_TYPE = 'session_token' as const;

export class ClerkSessionAuthenticator implements SessionAuthenticator {
  constructor(private readonly verifySession: ClerkSessionVerifier) {}

  async authenticate(
    request: Request,
  ): Promise<Result<VerifiedProviderSession, SessionAuthenticationFailure>> {
    const verified = await this.verifySession(request);
    if (!verified.ok) return verified;

    const { actor, factorVerificationAge, sessionId, userId } = verified.value;
    if (
      (actor !== null && actor !== undefined) ||
      !sessionId ||
      !userId ||
      !validProviderIdentifier(sessionId) ||
      !validProviderIdentifier(userId)
    ) {
      return err({ code: 'SESSION_INVALID' });
    }

    const firstFactor = factorVerificationAge?.[0] ?? null;
    const secondFactor = factorVerificationAge?.[1] ?? null;
    if (
      (firstFactor !== null && (!Number.isInteger(firstFactor) || firstFactor < -1)) ||
      (secondFactor !== null && (!Number.isInteger(secondFactor) || secondFactor < -1))
    ) {
      return err({ code: 'SESSION_INVALID' });
    }

    return ok(
      Object.freeze({
        firstFactorAgeMinutes: firstFactor === -1 ? null : firstFactor,
        provider: 'clerk',
        secondFactorAgeMinutes: secondFactor === -1 ? null : secondFactor,
        sessionId: sessionId as ProviderSessionId,
        subject: userId as ProviderSubject,
      }),
    );
  }
}

export class ClerkUserDirectory implements ProviderUserDirectory {
  constructor(private readonly readUser: ClerkUserReader) {}

  async getUser(subject: string): Promise<Result<ProviderUser, ProviderUserDirectoryFailure>> {
    if (!validProviderIdentifier(subject)) return err({ code: 'SESSION_INVALID' });
    const result = await this.readUser(subject);
    if (!result.ok) return result;
    if (result.value.subject !== subject) return err({ code: 'SESSION_INVALID' });

    return ok(
      Object.freeze({
        subject,
        verifiedPrimaryEmail:
          result.value.primaryEmailVerified &&
          result.value.primaryEmail &&
          emailAddressSchema.safeParse(result.value.primaryEmail).success
            ? result.value.primaryEmail
            : null,
      }),
    );
  }
}

export function createClerkAdapters(configuration: ClerkAdapterConfiguration): Readonly<{
  sessions: SessionAuthenticator;
  users: ProviderUserDirectory;
}> {
  const validAuthorizedParty = (party: string): boolean => {
    if (!URL.canParse(party)) return false;
    const url = new URL(party);
    const localHttp =
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    return (
      (url.protocol === 'https:' || localHttp) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  };
  if (
    configuration.authorizedParties.length === 0 ||
    configuration.authorizedParties.some((party) => !validAuthorizedParty(party)) ||
    !configuration.publishableKey ||
    !configuration.secretKey
  ) {
    throw new Error('Clerk adapter configuration is incomplete.');
  }

  const client = createClerkClient({
    publishableKey: configuration.publishableKey,
    secretKey: configuration.secretKey,
  });

  const verifySession: ClerkSessionVerifier = async (request) => {
    try {
      const state = await client.authenticateRequest(request, {
        acceptsToken: SESSION_TOKEN_TYPE,
        authorizedParties: [...configuration.authorizedParties],
      });
      if (!state.isAuthenticated) {
        const credentialPresent =
          request.headers.has('authorization') ||
          /(?:^|;\s*)__session=/u.test(request.headers.get('cookie') ?? '');
        return err({ code: credentialPresent ? 'SESSION_INVALID' : 'AUTHENTICATION_REQUIRED' });
      }
      const auth = state.toAuth();
      return ok(
        Object.freeze({
          actor: auth.actor,
          factorVerificationAge: auth.factorVerificationAge,
          sessionId: auth.sessionId,
          userId: auth.userId,
        }),
      );
    } catch {
      return err({ code: 'IDENTITY_SERVICE_UNAVAILABLE' });
    }
  };

  const readUser: ClerkUserReader = async (subject) => {
    try {
      const user = await client.users.getUser(subject);
      const primary = user.primaryEmailAddress;
      return ok(
        Object.freeze({
          primaryEmail: primary?.emailAddress ?? null,
          primaryEmailVerified: primary?.verification?.status === 'verified',
          subject: user.id,
        }),
      );
    } catch {
      return err({ code: 'IDENTITY_SERVICE_UNAVAILABLE' });
    }
  };

  return Object.freeze({
    sessions: new ClerkSessionAuthenticator(verifySession),
    users: new ClerkUserDirectory(readUser),
  });
}

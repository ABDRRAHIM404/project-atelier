import type { Result } from '../../../shared/kernel';
import type { VerifiedProviderSession } from '../domain/identity';

export type SessionAuthenticationFailure = Readonly<{
  code: 'AUTHENTICATION_REQUIRED' | 'IDENTITY_SERVICE_UNAVAILABLE' | 'SESSION_INVALID';
}>;

export interface SessionAuthenticator {
  authenticate(
    request: Request,
  ): Promise<Result<VerifiedProviderSession, SessionAuthenticationFailure>>;
}

export type ProviderUser = Readonly<{
  subject: string;
  verifiedPrimaryEmail: string | null;
}>;

export type ProviderUserDirectoryFailure = Readonly<{
  code: 'IDENTITY_SERVICE_UNAVAILABLE' | 'SESSION_INVALID';
}>;

export interface ProviderUserDirectory {
  getUser(subject: string): Promise<Result<ProviderUser, ProviderUserDirectoryFailure>>;
}

export {
  AuthorizationService,
  type AuthorizationDenial,
  type AuthorizationDenialCode,
  type AuthorizationGrant,
  type AuthorizationPolicy,
  type AuthorizationRequest,
} from './application/authorization-service';
export {
  ActorContextResolver,
  reauthenticationSatisfiesPolicy,
} from './application/resolve-actor-context';
export { CurrentIdentityResolver } from './application/resolve-current-identity';
export { SynchronizeIdentity } from './application/synchronize-identity';
export type {
  CurrentIdentity,
  IdentityProfile,
  IdentityProviderCode,
  IdentityResolutionFailure,
  IdentitySynchronizationEvent,
  IdentitySynchronizationResult,
  LocalIdentity,
  ReauthenticationPolicy,
  VerifiedProviderSession,
} from './domain/identity';
export type {
  IdentityRepository,
  IdentitySynchronizationRepository,
} from './ports/identity-repository';
export type {
  ProviderUser,
  ProviderUserDirectory,
  ProviderUserDirectoryFailure,
  SessionAuthenticationFailure,
  SessionAuthenticator,
} from './ports/session-authenticator';

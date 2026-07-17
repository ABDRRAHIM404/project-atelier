import type {
  CustomerId,
  Identifier,
  PrincipalId,
  ResolvedActorContext,
  UtcInstant,
} from '../../../shared/kernel';

export const identityProviderCodes = ['clerk'] as const;
export type IdentityProviderCode = (typeof identityProviderCodes)[number];

export type ProviderSubject = string & { readonly __brand: 'ProviderSubject' };
export type ProviderSessionId = string & { readonly __brand: 'ProviderSessionId' };
export type ProviderEventId = string & { readonly __brand: 'ProviderEventId' };
export type ManagerId = Identifier<'Manager'>;

export type VerifiedProviderSession = Readonly<{
  firstFactorAgeMinutes: number | null;
  provider: IdentityProviderCode;
  secondFactorAgeMinutes: number | null;
  sessionId: ProviderSessionId;
  subject: ProviderSubject;
}>;

export type LocalIdentity =
  | Readonly<{
      accessStatus: 'ACTIVE' | 'DISABLED';
      actorType: 'CUSTOMER';
      customerId: CustomerId;
      principalId: PrincipalId;
    }>
  | Readonly<{
      accessStatus: 'ACTIVE' | 'DISABLED';
      actorType: 'MANAGER';
      managerActive: boolean;
      managerId: ManagerId;
      principalId: PrincipalId;
    }>;

export type IdentityProfile =
  | Readonly<{
      accessStatus: 'ACTIVE' | 'DISABLED';
      actorType: 'CUSTOMER';
      contactEmail: string | null;
      customerId: CustomerId;
      preferredLocale: 'ar' | 'en';
      principalId: PrincipalId;
      recordVersion: number;
      verifiedEmail: string | null;
    }>
  | Readonly<{
      accessStatus: 'ACTIVE' | 'DISABLED';
      actorType: 'MANAGER';
      managerId: ManagerId;
      principalId: PrincipalId;
      recordVersion: number;
    }>;

export type IdentityResolutionFailure = Readonly<{
  code:
    | 'ACCOUNT_DISABLED'
    | 'IDENTITY_SERVICE_UNAVAILABLE'
    | 'MANAGER_INACTIVE'
    | 'PROVIDER_EVENT_CONFLICT'
    | 'SESSION_INVALID'
    | 'UNMAPPED_IDENTITY';
}>;

export type ReauthenticationPolicy = Readonly<{
  firstFactorMaximumAgeMinutes: number;
  secondFactorMaximumAgeMinutes: number;
}>;

export type IdentitySynchronizationEvent = Readonly<{
  eventId: ProviderEventId;
  eventType: 'USER_CREATED' | 'USER_DELETED' | 'USER_UPDATED';
  payloadDigest: string;
  provider: IdentityProviderCode;
  providerOccurredAt: UtcInstant | null;
  subject: ProviderSubject;
  user: Readonly<{
    accessRestricted: boolean;
    verifiedPrimaryEmail: string | null;
  }> | null;
}>;

export type IdentitySynchronizationResult =
  | 'APPLIED'
  | 'DUPLICATE'
  | 'IGNORED_STALE'
  | 'IGNORED_MANAGER_REQUIRES_OPERATOR'
  | 'IGNORED_RESTRICTED_IDENTITY'
  | 'IGNORED_UNMAPPED_DELETION'
  | 'IGNORED_UNVERIFIED_EMAIL';

export type CurrentIdentity = Readonly<{
  context: ResolvedActorContext;
  profile: IdentityProfile;
}>;

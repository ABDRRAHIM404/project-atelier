import type { Identifier } from './identifier';
import type { AuthenticationAssurance } from './authentication';

export const actorKinds = [
  'visitor',
  'customer',
  'manager',
  'system_job',
  'provider_webhook',
  'operator',
] as const;

export type ActorKind = (typeof actorKinds)[number];
export type PrincipalId = Identifier<'Principal'>;
export type CustomerId = Identifier<'Customer'>;

export type Actor =
  | Readonly<{ kind: 'visitor' }>
  | Readonly<{ kind: 'customer' | 'manager'; principalId: PrincipalId }>
  | Readonly<{ kind: 'system_job' | 'provider_webhook' | 'operator' }>;

export type ResolvedActorContext =
  | Readonly<{ actor: Readonly<{ kind: 'visitor' }>; assurance: 'anonymous' }>
  | Readonly<{
      actor: Readonly<{ kind: 'customer'; principalId: PrincipalId }>;
      assurance: 'customer_otp';
      customerId: CustomerId;
    }>
  | Readonly<{
      actor: Readonly<{ kind: 'manager'; principalId: PrincipalId }>;
      assurance: 'manager_mfa' | 'manager_password';
    }>
  | Readonly<{
      actor: Readonly<{ kind: 'provider_webhook' }>;
      assurance: 'provider_signature';
    }>
  | Readonly<{ actor: Readonly<{ kind: 'system_job' }>; assurance: 'system_job' }>
  | Readonly<{ actor: Readonly<{ kind: 'operator' }>; assurance: 'operator' }>;

export function isResolvedActorContext(
  value: Readonly<{
    actor: Actor;
    assurance: AuthenticationAssurance;
    customerId?: CustomerId;
  }>,
): value is ResolvedActorContext {
  switch (value.actor.kind) {
    case 'visitor':
      return value.assurance === 'anonymous' && value.customerId === undefined;
    case 'customer':
      return value.assurance === 'customer_otp' && value.customerId !== undefined;
    case 'manager':
      return (
        (value.assurance === 'manager_password' || value.assurance === 'manager_mfa') &&
        value.customerId === undefined
      );
    case 'provider_webhook':
      return value.assurance === 'provider_signature' && value.customerId === undefined;
    case 'system_job':
      return value.assurance === 'system_job' && value.customerId === undefined;
    case 'operator':
      return value.assurance === 'operator' && value.customerId === undefined;
  }
}

export function visitorActor(): Actor {
  return Object.freeze({ kind: 'visitor' });
}

export function principalActor(kind: 'customer' | 'manager', principalId: PrincipalId): Actor {
  return Object.freeze({ kind, principalId });
}

export function trustedActor(kind: 'operator' | 'provider_webhook' | 'system_job'): Actor {
  return Object.freeze({ kind });
}

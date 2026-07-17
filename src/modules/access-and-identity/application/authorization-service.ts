import {
  err,
  ok,
  type CustomerId,
  type ResolvedActorContext,
  type Result,
} from '../../../shared/kernel';

export type AuthorizationDenialCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTH_ASSURANCE_REQUIRED'
  | 'FORBIDDEN'
  | 'INVALID_STATE_TRANSITION'
  | 'RESOURCE_NOT_FOUND';

export type AuthorizationDenial = Readonly<{
  code: AuthorizationDenialCode;
}>;

export type AuthorizationPolicy = Readonly<{
  action: string;
  allowedActorKinds: readonly ResolvedActorContext['actor']['kind'][];
  allowedFields: Readonly<
    Partial<Record<ResolvedActorContext['actor']['kind'], readonly string[]>>
  >;
  allowedStates?: readonly string[];
  customerOwnership: 'NOT_APPLICABLE' | 'OWN_CUSTOMER_REQUIRED';
  managerAssurance: 'MFA' | 'PASSWORD' | 'NOT_APPLICABLE';
}>;

export type AuthorizationRequest = Readonly<{
  actorContext: ResolvedActorContext;
  ownerCustomerId?: CustomerId;
  requestedFields: readonly string[];
  resourceExists: boolean;
  resourceState?: string;
}>;

export type AuthorizationGrant = Readonly<{
  action: string;
  allowedFields: readonly string[];
}>;

function assurancePermits(
  context: ResolvedActorContext,
  requirement: AuthorizationPolicy['managerAssurance'],
): boolean {
  if (requirement === 'NOT_APPLICABLE') return true;
  if (context.actor.kind !== 'manager') return true;
  return requirement === 'MFA'
    ? context.assurance === 'manager_mfa'
    : context.assurance === 'manager_password' || context.assurance === 'manager_mfa';
}

export class AuthorizationService {
  authorize(
    policy: AuthorizationPolicy,
    request: AuthorizationRequest,
  ): Result<AuthorizationGrant, AuthorizationDenial> {
    const actorKind = request.actorContext.actor.kind;
    if (actorKind === 'visitor') return err({ code: 'AUTHENTICATION_REQUIRED' });

    if (!request.resourceExists) return err({ code: 'RESOURCE_NOT_FOUND' });

    if (
      policy.customerOwnership === 'OWN_CUSTOMER_REQUIRED' &&
      request.actorContext.actor.kind === 'customer'
    ) {
      if (!('customerId' in request.actorContext)) return err({ code: 'FORBIDDEN' });
      const customerContext = request.actorContext;
      if (!request.ownerCustomerId || request.ownerCustomerId !== customerContext.customerId) {
        return err({ code: 'RESOURCE_NOT_FOUND' });
      }
    }

    if (!policy.allowedActorKinds.includes(actorKind)) return err({ code: 'FORBIDDEN' });

    if (!assurancePermits(request.actorContext, policy.managerAssurance)) {
      return err({ code: 'AUTH_ASSURANCE_REQUIRED' });
    }

    if (
      policy.allowedStates &&
      (!request.resourceState || !policy.allowedStates.includes(request.resourceState))
    ) {
      return err({ code: 'INVALID_STATE_TRANSITION' });
    }

    const allowed = policy.allowedFields[actorKind] ?? [];
    const requested = new Set(request.requestedFields);
    const fields = allowed.filter((field) => requested.has(field));
    return ok(Object.freeze({ action: policy.action, allowedFields: Object.freeze(fields) }));
  }

  filterFields<Value extends Readonly<Record<string, unknown>>>(
    value: Value,
    grant: AuthorizationGrant,
  ): Readonly<Partial<Value>> {
    const allowed = new Set(grant.allowedFields);
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).filter(([field]) => allowed.has(field)),
      ) as Partial<Value>,
    );
  }
}

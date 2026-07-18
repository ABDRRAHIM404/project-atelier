import type { WebhookEvent } from '@clerk/backend/webhooks';
import { describe, expect, it, vi } from 'vitest';

import {
  ActorContextResolver,
  AuthorizationService,
  CurrentIdentityResolver,
  reauthenticationSatisfiesPolicy,
  type IdentityRepository,
  type LocalIdentity,
  type ProviderUserDirectory,
  type VerifiedProviderSession,
} from '../../src/modules/access-and-identity';
import {
  ClerkSessionAuthenticator,
  ClerkUserDirectory,
  createClerkAdapters,
} from '../../src/modules/access-and-identity/infrastructure/clerk/clerk-adapter';
import { ClerkWebhookVerifier } from '../../src/modules/access-and-identity/infrastructure/clerk/clerk-webhook-verifier';
import { GetCurrentIdentityHandler } from '../../src/modules/access-and-identity/presentation/http/get-current-identity-handler';
import { err, ok, parseIdentifier, type Identifier } from '../../src/shared/kernel';

function identifier<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Test identifier is invalid.');
  return parsed.value;
}

const ids = Object.freeze({
  correlation: identifier<'Correlation'>('10000000-0000-4000-8000-000000000001'),
  customer: identifier<'Customer'>('20000000-0000-4000-8000-000000000001'),
  customerOther: identifier<'Customer'>('20000000-0000-4000-8000-000000000002'),
  customerPrincipal: identifier<'Principal'>('30000000-0000-4000-8000-000000000001'),
  manager: identifier<'Manager'>('40000000-0000-4000-8000-000000000001'),
  managerPrincipal: identifier<'Principal'>('50000000-0000-4000-8000-000000000001'),
});

const customerIdentity = Object.freeze({
  accessStatus: 'ACTIVE',
  actorType: 'CUSTOMER',
  customerId: ids.customer,
  principalId: ids.customerPrincipal,
}) satisfies LocalIdentity;

const managerIdentity = Object.freeze({
  accessStatus: 'ACTIVE',
  actorType: 'MANAGER',
  managerActive: true,
  managerId: ids.manager,
  principalId: ids.managerPrincipal,
}) satisfies LocalIdentity;

function session(
  factors: Readonly<{ first?: number | null; second?: number | null }> = {},
): VerifiedProviderSession {
  return Object.freeze({
    firstFactorAgeMinutes: factors.first === undefined ? 0 : factors.first,
    provider: 'clerk',
    secondFactorAgeMinutes: factors.second === undefined ? null : factors.second,
    sessionId: 'sess_test' as VerifiedProviderSession['sessionId'],
    subject: 'user_test' as VerifiedProviderSession['subject'],
  });
}

function identityRepository(identity: LocalIdentity | null): IdentityRepository {
  return {
    findByProviderSubject: vi.fn(async () => ok(identity)),
    getProfile: vi.fn(async (resolved) =>
      resolved.actorType === 'CUSTOMER'
        ? ok(
            Object.freeze({
              accessStatus: resolved.accessStatus,
              actorType: 'CUSTOMER' as const,
              contactEmail: 'customer@example.invalid',
              customerId: resolved.customerId,
              preferredLocale: 'ar' as const,
              principalId: resolved.principalId,
              recordVersion: 1,
              verifiedEmail: 'customer@example.invalid',
            }),
          )
        : ok(
            Object.freeze({
              accessStatus: resolved.accessStatus,
              actorType: 'MANAGER' as const,
              managerId: resolved.managerId,
              principalId: resolved.principalId,
              recordVersion: 1,
            }),
          ),
    ),
    provisionCustomer: vi.fn(async () => ok(customerIdentity)),
  };
}

const providerUsers: ProviderUserDirectory = {
  getUser: vi.fn(async (subject) =>
    ok(Object.freeze({ subject, verifiedPrimaryEmail: 'customer@example.invalid' })),
  ),
};

describe('Clerk provider-neutral session boundary', () => {
  it('maps only verified non-impersonated Clerk evidence into provider-neutral factors', async () => {
    const authenticator = new ClerkSessionAuthenticator(
      vi.fn(async () =>
        ok({
          actor: null,
          factorVerificationAge: [2, 0] as const,
          sessionId: 'sess_test',
          userId: 'user_test',
        }),
      ),
    );
    const result = await authenticator.authenticate(new Request('https://atelier.invalid/me'));

    expect(result).toEqual({
      ok: true,
      value: {
        firstFactorAgeMinutes: 2,
        provider: 'clerk',
        secondFactorAgeMinutes: 0,
        sessionId: 'sess_test',
        subject: 'user_test',
      },
    });
  });

  it.each([
    {
      actor: { sub: 'operator' },
      factorVerificationAge: [0, 0] as const,
      sessionId: 's',
      userId: 'u',
    },
    { actor: null, factorVerificationAge: [-2, 0] as const, sessionId: 's', userId: 'u' },
    { actor: null, factorVerificationAge: [0, 0] as const, sessionId: null, userId: 'u' },
  ])('fails closed for malformed or impersonated session evidence', async (evidence) => {
    const authenticator = new ClerkSessionAuthenticator(vi.fn(async () => ok(evidence)));
    expect(await authenticator.authenticate(new Request('https://atelier.invalid/me'))).toEqual({
      error: { code: 'SESSION_INVALID' },
      ok: false,
    });
  });

  it('does not convert provider outages into an authenticated session', async () => {
    const authenticator = new ClerkSessionAuthenticator(
      vi.fn(async () => err({ code: 'IDENTITY_SERVICE_UNAVAILABLE' as const })),
    );
    expect(await authenticator.authenticate(new Request('https://atelier.invalid/me'))).toEqual({
      error: { code: 'IDENTITY_SERVICE_UNAVAILABLE' },
      ok: false,
    });
  });

  it('accepts only the matching verified primary email for Customer provisioning', async () => {
    const verified = new ClerkUserDirectory(
      vi.fn(async () =>
        ok({
          primaryEmail: 'verified@example.invalid',
          primaryEmailVerified: true,
          subject: 'user_test',
        }),
      ),
    );
    const unverified = new ClerkUserDirectory(
      vi.fn(async () =>
        ok({
          primaryEmail: 'unverified@example.invalid',
          primaryEmailVerified: false,
          subject: 'user_test',
        }),
      ),
    );

    expect(await verified.getUser('user_test')).toMatchObject({
      ok: true,
      value: { verifiedPrimaryEmail: 'verified@example.invalid' },
    });
    expect(await unverified.getUser('user_test')).toMatchObject({
      ok: true,
      value: { verifiedPrimaryEmail: null },
    });
  });

  it('requires authorized parties and server credentials before creating the Clerk adapter', () => {
    expect(() =>
      createClerkAdapters({
        authorizedParties: [],
        publishableKey: 'pk_test_fixture',
        secretKey: 'sk_test_fixture',
      }),
    ).toThrow('Clerk adapter configuration is incomplete.');
  });
});

describe('local identity and assurance resolution', () => {
  it('provisions only a verified Customer and resolves customer OTP assurance', async () => {
    const repository = identityRepository(null);
    const resolver = new ActorContextResolver(repository, providerUsers);

    expect(await resolver.resolve(session(), ids.correlation)).toEqual({
      ok: true,
      value: {
        actor: { kind: 'customer', principalId: ids.customerPrincipal },
        assurance: 'customer_otp',
        customerId: ids.customer,
      },
    });
    expect(repository.provisionCustomer).toHaveBeenCalledWith({
      correlationId: ids.correlation,
      provider: 'clerk',
      subject: 'user_test',
      verifiedEmail: 'customer@example.invalid',
    });
  });

  it('never provisions an unmapped identity without a verified provider email', async () => {
    const repository = identityRepository(null);
    const resolver = new ActorContextResolver(repository, {
      getUser: vi.fn(async (subject) => ok({ subject, verifiedPrimaryEmail: null })),
    });
    expect(await resolver.resolve(session(), ids.correlation)).toEqual({
      error: { code: 'UNMAPPED_IDENTITY' },
      ok: false,
    });
    expect(repository.provisionCustomer).not.toHaveBeenCalled();
  });

  it('requires an active local Manager and grants manager assurance', async () => {
    const resolver = new ActorContextResolver(identityRepository(managerIdentity), providerUsers);

    expect(await resolver.resolve(session({ second: null }), ids.correlation)).toMatchObject({
      ok: true,
      value: { assurance: 'manager_mfa' },
    });
    expect(await resolver.resolve(session({ second: 0 }), ids.correlation)).toMatchObject({
      ok: true,
      value: { assurance: 'manager_mfa' },
    });
  });

  it.each([
    {
      identity: { ...customerIdentity, accessStatus: 'DISABLED' as const },
      code: 'ACCOUNT_DISABLED',
    },
    { identity: { ...managerIdentity, managerActive: false }, code: 'MANAGER_INACTIVE' },
  ])('fails closed for disabled or inactive local identities', async ({ code, identity }) => {
    const resolver = new ActorContextResolver(identityRepository(identity), providerUsers);
    expect(await resolver.resolve(session({ second: 0 }), ids.correlation)).toEqual({
      error: { code },
      ok: false,
    });
  });

  it('uses an injected CFG-006 reauthentication window without assuming a duration', () => {
    const configuredPolicy = {
      firstFactorMaximumAgeMinutes: 5,
      secondFactorMaximumAgeMinutes: 2,
    };
    expect(
      reauthenticationSatisfiesPolicy(session({ first: 5, second: 2 }), configuredPolicy),
    ).toBe(true);
    expect(
      reauthenticationSatisfiesPolicy(session({ first: 6, second: 2 }), configuredPolicy),
    ).toBe(false);
  });
});

describe('actor-scoped authorization and field minimization', () => {
  const service = new AuthorizationService();
  const policy = Object.freeze({
    action: 'READ_CUSTOMER_RESOURCE',
    allowedActorKinds: ['customer', 'manager'] as const,
    allowedFields: {
      customer: ['id', 'state', 'customerNote'],
      manager: ['id', 'state', 'internalNote'],
    },
    allowedStates: ['ACTIVE'],
    customerOwnership: 'OWN_CUSTOMER_REQUIRED' as const,
    managerAssurance: 'MFA' as const,
  });
  const customerContext = Object.freeze({
    actor: Object.freeze({ kind: 'customer' as const, principalId: ids.customerPrincipal }),
    assurance: 'customer_otp' as const,
    customerId: ids.customer,
  });
  const managerContext = Object.freeze({
    actor: Object.freeze({ kind: 'manager' as const, principalId: ids.managerPrincipal }),
    assurance: 'manager_mfa' as const,
  });

  it('grants only allowed fields to the owning Customer', () => {
    const result = service.authorize(policy, {
      actorContext: customerContext,
      ownerCustomerId: ids.customer,
      requestedFields: ['id', 'state', 'internalNote'],
      resourceExists: true,
      resourceState: 'ACTIVE',
    });
    expect(result).toEqual({
      ok: true,
      value: { action: 'READ_CUSTOMER_RESOURCE', allowedFields: ['id', 'state'] },
    });
    if (result.ok) {
      expect(
        service.filterFields(
          { id: 'resource', internalNote: 'restricted', state: 'ACTIVE' },
          result.value,
        ),
      ).toEqual({ id: 'resource', state: 'ACTIVE' });
    }
  });

  it('uses non-disclosing not-found for cross-Customer access', () => {
    expect(
      service.authorize(policy, {
        actorContext: customerContext,
        ownerCustomerId: ids.customerOther,
        requestedFields: ['id'],
        resourceExists: true,
        resourceState: 'ACTIVE',
      }),
    ).toEqual({ error: { code: 'RESOURCE_NOT_FOUND' }, ok: false });
  });

  it('rejects Manager password-only assurance and invalid lifecycle state', () => {
    const passwordContext = {
      ...managerContext,
      assurance: 'manager_password' as const,
    };
    expect(
      service.authorize(policy, {
        actorContext: passwordContext,
        requestedFields: ['id'],
        resourceExists: true,
        resourceState: 'ACTIVE',
      }),
    ).toEqual({ error: { code: 'AUTH_ASSURANCE_REQUIRED' }, ok: false });
    expect(
      service.authorize(policy, {
        actorContext: managerContext,
        requestedFields: ['id'],
        resourceExists: true,
        resourceState: 'CLOSED',
      }),
    ).toEqual({ error: { code: 'INVALID_STATE_TRANSITION' }, ok: false });
  });
});

describe('Clerk webhook verification boundary', () => {
  const userEvent = {
    data: {
      banned: false,
      created_at: Date.parse('2026-07-16T12:00:00.000Z'),
      email_addresses: [
        {
          email_address: 'customer@example.invalid',
          id: 'email_primary',
          verification: { status: 'verified' },
        },
      ],
      id: 'user_test',
      locked: false,
      primary_email_address_id: 'email_primary',
      public_metadata: { role: 'manager' },
      unsafe_metadata: { role: 'manager' },
      updated_at: Date.parse('2026-07-16T12:00:00.000Z'),
    },
    object: 'event',
    type: 'user.created',
  } as unknown as WebhookEvent;

  it('maps only signed identity facts and ignores provider role metadata', async () => {
    const verifier = new ClerkWebhookVerifier(
      'whsec_test',
      vi.fn(async () => userEvent),
    );
    const result = await verifier.verify(
      new Request('https://atelier.invalid/api/v1/webhooks/clerk', {
        body: '{"safe":"fixture"}',
        headers: { 'svix-id': 'evt_test', 'svix-timestamp': '1784203200' },
        method: 'POST',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        eventId: 'evt_test',
        eventType: 'USER_CREATED',
        provider: 'clerk',
        subject: 'user_test',
        user: { accessRestricted: false, verifiedPrimaryEmail: 'customer@example.invalid' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('manager');
  });

  it('rejects forged signatures before returning an event', async () => {
    const verifier = new ClerkWebhookVerifier(
      'whsec_test',
      vi.fn(async () => {
        throw new Error('signature invalid');
      }),
    );
    expect(
      await verifier.verify(
        new Request('https://atelier.invalid/api/v1/webhooks/clerk', {
          body: '{}',
          headers: { 'svix-id': 'evt_forged' },
          method: 'POST',
        }),
      ),
    ).toEqual({ error: { code: 'INVALID_SIGNATURE' }, ok: false });
  });
});

describe('GET /api/v1/me HTTP contract', () => {
  it('returns an actor-safe no-store Customer representation', async () => {
    const current = new CurrentIdentityResolver(
      identityRepository(customerIdentity),
      providerUsers,
    );
    const handler = new GetCurrentIdentityHandler(
      { authenticate: vi.fn(async () => ok(session())) },
      current,
    );
    const response = await handler.handle(new Request('https://atelier.invalid/api/v1/me'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body).toMatchObject({
      assurance: 'customer_otp',
      customer: { id: ids.customer, preferredLocale: 'ar' },
      principalType: 'CUSTOMER',
      type: 'current-identity',
    });
    expect(JSON.stringify(body)).not.toContain('user_test');
  });

  it('returns an accessible stable problem for an unauthenticated request', async () => {
    const handler = new GetCurrentIdentityHandler(
      { authenticate: vi.fn(async () => err({ code: 'AUTHENTICATION_REQUIRED' as const })) },
      new CurrentIdentityResolver(identityRepository(customerIdentity), providerUsers),
    );
    const response = await handler.handle(new Request('https://atelier.invalid/api/v1/me'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect(body.title).toBeTruthy();
    expect(body.detail).toBeTruthy();
  });

  it('distinguishes an invalid credential from a missing session without disclosing details', async () => {
    const handler = new GetCurrentIdentityHandler(
      { authenticate: vi.fn(async () => err({ code: 'SESSION_INVALID' as const })) },
      new CurrentIdentityResolver(identityRepository(customerIdentity), providerUsers),
    );
    const response = await handler.handle(new Request('https://atelier.invalid/api/v1/me'));
    expect(await response.json()).toMatchObject({ code: 'SESSION_INVALID', status: 401 });
  });
});

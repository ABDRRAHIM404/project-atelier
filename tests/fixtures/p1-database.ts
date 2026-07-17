import type { ClientBase } from 'pg';

import {
  parseIdentifier,
  type Identifier,
  type ResolvedActorContext,
} from '../../src/shared/kernel';

function identifier<Entity extends string>(value: string): Identifier<Entity> {
  const result = parseIdentifier<Entity>(value);
  if (!result.ok) throw new Error('P1 fixture contains an invalid UUID.');
  return result.value;
}

export const p1FixtureIds = Object.freeze({
  customerA: identifier<'Customer'>('10000000-0000-4000-8000-000000000001'),
  customerAPrincipal: identifier<'Principal'>('20000000-0000-4000-8000-000000000001'),
  customerB: identifier<'Customer'>('10000000-0000-4000-8000-000000000002'),
  customerBPrincipal: identifier<'Principal'>('20000000-0000-4000-8000-000000000002'),
  manager: identifier<'Manager'>('30000000-0000-4000-8000-000000000001'),
  managerPrincipal: identifier<'Principal'>('40000000-0000-4000-8000-000000000001'),
});

export const p1ActorContexts = Object.freeze({
  customerA: Object.freeze({
    actor: Object.freeze({ kind: 'customer', principalId: p1FixtureIds.customerAPrincipal }),
    assurance: 'customer_otp',
    customerId: p1FixtureIds.customerA,
  }) satisfies ResolvedActorContext,
  customerB: Object.freeze({
    actor: Object.freeze({ kind: 'customer', principalId: p1FixtureIds.customerBPrincipal }),
    assurance: 'customer_otp',
    customerId: p1FixtureIds.customerB,
  }) satisfies ResolvedActorContext,
  managerMfa: Object.freeze({
    actor: Object.freeze({ kind: 'manager', principalId: p1FixtureIds.managerPrincipal }),
    assurance: 'manager_mfa',
  }) satisfies ResolvedActorContext,
  managerPassword: Object.freeze({
    actor: Object.freeze({ kind: 'manager', principalId: p1FixtureIds.managerPrincipal }),
    assurance: 'manager_password',
  }) satisfies ResolvedActorContext,
  operator: Object.freeze({
    actor: Object.freeze({ kind: 'operator' }),
    assurance: 'operator',
  }) satisfies ResolvedActorContext,
  providerWebhook: Object.freeze({
    actor: Object.freeze({ kind: 'provider_webhook' }),
    assurance: 'provider_signature',
  }) satisfies ResolvedActorContext,
  systemJob: Object.freeze({
    actor: Object.freeze({ kind: 'system_job' }),
    assurance: 'system_job',
  }) satisfies ResolvedActorContext,
  visitor: Object.freeze({
    actor: Object.freeze({ kind: 'visitor' }),
    assurance: 'anonymous',
  }) satisfies ResolvedActorContext,
});

export async function seedP1IdentityFixtures(client: ClientBase): Promise<void> {
  const ids = p1FixtureIds;
  await client.query(
    `insert into iam.principals (id, actor_type)
     values ($1, 'CUSTOMER'), ($2, 'CUSTOMER'), ($3, 'MANAGER')`,
    [ids.customerAPrincipal, ids.customerBPrincipal, ids.managerPrincipal],
  );
  await client.query(
    `insert into iam.customers (id, principal_id, verified_email_snapshot, preferred_locale)
     values
       ($1, $2, 'customer-a@example.invalid', 'ar'),
       ($3, $4, 'customer-b@example.invalid', 'ar')`,
    [ids.customerA, ids.customerAPrincipal, ids.customerB, ids.customerBPrincipal],
  );
  await client.query(
    `insert into iam.managers
       (id, principal_id, bootstrap_reason_code, changed_by_principal_id)
     values ($1, $2, 'TEST_FIXTURE_BOOTSTRAP', $2)`,
    [ids.manager, ids.managerPrincipal],
  );
}

import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ActorContextResolver,
  type ProviderUserDirectory,
  type VerifiedProviderSession,
} from '../../src/modules/access-and-identity';
import { PostgresIdentityRepository } from '../../src/modules/access-and-identity/infrastructure/postgres/identity-repository';
import { createDatabasePool } from '../../src/platform/database';
import { parseIdentifier, type Identifier } from '../../src/shared/kernel';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

function identifier<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Test identifier is invalid.');
  return parsed.value;
}

function providerSession(subject: string): VerifiedProviderSession {
  return Object.freeze({
    firstFactorAgeMinutes: 0,
    provider: 'clerk',
    secondFactorAgeMinutes: null,
    sessionId: 'sess_postgres_test' as VerifiedProviderSession['sessionId'],
    subject: subject as VerifiedProviderSession['subject'],
  });
}

describe('P1 exact-subject identity resolution and Customer provisioning', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  let repository: PostgresIdentityRepository;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('identity_resolution');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    await owner.query(
      `insert into iam.external_identities
         (provider, provider_subject, principal_id, verified_email_snapshot)
       values
         ('clerk', 'user_customer_a', $1, 'customer-a@example.invalid'),
         ('clerk', 'user_manager', $2, 'manager@example.invalid')`,
      [p1FixtureIds.customerAPrincipal, p1FixtureIds.managerPrincipal],
    );
    pool = createDatabasePool({
      applicationName: 'atelier-identity-resolution-test',
      connectionString: database.connectionString,
    });
    repository = new PostgresIdentityRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('resolves only one exact active provider subject without granting table access', async () => {
    const customer = await repository.findByProviderSubject(providerSession('user_customer_a'));
    const manager = await repository.findByProviderSubject(providerSession('user_manager'));
    const unknown = await repository.findByProviderSubject(providerSession('user_unknown'));

    expect(customer).toEqual({
      ok: true,
      value: {
        accessStatus: 'ACTIVE',
        actorType: 'CUSTOMER',
        customerId: p1FixtureIds.customerA,
        principalId: p1FixtureIds.customerAPrincipal,
      },
    });
    expect(manager).toMatchObject({
      ok: true,
      value: {
        actorType: 'MANAGER',
        managerActive: true,
        managerId: p1FixtureIds.manager,
        principalId: p1FixtureIds.managerPrincipal,
      },
    });
    expect(unknown).toEqual({ ok: true, value: null });

    const tablePrivileges = await owner.query<{ privileges: number }>(
      `select count(*)::integer as privileges
       from information_schema.role_table_grants
       where grantee = 'atelier_identity_resolver' and table_schema = 'iam'`,
    );
    expect(tablePrivileges.rows[0]?.privileges).toBe(0);
  });

  it('provisions one Customer idempotently under concurrency and never a Manager', async () => {
    const correlationId = identifier<'Correlation'>('60000000-0000-4000-8000-000000000001');
    const input = {
      correlationId,
      provider: 'clerk' as const,
      subject: 'user_new_customer' as VerifiedProviderSession['subject'],
      verifiedEmail: 'new-customer@example.invalid',
    };
    const results = await Promise.all([
      repository.provisionCustomer(input),
      repository.provisionCustomer(input),
      repository.provisionCustomer(input),
    ]);

    expect(results.every((result) => result.ok && result.value.actorType === 'CUSTOMER')).toBe(
      true,
    );
    expect(
      new Set(results.flatMap((result) => (result.ok ? [result.value.principalId] : []))).size,
    ).toBe(1);
    const counts = await owner.query<{
      audit_count: number;
      customer_count: number;
      identity_count: number;
      manager_count: number;
    }>(
      `select
         (select count(*)::integer from iam.external_identities
          where provider_subject = 'user_new_customer') as identity_count,
         (select count(*)::integer from iam.customers c join iam.external_identities e
          on e.principal_id = c.principal_id
          where e.provider_subject = 'user_new_customer') as customer_count,
         (select count(*)::integer from iam.managers m join iam.external_identities e
          on e.principal_id = m.principal_id
          where e.provider_subject = 'user_new_customer') as manager_count,
         (select count(*)::integer from audit.events
          where event_type = 'IDENTITY_PROVISIONED' and correlation_id = $1) as audit_count`,
      [correlationId],
    );
    expect(counts.rows[0]).toEqual({
      audit_count: 1,
      customer_count: 1,
      identity_count: 1,
      manager_count: 0,
    });
  });

  it('returns only the actor-safe own profile through forced RLS', async () => {
    const customer = await repository.findByProviderSubject(providerSession('user_customer_a'));
    const manager = await repository.findByProviderSubject(providerSession('user_manager'));
    if (!customer.ok || !customer.value || !manager.ok || !manager.value) {
      throw new Error('Identity fixture resolution failed.');
    }

    expect(await repository.getProfile(customer.value, p1ActorContexts.customerA)).toMatchObject({
      ok: true,
      value: {
        actorType: 'CUSTOMER',
        customerId: p1FixtureIds.customerA,
        preferredLocale: 'ar',
      },
    });
    expect(await repository.getProfile(manager.value, p1ActorContexts.managerMfa)).toMatchObject({
      ok: true,
      value: { actorType: 'MANAGER', managerId: p1FixtureIds.manager },
    });
    expect(await repository.getProfile(customer.value, p1ActorContexts.managerMfa)).toEqual({
      error: { code: 'SESSION_INVALID' },
      ok: false,
    });
  });

  it('fails closed after the local principal is disabled', async () => {
    await owner.query(
      `update iam.principals
       set access_status = 'DISABLED', disabled_at = clock_timestamp(),
           disabled_reason_code = 'TEST_DISABLED'
       where id = $1`,
      [p1FixtureIds.customerAPrincipal],
    );
    const providerUsers: ProviderUserDirectory = {
      getUser: async (subject) => ({
        ok: true,
        value: { subject, verifiedPrimaryEmail: 'customer-a@example.invalid' },
      }),
    };
    const resolver = new ActorContextResolver(repository, providerUsers);
    expect(
      await resolver.resolve(
        providerSession('user_customer_a'),
        identifier<'Correlation'>('60000000-0000-4000-8000-000000000002'),
      ),
    ).toEqual({ error: { code: 'ACCOUNT_DISABLED' }, ok: false });
  });
});

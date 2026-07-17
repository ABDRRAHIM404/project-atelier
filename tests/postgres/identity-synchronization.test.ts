import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  IdentitySynchronizationEvent,
  ProviderEventId,
  ProviderSubject,
} from '../../src/modules/access-and-identity/domain/identity';
import { PostgresIdentitySynchronizationRepository } from '../../src/modules/access-and-identity/infrastructure/postgres/identity-repository';
import { createDatabasePool } from '../../src/platform/database';
import {
  parseIdentifier,
  parseUtcInstant,
  type Identifier,
  type UtcInstant,
} from '../../src/shared/kernel';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

function identifier<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Test identifier is invalid.');
  return parsed.value;
}

function instant(value: string): UtcInstant {
  const parsed = parseUtcInstant(value);
  if (!parsed.ok) throw new Error('Test instant is invalid.');
  return parsed.value;
}

const correlationId = identifier<'Correlation'>('70000000-0000-4000-8000-000000000001');

function event(
  overrides: Partial<IdentitySynchronizationEvent> = {},
): IdentitySynchronizationEvent {
  return Object.freeze({
    eventId: 'evt_identity_1' as ProviderEventId,
    eventType: 'USER_CREATED',
    payloadDigest: 'a'.repeat(64),
    provider: 'clerk',
    providerOccurredAt: instant('2026-07-16T12:00:00.000Z'),
    subject: 'user_sync_customer' as ProviderSubject,
    user: Object.freeze({
      accessRestricted: false,
      verifiedPrimaryEmail: 'sync-customer@example.invalid',
    }),
    ...overrides,
  });
}

describe('P1 signed identity synchronization persistence', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  let repository: PostgresIdentitySynchronizationRepository;
  const persistenceFailures: unknown[] = [];

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('identity_synchronization');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    pool = createDatabasePool({
      applicationName: 'atelier-identity-sync-test',
      connectionString: database.connectionString,
    });
    repository = new PostgresIdentitySynchronizationRepository(pool, (error) => {
      persistenceFailures.push(error);
    });
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('provisions a Customer atomically and ignores all untrusted role metadata by contract', async () => {
    const result = await repository.synchronize(event(), correlationId);
    expect(persistenceFailures).toEqual([]);
    expect(result).toEqual({
      ok: true,
      value: 'APPLIED',
    });
    const state = await owner.query<{
      audit_count: number;
      customer_count: number;
      event_count: number;
      manager_count: number;
      process_state: string;
    }>(
      `select
         (select count(*)::integer from iam.customers c join iam.external_identities e
          on e.principal_id = c.principal_id where e.provider_subject = 'user_sync_customer')
           as customer_count,
         (select count(*)::integer from iam.managers m join iam.external_identities e
          on e.principal_id = m.principal_id where e.provider_subject = 'user_sync_customer')
           as manager_count,
         (select count(*)::integer from audit.events where event_type = 'IDENTITY_SYNCHRONIZED')
           as audit_count,
         (select count(*)::integer from ops.inbound_provider_events
          where provider_event_id = 'evt_identity_1') as event_count,
         (select process_state from ops.inbound_provider_events
          where provider_event_id = 'evt_identity_1') as process_state`,
    );
    expect(state.rows[0]).toEqual({
      audit_count: 1,
      customer_count: 1,
      event_count: 1,
      manager_count: 0,
      process_state: 'PROCESSED',
    });
  });

  it('deduplicates the same provider event and a different ID with the same semantic version', async () => {
    expect(await repository.synchronize(event(), correlationId)).toEqual({
      ok: true,
      value: 'DUPLICATE',
    });
    expect(
      await repository.synchronize(
        event({ eventId: 'evt_identity_semantic_duplicate' as ProviderEventId }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'DUPLICATE' });
    const counts = await owner.query<{ audit_count: number; event_count: number }>(
      `select
         (select count(*)::integer from audit.events where event_type = 'IDENTITY_SYNCHRONIZED')
           as audit_count,
         (select count(*)::integer from ops.inbound_provider_events
          where semantic_key like 'identity:%') as event_count`,
    );
    expect(counts.rows[0]).toEqual({ audit_count: 1, event_count: 1 });
  });

  it('rejects one event ID reused with a different digest', async () => {
    expect(
      await repository.synchronize(event({ payloadDigest: 'b'.repeat(64) }), correlationId),
    ).toEqual({ error: { code: 'PROVIDER_EVENT_CONFLICT' }, ok: false });
  });

  it('ignores a reordered event older than the latest processed provider version', async () => {
    const newerResult = await repository.synchronize(
      event({
        eventId: 'evt_identity_newer' as ProviderEventId,
        eventType: 'USER_UPDATED',
        payloadDigest: 'c'.repeat(64),
        providerOccurredAt: instant('2026-07-16T13:00:00.000Z'),
      }),
      correlationId,
    );
    expect(persistenceFailures).toEqual([]);
    expect(newerResult).toEqual({ ok: true, value: 'APPLIED' });
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_identity_older' as ProviderEventId,
          eventType: 'USER_UPDATED',
          payloadDigest: 'd'.repeat(64),
          providerOccurredAt: instant('2026-07-16T12:30:00.000Z'),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'IGNORED_STALE' });
  });

  it('does not provision a Customer without a verified primary email', async () => {
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_unverified' as ProviderEventId,
          payloadDigest: 'e'.repeat(64),
          providerOccurredAt: instant('2026-07-16T14:00:00.000Z'),
          subject: 'user_unverified' as ProviderSubject,
          user: Object.freeze({ accessRestricted: false, verifiedPrimaryEmail: null }),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'IGNORED_UNVERIFIED_EMAIL' });
    const count = await owner.query<{ count: number }>(
      `select count(*)::integer as count from iam.external_identities
       where provider_subject = 'user_unverified'`,
    );
    expect(count.rows[0]?.count).toBe(0);
  });

  it('does not provision an already restricted provider identity', async () => {
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_restricted_unmapped' as ProviderEventId,
          payloadDigest: '8'.repeat(64),
          providerOccurredAt: instant('2026-07-16T14:15:00.000Z'),
          subject: 'user_restricted_unmapped' as ProviderSubject,
          user: Object.freeze({
            accessRestricted: true,
            verifiedPrimaryEmail: 'restricted-unmapped@example.invalid',
          }),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'IGNORED_RESTRICTED_IDENTITY' });
    const count = await owner.query<{ count: number }>(
      `select count(*)::integer as count from iam.external_identities
       where provider_subject = 'user_restricted_unmapped'`,
    );
    expect(count.rows[0]?.count).toBe(0);
  });

  it('never mutates or creates Manager authority from a provider event', async () => {
    const principalId = identifier<'Principal'>('80000000-0000-4000-8000-000000000001');
    const managerId = identifier<'Manager'>('90000000-0000-4000-8000-000000000001');
    await owner.query(`insert into iam.principals (id, actor_type) values ($1, 'MANAGER')`, [
      principalId,
    ]);
    await owner.query(
      `insert into iam.managers
         (id, principal_id, bootstrap_reason_code, changed_by_principal_id)
       values ($1, $2, 'TEST_OPERATOR_BOOTSTRAP', $2)`,
      [managerId, principalId],
    );
    await owner.query(
      `insert into iam.external_identities
         (provider, provider_subject, principal_id, verified_email_snapshot)
       values ('clerk', 'user_existing_manager', $1, 'manager-before@example.invalid')`,
      [principalId],
    );

    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_manager_update' as ProviderEventId,
          eventType: 'USER_UPDATED',
          payloadDigest: '9'.repeat(64),
          providerOccurredAt: instant('2026-07-16T14:30:00.000Z'),
          subject: 'user_existing_manager' as ProviderSubject,
          user: Object.freeze({
            accessRestricted: true,
            verifiedPrimaryEmail: 'manager-provider-change@example.invalid',
          }),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'IGNORED_MANAGER_REQUIRES_OPERATOR' });

    const manager = await owner.query<{
      access_status: string;
      actor_type: string;
      audit_count: number;
      is_active: boolean;
      verified_email_snapshot: string;
    }>(
      `select p.actor_type, p.access_status, m.is_active, e.verified_email_snapshot,
              (select count(*)::integer from audit.events
               where event_type = 'MANAGER_IDENTITY_SYNC_DEFERRED') as audit_count
       from iam.principals p
       join iam.managers m on m.principal_id = p.id
       join iam.external_identities e on e.principal_id = p.id
       where p.id = $1`,
      [principalId],
    );
    expect(manager.rows[0]).toEqual({
      access_status: 'ACTIVE',
      actor_type: 'MANAGER',
      audit_count: 1,
      is_active: true,
      verified_email_snapshot: 'manager-before@example.invalid',
    });
  });

  it('disables access for a restricted provider identity and never silently re-enables it', async () => {
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_restricted' as ProviderEventId,
          eventType: 'USER_UPDATED',
          payloadDigest: 'f'.repeat(64),
          providerOccurredAt: instant('2026-07-16T15:00:00.000Z'),
          user: Object.freeze({
            accessRestricted: true,
            verifiedPrimaryEmail: 'sync-customer@example.invalid',
          }),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'APPLIED' });
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_unrestricted_later' as ProviderEventId,
          eventType: 'USER_UPDATED',
          payloadDigest: '1'.repeat(64),
          providerOccurredAt: instant('2026-07-16T16:00:00.000Z'),
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'APPLIED' });
    const principal = await owner.query<{ access_status: string; disabled_reason_code: string }>(
      `select p.access_status, p.disabled_reason_code
       from iam.principals p join iam.external_identities e on e.principal_id = p.id
       where e.provider_subject = 'user_sync_customer'`,
    );
    expect(principal.rows[0]).toEqual({
      access_status: 'DISABLED',
      disabled_reason_code: 'PROVIDER_RESTRICTED',
    });
  });

  it('preserves history while unlinking and disabling a deleted provider identity', async () => {
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_deleted' as ProviderEventId,
          eventType: 'USER_DELETED',
          payloadDigest: '2'.repeat(64),
          providerOccurredAt: instant('2026-07-16T17:00:00.000Z'),
          user: null,
        }),
        correlationId,
      ),
    ).toEqual({ ok: true, value: 'APPLIED' });
    const identity = await owner.query<{
      access_status: string;
      customer_count: number;
      link_status: string;
    }>(
      `select e.link_status, p.access_status,
              (select count(*)::integer from iam.customers c where c.principal_id = p.id)
                as customer_count
       from iam.external_identities e join iam.principals p on p.id = e.principal_id
       where e.provider_subject = 'user_sync_customer'`,
    );
    expect(identity.rows[0]).toEqual({
      access_status: 'DISABLED',
      customer_count: 1,
      link_status: 'UNLINKED',
    });
  });

  it('rolls back provider and identity effects when persistence validation fails', async () => {
    expect(
      await repository.synchronize(
        event({
          eventId: 'evt_invalid_digest' as ProviderEventId,
          payloadDigest: 'not-a-sha256',
          providerOccurredAt: instant('2026-07-16T18:00:00.000Z'),
          subject: 'user_rollback' as ProviderSubject,
          user: Object.freeze({
            accessRestricted: false,
            verifiedPrimaryEmail: 'rollback@example.invalid',
          }),
        }),
        correlationId,
      ),
    ).toEqual({ error: { code: 'IDENTITY_SERVICE_UNAVAILABLE' }, ok: false });
    const counts = await owner.query<{ event_count: number; identity_count: number }>(
      `select
         (select count(*)::integer from ops.inbound_provider_events
          where provider_event_id = 'evt_invalid_digest') as event_count,
         (select count(*)::integer from iam.external_identities
          where provider_subject = 'user_rollback') as identity_count`,
    );
    expect(counts.rows[0]).toEqual({ event_count: 0, identity_count: 0 });
  });
});

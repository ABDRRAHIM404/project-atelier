import { createHash, randomUUID } from 'node:crypto';

import type { Pool, QueryResultRow } from 'pg';

import {
  withActorTransaction,
  withIdentityResolutionTransaction,
} from '../../../../platform/database';
import {
  err,
  ok,
  parseIdentifier,
  type Identifier,
  type ResolvedActorContext,
  type Result,
} from '../../../../shared/kernel';
import type {
  IdentityProfile,
  IdentityResolutionFailure,
  IdentitySynchronizationEvent,
  IdentitySynchronizationResult,
  LocalIdentity,
  VerifiedProviderSession,
} from '../../domain/identity';
import type {
  IdentityRepository,
  IdentitySynchronizationRepository,
} from '../../ports/identity-repository';

type ResolutionRow = QueryResultRow & {
  access_status: 'ACTIVE' | 'DISABLED';
  actor_type: 'CUSTOMER' | 'MANAGER';
  customer_id: string | null;
  manager_active: boolean;
  manager_id: string | null;
  principal_id: string;
};

function parseResolution(row: ResolutionRow): LocalIdentity | null {
  const principal = parseIdentifier<'Principal'>(row.principal_id);
  if (!principal.ok) return null;

  if (row.actor_type === 'CUSTOMER' && row.customer_id) {
    const customer = parseIdentifier<'Customer'>(row.customer_id);
    return customer.ok
      ? Object.freeze({
          accessStatus: row.access_status,
          actorType: 'CUSTOMER',
          customerId: customer.value,
          principalId: principal.value,
        })
      : null;
  }

  if (row.actor_type === 'MANAGER' && row.manager_id) {
    const manager = parseIdentifier<'Manager'>(row.manager_id);
    return manager.ok
      ? Object.freeze({
          accessStatus: row.access_status,
          actorType: 'MANAGER',
          managerActive: row.manager_active,
          managerId: manager.value,
          principalId: principal.value,
        })
      : null;
  }

  return null;
}

function unavailable(): Result<never, IdentityResolutionFailure> {
  return err({ code: 'IDENTITY_SERVICE_UNAVAILABLE' });
}

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly pool: Pool) {}

  async findByProviderSubject(
    session: Pick<VerifiedProviderSession, 'provider' | 'subject'>,
  ): Promise<Result<LocalIdentity | null, IdentityResolutionFailure>> {
    try {
      return await withIdentityResolutionTransaction(this.pool, async (transaction) => {
        const result = await transaction.query<ResolutionRow>(
          'select * from iam.resolve_external_identity($1, $2)',
          [session.provider, session.subject],
        );
        if (!result.rows[0]) return ok(null);
        const identity = parseResolution(result.rows[0]);
        return identity ? ok(identity) : unavailable();
      });
    } catch {
      return unavailable();
    }
  }

  async provisionCustomer(
    input: Readonly<{
      correlationId: Identifier<'Correlation'>;
      provider: VerifiedProviderSession['provider'];
      subject: VerifiedProviderSession['subject'];
      verifiedEmail: string;
    }>,
  ): Promise<Result<LocalIdentity, IdentityResolutionFailure>> {
    try {
      return await withIdentityResolutionTransaction(this.pool, async (transaction) => {
        const result = await transaction.query<ResolutionRow>(
          'select * from iam.provision_customer_external_identity($1, $2, $3, $4)',
          [input.provider, input.subject, input.verifiedEmail, input.correlationId],
        );
        const row = result.rows[0];
        const identity = row ? parseResolution(row) : null;
        return identity?.actorType === 'CUSTOMER' ? ok(identity) : unavailable();
      });
    } catch {
      return unavailable();
    }
  }

  async getProfile(
    identity: LocalIdentity,
    context: ResolvedActorContext,
  ): Promise<Result<IdentityProfile, IdentityResolutionFailure>> {
    let contextMatchesIdentity: boolean;
    if (identity.actorType === 'CUSTOMER') {
      contextMatchesIdentity =
        context.actor.kind === 'customer' && 'customerId' in context
          ? context.actor.principalId === identity.principalId &&
            context.customerId === identity.customerId
          : false;
    } else {
      contextMatchesIdentity =
        context.actor.kind === 'manager' && context.actor.principalId === identity.principalId;
    }
    if (!contextMatchesIdentity) return err({ code: 'SESSION_INVALID' });

    try {
      return await withActorTransaction(this.pool, context, async (transaction) => {
        if (identity.actorType === 'CUSTOMER') {
          const result = await transaction.query<
            QueryResultRow & {
              access_status: 'ACTIVE' | 'DISABLED';
              contact_email: string | null;
              preferred_locale: 'ar' | 'en';
              record_version: number;
              verified_email_snapshot: string | null;
            }
          >(
            `select p.access_status, c.contact_email, c.preferred_locale, c.record_version,
                    c.verified_email_snapshot
             from iam.customers c join iam.principals p on p.id = c.principal_id
             where c.id = $1 and c.principal_id = $2`,
            [identity.customerId, identity.principalId],
          );
          const row = result.rows[0];
          return row
            ? ok(
                Object.freeze({
                  accessStatus: row.access_status,
                  actorType: 'CUSTOMER' as const,
                  contactEmail: row.contact_email,
                  customerId: identity.customerId,
                  preferredLocale: row.preferred_locale,
                  principalId: identity.principalId,
                  recordVersion: row.record_version,
                  verifiedEmail: row.verified_email_snapshot,
                }),
              )
            : err({ code: 'UNMAPPED_IDENTITY' });
        }

        const result = await transaction.query<QueryResultRow & { record_version: number }>(
          `select m.record_version
           from iam.managers m join iam.principals p on p.id = m.principal_id
           where m.id = $1 and m.principal_id = $2 and m.is_active`,
          [identity.managerId, identity.principalId],
        );
        const row = result.rows[0];
        return row
          ? ok(
              Object.freeze({
                accessStatus: identity.accessStatus,
                actorType: 'MANAGER' as const,
                managerId: identity.managerId,
                principalId: identity.principalId,
                recordVersion: row.record_version,
              }),
            )
          : err({ code: 'UNMAPPED_IDENTITY' });
      });
    } catch {
      return unavailable();
    }
  }
}

function semanticPrefix(event: IdentitySynchronizationEvent): string {
  const subjectDigest = createHash('sha256').update(event.subject).digest('hex');
  return `identity:${subjectDigest}`;
}

function semanticKey(event: IdentitySynchronizationEvent): string {
  const version =
    event.providerOccurredAt ?? createHash('sha256').update(event.eventId).digest('hex');
  return `${semanticPrefix(event)}:${version}:${event.eventType}`;
}

export class PostgresIdentitySynchronizationRepository implements IdentitySynchronizationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly reportPersistenceFailure: (error: unknown) => void = () => undefined,
  ) {}

  async synchronize(
    event: IdentitySynchronizationEvent,
    correlationId: Identifier<'Correlation'>,
  ): Promise<Result<IdentitySynchronizationResult, IdentityResolutionFailure>> {
    try {
      return await withActorTransaction(
        this.pool,
        Object.freeze({
          actor: Object.freeze({ kind: 'provider_webhook' }),
          assurance: 'provider_signature',
        }),
        async (transaction) => {
          await transaction.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `${event.provider}:${event.subject}`,
          ]);

          const inserted = await transaction.query<QueryResultRow & { id: string }>(
            `insert into ops.inbound_provider_events
               (provider, provider_event_id, semantic_key, event_type, payload_digest,
                signature_verified, provider_occurred_at, correlation_id)
             values ($1, $2, $3, $4, $5, true, $6, $7)
             on conflict do nothing
             returning id`,
            [
              event.provider,
              event.eventId,
              semanticKey(event),
              event.eventType,
              event.payloadDigest,
              event.providerOccurredAt,
              correlationId,
            ],
          );

          if (!inserted.rows[0]) {
            const existing = await transaction.query<
              QueryResultRow & { matched_event_id: boolean; payload_digest: string }
            >(
              `select payload_digest, provider_event_id = $2 as matched_event_id
               from ops.inbound_provider_events
               where provider = $1 and (provider_event_id = $2 or semantic_key = $3)
               order by (provider_event_id = $2) desc
               limit 1`,
              [event.provider, event.eventId, semanticKey(event)],
            );
            const conflict = existing.rows[0];
            if (!conflict) return unavailable();
            return !conflict.matched_event_id || conflict.payload_digest === event.payloadDigest
              ? ok('DUPLICATE')
              : err({ code: 'PROVIDER_EVENT_CONFLICT' });
          }

          const newer = event.providerOccurredAt
            ? await transaction.query<QueryResultRow & { found: boolean }>(
                `select exists (
                   select 1 from ops.inbound_provider_events
                   where provider = $1
                     and semantic_key like $2
                     and provider_occurred_at > $3
                     and process_state = 'PROCESSED'
                 ) as found`,
                [event.provider, `${semanticPrefix(event)}:%`, event.providerOccurredAt],
              )
            : undefined;

          if (newer?.rows[0]?.found) {
            await transaction.query(
              `update ops.inbound_provider_events
               set process_state = 'IGNORED', processed_at = clock_timestamp(),
                   safe_result_code = 'STALE_EVENT', updated_at = clock_timestamp()
               where id = $1`,
              [inserted.rows[0].id],
            );
            return ok('IGNORED_STALE');
          }

          const mapping = await transaction.query<
            QueryResultRow & {
              actor_type: 'CUSTOMER' | 'MANAGER';
              customer_id: string | null;
              principal_id: string;
            }
          >(
            `select p.id as principal_id, p.actor_type, null::uuid as customer_id
             from iam.external_identities e
             join iam.principals p on p.id = e.principal_id
             where e.provider = $1 and e.provider_subject = $2
               and e.link_status = 'ACTIVE' and e.is_primary`,
            [event.provider, event.subject],
          );
          let principalId = mapping.rows[0]?.principal_id;
          let customerId = mapping.rows[0]?.customer_id;

          if (principalId && mapping.rows[0]?.actor_type === 'MANAGER') {
            await transaction.query(
              `insert into audit.events
                 (event_type, actor_kind, target_type, target_id, operation, outcome,
                  safe_reason_code, correlation_id, metadata_json)
               values ('MANAGER_IDENTITY_SYNC_DEFERRED', 'provider_webhook', 'Principal', $1,
                       'SYNCHRONIZE_MANAGER_IDENTITY', 'DENIED', 'OPERATOR_REQUIRED', $2,
                       jsonb_build_object('provider', $3::text, 'result_code', $4::text))`,
              [principalId, correlationId, event.provider, event.eventType],
            );
            await this.finishEvent(
              transaction.query,
              inserted.rows[0].id,
              'IGNORED',
              'MANAGER_OPERATOR_REVIEW_REQUIRED',
            );
            return ok('IGNORED_MANAGER_REQUIRES_OPERATOR');
          }

          if (event.eventType === 'USER_DELETED') {
            if (!principalId) {
              await this.finishEvent(transaction.query, inserted.rows[0].id, 'IGNORED', 'UNMAPPED');
              return ok('IGNORED_UNMAPPED_DELETION');
            }
            if (mapping.rows[0]?.actor_type === 'CUSTOMER') {
              await transaction.query(
                `select iam.apply_customer_identity_provider_update($1, $2, null, 'DISABLE_DELETED')`,
                [event.provider, event.subject],
              );
            }
          } else if (!principalId && event.user?.accessRestricted) {
            await this.finishEvent(
              transaction.query,
              inserted.rows[0].id,
              'IGNORED',
              'RESTRICTED_IDENTITY',
            );
            return ok('IGNORED_RESTRICTED_IDENTITY');
          } else if (!event.user?.verifiedPrimaryEmail && !principalId) {
            await this.finishEvent(
              transaction.query,
              inserted.rows[0].id,
              'IGNORED',
              'VERIFIED_EMAIL_REQUIRED',
            );
            return ok('IGNORED_UNVERIFIED_EMAIL');
          } else if (!principalId && event.user?.verifiedPrimaryEmail) {
            principalId = randomUUID();
            customerId = randomUUID();
            await transaction.query(
              `insert into iam.principals (id, actor_type) values ($1, 'CUSTOMER')`,
              [principalId],
            );
            await transaction.query(
              `insert into iam.customers
                 (id, principal_id, verified_email_snapshot, contact_email, preferred_locale)
               values ($1, $2, $3, $3, 'ar')`,
              [customerId, principalId, event.user.verifiedPrimaryEmail],
            );
            await transaction.query(
              `insert into iam.external_identities
                 (provider, provider_subject, principal_id, verified_email_snapshot)
               values ($1, $2, $3, $4)`,
              [event.provider, event.subject, principalId, event.user.verifiedPrimaryEmail],
            );
          } else if (principalId && event.user) {
            if (mapping.rows[0]?.actor_type === 'CUSTOMER') {
              const action = event.user.accessRestricted
                ? 'DISABLE_RESTRICTED'
                : 'SYNC_VERIFIED_EMAIL';
              if (event.user.verifiedPrimaryEmail || event.user.accessRestricted) {
                await transaction.query(
                  `select iam.apply_customer_identity_provider_update($1, $2, $3, $4)`,
                  [event.provider, event.subject, event.user.verifiedPrimaryEmail, action],
                );
              }
            }
          }

          if (!principalId) return unavailable();

          await transaction.query(
            `insert into audit.events
               (event_type, actor_kind, target_type, target_id, operation, outcome,
                correlation_id, metadata_json)
             values ('IDENTITY_SYNCHRONIZED', 'provider_webhook', $1, $2,
                     'SYNCHRONIZE_IDENTITY', 'SUCCEEDED', $3,
                     jsonb_build_object('provider', $4::text, 'result_code', $5::text))`,
            [
              customerId ? 'Customer' : 'Principal',
              customerId ?? principalId,
              correlationId,
              event.provider,
              event.eventType,
            ],
          );
          await this.finishEvent(
            transaction.query,
            inserted.rows[0].id,
            'PROCESSED',
            'IDENTITY_SYNCHRONIZED',
          );
          return ok('APPLIED');
        },
      );
    } catch (error) {
      this.reportPersistenceFailure(error);
      return unavailable();
    }
  }

  private async finishEvent(
    query: (statement: string, values?: readonly unknown[]) => Promise<unknown>,
    id: string,
    state: 'IGNORED' | 'PROCESSED',
    resultCode: string,
  ): Promise<void> {
    await query(
      `update ops.inbound_provider_events
       set process_state = $1, processed_at = clock_timestamp(), safe_result_code = $2,
           updated_at = clock_timestamp()
       where id = $3`,
      [state, resultCode, id],
    );
  }
}

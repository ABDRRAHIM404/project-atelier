import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';

export type RecoveryVerificationClient = Readonly<{
  query: <Row extends QueryResultRow = QueryResultRow>(
    statement: string,
    values?: readonly unknown[],
  ) => Promise<Readonly<{ rows: readonly Row[] }>>;
}>;

export type RecoveryPoint = Readonly<{
  capturedAt: Date;
  snapshot: string;
  walLsn: string;
}>;

export type P1RecoveryInventory = Readonly<{
  activeManagerCount: number;
  auditEventCount: number;
  configurationDefinitionCount: number;
  customerCount: number;
  outboxEventCount: number;
  principalCount: number;
  relationCount: number;
}>;

export type P1RecoveryVerification = Readonly<{
  digestSha256: string;
  inventory: P1RecoveryInventory;
  issues: readonly string[];
  valid: boolean;
}>;

export async function captureRecoveryPoint(
  client: RecoveryVerificationClient,
): Promise<RecoveryPoint> {
  const result = await client.query<{
    captured_at: Date;
    snapshot: string;
    wal_lsn: string;
  }>(
    `select
       clock_timestamp() as captured_at,
       pg_current_snapshot()::text as snapshot,
       pg_current_wal_lsn()::text as wal_lsn`,
  );
  const row = result.rows[0];
  if (!row) throw new Error('PostgreSQL did not return a recovery point.');
  return Object.freeze({
    capturedAt: row.captured_at,
    snapshot: row.snapshot,
    walLsn: row.wal_lsn,
  });
}

export async function verifyP1Recovery(
  client: RecoveryVerificationClient,
): Promise<P1RecoveryVerification> {
  const inventoryResult = await client.query<P1RecoveryInventory>(
    `select
       (select count(*)::integer from iam.principals) as "principalCount",
       (select count(*)::integer from iam.customers) as "customerCount",
       (select count(*)::integer from iam.managers where is_active) as "activeManagerCount",
       (select count(*)::integer from config.configuration_definitions) as "configurationDefinitionCount",
       (select count(*)::integer from audit.events) as "auditEventCount",
       (select count(*)::integer from ops.outbox_events) as "outboxEventCount",
       (select count(*)::integer from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'r' and n.nspname in ('iam', 'config', 'audit', 'ops'))
         as "relationCount"`,
  );
  const inventory = inventoryResult.rows[0];
  if (!inventory) throw new Error('PostgreSQL did not return a recovery inventory.');

  const posture = await client.query<{
    bypass_role_count: number;
    missing_forced_rls_count: number;
    runtime_owned_relation_count: number;
  }>(
    `select
       (select count(*)::integer from pg_roles
          where rolname in ('atelier_runtime', 'atelier_job', 'atelier_identity_resolver')
            and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole)) as bypass_role_count,
       (select count(*)::integer from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'r' and n.nspname in ('iam', 'config', 'audit', 'ops')
            and (not c.relrowsecurity or not c.relforcerowsecurity)) as missing_forced_rls_count,
       (select count(*)::integer from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_roles r on r.oid = c.relowner
          where n.nspname in ('iam', 'config', 'audit', 'ops')
            and r.rolname in ('atelier_runtime', 'atelier_job', 'atelier_identity_resolver'))
         as runtime_owned_relation_count`,
  );
  const security = posture.rows[0];
  if (!security) throw new Error('PostgreSQL did not return its restored security posture.');

  const issues: string[] = [];
  if (inventory.relationCount !== 14) issues.push('P1_RELATION_COUNT_MISMATCH');
  if (inventory.configurationDefinitionCount !== 8) issues.push('CONFIGURATION_REGISTRY_MISMATCH');
  if (inventory.activeManagerCount > 1) issues.push('MULTIPLE_ACTIVE_MANAGERS');
  if (security.bypass_role_count > 0) issues.push('PRIVILEGED_RUNTIME_ROLE');
  if (security.missing_forced_rls_count > 0) issues.push('RLS_POSTURE_MISMATCH');
  if (security.runtime_owned_relation_count > 0) issues.push('RUNTIME_ROLE_OWNS_RELATION');

  const normalizedInventory = Object.freeze({ ...inventory });
  const digestSha256 = createHash('sha256')
    .update(JSON.stringify(normalizedInventory))
    .digest('hex');
  return Object.freeze({
    digestSha256,
    inventory: normalizedInventory,
    issues: Object.freeze(issues),
    valid: issues.length === 0,
  });
}

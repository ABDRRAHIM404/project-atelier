import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { captureRecoveryPoint, verifyP1Recovery } from '../../src/platform/database';
import { seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  createRestoredPostgresClone,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

describe('P1 recovery and reconciliation', () => {
  let source: IsolatedPostgresDatabase;
  let restored: IsolatedPostgresDatabase;
  let restoredClient: Client;

  beforeAll(async () => {
    source = await createIsolatedPostgresDatabase('recovery_source');
    const sourceClient = new Client({ connectionString: source.connectionString });
    await sourceClient.connect();
    await seedP1IdentityFixtures(sourceClient);
    await sourceClient.query(
      `insert into audit.events
         (event_type, actor_kind, target_type, operation, outcome, correlation_id, metadata_json)
       values
         ('RECOVERY_FIXTURE', 'system_job', 'RecoveryPoint', 'CAPTURE_RECOVERY_POINT',
          'SUCCEEDED', '70000000-0000-4000-8000-000000000001',
          '{"reason_code":"SYNTHETIC_RECOVERY_FIXTURE"}'::jsonb)`,
    );
    const point = await captureRecoveryPoint(sourceClient);
    expect(point.walLsn).toMatch(/^[0-9A-F]+\/[0-9A-F]+$/u);
    expect(point.snapshot).toContain(':');
    await sourceClient.end();

    restored = await createRestoredPostgresClone(source.name, 'recovery_restored');
    restoredClient = new Client({ connectionString: restored.connectionString });
    await restoredClient.connect();
  });

  afterAll(async () => {
    await restoredClient?.end();
    await restored?.dispose();
    await source?.dispose();
  });

  it('reconciles restored counts and security invariants without reading row content', async () => {
    const verification = await verifyP1Recovery(restoredClient);
    expect(verification.valid).toBe(true);
    expect(verification.issues).toEqual([]);
    expect(verification.inventory).toEqual({
      activeManagerCount: 1,
      auditEventCount: 1,
      configurationDefinitionCount: 8,
      customerCount: 2,
      outboxEventCount: 0,
      principalCount: 3,
      relationCount: 14,
    });
    expect(verification.digestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('fails recovery verification when forced RLS is weakened', async () => {
    await restoredClient.query('alter table iam.customers no force row level security');
    const verification = await verifyP1Recovery(restoredClient);
    expect(verification.valid).toBe(false);
    expect(verification.issues).toContain('RLS_POSTURE_MISMATCH');
  });
});

# P1 Database Migration and Recovery Runbook

**Scope:** P1 trusted foundation only  
**Production execution:** Not authorized by P1  
**Source of truth:** `supabase/migrations/` plus `manifest.json`

## Safety rules

- Never apply a migration from a preview deployment or a local developer dashboard.
- Never edit an applied migration. Add a reviewed forward-fix migration.
- Never run the disposable test harness against staging or production. It accepts only a loopback PostgreSQL administrator URL and creates only `atelier_test_*` databases.
- Never use production data as a fixture. P1 fixtures use reserved UUIDs, `.invalid` email addresses, Arabic/bidirectional edge text, and synthetic events.
- Do not activate a `CFG-*` revision until its Product Owner value and module validator are approved.

## Local and CI verification

1. Use the repository-pinned Node and npm versions.
2. Run `npm ci`.
3. Run `npm run migrations:check` to prove file ordering and SHA-256 agreement.
4. Run `npm run test:postgres`. The runner starts real PostgreSQL 17.6 in the operating-system temporary directory, applies the reviewed SQL transactionally, and removes the cluster after the tests.
5. Run `npm run verify:static`, unit/integration tests, and the P1 gate before review.

Supabase CLI remains the approved local/staging/production migration interface. This Linux Mint host has no Docker-compatible runtime, so CI/local correctness uses the pinned PostgreSQL 17.6 binary harness. This does not authorize a different production migration path.

## Staging rehearsal

Staging execution requires separate authorization and credentials. Before applying anything:

1. Compare remote migration history with the repository chain and stop on any drift.
2. Confirm the expected PostgreSQL major and extensions.
3. Confirm current provider backup/PITR status and authorized recovery access.
4. Capture the provider backup point and a PostgreSQL reconciliation point (timestamp, WAL LSN, transaction snapshot).
5. Apply the exact artifact that passed CI through Supabase CLI.
6. Run empty/upgrade, role, forced-RLS, single-Manager, immutable-audit, idempotency/outbox, and concurrency verification.
7. Record the operator, reviewer, migration ID/checksum, start/end time, lock observations, and result.

## Failure behavior

- Before commit: the migration runner rolls back the whole migration transaction.
- After commit: stop affected writers and dispatchers, preserve evidence, and prefer a reviewed forward fix.
- Application incompatibility: redeploy the last schema-compatible application artifact; do not destructively down-migrate.
- Integrity incident: use provider PITR only through the approved incident process. Accepted history and Audit Events are never rewritten to make verification pass.

## Restore and reconciliation

The executable recovery verifier records counts and security posture only; it never exports row content. On a restored copy it verifies:

- all 14 P1 relations and eight inactive configuration definitions;
- no more than one active Manager;
- runtime/job/resolver roles do not own relations or gain elevated privileges;
- every P1 relation still has enabled and forced RLS;
- identity, Customer, Audit Event, and outbox inventory counts for operator comparison; and
- a privacy-safe SHA-256 digest of that inventory.

Any mismatch blocks promotion of the restore. Later file-bearing phases must add relational/object-version reconciliation before this runbook can authorize a complete application recovery.

## Evidence retained

Retain the migration manifest/checksum, CI result, staging rehearsal record, provider backup point reference, reconciliation result/digest, reviewer approval, and any forward-fix incident reference. Do not retain credentials, row dumps, access tokens, signed URLs, raw provider payloads, or payment/file content in quality evidence.

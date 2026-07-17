# Version 1 Database Migration Strategy

**Status:** Accepted by the Product Owner on 2026-07-16  
**Applies to:** PostgreSQL schema, constraints, indexes, reference data, and controlled data transformations  
**Tooling:** Approved Drizzle migration workflow and Supabase CLI/local PostgreSQL  
**Important:** This document creates no migration and changes no Supabase resource.

## 1. Objectives

The migration process must preserve availability, rollback compatibility, Customer isolation, immutable history, and the accepted recovery targets. A successful application deployment is not evidence that a database migration is safe.

Required outcomes:

- the database can be built reproducibly from an empty supported PostgreSQL instance;
- every supported prior release can upgrade to the next release without unplanned data loss;
- application version N and its rollback version can operate against the expanded schema during the release window;
- immutable quotation/order/payment/audit records cannot be weakened by migration;
- migrations never depend on manual dashboard drift;
- each production change has backup, verification, recovery, and ownership evidence.

## 2. Source of truth and ownership

- Reviewed, committed SQL migration files are the schema-change source of truth.
- Drizzle schema metadata may generate or organize changes, but generated SQL is reviewed as carefully as handwritten SQL.
- Supabase CLI applies the same ordered migration history locally, in CI, staging, and production.
- Direct production dashboard changes, ORM auto-sync, `db push` against production, and unrecorded SQL are prohibited.
- Each migration declares its owning module/schema, reviewer, risk class, expected lock behavior, data effect, verification query, and recovery action.
- An applied migration is immutable. Corrections are new migrations; applied files are never edited or renumbered.

## 3. Migration identity and metadata

Every migration has:

- a monotonic sortable identifier;
- concise purpose and owning module;
- dependency/ordering notes;
- forward change;
- backward-compatibility window;
- whether it is transaction-safe;
- expected table size and lock class;
- timeout/statement expectations;
- backfill requirement and checkpoint key where applicable;
- preconditions and postconditions;
- rollback/forward-fix plan;
- issue/approval reference and checksum.

The database migration-history table and repository manifest must agree. Drift is a release-blocking error.

## 4. Change classes

| Class | Examples | Release treatment |
|---|---|---|
| A — additive/low risk | New nullable column, new empty table, new unconstrained reference table | Normal reviewed migration; verify metadata and permissions |
| B — online/index or constraint validation | Concurrent index, `NOT VALID` constraint then validation, RLS/policy change | Separate rehearsed steps; measure lock and query effect |
| C — data/backfill | Snapshot derivation, new normalized value, large projection rebuild | Expand first; durable batched/restartable backfill; validate before cutover |
| D — behavioral/critical | Immutability trigger, state-transition guard, authorization/RLS change, money calculation | Security/domain review, concurrency tests, staged activation, current restore evidence |
| E — destructive/contract | Drop/rename old column/table, narrow type, remove state | Later release only after all readers/writers and rollback versions stop using it |
| F — emergency repair | Forward correction after incident | Incident approval, backup evidence where possible, narrow scope, immediate audit and follow-up migration |

## 5. Expand–migrate–contract sequence

### 5.1 Expand

1. Confirm the production backup/PITR state and recovery access.
2. Add backward-compatible tables, nullable columns, indexes, triggers, views, or dual-readable structures.
3. Avoid table rewrites and long blocking operations on populated relations.
4. Deploy application behavior capable of operating with both old and new representations.

### 5.2 Migrate/backfill

1. Run a versioned, idempotent, restartable backfill through bounded batches.
2. Persist checkpoints and safe failure information.
3. Use stable primary-key/keyset traversal, not offset scanning.
4. Rate-limit work from measured database capacity and observe replication/connection/latency health.
5. Never fabricate missing historical facts. Rows that cannot be transformed enter a reconciliation report and block cutover where correctness is material.

### 5.3 Validate and switch

1. Compare row counts, uniqueness, nullability, ownership, totals/digests, and source/destination samples.
2. Run invariant and authorization suites against the migrated staging copy.
3. Switch reads/writes using compatible application behavior or an approved feature/configuration gate.
4. Monitor errors, latency, locks, dead tuples, connection use, and reconciliation discrepancies.

### 5.4 Contract

1. Wait until the previous application release cannot be restored into service against the schema.
2. Reconfirm that no code, job, report, recovery process, or provider callback uses the old representation.
3. Take/verify the appropriate recovery point.
4. Remove old data/columns/constraints in a later migration.

Contract work is never bundled into the first release that introduces the replacement.

## 6. Transaction and lock policy

- Use transactional DDL when PostgreSQL supports the operation safely.
- Operations that cannot run in a transaction, such as concurrent index creation, receive isolated migration steps with explicit failure cleanup.
- Production sessions use deliberate `lock_timeout` and `statement_timeout` values selected from rehearsal evidence; this document does not invent them.
- A timeout fails the migration rather than waiting indefinitely and degrading the business.
- New foreign keys/check constraints on populated tables use an online-safe creation/validation sequence where appropriate.
- New required columns follow nullable → backfill → validate → `NOT NULL`, not an immediate rewrite with a guessed default.
- Type changes use a new column and controlled conversion when an in-place conversion could rewrite or block a large table.

## 7. Critical invariant migrations

Changes affecting the following require Class D treatment and domain/security sign-off:

- uniqueness of current/accepted Quotation Revisions;
- immutability of sent/accepted revisions, Order Item Snapshots, payment decisions, or Audit Events;
- acceptance-to-Order atomicity;
- verified-payment production guard;
- Customer ownership/RLS policies;
- one-active-Manager rule;
- file classification/scan gating;
- money representation or commercial total validation;
- outbox/idempotency uniqueness.

Such migrations are tested against valid data, deliberately invalid fixtures, concurrent transactions, and a restored prior-release dataset.

## 8. Reference and configuration data

- Code-owned enumerations and configuration-definition keys are versioned as reviewed seed/reference changes.
- Seeds are idempotent and use stable identifiers/keys.
- Local/CI may install clearly synthetic fixtures in a separate command; fixture data is never part of production migrations.
- No placeholder Product prices, business address, legal wording, retention value, delivery zone, tax rule, or policy value is seeded into production.
- Product/Manager/business bootstrap is a separate authorized operational workflow with Audit Events, not an invisible schema migration.

## 9. Environments and rehearsal

### Local and CI

- Build from empty using the full migration chain.
- Upgrade a snapshot representing the last supported release.
- Validate Drizzle metadata against the resulting database.
- Run database integration, immutability, transition, RLS, and concurrency tests.

### Staging

- Use the same PostgreSQL major version/extensions and representative synthetic volume.
- Rehearse migration duration, locks, index builds, backfills, application overlap, rollback deployment, and verification.
- Rehearse file-metadata reconciliation when a migration affects object references.

### Production

- Apply only the exact reviewed artifact that passed staging.
- Use a dedicated least-privilege migration identity through an approved operator workflow.
- No preview deployment may apply production migrations.
- Record start/end time, migration IDs, operator, backup point, results, metrics, and follow-up work.

## 10. Deployment order

The default release order is:

1. confirm current migration history and absence of drift;
2. confirm PITR/backup and restoration credentials;
3. apply compatible expansion migrations;
4. deploy the compatible application artifact;
5. execute/release any durable backfill;
6. run smoke, invariant, ownership, and queue checks;
7. observe the release through the approved window;
8. contract only in a later independently approved release.

If a new application requires a schema not yet present, database expansion precedes application promotion. If a schema requires new writers to populate data, it remains backward compatible until those writers and the backfill are complete.

## 11. Rollback and recovery

### Application failure

Promote the last compatible application artifact. The expanded schema remains. This is the preferred rollback.

### Migration logic or data defect

- Stop affected writers/jobs.
- Assess whether a forward corrective migration is safe.
- Use append-only compensation for commercial history; never rewrite an accepted fact to make a migration look successful.
- Restore from PITR only when the incident plan determines that forward repair cannot meet integrity/recovery goals.
- Reconcile S3 object references after any relational restore.

Destructive down migrations are not the default production recovery mechanism. Restoring the database without coordinating later object/provider effects can create inconsistencies and therefore requires the recovery runbook.

## 12. Schema and data verification

Every migration supplies machine-checkable postconditions appropriate to its risk:

- migration checksum/history matches the repository;
- expected relation, column, type, default, constraint, index, policy, trigger, and grant exist;
- no unexpected invalid constraints or failed indexes remain;
- row ownership and parent/child counts reconcile;
- source and destination values/digests match for backfills;
- commercial component totals remain consistent;
- accepted/sent history remains immutable;
- verified-payment/production guard rejects invalid test transactions;
- Customer isolation and Manager action rules pass;
- query plans for named critical paths remain within accepted API budgets;
- outbox/jobs are not stranded by a schema-version mismatch.

## 13. Drift control

- CI builds a fresh database and compares the resulting schema with the declared Drizzle/repository representation.
- Staging and production migration histories are read and compared before release.
- Manual provider-console database changes create an incident/reconciliation task and are captured by a corrective migration.
- Extension installation/version changes are migrations and follow the same review.
- A backup or restored database is not promoted until schema history and constraints are verified.

## 14. Performance safeguards

- Index proposals name the exact query, selectivity, sort, and ownership predicate they serve.
- `EXPLAIN (ANALYZE, BUFFERS)` or safe equivalent evidence is captured in staging with representative volume.
- Redundant indexes are avoided because they increase write, vacuum, and storage cost.
- Search-index/projection rebuilds are isolated from commercial transaction paths.
- Backfills, audit growth, messages, notification attempts, outbox, and jobs receive growth/maintenance monitoring before retention is approved.

## 15. Migration approval checklist

- [ ] Business/domain intent and owner identified.
- [ ] No unresolved policy value was supplied as a default.
- [ ] Forward SQL reviewed.
- [ ] Backward compatibility and application overlap demonstrated.
- [ ] Lock, runtime, data-volume, and query-plan evidence captured.
- [ ] Empty install and prior-release upgrade pass.
- [ ] Authorization/RLS and immutable-history tests pass where affected.
- [ ] Backfill is idempotent, batched, checkpointed, and observable where required.
- [ ] Backup/restore point and object reconciliation impact documented.
- [ ] Application rollback and data forward-fix paths documented.
- [ ] Production verification and owner prepared.
- [ ] Contract/destructive step deferred appropriately.

## 16. Phase boundary

This strategy is ready for review, but it does not create a migration directory, SQL file, Supabase branch/project, schema object, seed, or data change. Migration implementation begins only after the database/API design package is approved.

# Data Architecture

**Status:** Approved 2026-07-16  
**Database model:** Relational  
**System of record:** PostgreSQL

## 1. Objectives

The data architecture preserves transactional correctness, immutable commercial history, customer isolation, auditability, recoverability, and configurable policy. It describes ownership and constraints without choosing physical tables, columns, indexes, or migration statements.

## 2. Data systems

| Data system | Responsibility | Authority |
|---|---|---|
| Supabase managed PostgreSQL | Domain state, configuration, ownership, file metadata, audit, notification state, outbox/jobs | Authoritative for business truth |
| Clerk | Credentials, login verification, MFA enrollment, provider session | Authoritative for authentication only |
| AWS S3 | Versioned object bytes | Authoritative for file content; relational metadata remains authoritative for business meaning and access |
| Sentry/provider telemetry | Operational events, traces, metrics | Diagnostic only; never business/audit truth |
| Resend | Email handoff and provider delivery events | Delivery diagnostic; internal notification/outbox state is canonical |

## 3. Logical data ownership

Logical ownership follows `DOMAIN_MODEL.md` and `MODULE_BOUNDARIES.md`. Every persistent business object has one owning module. Relationships across modules use stable, non-recycled identifiers. Deleting or changing a source object must not erase historical facts that another aggregate is required to retain.

The database is one relational cluster for Version 1. Module ownership is expressed through migration ownership, repository boundaries, naming conventions, permissions where useful, and code-review rules—not separate databases or network services.

## 4. Transaction boundaries

### 4.1 Ordinary transitions

A valid transition commits the current state, transition history or domain record, Audit Event, and required outbox intents in one database transaction. Validation is repeated inside the transaction after any needed lock is acquired. A failed precondition or concurrency conflict leaves no partial business change.

### 4.2 Quotation acceptance

Acceptance is atomic across Submitted Request, current sent Quotation Revision, Customer Acceptance, Order, Order Item Snapshots, fulfilment/commercial snapshots, Audit Event, and notification intents. The transaction must:

- authenticate the Customer and re-check ownership;
- lock or version-check the target revision and related request;
- confirm the revision is the current sent, non-superseded candidate;
- evaluate unresolved expiry or acceptance-window policy from configuration without inventing a value;
- prevent more than one successful acceptance/order for the same accepted revision;
- freeze all customer-visible commercial details needed to interpret the Order later;
- create the Order in Awaiting Payment;
- preserve all-or-nothing behavior.

### 4.3 Payment verification and production

Payment Verification and the corresponding Order/payment state change commit together. Production transitions query the authoritative verified-payment fact inside their transaction. A cached UI flag, webhook, or uploaded proof alone can never satisfy the precondition.

## 5. Immutability model

Immutability is defense in depth:

1. Domain operations expose creation/supersession rather than update for frozen records.
2. Repository APIs do not offer general updates to immutable objects.
3. Database rules restrict or reject mutation after the lifecycle freeze point.
4. Audit records make any privileged recovery action visible.
5. Provider/object keys are versioned or content-addressed; existing historical attachments are not silently overwritten.

The mandatory immutable records are:

- sent Quotation Revisions and their Quotation Items;
- accepted Quotation Revisions permanently;
- Customer Acceptance evidence;
- Order Item Snapshots and the accepted commercial/fulfilment snapshot;
- Payment Submissions and Payment Verifications as historical decisions;
- append-only Audit Events.

Corrections use a new revision, new submission, compensating record, or an explicitly governed recovery action. They never rewrite an accepted historical fact.

## 6. Temporal and configuration data

Business policy and system configuration are typed and scoped. Each durable value records provenance, effective period/version, and actor where the policy requires manager or operator approval. Historical transactions snapshot any policy value needed for later interpretation rather than resolving everything from today's configuration.

Configuration classes include:

- business identity and active fulfilment locations;
- initial currency (`SAR`) and supported currency metadata;
- business time zone and locale availability;
- quotation windows, wording, delivery price rules, file limits, retention values, and notification timing once approved;
- operational retry, job, and alert thresholds;
- feature publication controls such as optional English.

Security invariants, ownership rules, and historical immutability are not configurable off switches.

## 7. Value representation

- **Money:** exact decimal or integer minor units plus ISO 4217 currency code; no binary floating point. Rounding rules require explicit approval where applicable.
- **Time:** instants stored in UTC; local rendering and business-day calculations use an explicit IANA time-zone configuration.
- **Locale:** normalized BCP 47-style application locale identifiers; Arabic is required and fallback authority.
- **Identifiers:** opaque, stable, non-sequentially guessable public identifiers where records cross a trust boundary.
- **Text:** Unicode; normalization rules are intentional and must not destroy the original Arabic customer input.
- **Addresses:** structured enough to support home delivery and a future showroom/pickup location, with an immutable accepted-order snapshot.
- **Quantities and dimensions:** units stored explicitly; product-specific validation belongs to Catalog/Product Configuration policy.

## 8. Concurrency and idempotency

Stateful operations carry an idempotency key or unique business constraint when duplicate submission is possible. Optimistic versions, conditional updates, and targeted locks prevent lost updates. Examples include acceptance, payment-proof finalization, payment verification, outbox delivery, provider webhook processing, and fulfilment completion.

Webhook provider event IDs are deduplicated, but provider IDs are not the only safeguard. A replay with a different provider ID must still be harmless under the business uniqueness rules.

## 9. Query and projection strategy

Normalized transactional data is canonical. Purpose-built relational read projections are allowed for catalog search, manager work queues, customer timelines, and notification lists. Projections are rebuildable and read-only to consumers. They may be updated in the same transaction or asynchronously through durable outbox work depending on freshness requirements.

Version 1 uses PostgreSQL full-text capabilities plus `pg_trgm` for catalog search. The search projection contains only published, customer-safe catalog and approved localization content. Arabic normalization and ranking are verified against a product-owner-approved search corpus.

## 10. Audit data

Audit Events are append-only, actor-attributed, time-stamped, correlated to the request/job, and linked to affected objects without copying unrestricted sensitive payloads. They capture authorization-relevant and business-significant actions, including manager views of payment proof where feasible, state transitions, policy changes, publication, privileged recovery, and export.

Audit is distinct from application logs. Logs may be sampled or expire operationally; audit history follows the approved business/legal retention configuration and cannot rely on Sentry or Vercel log retention.

## 11. Backup, restore, and reconciliation

The production recommendation is Supabase Pro with Point-in-Time Recovery sized to meet the accepted database RPO of at most one hour and RTO of at most four hours. Supabase documentation notes that database backups do not contain Storage objects, and project deletion can remove provider backups; therefore encrypted logical backups are also exported to an independently controlled S3 recovery zone. Exact retention is an unresolved policy/configuration value.

S3 versioning protects object generations. Recovery joins relational file metadata to object inventory and versions, reports missing/orphaned objects, and never guesses ownership. Monthly restore exercises verify:

- a database can be restored to an isolated environment;
- immutable and audit constraints survive restoration;
- private/sensitive objects can be reconciled and accessed with restored metadata;
- recovery credentials and runbooks are usable;
- measured RPO/RTO meet `QUALITY_GATES.md`.

Official constraints: [Supabase database backups](https://supabase.com/docs/guides/platform/backups) and [Amazon S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html).

## 12. Migration architecture

Drizzle Kit generates or organizes versioned SQL migrations, which are reviewed and committed. Supabase CLI provides the local PostgreSQL environment and migration execution. Production changes use a controlled expand–migrate–contract sequence:

1. create a recoverable backup/restore point;
2. apply backward-compatible expansion;
3. deploy compatible application behavior;
4. migrate/backfill through observable, restartable work;
5. validate counts, constraints, and critical journeys;
6. contract only in a later release after rollback compatibility is no longer required.

Dashboard-only schema drift, ORM auto-sync, and direct production `push` workflows are prohibited. Application rollback does not imply database rollback; destructive down migrations are not the default recovery method.

## 13. Data lifecycle and privacy

No unresolved retention duration is invented. Each data class has a lifecycle policy point and legal/business owner. Until approved, implementation must preserve required records and support future policy execution without silently deleting customer, payment, order, message, audit, or file history. Data export, correction, and deletion requests use governed workflows that preserve legally required immutable transaction evidence and record the action.

## 14. Provider recommendation

Use Supabase managed PostgreSQL as the Version 1 relational provider, with PITR and independent encrypted logical backup. It fits the accepted relational model and provides managed operations without changing PostgreSQL semantics. Alternatives were self-hosted PostgreSQL, Neon, AWS RDS, and Vercel Postgres offerings. The tradeoff is provider dependency for control-plane, backup, and network behavior; SQL portability is high but auth/storage-specific coupling must be avoided. Cost includes the Supabase Pro project, compute, PITR, network, and backup storage. Lock-in is moderate operationally and low-to-moderate at the data model if standard PostgreSQL is retained. **Final recommendation: Accepted; see ADR-013 and ADR-014.**

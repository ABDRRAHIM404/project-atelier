# Database and API Design Review Report

**Project:** Project Atelier / بيتي بذوقي  
**Review date:** 2026-07-16  
**Phase status:** Approved by the Product Owner on 2026-07-16  
**Implementation authorization:** None — this approval authorized implementation planning only

## 1. Executive verdict

The approved product and architecture can be implemented through the proposed relational/database and first-party API contracts without redesigning the domain model.

The design preserves the four highest-risk invariants with application and database defenses:

1. accepting the current sent Quotation Revision creates exactly one Order atomically;
2. sent/accepted commercial history and Order Item Snapshots cannot be edited;
3. Customers cannot access another Customer's private records/files;
4. Order-level production cannot start without an authoritative Manager-verified payment.

No true database/API design blocker remains. Business-policy and exact configuration values remain explicit gates for affected actions and production release. They are not given guessed defaults.

**Recommendation:** Approve this package for schema/migration and endpoint implementation, then explicitly authorize implementation in a separate instruction.

## 2. Documents created

| Document | Purpose |
|---|---|
| `DATABASE_DESIGN.md` | PostgreSQL schemas, logical/physical relations, ownership, keys, snapshots, constraints, indexes, RLS roles, recovery boundaries |
| `MIGRATION_STRATEGY.md` | Reviewed migration source, expand–migrate–contract process, backfills, lock safety, drift, rollback/recovery, verification |
| `AUTHORIZATION_MODEL.md` | Actor/resource/action matrix, authentication assurance, field-level access, file inheritance, RLS defense, system/provider authority |
| `API_CONTRACTS.md` | Versioned first-party queries/commands, representations, concurrency, upload flow, callbacks, absent/unapproved actions |
| `ERROR_MODEL.md` | RFC 9457 Problem Details contract, stable error catalogue, localization, retry/non-disclosure semantics |
| `IDEMPOTENCY_RULES.md` | Client keys, request digests, business uniqueness, acceptance concurrency, jobs/webhooks/files, failure recovery |
| `VALIDATION_STRATEGY.md` | Layered validation ownership and domain/file/provider/output rules |
| `DATABASE_API_DESIGN_REVIEW_REPORT.md` | Phase summary, risks, remaining gates, and approval recommendation |

## 3. Existing documents updated

The Product Owner's explicit architecture/provider approval was recorded without changing the architecture:

- `ADR_INDEX.md`: ADR-001 through ADR-024 marked Accepted; ADR-015, ADR-016, and ADR-021 retain staged-adoption conditions.
- `ARCHITECTURE_DECISIONS.md`: structural ADR status and approval records reconciled.
- Architecture document status headers and provider ADR references updated from Proposed to Approved/Accepted.
- `MASTER_PRD.md` and `DECISION_WORKSHOP.md`: architecture-phase `DW-015` through `DW-017` recorded as completed/accepted.
- `AGENTS.md` and `GOAL.md`: current gate changed to database/API design review; application implementation remains unauthorized.

No historical audit/planning report was rewritten as though it were produced after this phase.

## 4. Database design summary

### 4.1 Structure

One PostgreSQL database uses module-owned schemas for Identity, Configuration, Catalog, CMS/Localization, Projects, Quotations, Orders, Payments, Production, Fulfilment, Messaging, Notifications, Files, Audit, and durable Operations. These are boundaries inside one modular monolith, not services or separate databases.

### 4.2 Important modeling choices requiring approval

| Choice | Reason |
|---|---|
| Local `principal` plus external identity link | Keeps Clerk authentication separate from portable local authorization and audit identity |
| No tenant key on business rows | Preserves approved single-business Version 1 and avoids premature multi-tenancy |
| Typed, code-registered configuration revisions | Supports unresolved values/effective history without arbitrary executable rules |
| Stable localized resource plus immutable translation revisions | Supports Arabic source, optional English, human approval, and future languages without weakening publication/history |
| Normalized mutable catalog plus JSONB only for versioned bounded snapshots | Preserves relational ownership while supporting product-specific configurations and immutable display history |
| Separate Submitted Request, Quotation Revision, Acceptance, Order, and Order Item Snapshot relations | Matches accepted commercial boundaries and prevents live catalog drift |
| Separate Payment Submission and Payment Verification | Makes upload proof distinct from the human decision |
| Order-level Production table/update history only | Implements accepted AB-004; no Order Item production lifecycle |
| Fulfilment snapshot plus handoff proof | Preserves accepted delivery/pickup facts and evidence without inventing failure states |
| File metadata and exact S3 version in PostgreSQL; bytes in S3 | Supports classification, ownership, scan gating, version recovery, and reconciliation |
| PostgreSQL RLS for Customer-owned tables as defense in depth | Adds isolation beneath mandatory application authorization without exposing direct browser data access |
| Append-only Audit, outbox, jobs, and idempotency records | Provides accountable transitions and durable/retryable external effects |

### 4.3 Database invariants

The future DDL must enforce, at minimum:

- one active Manager;
- unique current sent quotation revision;
- immutable sent/accepted revision and children;
- one Acceptance/Order per accepted revision;
- immutable Order Item Snapshots;
- one verified Payment decision per Order;
- exact Order-level Production transition pairs and verified-payment start guard;
- fulfilment completion only with method-consistent handoff proof;
- Customer parent/child ownership consistency;
- immutable published versions and Audit Events;
- idempotency/outbox/provider-event uniqueness.

## 5. Migration strategy summary

- Committed reviewed SQL is authoritative; Drizzle generation is reviewed, and Supabase CLI executes the same chain.
- No dashboard drift or production `push` workflow.
- Expand first, run observable/restartable backfills, validate, switch, and contract only in a later release.
- Application rollback uses a previous compatible artifact; database recovery favors a safe forward correction and uses PITR only under a coordinated runbook.
- Critical immutability, RLS, money, state, and production-gate migrations require domain/security review and concurrency testing.
- Empty install, prior-release upgrade, representative staging rehearsal, schema drift, query plans, backup point, and postconditions are release evidence.

No migration file or database object was created.

## 6. API design summary

### 6.1 Contract shape

- First-party `/api/v1` JSON contract over the modular application services.
- Server Components may call the same actor-scoped queries in-process; there is no weaker internal path.
- Clerk session for users, provider signatures for callbacks, and local authorization for every resource/action.
- Opaque IDs, UTC time, exact Money objects, localized messages, cursor pagination, private caching rules.
- ETag/`If-Match` for mutable/stateful resources and required Idempotency Keys for consequential commands.
- RFC 9457-compatible localized error envelope with non-disclosing cross-Customer behavior.

### 6.2 Critical command contracts

| Command | Atomic result / guard |
|---|---|
| Submit Project | Lock Project version and create complete immutable Submitted Request snapshot |
| Send Quotation Revision | Validate complete commercial snapshot, freeze Revision/items/components, queue Quote Ready |
| Accept current Revision | Create Acceptance, Order, Order Items/terms/price snapshots, initial payment/production/fulfilment, audit/outbox exactly once |
| Submit payment proof | Reference a clean own proof Attachment; create immutable attempt; never verify automatically |
| Verify payment | Explicit Manager decision; unlock production but do not start it |
| Start production | Manager MFA plus authoritative verified-payment recheck; Order-level only |
| Advance production | Named commands for exactly the accepted state sequence |
| Confirm handoff | Require clean proof and accepted method; complete Fulfilment and Order once |
| Publish content/translation | Human Manager approval, immutable version, Arabic/optional-English rules, durable cache/search work |

No generic state mutation, Manager override, direct checkout, payment reversal, cancellation, item-production, raw file publication, or arbitrary job endpoint exists.

## 7. Authorization review

Authorization uses role + ownership + lifecycle + action + assurance + purpose. Manager is not an infrastructure administrator and cannot bypass state guards. Customer ownership is derived on the server and reinforced by RLS. Files inherit the parent resource authorization and classification. Jobs/webhooks receive narrow capabilities and cannot perform human acceptance, payment verification, production approval, or publication.

The design requires cross-Customer non-disclosure and field-level filtering. Customer timelines are purpose-built projections, not raw Audit Event access.

## 8. Error, idempotency, and validation review

- Stable error codes are separate from Arabic/English wording.
- `404` hides cross-Customer existence, `409` represents domain/idempotency conflict, `412` stale ETag, and `428` missing precondition.
- Same idempotency key + same request replays the result; same key + different request is rejected.
- Database uniqueness remains authoritative after idempotency-record expiry.
- Provider callbacks and jobs are at-least-once and semantically deduplicated.
- Validation is layered from transport through domain, transaction, database, file scan, provider mapping, and safe output.
- Missing policy/configuration does not select a default; the affected action remains unavailable.

## 9. Contradictions resolved

| Prior tension | Resolution in this package |
|---|---|
| Architecture/provider ADRs still displayed as Proposed after explicit approval | Approval recorded consistently; staged provider conditions retained |
| File upload could be mistaken for Payment Submission/verification | Upload/scan, proof submission, and Manager verification are three distinct contracts |
| Configurable rules could become a general expression engine | Only code-owned typed keys and bounded Product rule relations are allowed |
| Draft/live catalog could leak into historical Orders | Complete submitted/quotation/order snapshots and immutable database boundaries |
| Future item-level production might leak into Version 1 | No Order Item production field/API/relation; future support is additive |
| Continuous messaging could imply separate Order chats | One Conversation per Customer with optional validated Project or Order context per Message |
| Supabase could imply browser database access | Business data is server-only; no PostgREST/browser authority; application checks plus RLS |
| Deferred features could create dormant schema/API scope | Favorites, Saved Designs, Reviews, AI, advanced analytics, push, French, and 360 processing are explicitly absent |

## 10. Remaining Business Policy decisions

These do not block database/API design approval, but their affected public/Manager actions cannot release until decided:

| ID | Release-gated policy |
|---|---|
| BP-001 | Withdrawal, infeasibility, quotation expiry/reopening, accepted-unpaid follow-up |
| BP-002 | Discounts, rounding, Saudi tax/invoice wording |
| BP-003 | Payment exceptions, mistaken-verification correction, escalation, retention |
| BP-004 | Cancellation, refund, return, warranty, repair, dispute |
| BP-005 | Production delay, pause, cancellation, correction, revised estimate |
| BP-006 | Fulfilment failure, refusal, damage, partial handoff, dispute, recipient |
| BP-007 | Account closure/export/deactivation and Manager continuity |
| BP-008 | Class-specific retention/deletion/publication/recovery governance |
| BP-009 | Optional notifications and message/notification retention |
| BP-010 | English scope and editorial/legal correction/retention policy |

## 11. Remaining Configuration and operational decisions

`CFG-001` through `CFG-008` remain unset until their owners approve actual values. Before the affected implementation/release, the package also requires:

- database/application/S3 region and Saudi legal/data-residency approval;
- business time zone and actual business/contact/location bootstrap values;
- upload byte/page/dimension limits before external upload testing;
- session/reauthentication and abuse-control thresholds;
- retry, lease, batch, escalation, and telemetry/audit retention values;
- KMS/CDN/Object Lock/replication decisions only if their recorded trigger/policy applies;
- infrastructure-as-code tool and production operator/runbook ownership;
- approved tax/legal wording and policies before publication.

None may weaken Customer isolation, immutable history, Manager-only verification, production gating, or Arabic requirements.

## 12. Risks requiring implementation evidence

| Risk | Required evidence before release |
|---|---|
| RLS/session context leaks through pooled connections | Transaction-local context and multi-Customer integration/concurrency tests |
| Snapshot missing a fact later needed to interpret agreement | Snapshot completeness review and catalog-change historical rendering tests |
| Trigger/constraint diverges from domain state machine | Generated transition matrix tests against application and PostgreSQL |
| Acceptance/payment race creates duplicates | Concurrent same/different idempotency-key tests and unique-constraint evidence |
| JSONB becomes an ungoverned model | Schema-version registry, validators, bounded use review |
| Outbox/job backlog or duplicate email | Lease/retry/dead-letter/idempotency tests and operational alerts |
| File scan events arrive late/out of order | Contract tests for clean/malicious/unknown/duplicate/reordered outcomes |
| Migration locks or weakens history | Representative rehearsal, lock evidence, prior-release upgrade, immutable tests |
| Arabic errors/contracts regress | Key completeness, RTL workflows, bidi/error accessibility tests |

## 13. Approval checklist

The reviewer should explicitly approve or request changes to:

- [x] PostgreSQL schema/module ownership and table boundaries.
- [x] Mutable versus immutable record boundaries and snapshot contents.
- [x] Acceptance/Order and payment/production transaction guards.
- [x] RLS/database-role defense in depth.
- [x] File upload/scan/submission separation and parent authorization.
- [x] Expand–migrate–contract and recovery posture.
- [x] `/api/v1` first-party contract and named command design.
- [x] ETag, idempotency, error, validation, and provider-callback semantics.
- [x] Explicitly absent/unapproved endpoints and deferred-feature persistence.
- [x] Remaining policy/configuration gates.

## 14. Final recommendation

### Approved for implementation planning

The database/API design is internally consistent with the approved planning and architecture package. The Product Owner approved it on 2026-07-16 and authorized implementation planning. Schema/migration and endpoint implementation remain unauthorized until the Product Owner separately starts implementation.

This turn did not provision Supabase, create schemas or migrations, implement endpoints, generate application/UI code, modify infrastructure, or deploy anything.

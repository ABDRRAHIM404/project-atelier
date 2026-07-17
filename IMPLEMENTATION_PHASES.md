# Version 1 Implementation Phases

**Status:** Approved by the Product Owner on 2026-07-16  
**Planning date:** 2026-07-16  
**Authority:** `IMPLEMENTATION_PLAN.md` and the approved product/architecture/database/API package

## 1. Gate model

Each phase uses four controls:

1. **Entry criteria:** upstream contracts and evidence that must already exist.
2. **Execution scope:** only the listed Version 1 capability and supporting quality work.
3. **Phase Definition of Done:** phase-specific evidence plus every applicable item in `QUALITY_GATES.md`.
4. **Release gate:** an explicit pass/fail decision before dependent work relies on the phase.

Passing a phase does not waive unresolved launch policies or authorize production deployment.

## 2. P0 — Delivery Foundation

### Objective

Create the smallest deployable/testable modular-monolith foundation with enforceable module boundaries, Arabic RTL defaults, shared value/error contracts, and automated quality checks.

### Prerequisites

- Database/API design approved.
- ADR-001 through ADR-024 remain Accepted.
- P0 task scope approved; no provider production resources required.

### Planned tasks

`FND-001` through `FND-008` and `TST-001` through `TST-003` from `IMPLEMENTATION_BACKLOG.md`.

### Expected outputs

- approved runtime/framework baseline and deterministic dependency workflow;
- module-boundary and server-only dependency enforcement;
- shared Identifier, Money, Locale, Actor, time, result, and Problem Details contracts;
- Arabic-first localization and RTL document/layout foundation;
- correlation, safe logging, telemetry, and secret-scrubbing conventions;
- unit/integration/browser test projects and CI gate skeleton;
- environment/configuration validation that fails closed; and
- a production-buildable shell with no invented business behavior.

### Testing

- static type/lint/format/build checks;
- architecture-boundary tests;
- unit tests for shared values, money, locale, UTC/business-time handling, and error serialization;
- an Arabic RTL browser smoke path with no console errors;
- secret/log redaction checks; and
- CI clean-install reproducibility.

### Phase Definition of Done

- All P0 tasks meet their completion criteria.
- A clean environment can run the same checks locally and in CI.
- No domain module imports framework/provider/database types.
- Arabic is the default and French has no Version 1 runtime route/catalog.
- Quality evidence is stored in a repeatable location and failed checks block merging.
- Relevant Global Definition of Done items pass.

### Gate G0 — Foundation Green

Pass only when the build/test skeleton is reproducible, boundary enforcement works, and no later module must bypass it. Failure keeps all business implementation blocked.

## 3. P1 — Trusted Data, Identity, Authorization, and Durable Operations

### Objective

Establish the relational, identity, authorization, audit, idempotency, outbox, job, and migration foundations used by every protected workflow.

### Prerequisites

- G0 passed.
- Approved database module ownership, migration strategy, authorization matrix, error model, and idempotency rules available.
- Isolated local/CI PostgreSQL strategy authorized; no shared production database.

### Planned tasks

`DAT-001` through `DAT-007`, `IAM-001` through `IAM-005`, `OPS-001`, and `TST-004` through `TST-006`.

### Expected outputs

- reviewed migration harness and initial module-owned persistence foundations;
- local principal/external identity mapping and single-Manager invariant;
- typed configuration revisions and required-value readiness checks;
- transaction-local actor context, database roles, RLS defense, and field filtering;
- append-only Audit Events, idempotency records, outbox, leased jobs, and provider-event deduplication;
- Clerk adapter with Customer OTP and Manager MFA assurance boundaries; and
- isolated fixture/seed strategy containing no production personal data.

### Testing

- empty-database migration and drift checks;
- Customer A/Customer B/Manager/system authorization matrix;
- pooled-connection actor-context leakage tests;
- Manager assurance and unmapped/disabled identity tests;
- audit append-only and safe-metadata tests;
- outbox/job lease, retry, crash recovery, and deduplication tests;
- webhook signature/replay contract tests; and
- database failure and transaction rollback injection.

### Phase Definition of Done

- Protected reads/writes cannot run without resolved local actor context.
- Runtime/job roles cannot own data or bypass RLS.
- Cross-Customer negative tests pass under concurrent pooled connections.
- Audit/outbox commit atomically with representative state changes.
- Duplicate jobs/provider events have one semantic outcome.
- Migration apply, rollback strategy, drift, and recovery evidence are documented.
- Relevant Global Definition of Done items pass.

### Gate G1 — Trust Boundary Proven

Pass only after security and database reviewers approve identity mapping, authorization enforcement, RLS context, audit immutability, migration safety, and durable work. Protected feature phases cannot proceed without G1.

## 4. P2 — Discovery, Content, Search, and File Foundations

### Objective

Deliver the Arabic public discovery slice and secure file/media lifecycle needed by later private and payment workflows.

### Prerequisites

- G1 passed.
- Catalog/CMS, localization, Files, Storage, and public API contracts stable.
- Test-only file limits may be used for isolated fixtures; external uploads wait for the applicable approved `CFG-003` upload limit and staged GuardDuty trigger.

### Planned tasks

`CAT-001` through `CAT-007`, `CMS-001` through `CMS-005`, `FIL-001` through `FIL-007`, and `TST-007` through `TST-010`.

### Parallel lanes

- Lane A: Catalog/configuration/search domain and manager publication.
- Lane B: CMS/Translation versioning and locale publication.
- Lane C: File metadata, signed operations, scan lifecycle, and access control.
- Lane D: Arabic storefront/presentation against stable read contracts.

Media publication integrates only after A/C contracts pass. Public presentation consumes contracts and fixtures; it does not write Catalog data.

### Testing

- catalog configuration and publication unit/integration tests;
- Arabic normalization, tolerant search, ranking corpus, and unpublished-data exclusion;
- immutable published content/translation revision tests;
- public/private/sensitive/restricted file authorization tests;
- signed capability expiry/scope, checksum/type/size, duplicate/out-of-order scan events, and malicious-file quarantine tests;
- responsive Arabic catalog Playwright journeys, axe checks, media budgets, and Lighthouse baseline; and
- cache invalidation/reconciliation evidence.

### Phase Definition of Done

- Only published Arabic-approved content appears publicly.
- Optional English never exposes incomplete/draft content; French is absent.
- Catalog rules are bounded and do not become a general rule engine.
- Every upload is private/quarantined until validation and clean scan complete.
- Public promotion is explicit, audited, and cannot publish Customer/payment material.
- Public pages meet applicable accessibility, media, mobile, and performance gates.
- Relevant Global Definition of Done items pass.

### Gate G2 — Discovery and File Boundary Proven

Pass after a Visitor can complete the Arabic discovery journey and security tests prove public/private storage separation. External Customer uploads remain disabled until their approved configuration/provider trigger is satisfied.

## 5. P3 — Customer Projects, Submission, Clarification, and Messaging

### Objective

Deliver authenticated multi-item Customer Projects, immutable Submitted Requests, Manager review, and the continuous Customer–Manager conversation.

### Prerequisites

- G2 passed.
- Customer identity, Catalog configuration reads, private file attachment path, and audit/outbox foundations stable.

### Planned tasks

`PRJ-001` through `PRJ-006`, `MSG-001` through `MSG-005`, and `TST-011` through `TST-013`.

### Parallel lanes

- Customer Project aggregate, configuration validation, and submission transaction.
- Messaging conversation/domain and safe attachment association.
- Customer and Manager interaction surfaces against fixed contracts.

Submission remains single-owner because it freezes Project state, creates the complete Submitted Request snapshot, Audit Event, and outbox intents together.

### Testing

- draft ownership/state/property tests;
- configuration revalidation against current published rules;
- multi-item snapshot completeness and catalog-change history tests;
- concurrent/stale submission and rollback tests;
- continuous-conversation access, contextual linkage, attachment classification, and cross-Customer denial;
- Arabic multi-item Project and Manager clarification Playwright journeys; and
- notification/audit intent tests without depending on Resend availability.

### Phase Definition of Done

- Customers can create/edit only their own eligible drafts.
- submission freezes the expected Project version and creates one immutable Submitted Request;
- later Catalog/Project changes do not rewrite submitted history;
- Manager can review and clarify without silently modifying Customer intent;
- one continuous authorized conversation supports validated Project/Order context;
- required states and accessible error/retry paths exist in Arabic; and
- relevant Global Definition of Done items pass.

### Gate G3 — Request Submitted

Pass when the Customer-to-Manager submitted-request journey is complete, isolated, immutable, auditable, and recoverable. Quotation implementation may then rely on Submitted Request history.

## 6. P4 — Quotations, Acceptance, and Orders

### Objective

Implement versioned Manager quotations and the exactly-once, atomic Customer Acceptance transaction that creates immutable Orders.

### Prerequisites

- G3 passed.
- Submitted Request snapshot contract stable.
- Money, configuration revision, idempotency, locking, Audit, Fulfilment snapshot input, and notification event contracts frozen.

### Planned tasks

`QUO-001` through `QUO-006`, `ORD-001` through `ORD-006`, and `TST-014` through `TST-017`.

### Parallel lanes

- Quotation draft/item/price authoring and revision lifecycle.
- Order snapshot/read/timeline model.
- Customer quotation history/decision presentation.

The Acceptance coordinator and its database migration are serialized under one owner after Quotation and Order contracts pass.

### Testing

- Money totals, revision numbering, send/freeze/supersede transitions;
- current-sent-only acceptance, stale ETag, idempotency replay, and different-digest conflict;
- concurrent acceptance proving exactly one Acceptance and one Order;
- injected rollback proving no partial Acceptance/Order/Audit/outbox state;
- immutable sent/accepted Revision, Quotation Item, Order Item, price, terms, locale, and fulfilment snapshots;
- live Catalog/translation/config mutation without historical drift;
- cross-Customer and field-filtering security tests; and
- Arabic Manager quote and Customer accept/revision-request Playwright journeys.

### Phase Definition of Done

- only the current sent Revision can be accepted;
- sent/accepted history cannot be mutated or deleted through any application/database path;
- acceptance records evidence and creates exactly one `AWAITING_PAYMENT` Order atomically;
- no payment or production begins during acceptance;
- historical Orders render entirely from snapshots;
- all critical concurrency and rollback tests pass; and
- relevant Global Definition of Done items pass.

### Gate G4 — Commercial Boundary Proven

Pass only after domain, database, API, security, and Product Owner acceptance evidence confirms the immutable commercial transaction. Payment work cannot rely on Orders before G4.

## 7. P5 — Bank-Transfer Proof and Manual Payment Verification

### Objective

Deliver the sensitive-file payment flow while proving that only an authorized Manager decision verifies payment.

### Prerequisites

- G4 passed.
- Sensitive S3 zone and clean-scan path verified for the target environment.
- Actual upload limits and operational scan response approved before non-team external testing.
- Payment exception/correction actions remain absent until `BP-003` approval.

### Planned tasks

`PAY-001` through `PAY-006` and `TST-018` through `TST-021`.

### Testing

- upload intent/finalize/scan/submission separation;
- wrong owner, wrong purpose, unsafe, expired, missing, duplicate, and reordered file events;
- immutable repeated submission/rejection history;
- Manager MFA and purpose-limited proof access with audit evidence;
- manual verify/reject idempotency and concurrency;
- proof upload alone and background/provider events never verifying Payment;
- verification transaction updating Payment/Order/Audit/outbox exactly once; and
- Arabic Customer upload/recovery and Manager review Playwright journeys.

### Phase Definition of Done

- only a clean, own, correctly purposed proof creates a reviewable Payment Submission;
- every attempt remains historical and no replacement overwrites evidence;
- proof bytes and signed URLs never enter public cache, logs, notification payloads, or normal list responses;
- only the MFA-authenticated Manager can verify/reject;
- verification unlocks but does not start Production;
- unsupported correction/reversal/partial-payment behavior remains unavailable; and
- relevant Global Definition of Done items pass.

### Gate G5 — Payment Gate Proven

Pass only after security review and direct-request/concurrency tests prove the manual verification boundary. Production remains blocked until G5.

## 8. P6 — Order-Level Production and Fulfilment

### Objective

Deliver high-level Order production tracking and accepted pickup/delivery completion without adding item-level manufacturing or unresolved exception states.

### Prerequisites

- G5 passed.
- Order, verified Payment read, accepted fulfilment snapshot, Files/handoff proof, Audit, and notification contracts stable.
- Delivery/pickup configuration required for the tested method is approved; unresolved failure/cancellation flows remain unavailable.

### Planned tasks

`PRO-001` through `PRO-005`, `FUL-001` through `FUL-006`, and `TST-022` through `TST-025`.

### Parallel lanes

- Production state machine/Manager operations.
- Fulfilment state machine/handoff evidence.
- Customer timeline/read projection.

The first Production transition and Production `READY` → Fulfilment coordination are integration-owned, serialized transactions.

### Testing

- table-driven allowed/forbidden Production and Fulfilment transitions;
- direct-request proof that no Production state leaves `NOT_STARTED` without verified Payment;
- rework loop and idempotent/stale concurrent transition tests;
- assertion that no Order Item production lifecycle exists;
- delivery/pickup method consistency and immutable accepted terms;
- clean handoff evidence before completion;
- unresolved pause/cancel/failure/refusal/partial paths rejected; and
- Arabic Manager progress and Customer timeline/completion Playwright journeys.

### Phase Definition of Done

- Production follows only the accepted Order-level sequence;
- verified payment is rechecked atomically on first transition;
- Order Item Snapshots remain immutable and have no production state;
- fulfilment uses accepted method/location/address/price snapshots;
- completion requires authorized clean handoff evidence;
- notifications/audit/timelines reflect committed facts without provider authority; and
- relevant Global Definition of Done items pass.

### Gate G6 — Core Transaction Complete

Pass when a synthetic Arabic Customer/Manager journey completes discovery through delivery/pickup with all invariants intact. This is the first complete core-transaction milestone, not production approval.

## 9. P7 — Operational Workspaces, Essential Notifications, and Recovery Controls

### Objective

Make the complete workflow operable for one Manager and understandable for Customers, with durable in-app/email notifications and actionable recovery states.

### Prerequisites

- G6 passed.
- Read projections/event contracts for every core state stable.
- Resend/provider smoke use remains limited to authorized isolated staging.

### Planned tasks

`WRK-001` through `WRK-005`, `NOT-001` through `NOT-006`, and `TST-026` through `TST-029`.

### Parallel lanes

- Customer workspace/orders/timelines/notifications.
- Manager request/quote/payment/production/fulfilment queues.
- event/template registry and in-app fan-out.
- email adapter/delivery/reconciliation and operations views.

### Testing

- queue/read-projection ownership and freshness;
- all seven essential event-to-in-app/email mappings;
- Arabic templates, optional English gating, escaping, bidi, and sensitive-field exclusion;
- duplicate, delayed, failed, dead-letter, and reconciliation behavior;
- provider outage proving business transactions still commit;
- authorization of notification/operational views; and
- complete Customer and Manager browser journeys including loading/empty/error/retry/success states.

### Phase Definition of Done

- one Manager can identify and action every core queue without raw database/provider access;
- Customers see only their own current/history/timeline data;
- each essential event creates one semantic in-app notification and an observable email delivery intent;
- email failure cannot repeat or roll back a business transition;
- operational recovery is documented and auditable;
- Manager efficiency measures can be observed without advanced analytics; and
- relevant Global Definition of Done items pass.

### Gate G7 — Operationally Viable

Pass after Manager acceptance of the end-to-end staging workflow and successful notification/reconciliation failure drills.

## 10. P8 — Release Candidate Hardening

### Objective

Freeze one release candidate and produce complete functional, security, accessibility, localization, browser, performance, resilience, migration, backup, and recovery evidence.

### Prerequisites

- G7 passed.
- Version 1 scope frozen.
- All policies/configuration values affecting the candidate identified with owner and approval state.
- Production-like isolated staging available under the accepted provider topology.

### Planned tasks

`HARD-001` through `HARD-009` and `TST-030` through `TST-035`.

### Testing

- full unit/integration/contract/Playwright matrices;
- full authorization and threat-model suite;
- WCAG 2.2 AA automated/manual review with zero critical and no unresolved A/AA failure;
- accepted browser/device/viewport and Arabic RTL matrix;
- optional English only for declared complete surfaces;
- Lighthouse/media/CWV lab budgets and k6 API targets under documented profile;
- provider timeout/replay/outage, job interruption, and scan-delay resilience;
- clean install and prior-release migration rehearsal;
- database restore plus private-object reconciliation within accepted RPO/RTO; and
- rollback/promotion drill with current runbooks.

### Phase Definition of Done

- every included feature satisfies the Global Definition of Done;
- no critical/high security defect, critical accessibility violation, data-loss risk, authorization bypass, or invariant failure remains;
- all accepted measurable Quality Gates have traceable evidence;
- production build and migration/rollback/restore rehearsals pass;
- all release-affecting `BP-*`/`CFG-*` decisions are approved or the affected feature is removed/disabled without violating Version 1 core;
- operational owners and incident paths are documented; and
- release candidate contents are immutable except reviewed fixes.

### Gate G8 — Release Candidate Qualified

Pass only with technical, security, accessibility, Product Owner, and operations sign-off. Failure returns the candidate to the owning phase; gates are rerun after changes.

## 11. P9 — Production Readiness and Launch Authorization

### Objective

Validate production-specific configuration and staged provider readiness, then obtain an explicit launch decision.

### Prerequisites

- G8 passed.
- Product Owner has approved all customer-facing policies and Arabic wording.
- Provider regions/legal posture, production budgets, domains, secrets, ownership, and staged-adoption triggers approved.
- Current official provider terms/pricing rechecked before purchase/provisioning.

### Planned tasks

`REL-001` through `REL-009`.

### Testing

- production configuration completeness without secret disclosure;
- least-privilege provider/IAM/access inventory;
- verified Clerk Manager MFA/recovery and Customer identity path;
- S3 versioning/zones plus GuardDuty before external uploads;
- Supabase backup/PITR and restore evidence;
- Vercel Pro commercial deployment readiness and authenticated scheduled reconciliation;
- Resend domain/delivery and Sentry/OTel scrubbing/alert smoke evidence;
- migration, rollback, incident, outage, and support runbooks;
- Manager operational acceptance and launch checklist; and
- monitored, reversible promotion plan.

### Phase Definition of Done

- every `IMPLEMENTATION_CHECKLIST.md` production item is evidenced;
- no unresolved decision affects a released behavior or legal/customer promise;
- backups, alerts, provider failure modes, reconciliation, and rollback are verified;
- support and emergency access ownership are accepted;
- baseline dashboards and spend/quota alerts are active;
- post-launch verification and rollback criteria are explicit; and
- the Product Owner records the launch authorization.

### Gate G9 — Launch Authorized

Production promotion occurs only under a separate explicit deployment instruction after G9. Implementation-plan approval, implementation completion, or a green CI run is not launch authorization.

## 12. Phase failure and recovery

- A gate failure records failed evidence, owner, impact, remediation, and rerun scope.
- Downstream phases may continue only on independent work that does not consume the failed contract.
- Invariant, authorization, privacy, migration, or recovery failures block all dependent work.
- A change to an accepted contract reopens the owning phase and every affected downstream gate.
- An unresolved business policy never receives a technical default to make a gate pass.

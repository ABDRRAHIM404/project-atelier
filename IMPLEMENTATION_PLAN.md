# Version 1 Implementation Plan

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Approved by the Product Owner on 2026-07-16  
**Planning date:** 2026-07-16  
**Scope:** Version 1 implementation planning only  
**Implementation authorization:** P1 — Trusted Data and Access only; P0 complete

## 1. Purpose

This plan converts the approved product, architecture, database, authorization, and API contracts into a controlled implementation program. It defines work order, ownership, evidence, integration gates, and release readiness without creating application code, database migrations, provider resources, endpoints, UI components, or infrastructure.

## 2. Authoritative baseline

Implementation must conform to:

- `MASTER_PRD.md`, `DOMAIN_MODEL.md`, and `STATE_MACHINES.md` for scope and behavior;
- `QUALITY_GATES.md` for the mandatory Definition of Done and measurable targets;
- `ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`, and `ADR_INDEX.md` for accepted structure and providers;
- the specialist architecture documents for security, storage, identity, localization, notifications, observability, deployment, and testing;
- `DATABASE_DESIGN.md`, `MIGRATION_STRATEGY.md`, `AUTHORIZATION_MODEL.md`, `API_CONTRACTS.md`, `ERROR_MODEL.md`, `IDEMPOTENCY_RULES.md`, and `VALIDATION_STRATEGY.md` for the approved implementation contracts;
- `DECISION_WORKSHOP.md` for unresolved `BP-*` and `CFG-*` gates; and
- `ANTI_PATTERNS.md` for prohibited shortcuts.

If implementation evidence exposes a contradiction, work stops at the affected boundary and the authoritative document is amended through review. Code convenience does not silently revise a product or architecture decision.

## 3. Intended outcome

Version 1 delivers one Arabic-first, RTL-native, server-authoritative modular monolith supporting the complete transaction:

1. discover published products and content;
2. authenticate as Customer or Manager;
3. configure multiple items and submit a Customer Project;
4. review, clarify, revise, send, and accept a Quotation;
5. atomically create an Order with immutable commercial snapshots;
6. upload bank-transfer proof and manually verify payment;
7. track production at Order level only;
8. complete pickup or delivery with handoff evidence;
9. communicate through the continuous Customer–Manager conversation; and
10. receive the seven essential in-app and email notifications.

No direct checkout, automatic payment verification, item-level production, French, Reviews, Favorites, Saved Designs, AI, push, advanced analytics, advanced 360° processing, multi-tenancy, microservices, worker management, or inventory enters Version 1.

## 4. Delivery principles

1. **Risk first:** prove Customer isolation, immutable history, transaction atomicity, payment gating, and private-file handling before feature breadth.
2. **Walking vertical slices:** each business phase includes domain, persistence, authorization, contract, presentation, audit, notification, and tests where applicable.
3. **One source of truth:** modules own writes; cross-module transactions use explicit coordinators; no HTTP calls occur between modules.
4. **Arabic from the first slice:** Arabic message catalogs, RTL layout, bidi-safe content, and localized errors are built and tested continuously.
5. **Configuration fails closed:** an unset `BP-*` or `CFG-*` value disables or blocks the affected action; it never activates a guessed default.
6. **Durability before delivery:** Audit Events and outbox intents commit with business state; provider delivery is idempotent and recoverable.
7. **Real PostgreSQL evidence:** constraints, RLS, migrations, concurrency, search, and transactions are tested against isolated PostgreSQL, not mocked equivalents.
8. **Provider boundaries:** Clerk, S3/GuardDuty, Resend, Sentry, Supabase, and Vercel remain behind accepted adapters and staged-adoption triggers.
9. **Small changes:** migrations and application changes remain forward-compatible through expand–migrate–contract; irreversible work requires explicit review.
10. **Evidence is part of delivery:** a task is incomplete until its tests, security evidence, quality checks, documentation, and recovery path exist.

## 5. Phase map

| Phase | Objective | Primary release evidence |
|---|---|---|
| P0 — Delivery Foundation | Establish repository, module, quality, test, localization, and observability guardrails | Reproducible local/CI validation and production build skeleton |
| P1 — Trusted Data and Access | Implement persistence foundations, identity mapping, authorization, RLS, audit, idempotency, outbox, and jobs | Cross-Customer denial, Manager assurance, migration and transaction evidence |
| P2 — Discovery and File Foundations | Deliver Catalog/CMS/search/public media foundations and the secure file lifecycle | Published Arabic catalog slice plus private/public file isolation |
| P3 — Projects and Clarification | Deliver multi-item drafts, immutable submission, Manager review, and continuous messaging | Customer Project submission and clarification journey |
| P4 — Quotations, Acceptance, and Orders | Deliver immutable revisions and exactly-once acceptance-created Orders | Concurrent acceptance and historical-snapshot evidence |
| P5 — Payment Verification | Deliver clean proof submission, Manager review, rejection history, and manual verification | Proof alone cannot verify; verified payment unlocks but does not start production |
| P6 — Production and Fulfilment | Deliver Order-level production and pickup/delivery completion | Full verified-payment-to-handoff journey |
| P7 — Operational Workspaces and Notifications | Complete Manager/Customer workspaces, seven notification flows, reconciliation, and recovery controls | Operable queues, timelines, in-app/email delivery evidence |
| P8 — Release Candidate Hardening | Close security, accessibility, RTL, browser, performance, resilience, migration, and recovery evidence | All accepted Quality Gates pass in staging |
| P9 — Production Readiness and Launch | Verify production configuration, providers, runbooks, restore, rollback, and Manager acceptance | Signed launch decision and monitored staged promotion |

Detailed entry, exit, test, and gate criteria are in `IMPLEMENTATION_PHASES.md`. Task-level ownership and outputs are in `IMPLEMENTATION_BACKLOG.md`.

## 6. Critical path

The minimum technical critical path is:

`P0 → P1 → P2 Catalog/File readiness → P3 Submitted Request → P4 Acceptance/Order → P5 Verified Payment → P6 Production/Fulfilment → P7 Operability → P8 Release Candidate → P9 Launch`

The following dependencies cannot be bypassed:

- module and transaction foundations precede business persistence;
- local identity and authorization precede protected feature work;
- Catalog configuration precedes Project Item validation;
- secure Files precede external attachments and Payment Submission;
- immutable Submitted Request precedes Quotation creation;
- current sent Quotation Revision precedes Customer Acceptance;
- Acceptance and Order snapshots commit together;
- a clean Payment Submission precedes manual Payment Verification;
- verified Payment precedes the first Production transition;
- Production `READY` precedes fulfilment readiness/completion; and
- integrated workflow evidence precedes production promotion.

## 7. Parallel work model

Parallelism is allowed only after contracts and ownership are fixed for the wave.

### Safe parallel lanes

- P0: test/CI harness, module-boundary enforcement, localization foundation, and observability conventions.
- P1: identity adapter, shared database conventions, and audit/outbox foundations after shared Actor/Money/ID/Error contracts are frozen.
- P2: Catalog/CMS, secure Files, and public presentation can progress independently; media publication integration waits for both Catalog and Files.
- P3: Customer Project domain and Messaging domain can progress in parallel; attachment integration waits for Files.
- P4: Quotation authoring and Order read/snapshot foundations can progress in parallel; the Acceptance coordinator is the integration point and remains single-owner.
- P6: Production and Fulfilment domain work can progress in parallel after Payment and Order contracts are stable; end-to-end transitions integrate sequentially.
- P7: Customer workspace, Manager queues, notification templates, and provider delivery adapters can progress in parallel against fixed read/event contracts.
- P8: accessibility, performance, security, resilience, browser, and recovery evidence can run in parallel against one frozen release candidate.

### Conflict controls for multiple Codex agents

1. Assign one agent as integration owner for each phase and one owner per module boundary.
2. Give each agent disjoint module source and test ownership; do not assign two agents to the same migration, shared contract, localization catalog, generated artifact, lockfile, or configuration file.
3. Freeze cross-module command/event/read contracts before parallel implementation begins.
4. Serialize database migration numbering and all changes to shared primitives, authorization context, error codes, and build configuration.
5. Require provider lanes to use fakes/contract fixtures until an explicitly authorized staging integration task.
6. Merge foundation contracts before consumers, then rebase each lane and run the full affected gate.
7. Keep the Acceptance coordinator, Payment Verification coordinator, first Production transition, and production release promotion under a single owner/reviewer at a time.

`DEPENDENCY_GRAPH.md` and `MODULE_IMPLEMENTATION_ORDER.md` define the exact safe and unsafe boundaries.

## 8. Task contract

Every backlog task must record:

- stable task ID and target phase;
- owning module or cross-module coordinator;
- prerequisites and upstream contracts;
- expected implementation and test outputs;
- positive, negative, concurrency, and recovery criteria where applicable;
- applicable `QUALITY_GATES.md` requirements;
- documentation, telemetry, audit, and rollback obligations; and
- unresolved `BP-*`/`CFG-*` gate, if any.

A task cannot be declared complete by code review alone.

## 9. Definition of Done inheritance

Every task and phase inherits the complete Global Definition of Done in `QUALITY_GATES.md`. A phase-specific checklist narrows what evidence is relevant but never weakens the global gate. At minimum:

- business behavior and state-machine rules pass;
- server-side allowed/denied authorization is verified;
- types, lint, formatting, unit, integration, relevant Playwright, and production build pass;
- Arabic RTL and optional included English are verified;
- mobile/desktop, loading, empty, error, permission-denied, and success states are present;
- applicable accessibility, browser, performance, and media targets pass;
- no unexpected console error or sensitive-data exposure exists;
- audit, notification, telemetry, migration, configuration, recovery, and documentation obligations are complete; and
- the change has a safe rollback or forward-recovery path.

Security authorization, verified-payment gating, accepted-history immutability, and private-file protection cannot receive routine exceptions.

## 10. Decision and configuration workstream

`BP-001` through `BP-010` and `CFG-001` through `CFG-008` run beside implementation as a Product Owner/operations workstream. They do not prevent P0 from starting, but each affected task must remain disabled, use synthetic test-only configuration, or stop at its release gate until approved values exist.

The workstream must:

1. record owner, decision, effective date, rationale, and affected surfaces;
2. update `DECISION_WORKSHOP.md` and every affected source document;
3. add typed validation and audit history without general-purpose executable rules;
4. add test fixtures for approved and missing configuration; and
5. provide approved Arabic wording before public or transactional publication.

No implementation task is authorized to decide policy content.

## 11. Change and defect governance

- A product/architecture contradiction becomes a documentation decision, not an implicit implementation change.
- A failed invariant test blocks its phase and every downstream phase.
- Critical/high security defects, critical accessibility violations, data-loss risks, and migration/recovery failures block release.
- Flaky tests are defects; temporary quarantine needs owner, reason, expiry, and equivalent control.
- Deferred scope requires Product Owner approval and updated planning before entering the backlog.
- Provider pricing/terms and region compatibility are rechecked only at the recorded purchase/provisioning trigger.

## 12. Approval boundary

The Product Owner approved this plan, approved P0 completion, and explicitly authorized P1 on
2026-07-16. This authorization does not include P2, remote/production provider provisioning, production
data, unresolved policy values, deployment, or launch. Each later phase still requires its documented
release gate and a separate Product Owner instruction.

This planning phase creates documentation only.

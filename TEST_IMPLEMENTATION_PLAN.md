# Version 1 Test Implementation Plan

**Status:** Approved by the Product Owner on 2026-07-16  
**Authority:** `QUALITY_GATES.md`, `TEST_STRATEGY.md`, approved domain/state/database/API contracts  
**Toolchain:** TypeScript/ESLint, Vitest, real PostgreSQL integration tests, Playwright Test, axe-core, Lighthouse CI, k6, security and recovery checks

## 1. Objective

Build verification at the same time as each implementation slice so the release does not depend on a late test phase. Tests must prove business behavior, database enforcement, authorization, Arabic RTL quality, provider isolation, recoverability, and measurable quality—not merely handler success.

## 2. Test ownership model

| Evidence type | Primary owner | Required independent review |
|---|---|---|
| Domain/state/unit | Owning business module | Another module or test reviewer for critical invariants |
| Persistence/migration/RLS | Owning module + Data Platform | Database and security reviewer |
| Cross-module transaction | Named coordinator owner | Every participating module plus test reviewer |
| API contract/error/idempotency | Owning application boundary | Consumer/presentation and security reviewer |
| Presentation/Playwright | Presentation owner | Domain owner and accessibility reviewer |
| Provider contract | Adapter owner | Owning business module and security reviewer |
| Performance/resilience | Performance/operations owner | Affected module and release owner |
| Backup/restore/rollback | Data/files/deployment owner | Release and security/operations reviewer |

The author of a critical transaction cannot be its only reviewer.

## 3. Test layers and responsibilities

| Layer | Must prove | Must not be replaced by |
|---|---|---|
| Static/boundary | Strict types, lint, forbidden imports, server-only/provider separation, message-key completeness | Runtime tests alone |
| Unit/property | Money, locale/time, configuration rules, state transitions, error mapping, event/template schemas | Browser happy paths |
| Database integration | Constraints, transactions, RLS, locks, concurrency, immutability, migrations, outbox/jobs, query plans | In-memory repositories or mocked SQL |
| Application/API contract | Actor-scoped commands/queries, validation, Problem Details, ETag, idempotency, output filtering | UI visibility checks |
| Provider contract | Signing, replay, mapping, outage, retry, idempotency, scrubbing | Uncontrolled live-provider calls in routine CI |
| Browser E2E | Real Customer/Manager workflows, accessibility, RTL, responsive/universal states, console safety | Unit snapshots alone |
| Performance | Accepted API/media/page budgets under recorded profiles | Subjective “fast” review |
| Security | Cross-account denial, assurance, XSS/file/webhook/cache/log/secret controls | Hidden routes/buttons |
| Recovery | Migration compatibility, rollback/forward recovery, restore and object reconciliation | Provider backup status page |

## 4. Test infrastructure implementation order

### T0 — Foundation in P0

- deterministic unit and integration project discovery;
- browser projects for Chromium, Firefox, WebKit and representative viewports;
- axe integration and unexpected-console/unhandled-rejection failure capture;
- fixture factories and stable clock/ID/provider ports;
- privacy-safe evidence/artifact handling; and
- CI stages that can block merge.

**Exit:** a deliberately broken type, boundary, unit, browser, axe, build, and budget check is independently shown to fail the gate.

### T1 — Real data/security harness in P1

- isolated PostgreSQL matching production major/extensions;
- migrations from empty and upgrade fixtures;
- Customer A, Customer B, Manager, system, provider and anonymous actors;
- transaction-local RLS context and connection-pool concurrency;
- idempotency/outbox/job/provider-event failure injection; and
- synthetic Arabic/bidi data without production records.

**Exit:** cross-Customer leakage, owner/bypass roles, partial transactions, duplicate semantic work and actor-context carryover are all rejected.

### T2 — Provider contract harnesses in P1–P2

- Clerk session/factor/webhook fixtures;
- S3 capability/object-version/access fixtures;
- GuardDuty clean/malicious/failed/delayed/reordered events;
- Resend send/callback/failure fixtures;
- Sentry/OTel redaction/correlation fixtures; and
- Vercel reconciliation authentication/concurrency fixtures.

**Exit:** routine suites are deterministic without live paid services, and isolated staging smoke tests can run only with explicit authorization.

### T3 — Journey fixtures in P2–P7

- published/draft Arabic Catalog/CMS content;
- valid/invalid Product configurations;
- multiple Customers and multi-item Projects;
- Submitted Request and multiple Quotation Revisions;
- accepted Order snapshots, repeated Payment Submissions, pickup/delivery;
- Messages/Attachments and all seven Notification events; and
- malicious/unknown/late file and provider cases.

**Exit:** fixtures exercise history, concurrency, empty/error states and negative authorization, not just a clean happy path.

### T4 — Release evidence in P8–P9

- full browser/device/language matrix;
- manual accessibility and security reviews;
- Lighthouse/k6/query/media profiles;
- migration/rollback/resilience/provider outage drills;
- database restore/object reconciliation; and
- Manager acceptance and production-readiness smoke plans.

**Exit:** traceable evidence satisfies G8/G9; production execution remains separately authorized.

## 5. Phase test matrix

| Phase | Unit/property | PostgreSQL/integration | API/contract | E2E/accessibility | Security/resilience | Gate evidence |
|---|---|---|---|---|---|---|
| P0 | Shared values, locale, error mapping | Harness connectivity only | Problem/envelope fixtures | Arabic RTL smoke + axe | Boundary and log/secret scrub | G0 reproducibility |
| P1 | Actor/config/idempotency/job rules | Migration, RLS, audit, outbox, leases, concurrency | Identity/session/webhook/error contracts | Customer/Manager auth representative paths | Cross-Customer, MFA, replay, DB failure | G1 trust review |
| P2 | Catalog/config/content/file lifecycles | Publication, search, file metadata/event ordering | Public reads, manager commands, signed operations | Arabic browse/search/content/media | Draft leak, file abuse, public/private separation | G2 discovery/file evidence |
| P3 | Project, submission and message rules | Atomic snapshot, ownership, attachment inheritance | Project/Request/Message ETag/idempotency/error | Multi-item submit and clarification | Cross-Customer, stale/replay, provider-independent notification | G3 request evidence |
| P4 | Money/revision/acceptance/order rules | Freeze, immutability, serializable acceptance, rollback | Current-action/history/accept contracts | Manager quote/revise + Customer accept | Concurrent acceptance, historical leak/mutation | G4 commercial evidence |
| P5 | Payment lifecycle/reason schemas | Submission/verification uniqueness and transaction | File-submit/review/verify/reject contracts | Customer proof + Manager review | Sensitive file, MFA, proof-never-verifies, outage/replay | G5 payment evidence |
| P6 | Production/Fulfilment state matrices | Verified-payment guard, sequence/evidence/completion | Named transitions and timelines | Production to pickup/delivery completion | Direct bypass, wrong proof/method, duplicate completion | G6 complete transaction |
| P7 | Notification registry/templates/read rules | Fan-out/delivery attempts/projections | Workspace/notification/operations contracts | Full core journeys and seven notifications | Email outage/reconcile, queue field leakage | G7 Manager acceptance |
| P8 | Full regression | Empty/upgrade/full integration suite | Full compatibility/error/idempotency | Accepted browser/RTL/axe matrix | Threat, load, resilience, restore, rollback | G8 quality dossier |
| P9 | Configuration schema checks | Production plan validation only until authorized | Provider smoke plan | Manager UAT and launch smoke plan | Access inventory, alert/runbook drills | G9 signed launch gate |

## 6. Mandatory invariant suites

### 6.1 Authorization and privacy

For every protected resource, generate cases across:

- unauthenticated Visitor;
- owning Customer;
- different Customer;
- Manager with sufficient and insufficient assurance;
- disabled/unmapped identity;
- authorized system job; and
- forged/invalid provider callback.

Tests cover list, detail, mutation, indirect child, projection, cache, file, notification, audit and guessed-ID paths. Cross-Customer responses use approved non-disclosure behavior.

### 6.2 State machines

Every `STATE_MACHINES.md` transition row becomes a table-driven test covering actor, origin, destination, preconditions, validation, audit, notification intent, idempotent replay, stale/concurrent request, reversibility and recovery. Unlisted transitions are rejected.

### 6.3 Immutable history

Tests prove:

- sent/accepted Quotation Revisions and their items/components cannot change;
- Acceptance evidence cannot change;
- Order Item/commercial/identity/fulfilment snapshots cannot change;
- published content/translation versions and Audit Events remain historical;
- live Product, translation, configuration, address or location changes do not alter rendered accepted history; and
- deletion/retention work cannot orphan required history.

### 6.4 Payment-before-production

Attempt the first Production transition through UI, first-party contract, application operation, direct repository/SQL test boundary, job, provider callback, replay and stale/concurrent request. Every attempt without authoritative verified Payment fails. Successful manual verification still does not start Production.

### 6.5 Idempotency and concurrency

For every required operation:

- same key/same digest replays equivalent result;
- same key/different digest conflicts;
- different key/same unique business fact cannot duplicate;
- concurrent requests commit one outcome;
- timeout after commit can recover the result; and
- expiry of request records does not weaken business uniqueness.

## 7. Minimum release-blocking Playwright journeys

The twelve journeys in `TEST_STRATEGY.md` remain mandatory:

1. Arabic Visitor catalog/search and unpublished-content exclusion.
2. Customer email OTP to owned dashboard.
3. Multi-item Project build and submission.
4. Manager review, Quotation send and revision history.
5. Current Revision acceptance and exactly one awaiting-payment Order.
6. Valid/invalid/unsafe Payment proof behavior.
7. Manager manual verification and payment-before-production guard.
8. Order-level Production through pickup/delivery completion.
9. Continuous Messaging with safe Attachments.
10. Seven essential in-app/email notification intents.
11. Cross-Customer navigation/ID/file denial.
12. Manager Catalog/CMS publication and optional-English gating.

Each journey exercises loading, empty where relevant, validation, permission-denied, recoverable error/retry, and success. Arabic is default. Optional English runs only for the explicitly included complete scope; French presence is a Version 1 failure.

## 8. Quality Gate implementation

| Accepted gate | Automated evidence | Manual/operational evidence |
|---|---|---|
| WCAG 2.2 AA / zero critical | axe, keyboard assertions where stable, semantic linting | Screen reader, focus, reflow/zoom, contrast, forms/errors, auth, bidi review |
| CWV and mobile budgets | Lighthouse CI, bundle/resource/media checks | Profile review and production RUM after launch |
| API targets | k6 plus server/query timing and plan checks | Load profile/dataset/geographic point approval |
| RTL/localization | key/ICU checks, route sweep, visual/bidi tests | Human Arabic content and reading-order review |
| Browser/device matrix | Playwright engines/viewports | Physical Safari/iOS/Android and assistive-input review |
| Availability/error | synthetic/telemetry/error tests | SLO definition, exclusions and alert/runbook drills |
| RPO/RTO | backup/restore automation and object reconciliation | Timed monthly exercise with owner/remediation |

## 9. Test data and environment policy

- No production Customer, message, address, quotation or payment-proof data enters local/CI/preview/staging tests.
- Synthetic data includes Arabic text, mixed direction, long strings, Unicode edge cases, multiple Customers, history, failures and concurrency.
- Test identities and objects are environment-namespaced; teardown credentials cannot address production.
- Time, IDs and provider responses may be controlled through ports, but PostgreSQL constraints/transactions/RLS are real.
- Unsafe-file fixtures are non-executable, controlled, documented and never exposed publicly.
- Live provider smoke uses isolated accounts/resources, explicit authorization and minimum safe non-sensitive data.

## 10. CI and evidence tiers

| Tier | Trigger | Required evidence |
|---|---|---|
| Fast change gate | Every change | Boundary, type, lint, unit, affected integration, message keys, build |
| Pull-request gate | Before merge | Full affected module integration, core browser/axe, migration/drift where relevant, security scans |
| Mainline/nightly gate | Scheduled/merge | Broader PostgreSQL/provider-contract/browser matrix, resilience selection, performance trend |
| Staging candidate gate | G8 candidate | Full matrices, live-authorized provider smoke, migration/rollback/restore, manual security/accessibility |
| Production promotion gate | G9 | Exact candidate/config/migration evidence, backup point, smoke/alert/rollback plan and signatures |

The specific CI vendor/workflow syntax is implementation detail; the gate semantics are mandatory.

## 11. Flaky tests and exceptions

- A flaky test is a defect with an owner and root-cause task.
- Quarantine requires reason, risk, compensating evidence and expiry.
- A quarantined test cannot be the only evidence for authorization, payment gating, immutability, private files, migration safety or recovery.
- Quality exceptions follow `QUALITY_GATES.md`; non-waivable invariants remain non-waivable.

## 12. Test completion gate

Test implementation is complete when every backlog task links its evidence, all mandatory suites run in their intended environment, G8 has a reproducible evidence dossier, and G9 production-specific drills are approved. Test count or coverage percentage alone is not completion.

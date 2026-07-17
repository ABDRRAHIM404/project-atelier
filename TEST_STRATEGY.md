# Version 1 Test Strategy

**Status:** Approved 2026-07-16  
**Authority:** `QUALITY_GATES.md`, `MASTER_PRD.md`, `DOMAIN_MODEL.md`, and `STATE_MACHINES.md`

## 1. Purpose

Testing supplies evidence that the core Arabic-first quote-to-order transaction is correct, secure, accessible, recoverable, and performant. Tests are organized around business risks and architectural boundaries rather than maximizing a raw coverage percentage.

Every feature must meet the global Definition of Done in `QUALITY_GATES.md`. A test passing locally is not sufficient if server authorization, RTL, error states, production build, accessibility, performance, or documentation gates fail.

## 2. Approved test stack

| Layer | Tool | Purpose |
|---|---|---|
| Static | TypeScript strict mode, ESLint, framework/build checks | Type, boundary, and common correctness defects |
| Unit/component-domain | Vitest | Value rules, policy, state transitions, formatting, adapters in isolation |
| Database integration | Vitest plus disposable Supabase-local PostgreSQL | Transactions, constraints, repositories, concurrency, migrations, outbox |
| Browser journey | Existing `@playwright/test` and browser binaries | Real customer/manager journeys across Chromium, Firefox, WebKit and device projects |
| Accessibility | axe-core/Playwright plus manual assistive-technology review | WCAG 2.2 AA and no critical automated violations |
| Performance | Lighthouse CI and k6 | Frontend budgets/CWV lab signals and server/load targets |
| Security | Authorization suites, dependency/secret/SAST scanning, focused dynamic tests | Cross-account, state, input, upload, webhook, and supply-chain risks |
| Recovery | Provider/local restore and reconciliation exercises | Accepted RPO/RTO and object recovery evidence |

The repository already has Playwright Test and browser binaries from the earlier tooling phase; Playwright MCP browser control is not a dependency of the application test suite.

## 3. Test pyramid and boundaries

Most policy combinations and transition rules are covered as fast unit/domain tests. Relational integrity and concurrency use real PostgreSQL integration tests rather than mocks. A smaller, high-value browser suite proves wiring and customer-visible behavior. Contract tests sit at provider adapters so routine tests do not call live paid services.

Mocks may simulate provider responses but cannot replace tests of the application's own database constraints, authorization queries, transaction boundaries, or migration behavior.

## 4. Domain and state-machine tests

Table-driven tests are derived directly from every row in `STATE_MACHINES.md`. For each transition they cover:

- allowed actor and required ownership;
- valid starting state and destination;
- preconditions and validation;
- side effects, Notification intent, and Audit Event;
- reversibility and recovery behavior;
- idempotent replay;
- invalid prior/terminal states;
- concurrent requests and stale versions.

Mandatory invariant properties include:

- no Production state can leave Not Started without verified payment;
- accepted/sent Quotation Revision and Order Item Snapshot mutation is rejected;
- exactly one Order is produced by repeated/concurrent acceptance of one revision;
- a superseded revision cannot be accepted;
- proof upload alone never creates verified payment;
- Customer A cannot observe or mutate Customer B data;
- item-level production state is absent from Version 1 behavior;
- current catalog/translation/config changes do not rewrite accepted snapshots.

## 5. Unit tests

Unit tests cover Money/currency, identifiers, time-zone and locale handling, Arabic search normalization, product-configuration rules, typed policy resolution, transitions, notification template schemas, file classification, safe logging, and provider error mapping.

Coverage thresholds are proposed implementation configuration, not a substitute for risk coverage. Critical domain and authorization branches require complete behavior-case coverage even if a global percentage target is lower.

## 6. Database integration tests

Tests use an isolated PostgreSQL database matching the production major version and enabled extensions. They verify:

- migrations apply from empty and from the last supported release state;
- generated SQL is reviewed and no drift exists;
- relational ownership and required uniqueness;
- immutable-record defenses;
- atomic acceptance/order creation and rollback on injected failure;
- payment verification/production ordering;
- transaction isolation under concurrent acceptance/verification;
- outbox commit, leasing, retries, deduplication, and lease recovery;
- audit append behavior;
- catalog search ranking/query safety with Arabic fixtures;
- private query paths cannot return cross-customer rows.

Tests must not depend on a shared developer or production Supabase project.

## 7. Provider contract tests

Each adapter has a provider-neutral contract and captured/sandbox conformance tests:

- **Clerk:** session verification, factor assurance, disabled/unmapped identity, webhook signature/replay/idempotency.
- **S3:** signed operation scope/expiry, version pinning, wrong key/size/type, access denial, scan-result lifecycle.
- **GuardDuty event path:** clean, malicious, unsupported, failed, duplicate, delayed, and out-of-order events.
- **Resend:** idempotency, transient/permanent failure mapping, signed webhook, duplicates, late delivery state.
- **Sentry/OTel:** correlation propagation and sensitive-field scrubbing.
- **Vercel scheduled entry point:** authentication, bounded batches, concurrency, lease recovery, and safe repeat invocation.

Live provider smoke checks run only in an isolated staging account with non-sensitive fixtures and explicit CI authorization.

## 8. Browser journey suite

Minimum release-blocking Playwright journeys:

1. Arabic visitor browses published catalog/search and unpublished content stays hidden.
2. Customer email-OTP account path reaches an owned dashboard.
3. Customer builds and submits a multi-item project.
4. Manager reviews it, sends a quotation, creates a revision, and the Customer sees only allowed history.
5. Customer accepts the current revision; exactly one awaiting-payment Order with matching snapshots appears.
6. Customer uploads valid bank proof; invalid/oversized/unsafe files show recoverable errors.
7. Manager verifies payment; production remains blocked before verification and progresses after it.
8. Order proceeds through high-level production to Ready and delivery or pickup completion.
9. Customer and Manager exchange messages and safe attachments.
10. Seven essential events produce authorized in-app notifications and queued email delivery state.
11. Customer cannot navigate, guess, or mutate another Customer's resources/files.
12. Manager CMS/catalog publication and optional English gating behave according to state.

Tests assert loading, empty, error, retry, and success states—not only the happy path.

## 9. Browser and device matrix

Automated Playwright projects cover current stable Chromium, Firefox, and WebKit engines and representative mobile viewports. Manual release checks cover the accepted supported browser/device matrix in `QUALITY_GATES.md`, including recent Chrome/Edge/Firefox, Safari on supported macOS/iOS, and Chrome on Android. The matrix's rolling version cutoffs are mandatory release criteria.

Trace, screenshot, video-on-failure where appropriate, and accessibility output are retained as CI evidence under an approved, privacy-safe retention policy.

## 10. Localization and RTL testing

- Arabic is the default for every browser and visual test unless the test explicitly targets English.
- Visual regression samples cover navigation, forms, quotation tables, timelines, messaging, uploads, currency, and mixed-direction content.
- Keyboard order and screen-reader reading order are verified, not inferred from appearance.
- Missing application translations and invalid ICU messages fail CI.
- Optional English is exercised only on declared supported surfaces.
- French strings/routes in a Version 1 build are a scope failure except historical documentation content not shipped to users.

Human Arabic copy approval remains necessary.

## 11. Accessibility testing

Automated axe checks run on representative states of every critical journey with zero critical violations. Keyboard-only and focus-visible checks are in Playwright where stable. Manual testing includes zoom/reflow, contrast review, error identification, dialogs/focus restoration, live announcements, RTL reading order, and representative screen-reader testing.

The release target is WCAG 2.2 AA; automated tools do not claim full conformance.

## 12. Performance and resilience testing

Lighthouse CI tests representative Arabic mobile public pages against the accepted JS, image/media, and CWV lab budgets. Real-user telemetry is the production p75 authority. k6 tests public catalog reads, authenticated dashboard reads, and key mutations against the accepted p95 API targets without using production customer data.

Resilience tests inject database/provider timeouts, email rate limiting, duplicate webhooks, job interruption, scan delay, and expired upload capabilities. They prove safe failure, idempotent retry, and visible recovery—not merely a 200 response.

Load shape, concurrency, and data volume are capacity assumptions requiring approval or measurement before performance sign-off.

## 13. Security testing

An authorization matrix pairs actor, resource owner, state, and action. Negative cases are first-class. CI also runs lockfile-aware dependency scanning, secret scanning, static analysis, security-header/CSP tests, and unsafe file fixtures. Before production, a focused manual security review covers identity recovery, access-control bypass, stored XSS, upload handling, webhook forgery, sensitive cache/log leakage, and provider IAM.

No destructive security testing targets production.

## 14. Backup and recovery tests

Monthly exercises restore the database and reconcile versioned private objects in isolation. Evidence records source point, target, duration, achieved RPO/RTO, missing/orphaned object count, integrity checks, and corrective actions. Provider backup status without a demonstrated restore is not sufficient.

## 15. Test data

Fixtures are synthetic and include Arabic names/text, bidi edge cases, long content, multiple project items, revision history, repeated proof submissions, pickup/delivery, failed scans, and concurrent commands. No production personal data or payment proof is copied into test/preview systems. Tests generate unique identities and clean them through environment-specific teardown that cannot address production.

## 16. CI stages and release evidence

Pull-request gates run static, unit, integration, build, core Playwright, axe, and budget checks. Staging release gates add full browser matrix, provider contract smoke, load/resilience selection, migration rehearsal, and operational alert verification. Production promotion requires a traceable quality report, approved migration/recovery plan, and no unresolved release-blocking defect.

Flaky tests are defects. Quarantine requires an owner, reason, expiry, and equivalent risk control; it cannot silently turn a mandatory gate green.

## 17. Tool evaluation

### Vitest

- **Why it fits:** current TypeScript/ESM-friendly fast unit and integration runner with coverage and project separation.
- **Alternatives:** Jest and Node's built-in test runner.
- **Tradeoffs/risks:** another tool configuration; framework mocking and environment differences can hide server behavior if overused.
- **Cost:** open source; CI compute only.
- **Lock-in:** low; tests use common assertion patterns but mocks/config need migration.
- **Recommendation/status:** Vitest on Node 24 LTS — **Accepted (ADR-023)**. See [Vitest](https://vitest.dev/).

### Playwright Test

- **Why it fits:** already installed; current multi-browser/device automation, traces, isolation, and CI support.
- **Alternatives:** Cypress and WebdriverIO.
- **Tradeoffs/risks:** browser binaries and full suites consume CI time; unstable selectors/data create flakiness.
- **Cost:** open source plus CI compute/storage.
- **Lock-in:** moderate in fixtures and test APIs; user-facing journey intent is portable.
- **Recommendation/status:** retain `@playwright/test` and official browser binaries — **Accepted (ADR-023)**. See [Playwright Test](https://playwright.dev/docs/intro).

### axe-core and Lighthouse CI

- **Why they fit:** repeatable automated accessibility and web budget checks integrated with browser CI.
- **Alternatives:** Pa11y, WebPageTest, and manual-only review.
- **Tradeoffs/risks:** neither proves WCAG nor real-user performance; lab variance must be controlled.
- **Cost:** open source plus CI compute; optional hosted services extra.
- **Lock-in:** low.
- **Recommendation/status:** use with mandatory manual accessibility and production RUM — **Accepted (ADR-023)**.

### k6

- **Why it fits:** scriptable open-source load tests runnable locally/CI without requiring a hosted plan.
- **Alternatives:** Artillery, autocannon, JMeter, and hosted load services.
- **Tradeoffs/risks:** test realism and safe environment capacity require deliberate data/setup; cloud analysis costs extra.
- **Cost:** OSS local runner; CI or Grafana Cloud usage if selected.
- **Lock-in:** low for HTTP scenarios; hosted dashboards add moderate operational coupling.
- **Recommendation/status:** k6 for Version 1 API/load evidence — **Accepted (ADR-023)**.

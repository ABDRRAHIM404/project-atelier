# PROJECT AUDIT

**Project:** Project Atelier / بيتي بذوقي  
**Audit date:** 2026-07-15  
**Audit type:** Repository, architecture, documentation, and business-knowledge review  
**Implementation changes:** None. This audit document is the only project file created by the audit.

> **Point-in-time notice (2026-07-16):** This audit describes repository state at the audit date. Subsequent planning created `MASTER_PRD.md`, `GOAL.md`, `ANTI_PATTERNS.md`, `DOMAIN_MODEL.md`, `STATE_MACHINES.md`, `QUALITY_GATES.md`, `ARCHITECTURE_DECISIONS.md`, `DECISION_WORKSHOP.md`, and readiness reports. Findings remain historical evidence; current decision and readiness status is in `DECISION_WORKSHOP.md` and `IMPLEMENTATION_READINESS_REPORT.md`.

---

## Audit Scope and Evidence

The audit covered every project-authored file currently present:

- `PROJECT_KNOWLEDGE.md`
- `package.json`
- `package-lock.json`
- `playwright.config.js`
- `tests/e2e/smoke.spec.js`
- Generated Playwright result and MCP snapshot artifacts

The installed dependency tree was reconciled with `package-lock.json`. `node_modules` is vendored dependency output rather than project-authored source and was assessed through the package manifest, lockfile, and installed dependency tree.

Important repository facts at audit time:

- There is no application source code, database schema, migration, API, deployment configuration, or infrastructure definition.
- `GOAL.md` does not exist.
- `ANTI_PATTERNS.md` does not exist.
- No `AGENTS.md`, `README.md`, architecture decision record, or technical specification exists.
- Git has been initialized, but there are no commits and all files are untracked.
- The only executable project tooling is Playwright Test 1.61.1 and one self-contained browser smoke test.

This means the audit can evaluate discovery quality, intended system boundaries, architectural readiness, and implementation risk. It cannot validate an implemented application architecture because none exists yet.

---

# Executive Summary

Project Atelier is currently a **discovery-complete, pre-architecture, pre-implementation project**. `PROJECT_KNOWLEDGE.md` provides unusually strong coverage of the product vision, customer and manager journeys, brand principles, high-level features, and the central made-to-order business model. It correctly distinguishes the product from ordinary inventory-based e-commerce and establishes several sound principles: Arabic-first RTL, mobile-first design, immutable order history, manager-controlled business decisions, and graceful degradation when AI is unavailable.

The project is not ready for feature implementation. The knowledge base declares itself the single source of truth, but it contains unresolved core policies, duplicated decision registers, ambiguous domain boundaries, and non-measurable quality requirements. It describes an architecture philosophy, not an architecture. Critical choices involving lifecycle state, quotation revisioning, money, payment proof, cancellation, refunds, delivery, security, file retention, providers, and Version 1 scope remain undecided.

The proposed Version 1 is also too broad for a first release unless explicitly phased. It combines a multilingual storefront, configurable product catalog, CMS, visual Design Studio, 360° media, multi-item projects, quotation negotiation, payment-proof verification, production tracking, continuous messaging, email and push notifications, reviews, analytics, and optional AI. Delivering these simultaneously would create schedule, quality, security, and operational risk.

The recommended next move is a **decision and architecture milestone**, not application feature development. First consolidate the product contract, close blocking business decisions, define lifecycle state machines and immutable commercial snapshots, establish measurable non-functional requirements, and approve a narrow release scope. Then build a modular monolith around the verified transaction path from product discovery to completed order.

### Overall Assessment

| Area | Assessment | Readiness |
|---|---|---:|
| Business vision | Clear and differentiated | High |
| Customer and manager journeys | Broadly understood | Medium-High |
| Business-rule completeness | Major operational rules remain open | Low |
| Version 1 scope | Valuable but overextended and insufficiently gated | Low |
| Application architecture | Not yet defined or implemented | None |
| Security and privacy design | Principles exist; controls and policies do not | Low |
| Documentation system | Strong monolithic source, weak supporting documentation | Medium-Low |
| Testing | Browser runtime only; no product behavior is tested | Very Low |
| Delivery readiness | No source-control baseline, CI, environments, or deployment design | None |

### Highest-Priority Findings

1. **There is no implemented architecture to review.** Only a product knowledge document and Playwright tooling exist.
2. **The commercial lifecycle is ambiguous.** Project, request, quotation, order, payment, production, delivery, and completion are described, but their ownership, transition rules, revision semantics, and terminal states are not formalized.
3. **Sensitive-data handling is under-specified.** Payment proof, customer files, messages, addresses, and private project data require explicit access, retention, deletion, scanning, logging, and recovery rules.
4. **Version 1 is not a credible single milestone without prioritization.** Several expensive or operationally complex features need to be staged or explicitly accepted as release-critical.
5. **Core policy decisions are blockers.** Pricing, tax, delivery, warranty, cancellation, refund, return, quotation validity, payment discrepancies, and production capacity cannot safely be invented during development.
6. **Repository governance is absent.** There are no commits, ignore rules, contribution instructions, goal file, anti-pattern file, CI, or quality gates.

---

# Architecture Review

## Current Physical Architecture

The current repository has no product architecture. Its physical structure is:

- One 3,353-line product-discovery document.
- A minimal npm package used only for Playwright.
- One Playwright configuration targeting Chromium, Firefox, and WebKit.
- One smoke test that renders an inline HTML button and clicks it.
- Generated Playwright artifacts.

There is no frontend, backend, domain layer, database, authentication system, file-storage integration, notification worker, CMS implementation, analytics implementation, or AI adapter.

The smoke test proves that installed browser binaries can render and interact with static HTML. It does **not** prove that Project Atelier can start, route, authenticate, persist data, enforce authorization, handle RTL, execute a business workflow, or deploy.

## Intended Logical Architecture Inferred from the Knowledge Base

The business description implies the following bounded capabilities:

| Capability | Responsibility |
|---|---|
| Identity and Access | Visitors, customers, the manager, sessions, authorization, account recovery |
| Catalog | Products, categories, collections, materials, colors, media, visibility |
| Product Configuration | Dimension constraints, option compatibility, saved designs, validation |
| Customer Projects | Multi-item draft projects, notes, references, submission |
| Quotations | Feasibility review, revisions, pricing, delivery terms, acceptance |
| Orders | Immutable agreed commercial snapshot and lifecycle history |
| Payment Verification | Bank-transfer instructions, proof upload, manual review, rejection/resubmission |
| Production and Fulfilment | Progress stages, estimates, pickup/delivery, completion |
| Communication | Continuous customer-manager messaging, attachments, contextual links |
| Notifications | In-app, email, and potentially push delivery with preferences and localization |
| Reviews | Completed-order eligibility, ratings, photos, manager responses, moderation |
| CMS and Localization | Arabic source content, translation approval, publishing, page composition |
| Analytics | Funnel, catalog, customization, order, and operational metrics |
| AI Adapters | Optional search, recommendations, translation, and drafting assistance |

These boundaries are useful, but they are not yet expressed as modules, schemas, APIs, events, or ownership rules.

## Recommended Version 1 Architecture

A **modular monolith** is the most appropriate default for Version 1:

- One deployable application boundary unless a provider constraint requires otherwise.
- Explicit internal modules aligned to the capabilities above.
- A relational database for transactional consistency and historical snapshots.
- Private object storage for payment proof and customer attachments; public optimized storage/CDN paths for catalog media.
- Background jobs for email, media processing, notification delivery, analytics aggregation, and AI work.
- A transactional outbox or equivalent durable event mechanism for side effects.
- Server-enforced authorization and state transitions; the UI must never be the policy boundary.
- Provider adapters for authentication, storage, email, push, search, analytics, and AI.
- An append-only audit trail for manager actions affecting quotations, payments, order states, and content publication.

This design preserves simplicity for one workshop while keeping domain boundaries clear enough to extract services later if scale proves the need. Microservices, generalized multi-tenancy, native apps, event streaming infrastructure, and complex distributed orchestration would be premature.

## Required Domain Model Clarification

The project needs an approved lifecycle model. A reasonable proposal for discussion is:

1. **Project Draft** — editable collection of configured items.
2. **Submitted Request** — customer snapshot submitted for review; no silent edits.
3. **Under Review / Clarification** — manager and customer resolve feasibility questions.
4. **Quotation Revision** — immutable numbered revision with price, currency, delivery, production estimate, validity period, and terms.
5. **Quotation Accepted** — explicit acceptance of one revision with timestamp and actor.
6. **Payment Pending / Under Review** — proof uploaded and reviewed with a recorded outcome.
7. **Payment Verified** — irreversible gate authorizing production, except through an audited correction process.
8. **Production** — explicit allowed stages and transition rules.
9. **Ready for Fulfilment** — pickup or delivery branch.
10. **Completed / Cancelled / Disputed** — terminal states with policy-driven outcomes.

The team must decide when an `Order` is created: quotation acceptance, payment verification, or another explicit point. Until that is decided, database and API design would be guesswork.

## Architectural Risks

- “Future-proof” is repeated without specifying the seams that matter. This can cause premature abstraction and multi-tenant complexity.
- Manager-configurable rules are described broadly, but arbitrary rule builders are expensive and unsafe. Version 1 needs a deliberately bounded configuration model.
- Historical immutability conflicts with editable catalog data unless accepted quotations and order items store complete immutable snapshots.
- A single continuous customer-manager conversation may become ambiguous when a customer has multiple simultaneous projects; messages need optional project/order context.
- Push notifications, 360° media, multilingual CMS publishing, analytics, and AI each add their own infrastructure and privacy surface.
- A single manager is both a Version 1 simplification and an operational bottleneck. Account recovery, emergency access, and auditability need design even without multiple roles.

---

# Documentation Review

## Strengths of `PROJECT_KNOWLEDGE.md`

- Clearly identifies the made-to-order, quotation-first business model.
- Separates customer-facing brand from the internal project codename.
- Documents visitor, customer, and manager capabilities.
- Describes the customer and manager journeys end to end.
- Establishes Arabic-first RTL and mobile-first requirements early.
- Treats AI as optional and human-supervised.
- Recognizes immutable historical orders as a core requirement.
- Includes future vision, risks, open decisions, business rules, design principles, and technical principles.
- Explicitly warns agents not to assume unresolved requirements.

## Structural and Governance Problems

1. **Missing section number:** The document moves from `# 2. Brand` to `# 4. Core Philosophy`; section 3 is absent.
2. **Duplicated decision registers:** `# 20. Open Decisions & Assumptions` and `# 25. Pending Decisions` overlap but are not identical. For example, return policy appears in one list while payment-proof storage appears only in the other.
3. **Overloaded source of truth:** Business vision, requirements, future ideas, risks, technical principles, and decisions are all combined in one long file. This increases drift and makes change review difficult.
4. **No requirement identifiers:** Rules and capabilities cannot be traced from business intent to design, implementation, and tests.
5. **Ambiguous requirement strength:** The document contains substantially more “should” and “may” language than “must,” but does not define which statements are binding release requirements.
6. **No ownership or decision history:** The document has a version and status but no owner, approvers, review date, changelog, or decision provenance.
7. **Discovery status conflicts with unresolved fundamentals:** “Discovery Completed” is misleading while core business, technical, and design decisions remain open.
8. **Future and Version 1 boundaries blur:** Some sections label features as Version 1, others say “should,” “may,” or “future” without an authoritative release matrix.

## Missing Documentation

| Missing document | Why it is needed |
|---|---|
| `GOAL.md` | A concise, measurable current objective, success criteria, non-goals, and release boundary |
| `ANTI_PATTERNS.md` | Project-specific prohibited shortcuts and architectural failure modes |
| `README.md` | Repository purpose, status, structure, setup, commands, and documentation map |
| `AGENTS.md` | Stable operating instructions for human and AI contributors |
| Version 1 scope / PRD | Prioritized release requirements and explicit deferrals |
| Decision register and ADRs | Approved business and technical decisions with rationale and consequences |
| Domain glossary | Unambiguous definitions for project, request, design, quotation, order, payment, production, fulfilment, and completion |
| Lifecycle state-machine specification | Allowed transitions, actors, guards, side effects, cancellations, and correction paths |
| System architecture | Context/container diagrams, module ownership, integration boundaries, and deployment shape |
| Data model and retention policy | Entities, snapshots, audit history, ownership, deletion, archival, and recovery |
| Security and privacy specification | Threat model, data classification, authorization matrix, file controls, audit, incident handling |
| Non-functional requirements | Quantified performance, availability, accessibility, recovery, observability, and browser/device targets |
| Localization specification | Locale fallback, translation lifecycle, RTL test matrix, formatting, and content completeness |
| Media specification | Formats, size limits, 360° asset contract, optimization, CDN, alt text, and deletion |
| Notification specification | Event taxonomy, channel policy, templates, localization, retry, idempotency, and preferences |
| Analytics taxonomy | Event names, properties, consent, retention, funnel definitions, and metric formulas |
| Test strategy | Unit, integration, contract, state-machine, authorization, accessibility, visual, and E2E coverage |
| Deployment and operations runbook | Environments, CI/CD, secrets, migrations, monitoring, backups, restore tests, and rollback |

---

# Business Knowledge Review

## What Is Well Understood

- The company manufactures custom furniture only after agreement and verified payment.
- Products are configurable templates, not stocked SKUs.
- Customers can combine multiple standard or customized items into one project.
- The manager controls feasibility, final price, payment verification, production updates, and fulfilment.
- Bank transfer is the only Version 1 payment method.
- The customer experience depends on transparency and communication rather than instant checkout.
- Historical commercial records must survive catalog and pricing changes.
- Worker, supplier, inventory, and multi-business functions are excluded from Version 1.
- Arabic is primary; French and English are intended as complete translations.
- The platform must remain usable without AI.

## Unclear Business Rules

The following questions must be answered before their affected features are designed:

### Projects, Quotations, and Orders

- When exactly does a project request become an order?
- Can a submitted request be withdrawn or edited, or must changes create a new revision?
- Can a manager send multiple quotation revisions, and which fields are immutable?
- Does a quotation expire? Can the manager revoke it after acceptance?
- Is “reject quotation” distinct from “request changes” and “cancel project”?
- What evidence constitutes customer acceptance and what terms are accepted?
- Can an accepted quotation change because of material availability or measurement corrections?
- What happens when one item in a multi-item project is infeasible or cancelled?

### Pricing and Money

- Is MAD the only supported currency, and are amounts stored/displayed with tax included?
- What tax, invoice, rounding, and legal-document rules apply?
- Is full payment always required, or can deposits and staged payments occur?
- Are discounts, negotiated adjustments, delivery fees, and additional services separate line items?
- How are price estimates distinguished visually and legally from final quotations?

### Payment Verification

- What proof formats and maximum sizes are accepted?
- Can one proof cover multiple payments or orders?
- What are the outcomes for duplicate, partial, overpaid, incorrect, expired, or fraudulent proof?
- Can a manager reverse a mistaken verification, and what audit/approval is required?
- How long is payment proof retained and who can delete it?

### Production, Delivery, and Completion

- What are the authoritative production states and allowed transitions?
- Can production be paused, rolled back, or cancelled after payment?
- How are estimates updated and delays communicated?
- How are pickup identity, delivery acceptance, damage, refusal, and completion proven?
- What delivery areas, pricing rules, scheduling rules, and service-level expectations apply?

### After-Sales Policy

- What are the cancellation, refund, custom-return, warranty, repair, and dispute policies?
- When may a review be created, edited, deleted, or moderated?
- “Verified customer” and “verified completed order” are both used; the eligibility rule needs one definition.

### Catalog and Configuration

- How is “temporarily unavailable” different from hidden or archived?
- Without inventory management, who confirms current material/color availability and how often?
- What rule types are configurable in Version 1, especially conflicting options and dimension formulas?
- What happens to saved designs when a product or option is edited, hidden, or archived?
- Is “order as shown” still required to pass through manager review and quotation? The broader workflow implies yes, but this must be explicit.

### Communication and Operations

- Is there one account-level thread, or can messages be scoped to projects/orders while remaining visible in one inbox?
- What response expectations and escalation behavior exist when the only manager is unavailable?
- Which notifications are mandatory, optional, transactional, or marketing?
- Are push notifications truly required for Version 1, and on which client surface?

---

# Inconsistencies

1. The document claims to contain validated knowledge and to have completed discovery while preserving many release-blocking open decisions.
2. Open decisions are maintained in two overlapping sections with different contents.
3. “Order as shown” sounds like direct purchase, while the business rules say every order starts as a manager-reviewed project request and no payment occurs before quotation acceptance.
4. The manager journey says the customer may accept or reject a quotation; the order section defines accept or request changes. Rejection, withdrawal, expiration, and cancellation are not separated.
5. “Project,” “project request,” and “order” are sometimes treated as stages of one object and sometimes as separate dashboard concepts.
6. Reviews are limited once to “verified customers” and elsewhere to “verified completed orders.”
7. The manager dashboard is described as the complete tool needed to operate the business, but production coordination remains manual and bank transfer, email, storage, and potentially push rely on external systems.
8. The architecture is asked to support multi-business expansion without major redesign, while Version 1 is explicitly single-business and single-manager. The intended degree of tenancy preparation is undefined.
9. Version 1 includes push notifications and 360° media, while the push provider and media workflow are undecided.
10. The knowledge file says no customer-facing text should be hardcoded, but no translation completeness, fallback, or publishing contract is defined.

---

# Missing Decisions

## Priority 0 — Required Before Architecture Is Approved

| Decision | Required outcome |
|---|---|
| Version 1 release boundary | Must-have, should-have, and deferred capability matrix |
| Domain vocabulary | One approved definition for each lifecycle object |
| Commercial state machine | States, transitions, actors, guards, correction paths, and terminal outcomes |
| Quotation contract | Revisions, expiry, acceptance evidence, pricing fields, terms, and snapshots |
| Pricing policy | Currency, tax, rounding, estimate rules, delivery, discounts, deposits/full payment |
| Payment policy | Proof workflow, mismatch handling, reversal, retention, and audit requirements |
| Cancellation/refund/return/warranty | Approved operational and customer-facing policies |
| Delivery policy | Coverage, price, scheduling, handoff evidence, failure, and dispute behavior |
| Configuration scope | Supported Version 1 rule types; avoid an unbounded generic rule engine |
| Sensitive-data policy | Classification, access, retention, deletion, encryption, scanning, and recovery |

## Priority 1 — Required Before the Walking Skeleton

| Decision | Required outcome |
|---|---|
| Application stack | Runtime, frontend, backend shape, package manager, supported versions |
| Database and tenancy posture | Database choice, ownership model, whether a business identifier is present in V1 |
| Authentication | Provider, manager bootstrap/recovery, sessions, MFA posture, authorization enforcement |
| File storage | Public/private buckets, signed access, file limits, image processing, malware handling |
| Deployment | Environments, hosting, regions, migrations, rollback, secret management |
| Background work | Job mechanism, retry, idempotency, dead-letter behavior, scheduling |
| Observability | Logs, metrics, traces, alerts, audit history, incident response |
| Backup and recovery | RPO/RTO targets, backup frequency, restore testing, business-continuity ownership |
| Localization model | Content schema, fallbacks, formatting, review/publish states, RTL coverage |
| Accessibility target | Approved standard/level and acceptance testing strategy |
| Performance budgets | Page, API, media, interaction, and mobile-network targets |

## Priority 2 — Required Before Their Features

- Email and push providers and channel eligibility.
- Search implementation and normal-search fallback behavior.
- Analytics provider, consent, event taxonomy, formulas, and retention.
- AI provider, evaluation criteria, safety review, cost budgets, and fallback UX.
- 360° capture and delivery workflow.
- Brand palette, typography, design tokens, animation rules, and design system.
- Content moderation and attachment policy.

---

# Risks

| ID | Severity | Risk | Consequence | Primary mitigation |
|---|---:|---|---|---|
| R-01 | Critical | Implementation begins before lifecycle and policy decisions | Data model churn, invalid behavior, expensive rewrites | Close Priority 0 decisions first |
| R-02 | Critical | Sensitive payment proof and attachments lack a complete security model | Privacy breach, unauthorized access, loss of trust | Threat model, private storage, strict authorization, retention, scanning, audit |
| R-03 | High | Version 1 scope is too broad | Delayed launch, shallow quality, unfinished core workflow | Approve a phased scope and candidate deferrals |
| R-04 | High | Mutable catalog data leaks into historical orders | Agreed orders change retroactively | Immutable quotation/order snapshots and revision history |
| R-05 | High | Ambiguous state transitions | Impossible states, early production, inconsistent dashboards | Server-enforced state machine with invariant tests |
| R-06 | High | Single-manager operational dependency | Requests, payments, and customers stall during absence or account loss | Recovery, emergency access, queues, SLAs, audit, future delegation path |
| R-07 | High | Unbounded “configurable business rules” | Complex unsafe rule engine and difficult validation | Whitelist concrete Version 1 rule types |
| R-08 | High | Media-heavy premium experience on mobile | Slow pages, high bandwidth/storage cost, poor conversion | Media budgets, responsive derivatives, CDN, lazy loading, asset contract |
| R-09 | High | Arabic/French/English parity and RTL are not tested systematically | Broken layouts, incomplete content, inconsistent customer journeys | Locale lifecycle plus automated RTL/LTR and content-completeness checks |
| R-10 | Medium-High | Continuous messaging lacks project context | Confusing discussions and weak audit trail | One inbox with explicit optional project/order linkage |
| R-11 | Medium-High | Push/email delivery has no reliability contract | Duplicate, missing, or wrongly localized notifications | Event taxonomy, outbox, idempotency, retries, preferences, delivery logs |
| R-12 | Medium-High | Analytics ambitions conflict with data minimization | Unnecessary personal-data collection and unreliable metrics | Consent-aware event plan and metric definitions before instrumentation |
| R-13 | Medium | AI output is grounded conceptually but not technically | Invented products, bad translations, unexpected cost | Catalog-constrained retrieval, human approval, evals, budgets, fallback |
| R-14 | Medium | Premature future-proofing | Complexity without present value | Modular boundaries, not speculative generalized infrastructure |
| R-15 | Medium | No committed baseline or CI | Loss, unreviewed drift, irreproducible builds | Commit a clean baseline and add quality gates |
| R-16 | Medium | Legal/customer policies remain undecided | Inconsistent manager actions and customer disputes | Product-owner decision with appropriate professional review |

---

# Technical Debt

The project has little code debt because it has almost no code. It already has substantial **decision, documentation, tooling, and architecture debt**.

## Repository and Tooling Debt

- Git has no commits; every file, dependency directory, and generated artifact is untracked.
- No `.gitignore` excludes `node_modules`, `test-results`, `.playwright-mcp`, traces, screenshots, coverage, environment files, or local secrets.
- There is no declared Node version, package-manager version, runtime engine policy, or reproducible setup guide.
- `@playwright/test` uses a caret range in `package.json`; the lockfile currently pins 1.61.1, but update policy is undefined.
- No lint, formatting, type-check, unit-test, integration-test, accessibility-test, security-check, or CI scripts exist.

## Test Debt

- The only test uses `page.setContent`; it never launches Project Atelier.
- Clicking the button has no asserted outcome, so it verifies only that a browser can click a visible button.
- There is no `baseURL`, application server, test environment, fixture strategy, authenticated state, data isolation, or cleanup policy.
- There are no tests for RTL, localization, authorization, uploads, lifecycle invariants, immutable snapshots, payment gates, notifications, accessibility, or mobile layouts.
- The cross-browser configuration is useful, but all projects run by default even when the host has previously shown resource sensitivity; CI execution policy is not defined.

## Documentation Debt

- `GOAL.md` and `ANTI_PATTERNS.md` are missing despite being named as required audit inputs.
- The monolithic knowledge file duplicates decisions and repeats principles, increasing divergence risk.
- No concise current-state, roadmap, decision, handoff, or status documents exist.
- Requirements lack stable identifiers and acceptance criteria.
- No documentation lint or link-validation process exists.

## Architecture Debt

- No domain model, state machine, integration map, data ownership, or module boundaries have been approved.
- Provider decisions are entirely open.
- No security, privacy, retention, backup, or recovery design exists for sensitive records.
- No side-effect reliability pattern exists for notifications, payment verification, or status updates.
- No observability, audit, migration, or rollback strategy exists.

---

# Recommendations

## Immediate Recommendations

1. **Create the missing project contract.** Add `GOAL.md` with the current milestone, measurable success criteria, non-goals, constraints, and explicit Version 1 boundary.
2. **Create `ANTI_PATTERNS.md`.** At minimum prohibit direct checkout assumptions, client-only authorization, mutable historical orders, production before verified payment, public payment files, AI approval of business decisions, hardcoded customer content, and speculative multi-service architecture.
3. **Replace duplicate open-decision sections with one decision register.** Give each decision an ID, owner, status, due date, options, outcome, rationale, and affected requirements.
4. **Approve a domain glossary and lifecycle state machines.** Treat this as the gate before schema or API work.
5. **Narrow Version 1.** Candidate deferrals for owner review include room visualization, 3D/AR, AI recommendations, advanced analytics, push notifications, native apps, multi-tenancy, and possibly 360° media if no production asset workflow exists.
6. **Define security before uploads.** Payment proof and private attachments must not be implemented until data classification, signed-access rules, file limits, scanning, retention, deletion, auditing, and recovery are approved.
7. **Adopt a modular monolith.** Keep strong internal domain boundaries and provider adapters; avoid microservices and a generalized rules engine.
8. **Make commercial snapshots immutable.** Store numbered quotation revisions and accepted order-item snapshots independent of live catalog entities.
9. **Quantify quality.** Convert “fast,” “accessible,” “premium,” “mobile-first,” and “secure” into measurable acceptance criteria.
10. **Establish repository hygiene before implementation.** Add ignore rules, commit a reviewed baseline, document the runtime, and introduce CI quality gates.

## Suggested Version 1 Core

The minimum coherent digital-atelier release should focus on:

- Arabic-first responsive storefront with French/English-ready localization architecture.
- Customer registration and secure manager access.
- Manager-managed catalog, categories, collections, materials, colors, and bounded product options.
- Basic visual product configuration with validated inputs; advanced rendering is separable.
- Multi-item project draft and submission.
- Manager review and immutable quotation revisions.
- Customer acceptance and bank-transfer proof workflow.
- Server-enforced payment-verification gate before production.
- Production status timeline and pickup/delivery completion.
- Contextual customer-manager messaging.
- In-app notifications and one reliable external channel.
- Basic manager and customer dashboards.
- Audit history, backups, privacy controls, accessibility, performance, and monitoring.

Everything else should be evaluated against launch value, operational readiness, and evidence—not included merely because it is desirable long term.

---

# Proposed Development Roadmap

## Phase 0 — Product Contract and Decision Closure

**Goal:** Turn discovery knowledge into an implementable, testable contract.

Deliverables:

- `GOAL.md`, `ANTI_PATTERNS.md`, `README.md`, documentation map.
- Approved Version 1 feature matrix and explicit deferrals.
- Domain glossary.
- Customer/project/quotation/order/payment/production/fulfilment state machines.
- Pricing, payment, delivery, cancellation, refund, return, and warranty decisions.
- Requirement IDs and acceptance criteria.
- Consolidated decision register.

Exit gate: No Priority 0 decision remains unresolved.

## Phase 1 — Architecture and Quality Baseline

**Goal:** Approve how the product will be built and operated before feature work.

Deliverables:

- Architecture context and container diagrams.
- Modular-monolith module map and dependency rules.
- Data model with immutable snapshot and audit strategy.
- Authorization matrix and threat model.
- Storage/media/privacy/retention specification.
- Localization, accessibility, and performance requirements.
- Environment, deployment, migration, backup, restore, monitoring, and rollback design.
- ADRs for stack and providers.
- Test strategy and CI plan.

Exit gate: Architecture, security, and operability reviews approved.

## Phase 2 — Walking Skeleton

**Goal:** Prove one thin, deployable path through the chosen stack.

Capabilities:

- Application starts locally and in a non-production environment.
- Database migration and health check.
- Customer and manager authentication with server-enforced authorization.
- Arabic RTL shell and locale switching.
- One published product read from persistent storage.
- One private file upload with verified authorization.
- Structured logs, error reporting, CI, and backup/restore smoke test.

Exit gate: A deployed, observable, secure skeleton passes automated checks.

## Phase 3 — Catalog, CMS, and Basic Configuration

**Goal:** Let the manager publish real, localizable products and bounded options.

Capabilities:

- Categories, collections, products, materials, colors, media, visibility states.
- Arabic authoring and translation review states.
- Responsive public catalog and product detail.
- Basic option/dimension validation.
- Media optimization and accessibility metadata.
- Catalog authorization, integration, RTL/LTR, accessibility, and performance tests.

Exit gate: Manager can publish a product without developer intervention and customers can browse it reliably.

## Phase 4 — Core Commercial Workflow

**Goal:** Complete the business-critical transaction loop.

Capabilities:

- Saved designs and multi-item project drafts.
- Submission snapshots and manager review.
- Numbered immutable quotation revisions.
- Customer acceptance evidence.
- Private payment-proof upload, review, rejection/resubmission, and audited verification.
- Server-enforced production gate.
- Order snapshots and lifecycle history.

Exit gate: One full project can move from draft to payment verified with invariant and authorization tests.

## Phase 5 — Production, Fulfilment, Communication, and Dashboards

**Goal:** Operate a paid order transparently through completion.

Capabilities:

- Production stages and estimated dates.
- Pickup/delivery branch and completion evidence.
- Project/order-aware messaging and attachments.
- Reliable notification outbox, templates, localization, retries, and preferences.
- Customer and manager work queues/dashboards.
- Completed-order review eligibility.

Exit gate: A manager can run the full customer lifecycle without hidden manual state, except workshop production work explicitly outside Version 1.

## Phase 6 — Release Hardening

**Goal:** Make the core release safe and dependable.

Deliverables:

- Threat-model remediation and authorization audit.
- File-security and privacy verification.
- Accessibility conformance review.
- Mobile/RTL/LTR browser matrix.
- Performance and media-budget validation.
- Backup restore exercise, migration rollback exercise, and incident runbooks.
- End-to-end business-flow tests and manager acceptance testing.
- Legal/customer policy content approved for publication.

Exit gate: Release checklist and product-owner acceptance complete.

## Phase 7 — Evidence-Driven Enhancements

Only after production data and operational feedback exist:

- Search analytics and basic business reporting.
- AI-assisted translation with approval and quality evals.
- Grounded natural-language product search and recommendations.
- 360° media expansion where the asset pipeline is proven.
- Push notifications if channel value justifies complexity.
- Advanced visualization, 3D, AR, native apps, integrations, worker accounts, inventory, and multi-business support as separate validated initiatives.

---

# Final Assessment

Project Atelier has a strong product story and a credible differentiated business model. Its largest risk is not lack of ideas; it is attempting to implement too many ideas before converting the discovery narrative into precise commercial rules, state transitions, security controls, measurable requirements, and a narrow delivery contract.

The next milestone should therefore produce decisions and architecture evidence. Application implementation should begin only after that gate. This preserves the core vision—premium, Arabic-first, visual, collaborative, and trustworthy—without allowing unresolved assumptions to become expensive code.

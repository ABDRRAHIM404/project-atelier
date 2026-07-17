# ARCHITECTURE DECISIONS

**Project:** Project Atelier / بيتي بذوقي  
**Document type:** Architecture Decision Record register  
**Status:** Accepted architecture constraints; residual policy/configuration maps to `DECISION_WORKSHOP.md`  
**Scope:** Decision intent and constraints only; no application architecture, database schema, API, deployment topology, or source code  
**Source material:** `PROJECT_KNOWLEDGE.md`, `PROJECT_AUDIT.md`, `MASTER_PRD.md`, `DOMAIN_MODEL.md`, `STATE_MACHINES.md`, `QUALITY_GATES.md`, and `DECISION_FORM.md`

---

## 1. Register Rules

This register records the structural architecture constraints. The Product Owner approved the architecture and provider decisions on 2026-07-16; the technology/provider detail and staged-adoption conditions are in `ADR_INDEX.md`.

- **Proposed** means the decision requires product/technical-owner approval before it becomes a constraint on implementation.
- **Accepted** may be used only after approval is recorded with approver, date, and any conditions.
- Rejected or superseded proposals must remain in history rather than being silently removed.
- Implementation work must not use a Proposed decision as though it were Accepted.

| ID | Decision | Status | Approval required |
|---|---|---|---|
| ADR-001 | Modular monolith for Version 1 | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-002 | Relational transactional data model | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-003 | Immutable sent/accepted quotation revisions and Order snapshots | Accepted | Expanded by Product Owner decision `DW-002` on 2026-07-16 |
| ADR-004 | Public/private storage separation | Accepted | Classification and private-by-default rule confirmed by `DW-009` on 2026-07-16; detailed controls remain open |
| ADR-005 | Server-enforced authorization and state transitions | Accepted | Identity methods refined by `DW-008`; provider and residual account policy remain open |
| ADR-006 | Transactional outbox or equivalent durable side effects | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-007 | Provider adapters at external boundaries | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-008 | Durable background-job mechanism | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-009 | First-class localization architecture | Accepted | Language scope revised by Product Owner decision `DW-011` on 2026-07-16 |
| ADR-010 | Append-only business audit logging | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-011 | Single-business Version 1 without premature multi-tenancy | Accepted | Resolved by `DR-001` and `DR-016` |

---

## ADR-001 — Modular Monolith for Version 1

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
Version 1 serves one workshop and one Manager while implementing one tightly connected transaction across catalog, configuration, project requests, quotations, payment verification, production, fulfilment, messaging, notifications, and CMS. The repository has no implemented architecture. The audit warns against both an undifferentiated codebase and speculative distributed services.

**Decision**  
Use one deployable application boundary for Version 1 with explicit internal business-module boundaries and dependency rules. Keep transaction policy in the relevant business modules and keep external providers behind boundaries. The module map, framework, package layout, runtime, and deployment topology remain future architecture work.

**Alternatives considered**

- Microservices from Version 1.
- A single unstructured application with no internal boundaries.
- Separate applications for each workflow stage.

**Consequences**

- Cross-workflow consistency can use local transactions where appropriate.
- Operations and deployment remain proportionate to a single-business release.
- Internal boundaries, ownership, and dependency tests must be deliberately maintained.
- A later service extraction remains possible only where evidence justifies it.

**Risks**

- Weak discipline could turn the monolith into tightly coupled code.
- Premature internal abstractions could recreate distributed-system complexity in-process.
- A future scale bottleneck may require targeted extraction.

**Approval record**  
Accepted by the Product Owner on 2026-07-16.

---

## ADR-002 — Relational Transactional Data Model

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
The product has strongly related commercial records, state transitions, revisions, authorizations, and immutable history. Quotation acceptance, Order creation, snapshots, and audit intent require consistency. No database provider or schema is approved.

**Decision**  
Use a relational database capable of transactional consistency, constraints, migrations, backups, and point-in-time recovery appropriate to the approved recovery objectives. Model business concepts from `DOMAIN_MODEL.md`; do not treat that conceptual model as a table design. Provider, schema, indexing, migration tooling, and tenancy keys remain undecided.

**Alternatives considered**

- Document database as the primary system of record.
- Independent stores for each module in Version 1.
- Event sourcing as the primary persistence model.

**Consequences**

- Commercial invariants and related writes can be enforced transactionally.
- Schema evolution requires controlled, tested migrations.
- Media remains in object storage with database metadata/references.
- Audit history may be append-only without making the whole product event-sourced.

**Risks**

- Poor schema design could couple mutable catalog data to commercial history.
- Provider-specific features could reduce portability.
- Unbounded reporting queries could harm transactional performance.

**Approval record**  
Accepted by the Product Owner on 2026-07-16; provider and migration detail is recorded in ADR-013 and ADR-014.

---

## ADR-003 — Immutable Sent/Accepted Quotation and Order Snapshots

**Status:** Accepted from `PROJECT_KNOWLEDGE.md`, `DR-012`, and Product Owner decision `DW-002` on 2026-07-16

**Context**  
Product names, translations, options, materials, colors, media, and prices can change after a commercial agreement. Existing business rules require accepted quotations and historical Orders to remain permanent and independent of those live changes. The Product Owner also accepted numbered revisions that freeze when sent and must be replaced by a new revision when changed.

**Decision**  
Treat each sent Quotation Revision, every accepted item fact, Customer Acceptance evidence, and every historical Order Item Snapshot as immutable commercial history. Live catalog records may be referenced for navigation but must not determine historical commercial meaning. Corrections use a new numbered revision. Expiry, withdrawal, infeasibility, cancellation, and after-sales records remain subject to the narrowed residual policies.

**Alternatives considered**

- Render historical Orders directly from current Product records.
- Allow in-place edits to sent or accepted quotations.
- Store only a generated document without structured snapshot facts.

**Consequences**

- Customer and Manager can reconstruct the accepted agreement.
- Snapshot completeness and versioning rules become release-critical.
- Storage use increases modestly through controlled duplication.
- Policy is needed for audited corrections, cancellations, and refunds.

**Risks**

- Incomplete snapshots could still make history ambiguous.
- Incorrectly mutable nested data or attachments could undermine the invariant.
- Privacy/deletion obligations may conflict with retention and require explicit policy.

**Approval required**  
No further approval is required for sent/accepted revision or historical Order immutability. Quotation expiry, withdrawal, infeasibility, and cancellation policy remain open; later architecture must prove enforcement and migration safeguards.

---

## ADR-004 — Public and Private Storage Separation

**Status:** Accepted from `DR-010`, `DR-016`, and Product Owner decision `DW-009` on 2026-07-16

**Context**  
Catalog images and deliberately published CMS media are public. Payment proof, customer reference images, documents, message attachments, and other customer uploads may contain sensitive data. The source material requires authorization but does not yet approve retention, scanning, access-link, or file-limit policies.

**Decision**  
Separate intentionally public media from private Customer/business uploads through enforceable storage boundaries, and require server authorization for private access. The accepted classifications are Public (Products and Portfolio), Private (Customers and Orders), Sensitive (Payment proof), and Restricted (Internal notes and Audit logs). Everything is private by default. Exact access-link, validation/scanning, metadata, retention/deletion, provider, and storage layout remain the residual `DW-009` policy and `DW-016`.

**Alternatives considered**

- One public storage location for every file.
- Store binary files directly in the relational database.
- One storage namespace relying only on obscure object paths.

**Consequences**

- Public media can be optimized without weakening private-file controls.
- Upload processing, access checks, scanning posture, retention, and audit must be designed before uploads ship.
- Moving content from private to public becomes an explicit publication action.

**Risks**

- Misclassification or misconfiguration could expose sensitive files.
- Long-lived links could bypass intended revocation.
- File scanning and transformation failures require safe quarantine/recovery behavior.

**Approval required**  
The separation and classification constraints are Accepted. Access-link, validation/scanning, retention/deletion, and provider choices remain open through the residual `DW-009` policy and `DW-016`.

---

## ADR-005 — Server-Enforced Authorization and State Transitions

**Status:** Accepted from explicit authorization rules and the mandatory Definition of Done under `DR-016`

**Context**  
Customers may access only their own private records, while the Manager performs privileged commercial and publication actions. Client-side visibility is not an authorization boundary. Invalid lifecycle transitions could start production without payment or mutate commercial history.

**Decision**  
Enforce authentication, object ownership/scope, role/action authorization, and state-transition guards on the trusted server side for every private read and mutation. User-interface controls provide guidance only. Exact privileged audit taxonomy remains `DW-017`; the authentication/authorization product remains `DW-015`.

**Alternatives considered**

- Client-only route and button protection.
- Broad Manager/customer data access filtered only in the UI.
- Authorization embedded independently in every interface with no shared policy contract.

**Consequences**

- Every server operation needs an explicit authorization contract and negative tests.
- Direct object access must be ownership-checked.
- Background jobs and provider callbacks require their own trusted identities and scoped authority.

**Risks**

- Inconsistent enforcement between entry points could create bypasses.
- Overly broad service credentials could defeat object-level checks.
- A single Manager remains an operational recovery risk.

**Approval required**  
The server-enforcement constraint is Accepted. Customers use email with OTP verification; the Manager uses a strong password, MFA, and recovery codes. Exact Customer profile fields, Manager emergency continuity, account closure/export, session policy, provider, and verification evidence remain open through the residual `DW-008`, `DW-015`, and the architecture/security phase.

---

## ADR-006 — Transactional Outbox or Equivalent Durable Side Effects

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
State changes can trigger notifications, search/cache changes, media processing, analytics, or other asynchronous work. A committed payment verification must not be lost or repeated merely because an email fails. The audit recommends a transactional outbox or equivalent mechanism.

**Decision**  
Adopt a durable mechanism that records the authoritative business transition and its side-effect intent atomically, then delivers side effects with idempotency, retries, failure visibility, and reconciliation. A transactional outbox is the default proposal, but an equivalent mechanism may be accepted if it proves the same guarantees. Tool/provider selection is open.

**Alternatives considered**

- Call external providers synchronously inside every business request.
- Fire-and-forget in-memory events.
- Periodically infer every side effect by scanning mutable records.

**Consequences**

- Committed business state remains authoritative during provider outages.
- Consumers need idempotency keys, retry policy, delivery status, and dead-letter/escalation handling.
- Operations need visibility into lag and exhausted retries.

**Risks**

- Incorrect idempotency may produce duplicate customer communication.
- Outbox backlog may delay essential notifications.
- Treating analytics and notifications identically could obscure different reliability needs.

**Approval record**  
Accepted by the Product Owner on 2026-07-16. Retry/escalation values remain operational configuration.

---

## ADR-007 — Provider Adapters at External Boundaries

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
Authentication, storage, email, future push, search, analytics, AI, and deployment services are undecided and may change. Core transaction behavior must remain usable when AI is unavailable and must not be expressed in vendor-specific calls.

**Decision**  
Place external provider behavior behind small capability-oriented boundaries owned by the application. Keep business rules, lifecycle decisions, and authorization outside provider adapters. Do not build generalized abstractions before a real boundary exists; use the smallest interface needed by an approved use case.

**Alternatives considered**

- Call provider SDKs throughout business logic.
- Build a universal integration framework in advance.
- Self-host every external capability in Version 1.

**Consequences**

- Provider replacement and test doubles become more practical.
- Provider-specific capabilities and failure modes still need explicit mapping.
- Core workflows can define graceful degradation separately from optional enhancements.

**Risks**

- Leaky abstractions may hide important provider constraints.
- Excessive indirection may slow delivery without improving portability.
- Lowest-common-denominator interfaces may discard useful features.

**Approval record**  
Accepted by the Product Owner on 2026-07-16. Provider boundaries remain capability-focused rather than a generalized integration framework.

---

## ADR-008 — Durable Background Jobs

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
Email delivery, optional push, media transformation, notification retry, cleanup, backup verification, scheduled publication, and future AI/analytics work may not belong in an interactive request. The mechanism and provider are undecided.

**Decision**  
Use a durable background-job mechanism for approved work that can execute asynchronously. Jobs must define ownership, idempotency, retry/backoff, timeout, concurrency, observability, failure escalation, and safe replay. Business state changes remain governed by `STATE_MACHINES.md`; a job cannot bypass actor/guard rules merely because it runs in the background.

**Alternatives considered**

- Perform all work synchronously.
- Use process-local, non-durable task scheduling.
- Introduce multiple queue systems by module in Version 1.

**Consequences**

- User-facing requests can remain responsive during slow provider/media work.
- Job state and operational recovery become part of the production system.
- The durable-side-effect mechanism and job mechanism must have a clear relationship.

**Risks**

- Duplicate or out-of-order jobs could violate expectations if not guarded.
- Silent retry exhaustion could hide customer-impacting failures.
- Scheduled jobs depend on correct time-zone and localization handling.

**Approval record**  
Accepted by the Product Owner on 2026-07-16; operational values remain configuration and runbook work.

---

## ADR-009 — First-Class Localization Architecture

**Status:** Accepted from `DR-016` and Product Owner decision `DW-011` on 2026-07-16

**Context**  
The product is Arabic-first and RTL-native. Arabic is required for Version 1, English is optional, and French is outside Version 1. UI, validation, content, emails, notifications, policies, dates, numbers, currencies, and managed content need localization for each included language. AI translation may assist only in Version 1.1 and cannot publish without human approval.

**Decision**  
Treat locale and text direction as first-class application context, require Arabic RTL, support optional English without making it a Version 1 release dependency, require human Manager approval before translated content is published, and do not hardcode Customer-visible copy. French is not a Version 1 locale. Exact content representation, draft/review/publication lifecycle, source-version linkage, completeness, and fallback remain the residual `DW-011` policy and later architecture work.

**Alternatives considered**

- Build one language first and retrofit RTL later.
- Store all language variants in unstructured blobs without lifecycle.
- Auto-publish machine translations.

**Consequences**

- Arabic RTL is verified throughout delivery rather than added at the end.
- Arabic requires complete RTL critical-workflow coverage; English requires equivalent checks only when included in the release.
- Content publication must account for locale completeness and source-version changes.
- Additional locales can reuse the same lifecycle without assuming translation quality.

**Risks**

- Unapproved fallback could expose stale or wrong-language content.
- Layout and media may have locale-specific needs beyond string translation.
- Translation version drift may make published content inconsistent.

**Approval required**  
The first-class localization constraint and Version 1 language scope are Accepted. Locale fallback and the remaining editorial lifecycle policy remain open; later technical structure must comply.

---

## ADR-010 — Append-Only Business Audit Logging

**Status:** Accepted by the Product Owner on 2026-07-16

**Context**  
Quotation, acceptance, payment verification, production authorization, fulfilment, content publication, access, and security-sensitive actions require accountability. Operational logs alone are not a durable business history. Exact events and retention require `DW-009` and `DW-017`.

**Decision**  
Create append-only Audit Events for approved business-critical and security-significant actions. Capture actor identity/type, action, target, timestamp, outcome, permitted before/after state facts or change summary, reason where required, and correlation context. Audit records must be access-controlled, tamper-resistant within the approved threat model, searchable by authorized operators, and governed by retention/privacy policy. Do not place secrets or unnecessary sensitive file contents in audit payloads.

**Alternatives considered**

- Rely only on application/server logs.
- Keep only current record timestamps and last editor.
- Make every domain record fully event-sourced in Version 1.

**Consequences**

- Commercial and privileged actions can be reconstructed without making audit the source of current state.
- Event taxonomy, access, retention, redaction, integrity, and export require design.
- Failed privileged attempts may be recorded without changing business state.

**Risks**

- Excessive payloads could create a secondary privacy exposure.
- Missing actor/correlation data would reduce evidentiary value.
- Unbounded retention could conflict with privacy or cost requirements.

**Approval record**  
The append-only PostgreSQL Audit mechanism was accepted by the Product Owner on 2026-07-16. Viewer, retention, redaction, and incident procedures remain policy/configuration gates.

---

## ADR-011 — Single-Business Version 1 Without Premature Multi-Tenancy

**Status:** Accepted from explicit Version 1 scope and `DR-001`/`DR-016`

**Context**  
Version 1 explicitly serves one workshop with one Manager. The long-term product may expand to multiple managers, showrooms, workshops, countries, or brands, but no multi-tenant business rules are approved. The audit identifies premature tenancy as unnecessary complexity.

**Decision**  
Implement Version 1 as a single-business product. Preserve clean ownership boundaries and avoid assumptions that make later expansion impossible, but do not add tenant administration, cross-tenant isolation machinery, generalized tenant configuration, or multi-business data paths before requirements exist. Revisit tenancy through a new ADR based on approved future scope.

**Alternatives considered**

- Full multi-tenant architecture in Version 1.
- Hardcode business identity throughout every module with no boundary.
- Build separate deployments as an assumed future business model.

**Consequences**

- Version 1 remains simpler and aligned to actual users.
- Business-owned settings should still have a coherent boundary.
- Future multi-tenancy will require deliberate domain, authorization, data-isolation, migration, and operational design.

**Risks**

- Careless global assumptions could make later separation expensive.
- Speculative “future-proof” fields could quietly introduce incomplete tenancy.
- Stakeholders may mistake modularity for promised multi-tenant readiness.

**Approval required**  
No further Version 1 approval is required. Future multi-business scope requires separate discovery and a new ADR.

---

## 2. Approval Sequence and Dependencies

1. Pre-architecture blocker review is complete: no true Architecture Blocker remains, and `AB-004` is resolved as Order-level production. Preserve `BP-*` and `CFG-*` flexibility without inventing policy.
2. Treat Accepted ADR-003, ADR-004, ADR-005, ADR-009, and ADR-011 as constraints on architecture options.
3. Resolve ADR-001 and ADR-002 through `DW-015`.
4. Resolve provider/deployment choices through `DW-016` only after data classification and recovery targets are approved.
5. Resolve ADR-006, ADR-007, ADR-008, and ADR-010 through `DW-017` after notification/audit guarantees are known.
6. Select products/providers, deployment topology, schemas, APIs, and module layout only in later architecture work authorized by the product owner.

## 3. Decisions Intentionally Not Made Here

- Programming language, framework, runtime, or package manager.
- Authentication, database, storage, email, push, search, analytics, AI, monitoring, or hosting provider.
- Database tables, columns, indexes, constraints, migrations, or seed data.
- APIs, events, routes, controllers, UI components, or module/package layout.
- Cloud regions, environments, deployment topology, secrets management, or CI/CD design.
- Multi-tenant data model or future business operating model.

These remain `DW-015` through `DW-017` architecture-phase decisions. The planning package is Architecture Ready, but these choices are made only after an explicit Product Owner request to begin architecture.

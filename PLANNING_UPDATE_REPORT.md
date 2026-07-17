# PLANNING UPDATE REPORT

**Project:** Project Atelier / بيتي بذوقي  
**Date:** 2026-07-15  
**Status:** Planning update complete; proposed decisions await approval  
**Implementation produced:** None

> **Historical report:** This document records the 2026-07-15 planning revision. Its Open Decision inventory and readiness recommendation are superseded by `DECISION_WORKSHOP.md` and `IMPLEMENTATION_READINESS_REPORT.md` dated 2026-07-16. The underlying scope-change history remains valid.

---

## 1. Executive Result

The planning set now defines a narrowed Version 1 around one complete custom-furniture transaction, a conceptual domain model, explicit lifecycle transitions, a proposed ADR register, measurable proposed quality targets, and a global Definition of Done.

No application architecture, database schema, API, UI component, or source code was generated. `PROJECT_KNOWLEDGE.md` and `PROJECT_AUDIT.md` remain source evidence and were not edited.

The documents are ready for a product-owner and technical decision review. They are not an implementation authorization: core business policies, security rules, the proposed Project-to-Order transition, state machines, quality targets, and ADRs still require approval.

---

## 2. Files Created

| File | Purpose | Status |
|---|---|---|
| `QUALITY_GATES.md` | Proposed measurable quality targets plus the global Definition of Done | Proposed for approval |
| `DOMAIN_MODEL.md` | Conceptual business objects, relationships, ownership, mutability, lifecycle, authorization, and historical-record needs | Proposed for approval |
| `STATE_MACHINES.md` | Allowed proposed states/transitions with actors, guards, effects, notifications, audit, reversibility, and recovery | Proposed for approval |
| `ARCHITECTURE_DECISIONS.md` | Proposed ADR register without selecting frameworks, providers, schemas, APIs, or deployment topology | Proposed for approval |
| `PLANNING_UPDATE_REPORT.md` | Summary of this planning revision, decisions, blockers, and readiness recommendation | Complete |

## 3. Files Updated

| File | Change |
|---|---|
| `MASTER_PRD.md` | Narrowed Version 1, staged non-core features, added conditional 360° gate, made quotation revisions/snapshots explicit, added measurable proposed NFRs, referenced all companion documents, and consolidated Open Decisions |

## 4. Source Files Preserved

- `PROJECT_KNOWLEDGE.md` — not modified.
- `PROJECT_AUDIT.md` — not modified.
- Application/tooling files — not modified by this planning update.

---

## 5. Scope Changes

### Version 1 retained

- Arabic-first RTL storefront with complete French and English functional parity.
- Customer accounts and one Manager account.
- Catalog, normal non-AI search, CMS, localization, and basic optimized product media.
- Bounded basic Product Configuration using only Manager-defined options.
- Multi-item Customer Projects and Submitted Requests.
- Manager feasibility review and clarification.
- Quotation Revisions, change requests, Customer Acceptance, and immutable commercial history.
- Bank-transfer proof upload, rejection/replacement, and manual Payment Verification.
- Production tracking with an absolute verified-payment gate.
- Pickup or delivery fulfilment.
- Customer-Manager messaging.
- Essential localized in-app and email notifications.
- Operational customer/Manager views and status queues needed to run the transaction.
- Security, authorization, private-file controls, Audit Events, backup/recovery, accessibility, RTL/localization, browser support, and performance gates.

### Proposed for Version 1.1

- AI recommendations and the other documented AI assistance.
- Advanced analytics and decision dashboards.
- Push notifications.
- Reviews and Manager responses.
- Favorites and Saved Designs.
- 360° media if its Version 1 readiness gate is not approved and demonstrated.

### Proposed for Version 1.2 or later

- Advanced comparison.
- The explicitly future roles, inventory/supplier capabilities, payment methods, native apps, 3D/AR/room visualization, multi-business operations, integrations, and richer communication media already deferred by the source material.

### Conditional Version 1

Interactive 360° media is the only explicitly conditional Version 1 capability in this revision. It ships only if representative production assets satisfy the approved capture workflow, accessible fallback, supported-device behavior, and `Q-MED-006` through `Q-MED-009`. Otherwise it moves to Version 1.1 and does not block the core release.

---

## 6. New Proposed Decisions

### Domain and lifecycle

- `DM-001`: a Customer Project does not become an Order on submission. Under the proposal, accepting exactly one sent Quotation Revision atomically creates the Customer Acceptance, Order, and immutable Order Item Snapshots in an awaiting-payment state.
- Submitted Requests are distinct snapshots of a submitted Customer Project.
- Sent Quotation Revisions become immutable; any commercial change requires a new revision.
- Accepted Quotation Revisions, Customer Acceptance evidence, and historical Order Item Snapshots remain immutable.
- Production cannot transition from not-started until a successful Manager-created Payment Verification exists.
- Every listed lifecycle transition remains Proposed pending approval; unlisted transitions are forbidden rather than assumed.

### Quality

- WCAG 2.2 AA with zero known critical violations and zero known unresolved A/AA failures at release.
- Core Web Vitals: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75.
- Proposed mobile JavaScript, CSS, transfer-weight, and Lighthouse budgets.
- Proposed p95 API response targets and error-rate thresholds.
- Proposed image and 360° media budgets.
- Explicit RTL/localization completion criteria and browser/device matrix.
- Proposed 99.9% monthly core-workflow availability and < 0.5% server/client error targets.
- Proposed transactional-data RPO ≤ 1 hour, core-service RTO ≤ 4 hours, and monthly restore testing.
- One global Definition of Done for every feature and release.

All numeric quality values are marked **Proposed**, not Accepted.

### Architecture constraints

The following ADRs are Proposed, not finalized:

1. Modular monolith for Version 1.
2. Relational transactional data category.
3. Immutable quotation and Order snapshots.
4. Enforced separation of public and private storage.
5. Server-enforced authorization and state transitions.
6. Transactional outbox or an equivalent durable side-effect mechanism.
7. Small provider adapters at real external boundaries.
8. Durable, observable, idempotent background jobs.
9. First-class Arabic RTL and localization architecture.
10. Append-only business Audit Events distinct from operational logs.
11. One-business Version 1 without premature multi-tenancy.

No provider, framework, database product, queue, hosting platform, schema, API, or application module layout was selected.

---

## 7. Contradictions Resolved

| Previous ambiguity or conflict | Planning resolution |
|---|---|
| Version 1 mixed the core transaction with a broad enhancement set | Version 1 now contains the complete core transaction; enhancement phases are explicit |
| Push appeared launch-critical despite being non-essential | Version 1 uses in-app and email; push is proposed for Version 1.1 |
| Reviews appeared inside the core dashboard and release sequence | Reviews are proposed for Version 1.1 and no longer block Version 1 |
| AI and advanced analytics had unclear release status | Both are proposed for Version 1.1; Version 1 has normal search and operational status information only |
| Favorites and Saved Designs broadened the core account scope | Both are proposed for Version 1.1; configuration can be placed directly in a draft Project in Version 1 |
| 360° media was described as mandatory without a ready asset contract | It is Conditional V1 with automatic deferral to Version 1.1 if the readiness gate fails |
| “Order as shown” could be mistaken for direct checkout | Every Version 1 path follows Project → Request → Quotation → Acceptance → payment verification → production |
| Project, Request, Quotation, and Order boundaries were unclear | `DOMAIN_MODEL.md` separates the objects and proposes one explicit acceptance-to-Order point |
| Quotation changes could overwrite the agreed offer | Sent revisions and accepted history are immutable; changes create a new revision |
| Historical Orders could depend on mutable catalog data | Order Item Snapshots preserve the accepted commercial facts |
| Vague accessibility/performance/reliability goals were not testable | `QUALITY_GATES.md` supplies measurable proposed thresholds and evidence requirements |
| “Future-proofing” could imply early multi-tenancy or services | ADR-001 and ADR-011 propose a modular monolith and single-business Version 1 |
| Open Decisions were repeated as scope questions, ADRs, and NFR placeholders | Scope is resolved in Section 5; detailed proposals live in one canonical companion document and the PRD now references their approval |

---

## 8. Remaining Blocking Questions

### Business and lifecycle

- Approve or revise `DM-001` and the full conceptual Domain Model.
- Approve the State Machines and decide post-submission withdrawal/edit behavior.
- Define quotation expiry, correction, decline/reopen, supersession, and cancellation policy.
- Define acceptance evidence and accepted commercial terms.
- Approve currency, tax, rounding, line-item, discount, deposit/stage, and final pricing rules.
- Define payment-proof file rules, mismatch/duplicate/partial/overpayment behavior, retention, and audited correction/reversal.
- Approve cancellation, refund, custom-furniture return, warranty, repair, and dispute policies.
- Define delivery area/pricing, scheduling, receipt evidence, failed pickup/delivery, damage, and dispute behavior.
- Define production delay, pause, rework, correction, and cancellation behavior.
- Approve bounded Version 1 configuration/conflict-rule types.
- Define messaging context/linkage and retention.

### Identity, security, privacy, and operations

- Define Customer signup/verification, Manager bootstrap/recovery, session/MFA posture, and account deletion/export.
- Approve data classification, private access, signed-link, upload validation/scanning, retention/deletion, audit taxonomy, and incident response.
- Define the single-Manager continuity procedure.
- Approve monitoring, alerting, escalation, rollback, recovery ownership, and backup-retention/geographic-copy policy.

### Experience and release acceptance

- Approve locale fallback, locale completeness, formatting, and CMS publication policy.
- Approve mandatory/optional notification events, email channel mapping, preferences, retry, and delivery evidence.
- Approve base-image workflow and either approve the 360° readiness contract or defer it.
- Approve brand, typography, and design-system decisions.
- Approve or revise every proposed value and the exception policy in `QUALITY_GATES.md`.
- Approve or revise the Version 1.1/later roadmap assignments.

### Architecture approval

- Approve, revise, or reject ADR-001 through ADR-011.
- Only after the constraints are approved: select the application stack, authentication/database/storage/email/search/observability providers, durable-job mechanism, hosting, deployment, migration, rollback, and secrets approach.

---

## 9. Architecture Readiness Recommendation

**Recommendation: do not begin finalized application architecture or implementation yet.** Begin a short decision-closure review using these documents. Architecture work may proceed only after Gate 1 in `MASTER_PRD.md` is satisfied—at minimum, approval or revision of `DM-001`, the core State Machines, commercial/payment/fulfilment policies that affect the transaction, the authorization/private-file posture, the quality targets, and the relevant ADRs.

Once those constraints are approved, application architecture work may begin with a stable product contract. Database schemas, APIs, UI design, and source code should remain paused until then.

---

## 10. Completion Boundary

This update stops at planning documentation as requested. No application architecture, database schema, API contract, UI component, or source code is included.

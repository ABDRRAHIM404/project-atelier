# Version 1 Implementation Risk Register

**Status:** Approved by the Product Owner on 2026-07-16  
**Planning date:** 2026-07-16  
**Review cadence:** At each phase entry, gate, architecture/contract change, and release-candidate decision

## 1. Rating model

- **Likelihood:** Low, Medium, or High based on current plan exposure, not a statistical forecast.
- **Impact:** Moderate, High, or Critical to Version 1 safety/delivery.
- **Disposition:** Prevent, reduce, transfer/isolate, accept with evidence, or avoid.
- Any Critical-impact risk that threatens authorization, immutable history, payment gating, private files, data recovery, or legal release readiness blocks the affected gate until controlled.

## 2. Risk register

| ID | Risk | Likelihood | Impact | Exposed phase/gate | Required prevention/evidence | Trigger and contingency | Owner |
|---|---|---:|---:|---|---|---|---|
| IR-001 | Version 1.1 features enter Version 1 through “small” schema/API/UI additions | Medium | High | All | Scope traceability; absent-feature checks; Product Owner change control | Any Review/Favorite/Saved Design/AI/push/advanced analytics/360/item-production work: stop, remove from V1 branch, seek roadmap approval | Product Owner + Release Management |
| IR-002 | An unresolved `BP-*`/`CFG-*` value becomes a hard-coded default | High | Critical | All/G9 | Typed fail-closed configuration; decision references in tasks/tests; governance lane | Undocumented value or enabled action: disable affected path, record decision request, rerun gate | Business Configuration + Product Owner |
| IR-003 | Shared Actor/Money/Error/Locale/event contracts churn after parallel work starts | Medium | High | P0–P7 | Contract freeze per wave; single owner; consumer matrix; compatibility review | Breaking contract proposal: pause consumers, assign integration owner, update all affected tests/docs together | Shared Kernel/Integration owner |
| IR-004 | Multiple agents edit migrations, lockfile, shared config, catalogs or generated artifacts and create semantic merge conflicts | High | High | All | Exclusive file/category ownership; serialized migration IDs; integration branch owner | Overlap detected: stop one lane, preserve both intents, reconcile through owner, rerun full affected gate | Phase integration owner |
| IR-005 | Migration locks, ordering, drift or incompatible rollback damages availability/data | Medium | Critical | P1/P8/P9 | Expand–migrate–contract; empty/upgrade rehearsal; lock/query-plan evidence; backup point | Lock/runtime/integrity threshold exceeded: abort before promotion, use compatible artifact or reviewed forward recovery | Data Platform |
| IR-006 | RLS actor context leaks through pooled connections or Manager context becomes a generic bypass | Medium | Critical | P1 onward | Forced RLS, non-owner runtime, transaction-local context, generated multi-actor concurrency suite | Cross-Customer result or context persistence: block all protected work, rotate access if needed, fix and full security rerun | Access and Identity + Data Security |
| IR-007 | Clerk identity mapping, webhook ordering, MFA assurance or Manager recovery is misimplemented | Medium | Critical | P1/P9 | Local authorization authority; signed/deduped sync; unmapped fail-closed; MFA tests; approved continuity runbook | Mapping collision/assurance ambiguity/provider outage: deny protected action, reconcile identity, use approved recovery only | Access and Identity |
| IR-008 | Submitted/Quotation/Order snapshot omits facts needed to interpret the agreement later | Medium | Critical | P3/P4 | Snapshot completeness review; catalog/config/content-change rendering tests; versioned schemas | Historical rendering requires live mutable data: block G4, extend snapshot compatibly before acceptance release | Projects + Quotations + Orders |
| IR-009 | Concurrent acceptance creates duplicate/partial Orders or accepts a superseded Revision | Medium | Critical | P4 | Locks/serializable transaction, idempotency digest, unique constraints, failure injection | Duplicate/partial/stale success: block downstream phases, repair design before any data exists, full transaction audit | Acceptance coordinator |
| IR-010 | Upload, provider event, UI state or background job verifies payment automatically | Low | Critical | P5/P6 | Separate Submission/Verification; Manager MFA command; negative paths through every adapter | Non-human verification path detected: disable payment/production, preserve evidence, security review and full invariant rerun | Payments + Security |
| IR-011 | Malicious/unknown/late/out-of-order file scan becomes usable or proof link leaks | Medium | Critical | P2/P5/P6 | Quarantine until CLEAN; signed/deduped events; parent authorization; short-lived URLs; log/cache tests | Verdict uncertain/leak detected: quarantine affected zone, invalidate capabilities, reconcile events, incident review | Files and Media + Security |
| IR-012 | Versioned object growth, scanning, requests or egress create unobserved cost | Medium | Moderate | P2/P9/operations | Usage tags, lifecycle only after policy, budgets/alerts, monthly cost review | Cost trend/allowance trigger: investigate versions/egress, apply approved lifecycle/CDN decision, never delete required history silently | Files/Operations |
| IR-013 | Item-level production or workforce/inventory behavior leaks into Version 1 | Medium | High | P6 | Schema/API/route absence checks; Order-level transition tests; scope audit | Item status/task/worker field appears: remove/defer and rerun data/API/scope traceability | Production + Product Owner |
| IR-014 | Unresolved cancellation, delay, refusal, damage or partial-handoff policy creates unsupported operational states | High | High | P4–P9 | Unsupported transitions absent; accurate public policy; Product Owner governance before affected release | Manager/customer needs unavailable exception: use approved offline/support procedure only after policy; do not mutate state ad hoc | Product Owner + Orders/Production/Fulfilment |
| IR-015 | Notification retries duplicate Customer messages or repeat business transitions | Medium | High | P1/P7 | Transactional outbox, event identity, recipient dedupe, provider idempotency, separate delivery state | Duplicate/backlog/provider callback anomaly: stop dispatcher if harmful, reconcile from durable facts, never repeat transition | Notifications + Audit/Operations |
| IR-016 | Six-provider footprint overwhelms a solo maintainer | High | High | P1–P9 | Staged adoption, adapter boundaries, unified access/credential/cost inventory, runbooks and alarms | Missing owner/credential/alert or repeated operational incident: block G9, simplify operational use without breaking ADR | Operations + Product Owner |
| IR-017 | Serverless timeout/concurrency leaves jobs stuck or duplicated | Medium | High | P1/P7/P9 | Bounded batches, leases, checkpoints, retries, dead-letter visibility, scheduled reconciliation | Oldest-job/lease anomaly: pause consumers if needed, release expired lease, reconcile idempotently, inspect capacity config | Audit and Operations |
| IR-018 | Arabic RTL, bidi, accessibility or mobile behavior is deferred until late UI integration | Medium | Critical | P0 onward | Arabic default smoke from P0; per-phase Playwright/axe/manual review; semantic design system | Raw key/overflow/focus/reading-order violation: block feature gate and fix in owning slice, not P8-only | Localization + Presentation + Accessibility |
| IR-019 | Performance budgets fail after catalog media/dashboard complexity accumulates | Medium | High | P2/P7/P8 | Per-phase Lighthouse/media/query budgets, bundle trend, server timing, representative data | Budget regression: block merge, remove/defer cost or optimize within approved behavior; do not weaken profile | Performance owner + affected module |
| IR-020 | Flaky browser/provider/concurrency tests erode gate trust | Medium | High | All | Deterministic fixtures, stable selectors/contracts, controlled clocks, quarantine governance | Repeated nondeterminism: mark defect with owner/expiry/compensating evidence; mandatory invariant tests cannot be waived | Test Platform |
| IR-021 | Staging differs from production region/extensions/provider/IAM and gives false confidence | Medium | Critical | P8/P9 | Environment parity matrix; same migration chain/extensions/config schemas; isolated provider smoke | Parity gap affecting core behavior: block G8/G9, reproduce missing condition or document approved safe difference | Deployment + Data/Provider owners |
| IR-022 | Provider backup status is mistaken for proven recovery | Medium | Critical | P8/P9 | Monthly isolated restore; S3 version reconciliation; measured RPO/RTO; corrective actions | Restore exceeds target/misses objects/invariants: block release, repair backup/reconciliation and rerun | Data/Files/Operations |
| IR-023 | Logs, traces, browser artifacts or Audit metadata capture PII, proof, tokens or signed URLs | Medium | Critical | P0 onward | Allowlisted telemetry/audit schemas, scrubbing tests, artifact access/retention, no raw request bodies | Sensitive capture: restrict/delete under approved procedure, rotate capability/secret, incident review and scrubber fix | Observability + Security |
| IR-024 | Synchronous provider outage blocks or corrupts core workflow | Medium | High | P1–P9 | Timeouts, fail-closed identity, quarantine files, durable side effects, adapter contract/resilience tests | Outage: preserve committed DB truth, show recoverable status, queue/reconcile, never bypass assurance/scan | Provider owner + Operations |
| IR-025 | Single Manager absence/account loss stalls verification and fulfilment | Medium | High | P1/P9/operations | Approved `BP-007` continuity/recovery, backup codes, named operator procedure, drills | Manager unavailable/recovery fails: follow approved continuity path; no hidden super-admin or direct DB mutation | Product Owner + Access/Operations |
| IR-026 | Secret scope, callback signing or provider IAM is overprivileged/misconfigured | Medium | Critical | P1/P2/P7/P9 | Least privilege per environment/purpose, secret scanning, rotation, signed callback tests, access inventory | Leak/invalid signature/overbroad role: revoke/rotate, quarantine events, audit access, block environment gate | Security + Provider owners |
| IR-027 | Arabic PostgreSQL search relevance or latency misses accepted needs | Medium | Moderate | P2/P8 | Approved representative Arabic query corpus, normalization/ranking tests, query plans and Q-API target | Relevance/performance miss: tune within PostgreSQL; if insufficient, open later ADR rather than silently add provider | Catalog and Search |
| IR-028 | Typed configuration grows into an unsafe general expression/rules engine | Medium | High | P1 onward | Code-registered keys/schemas, bounded catalog relations, approval/effective history, architecture review | Arbitrary expression/script/data-driven authorization proposed: reject and require ADR/product evidence | Business Configuration + Architecture owner |
| IR-029 | Region, Saudi legal/data-residency, tax/policy wording or retention remains unresolved at launch | High | Critical | P8/G9 | `GOV-*` lane, legal/Product Owner approvals, readiness check, accurate Arabic policy publication | Any release-affecting item unresolved: G9 remains closed; no production data/provider purchase/promise | Product Owner + Legal/Operations |
| IR-030 | Advanced analytics sneaks into operational metrics/dashboards and expands consent/privacy scope | Medium | Moderate | P7/P8 | Restrict to queues, statuses, SLOs and accepted baseline measures; scope/field review | New behavioral taxonomy/profile/warehouse requested: defer under DW-021 and remove from V1 release | Product Owner + Observability/Workspaces |

## 3. Top implementation risks

The highest-priority controls before feature breadth are:

1. `IR-002` — policy/configuration guessing;
2. `IR-006` — RLS/authorization isolation;
3. `IR-008`/`IR-009` — immutable snapshot completeness and atomic Order creation;
4. `IR-010`/`IR-011` — manual Payment Verification and sensitive-file safety;
5. `IR-018` — Arabic/accessibility built continuously;
6. `IR-022` — demonstrated recovery rather than assumed backup; and
7. `IR-029` — release-specific policy/legal/region readiness.

These risks determine the implementation order in `IMPLEMENTATION_PHASES.md`.

## 4. Risk ownership and closure

A risk closes for a phase only when:

- its preventive control is implemented;
- the required positive, negative, concurrency and recovery evidence passes;
- the residual risk and owner are recorded;
- any policy/configuration dependency is approved or the affected behavior remains unavailable; and
- the phase reviewer accepts the evidence.

“No incident observed” is not evidence of control.

## 5. Escalation rules

- Critical invariant/security/privacy/recovery risks stop dependent implementation immediately.
- Scope or policy conflicts go to the Product Owner; provider/technology contract changes require ADR review.
- Migration/data issues go to the Data Platform and release owner before any continuation.
- Multi-agent ownership conflicts go to the phase integration owner before merging.
- A risk may not be reduced by weakening `QUALITY_GATES.md` or hiding failed evidence.

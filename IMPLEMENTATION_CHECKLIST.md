# Version 1 Implementation Checklist

**Status:** Approved by the Product Owner on 2026-07-16  
**Use:** Phase entry/exit, merge review, release-candidate review, and launch authorization  
**Rule:** A checked box requires linked evidence; “not applicable” requires written rationale

## 1. Planning approval and execution authorization

- [ ] `IMPLEMENTATION_PLAN.md` approved.
- [ ] `IMPLEMENTATION_PHASES.md` and G0–G9 approved.
- [ ] `IMPLEMENTATION_BACKLOG.md` ownership and scope approved.
- [ ] Module order/dependency/parallel-agent controls approved.
- [ ] Test and release plans approved.
- [ ] Risk owners accepted.
- [ ] Database/API approval is recorded in authoritative status documents.
- [ ] A separate explicit instruction authorizes P0 implementation.
- [ ] No instruction implicitly authorizes provider provisioning, production data, deployment or unresolved policy.

## 2. Per-task Definition of Ready

- [ ] Stable backlog ID, phase and owning module assigned.
- [ ] Upstream contracts/gate passed.
- [ ] Expected outputs and acceptance criteria understood.
- [ ] Actor/resource/state/action/assurance cases identified.
- [ ] State-machine transitions and immutable facts identified.
- [ ] Database/API/error/idempotency/validation contracts identified.
- [ ] Applicable Audit/Notification/File/provider effects identified.
- [ ] Applicable Arabic/English/accessibility/responsive/performance requirements identified.
- [ ] Test data and environment are synthetic/isolated.
- [ ] `BP-*`/`CFG-*` dependency is approved, explicitly disabled, or synthetic-only.
- [ ] Files/artifacts are assigned exclusively if multiple agents work in parallel.
- [ ] Rollback/forward-recovery approach is understood.

## 3. Per-task Definition of Done

### Business and architecture

- [ ] Approved business requirements and acceptance criteria pass.
- [ ] Domain model, state machine, module boundary and ADR constraints are preserved.
- [ ] No unresolved policy/configuration became behavior.
- [ ] No Version 1.1/later scope was introduced.
- [ ] Only owning modules write their records.
- [ ] Cross-module atomic work uses the approved coordinator/transaction.

### Authorization, security and privacy

- [ ] Server-side authorization passes for every allowed actor.
- [ ] Denied, wrong-owner, wrong-state and insufficient-assurance cases pass.
- [ ] Cross-Customer non-disclosure tests pass where applicable.
- [ ] Field-level response filtering and cache policy pass.
- [ ] File purpose/classification/parent/scan/access checks pass where applicable.
- [ ] No secret/private data exists in source, client, cache, logs, telemetry, artifacts or docs.
- [ ] Security/privacy review is linked.

### Data, state and side effects

- [ ] Persistence constraints and optimistic/concurrent behavior pass.
- [ ] Immutable history/snapshot behavior passes where applicable.
- [ ] Idempotency same/different key/digest behavior passes where applicable.
- [ ] Audit Event and outbox intent commit with the business fact.
- [ ] Provider delivery is retryable, observable and non-authoritative.
- [ ] Migration, backfill, rollback/forward-recovery and documentation are included where affected.

### Experience and quality

- [ ] Loading, empty, validation, permission-denied, dependency-error/retry and success states exist.
- [ ] Arabic is complete and RTL/bidi behavior verified.
- [ ] Included optional-English surface is complete and verified; French remains absent.
- [ ] Mobile/desktop and applicable browser/device/input paths pass.
- [ ] Keyboard/focus/axe and applicable manual accessibility checks pass.
- [ ] API/page/media/performance budgets pass where applicable.
- [ ] No unexpected console error or unhandled rejection occurs.

### Engineering evidence

- [ ] Type checking, linting, formatting/repository checks pass.
- [ ] Unit/property tests pass.
- [ ] Real-PostgreSQL integration tests pass where applicable.
- [ ] Provider contract tests pass where applicable.
- [ ] Relevant Playwright journeys pass.
- [ ] Production build passes.
- [ ] Documentation, telemetry, runbook and test evidence are updated.
- [ ] Safe rollback/recovery is demonstrated or documented proportionately.

## 4. Phase G0 — Delivery Foundation

- [ ] Runtime/dependency workflow is deterministic.
- [ ] Modular boundaries and server-only/provider rules are enforced automatically.
- [ ] Shared Money/ID/Actor/Locale/time/version/error contracts pass.
- [ ] Arabic default/RTL shell and typed message-key gate pass.
- [ ] Unit/integration/browser/axe/quality evidence harnesses run locally and in CI.
- [ ] Correlation/logging/telemetry scrub prohibited data.
- [ ] Missing environment/config values fail closed.
- [ ] Clean production build and Arabic smoke pass with no console errors.
- [ ] G0 reviewer records Foundation Green.

## 5. Phase G1 — Trusted Data and Access

- [ ] Migration chain applies from empty without drift/dashboard mutation.
- [ ] Local Principal/Customer/Manager/external identity mapping and one-Manager invariant pass.
- [ ] Clerk boundary, Customer OTP, Manager MFA/backup-code assurance and fail-closed paths pass.
- [ ] Runtime/job roles are non-owner and cannot bypass RLS.
- [ ] Transaction-local actor context survives pool/concurrency negative tests without leakage.
- [ ] Full actor/owner/state/action/assurance matrix passes.
- [ ] Audit is append-only and safe.
- [ ] Idempotency/outbox/jobs/provider-event replay, lease and recovery tests pass.
- [ ] Synthetic fixtures contain no production data.
- [ ] G1 database/security reviewers record Trust Boundary Proven.

## 6. Phase G2 — Discovery and File Boundary

- [ ] Catalog/CMS/Translation/configuration domain and publication rules pass.
- [ ] Only approved published Arabic content appears publicly.
- [ ] Optional English is complete/gated; French is absent.
- [ ] Arabic search corpus, unpublished exclusion and query-plan targets pass.
- [ ] Secure upload intent/finalize/quarantine/scan/access lifecycle passes.
- [ ] Duplicate/late/out-of-order/malicious scan cases converge safely.
- [ ] Public promotion cannot expose Customer/payment/private files.
- [ ] Storefront browser/accessibility/media/performance gates pass.
- [ ] External uploads remain disabled until the applicable `CFG-003` upload limit and GuardDuty trigger are approved.
- [ ] G2 reviewers record Discovery and File Boundary Proven.

## 7. Phase G3 — Submitted Request and Clarification

- [ ] Customer owns and may edit only eligible Project drafts.
- [ ] Multi-item Product configuration is revalidated server-side.
- [ ] Submission creates exactly one immutable Submitted Request/Audit/outbox transaction.
- [ ] Live Project/Catalog changes do not alter submitted history.
- [ ] Manager review distinguishes Customer-visible and internal fields.
- [ ] One continuous Conversation and validated Project/Order context pass.
- [ ] Message attachments inherit parent/file authorization and clean-scan rules.
- [ ] Customer/Manager Project and clarification Playwright journey passes in Arabic.
- [ ] G3 reviewer records Request Submitted.

## 8. Phase G4 — Commercial Boundary

- [ ] Quotation Money totals, revision numbering and source trace pass.
- [ ] Draft-only edits and send/freeze/supersede transitions pass.
- [ ] Only current sent Revision can be accepted.
- [ ] Same-key replay/different-digest conflict/stale version behavior passes.
- [ ] Concurrent acceptance creates exactly one Acceptance and Order.
- [ ] Failure injection proves no partial Acceptance/Order/Audit/outbox.
- [ ] Sent/accepted Revision and Order snapshots reject update/delete.
- [ ] Historical rendering is independent of live Catalog/content/config/address/location.
- [ ] Arabic Manager quotation and Customer decision journey passes.
- [ ] G4 domain/data/security/Product reviewer records Commercial Boundary Proven.

## 9. Phase G5 — Manual Payment Verification

- [ ] Upload, clean scan, Payment Submission and Payment Verification are distinct.
- [ ] Only clean own correctly purposed proof becomes reviewable.
- [ ] Every submission/rejection remains immutable history.
- [ ] Sensitive proof list/cache/log/telemetry and signed-download controls pass.
- [ ] Manager MFA required for proof view and decision as designed.
- [ ] Proof/provider/job/UI cannot verify automatically.
- [ ] Manual decision is atomic/idempotent/concurrency-safe and audited.
- [ ] Verification unlocks but does not start Production.
- [ ] Unsupported exceptions/correction/reversal/partial-payment paths remain absent.
- [ ] G5 security/payment reviewers record Payment Gate Proven.

## 10. Phase G6 — Production and Fulfilment

- [ ] Production follows only Not Started → Materials Preparation → In Production → Quality Inspection → Ready, including approved rework loop.
- [ ] First Production transition rechecks verified Payment in the same transaction.
- [ ] Direct/database/job/config/Manager bypass attempts fail.
- [ ] No item-level Production field/relation/API/UI exists.
- [ ] Pickup/delivery uses immutable accepted method/location/address/price facts.
- [ ] Production READY precedes fulfilment readiness/completion.
- [ ] Clean authorized handoff evidence is required.
- [ ] Duplicate completion is idempotent and updates Order consistently.
- [ ] Unapproved delay/cancel/failure/refusal/damage/partial/dispute transitions remain absent.
- [ ] Complete Arabic core transaction passes for representative pickup and delivery.
- [ ] G6 reviewer records Core Transaction Complete.

## 11. Phase G7 — Operational Viability

- [ ] Customer workspace shows own Projects/Quotes/Orders/payment/production/fulfilment/Messages/Notifications and valid next actions.
- [ ] Manager queues cover requests, quotations, payment, production and fulfilment.
- [ ] Composed reads cannot bypass module authorization/RLS/field filtering.
- [ ] All seven essential event schemas/templates/recipients/channels pass.
- [ ] In-app dedupe and own-only read/unread behavior pass.
- [ ] Resend delivery/retry/callback/reconciliation is provider-isolated.
- [ ] Provider outage does not roll back or repeat business facts.
- [ ] Full loading/empty/error/retry/success and accessibility states pass.
- [ ] Manager completes staging workflow without raw DB/provider-console work.
- [ ] G7 Product Owner/Manager/operations reviewers record Operationally Viable.

## 12. Phase G8 — Release Candidate

- [ ] Version 1 requirement-to-implementation-to-test traceability is complete.
- [ ] Deferred modules/routes/schema/contracts are absent.
- [ ] Full static/unit/integration/provider/Playwright suites pass.
- [ ] Full authorization/threat/security review passes with no critical/high exploitable issue.
- [ ] WCAG 2.2 AA evidence has zero critical and no unresolved A/AA failure.
- [ ] Arabic/optional-English/browser/device/input matrix passes; French is absent.
- [ ] All accepted API/page/media/CWV performance targets pass under documented profiles.
- [ ] Resilience/provider outage/replay/job/scan-delay drills pass.
- [ ] Empty/upgrade migration, rollback/forward recovery and drift checks pass.
- [ ] Database restore and private-object reconciliation meet RPO/RTO.
- [ ] Every included feature satisfies the Global Definition of Done.
- [ ] Release-affecting policy/configuration has owner/approved state; affected unresolved behavior is not released.
- [ ] G8 reviewers record Release Candidate Qualified.

## 13. Phase G9 — Production Readiness and Launch

- [ ] All release-affecting `BP-*`/`CFG-*` decisions and Arabic wording are approved.
- [ ] Saudi region/legal/data-residency/tax/privacy/retention posture is approved where applicable.
- [ ] Provider terms/pricing rechecked at purchase/launch trigger.
- [ ] Production plans, resources, domains, secrets, IAM, callbacks and owners are approved and isolated.
- [ ] Clerk Manager MFA/recovery and Customer production auth readiness pass.
- [ ] S3 zones/versioning and GuardDuty external-upload requirement pass.
- [ ] Supabase backup/PITR and current restore evidence pass.
- [ ] Resend and Sentry/OTel domain/scrubbing/delivery/alert evidence pass.
- [ ] Vercel Pro commercial readiness and scheduler authentication pass.
- [ ] Migration, promotion, rollback, restore, reconciliation, incident and provider-outage runbooks pass drills.
- [ ] Availability/error/queue/backup/security/spend alerts reach their owner.
- [ ] Manager operational acceptance is signed.
- [ ] Product Owner explicitly records G9 Launch Authorized.
- [ ] Separate deployment instruction exists before any production change.

## 14. Multi-agent merge checklist

- [ ] Each agent owns a disjoint module/file/test set.
- [ ] Shared contracts were frozen and referenced before parallel work.
- [ ] Migration number, lockfile, shared config, localization catalog, event registry and generated artifact owner is singular.
- [ ] Integration point has one designated owner.
- [ ] Each lane rebased after foundation/contract changes.
- [ ] Module-level gates pass before merge.
- [ ] Integrated cross-module/concurrency/security tests pass after merge.
- [ ] Handoff records assumptions, decisions, changed contracts, tests and known risk.

## 15. Final scope-negative checklist

- [ ] No direct checkout or payment-before-quotation path.
- [ ] No automatic payment verification.
- [ ] No Production before verified Payment.
- [ ] No item-level Production.
- [ ] No mutable accepted commercial history.
- [ ] No public Customer/payment attachment by default.
- [ ] No browser/direct Supabase business-data authority.
- [ ] No French Version 1 route/content requirement.
- [ ] No Reviews, Favorites, Saved Designs, AI, push, advanced analytics or advanced 360 processing.
- [ ] No worker/inventory/supplier/multi-tenancy/microservices.
- [ ] No invented exception, cancellation, refund, delivery-failure, retention or legal policy.

## 16. Checklist completion

This checklist is complete only with linked evidence and required signatures. Empty checkboxes are expected during planning and do not represent failed implementation; implementation has not begun.

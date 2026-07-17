# DECISION WORKSHOP

**Project:** Project Atelier / بيتي بذوقي  
**Date:** 2026-07-16  
**Status:** Product Owner answers integrated; narrowed residual workshop remains  
**Authority:** Product Owner answers in `DECISION_FORM.md`, then `PROJECT_KNOWLEDGE.md`, `PROJECT_AUDIT.md`, `MASTER_PRD.md`, and companion planning documents where not superseded  
**Rule:** `DECISION_FORM.md` answers are authoritative. Unanswered details remain open and cannot be inferred from a recommendation.

---

## 1. Purpose and Method

Every prior Open Decision and proposed approval was tested against explicit existing documentation.

- A decision is **Resolved from documentation** only where the existing package states one unambiguous rule.
- A decision remains **Open** where the documents contain alternatives, use non-binding language such as “may” or “typical,” name a decision as pending, or omit a policy needed to choose safely.
- Related and duplicate questions are merged into one canonical `DW-*` item.
- The legacy `OD-*` identifiers remain in the coverage index for traceability but are no longer the active register.
- Database, API, and UI impacts below describe planning consequences only. They are not schemas, endpoints, or designs.

---

## 2. Decisions Resolved from Existing Documentation

| Resolution | Resolved rule | Evidence and reason |
|---|---|---|
| DR-001 | Version 1 serves one furniture business with one Manager and no worker, inventory, supplier, or multi-store functions | Explicit in `PROJECT_KNOWLEDGE.md` Version 1 Scope and Business Rules; repeated in the narrowed PRD |
| DR-002 | There is no direct checkout, including “order as shown” | The documented Business Model and Quotation Rules require request, Manager review, agreement, bank transfer, and verification before production for every Order |
| DR-003 | A Customer Project is editable before submission; its submitted content is preserved rather than silently edited | Explicit in Project Requests and Customer Rules; immutable submission history follows the documented permanent-history requirement |
| DR-004 | Customers require an account before submitting a furniture project; Visitors cannot customize, submit, message, track, or review | Explicit Visitor, Customer Journey, Authentication, and Customer Rules sections |
| DR-005 | Version 1 basic configuration is bounded to Manager-assigned dimensions, materials, fabrics, colors, finishes, required/optional fields, Product-specific options, and validation of invalid/unavailable/conflicting selections | Explicit Product System, Design Studio, CMS Product Option Management, and Product Rules; no generalized rule engine is authorized |
| DR-006 | Displayed prices are starting/estimated values; the Manager alone confirms final price after review | Explicit Pricing Strategy, Product Pricing, Price Estimation, Manager Journey, and Quotation Rules |
| DR-007 | Version 1 payment is bank transfer with private proof and manual Manager verification; card data is not processed or stored | Explicit Business Model, Payment Rules, Payment Information, and Manager Dashboard |
| DR-008 | Production never starts before successful Manager Payment Verification | Repeated as a mandatory Business Model, Payment, Production, and Security invariant |
| DR-009 | Customer-Manager communication is one continuous conversation rather than a separate chat per Order | Explicit Messaging System and Communication Rules; optional business-object context and retention remain `DW-010` |
| DR-010 | Published catalog/CMS media is public by intent; payment proof and Customer uploads are private unless the Manager intentionally publishes them | Explicit Payment Information and Media & Files rules |
| DR-011 | Arabic is default and RTL; localization is first-class; translation requires human Manager approval | Original source direction, superseded for language scope by Product Owner `DW-011`: Arabic required, English optional, French outside Version 1 |
| DR-012 | Accepted quotations and historical Orders remain permanent and cannot change when live Products, prices, materials, colors, or availability change | Explicit Order History and Order Rules; ADR-003 is Accepted for accepted commercial history |
| DR-013 | 360° media does not block Version 1 and is deferred to Version 1.1 because no production asset workflow is documented | The approved narrowing rule says to defer when the asset workflow is not ready; the audit confirms that workflow is missing |
| DR-014 | Version 1 essential notifications use in-app and email; push is not Version 1 | Product Owner `DW-010` now fixes the core event matrix; preferences, retention, and delivery-failure handling remain open |
| DR-015 | The global Definition of Done and `QUALITY_GATES.md` Version 1 targets are mandatory | Definition of Done came from the planning instruction; Product Owner accepted all current targets through `DW-012` on 2026-07-16 |
| DR-016 | Server-side authorization, public/private storage separation, first-class localization, and single-business Version 1 are architectural constraints | Directly supported by explicit security, localization, and Version 1 rules; ADR-004, ADR-005, ADR-009, and ADR-011 are Accepted |

These resolutions remove the former umbrella decisions `OD-CFG-01` and the thread-topology portion of `OD-MSG-01`, accept the source-backed part of the domain/state model, and prevent their subjects from being reopened as implementation preferences.

---

## 3. Priority 0 — Product Owner Decision Records and Residual Questions

**Decision owner:** Product Owner  
**Decision date:** 2026-07-16  
**Rationale:** No separate rationale was supplied; the authoritative wording is preserved from `DECISION_FORM.md`.  
**Status rule:** Accepted means the form fully answered the decision. Partially Accepted means the stated choice is binding but one or more details asked by the original decision remain unanswered.

### DW-001 — Commercial Object Boundary and Order Creation

- **Status:** Accepted.
- **Authoritative answer:** Create the Order when the Customer accepts the quotation. Production cannot start until payment is manually verified.
- **Remaining question:** None within `DW-001`; cancellation and retention are tracked under their own residual policies.

- **Merged legacy IDs:** `OD-DOM-01`; unresolved Order-creation portion of `OD-DOM-03`.
- **Question:** At which authoritative event is an Order created, and how does it relate to the Customer Project, Submitted Request, Quotation, and accepted Quotation Revision?
- **Why it matters:** The documentation clearly separates pre-agreement work from permanent Orders but never states the exact creation event.
- **Recommended option:** Create the Order atomically when the Customer accepts the current sent Quotation Revision; create immutable Order Item Snapshots at the same time; begin in Awaiting Payment.
- **Alternative options:** Create the Order when the Project is submitted; create it only after Payment Verification; keep one record whose type/status changes throughout the journey.
- **Advantages:** Matches the customer’s commercial commitment; gives payment proof a stable Order parent; separates negotiation from fulfillment; supports immutable snapshots.
- **Disadvantages:** Creates unpaid Orders; requires a clear abandoned/unpaid policy; needs an atomic acceptance transaction.
- **Risks:** Creating too early pollutes Order history; creating too late leaves payment without a stable commercial parent; a single evolving record blurs authorization and history.
- **Impact on database:** Determines object identities, foreign-key direction, uniqueness of acceptance-to-Order creation, snapshot timing, and unpaid-Order retention.
- **Impact on API:** Determines which command creates an Order and the idempotency/authorization contract for acceptance.
- **Impact on UI:** Determines when “My Orders” begins, where accepted-but-unpaid work appears, and which next action is shown.
- **Impact on business:** Defines when a request becomes a commercial commitment and how unpaid acceptances are managed.
- **Recorded outcome:** Acceptance-created Order is Accepted. Unpaid-Order retention and cancellation remain separate residual policies.

### DW-002 — Submission, Quotation Revision, and Acceptance Contract

- **Status:** Partially Accepted.
- **Authoritative answer:** Accept the form's recommended option exactly: lock submitted requests, number and freeze sent revisions, accept only the current revision, and record changes and declines explicitly.
- **Remaining question:** Quotation expiry/validity, request withdrawal, Manager infeasibility closure, and declined-request reopening were not selected.

- **Merged legacy IDs:** `OD-DOM-02`, remaining `OD-DOM-03`, `OD-QUO-01`, `OD-QUO-02`.
- **Question:** After submission, how are withdrawal, infeasibility, revisions, expiry, decline, change requests, supersession, correction, and Customer acceptance evidenced?
- **Why it matters:** These actions determine the enforceable agreement and prevent silent changes to Customer instructions or Manager offers.
- **Recommended option:** Lock the submitted snapshot; use sequential immutable sent Quotation Revisions; let the Customer accept only the current sent revision, request changes, or decline; capture authenticated acceptance with revision/version, timestamp, and accepted terms; handle correction through a new revision; define explicit expiry and withdrawal states.
- **Alternative options:** Allow in-place edits until acceptance; use unnumbered quotations; record agreement only in Messages; omit expiry and allow quotations to remain open indefinitely.
- **Advantages:** Clear history, reproducible agreement, safe concurrency, understandable Customer choices, and reliable audit evidence.
- **Disadvantages:** More lifecycle states and Manager steps; requires policy for old revisions and abandoned requests.
- **Risks:** Mutable offers undermine trust; ambiguous decline/change semantics cause accidental closure; missing expiry leaves stale prices actionable.
- **Impact on database:** Determines revision sequence, immutable fields, current-revision uniqueness, response evidence, expiry/withdrawal facts, and retention.
- **Impact on API:** Requires guarded commands for send, request changes, decline, withdraw, expire, supersede, and accept.
- **Impact on UI:** Requires revision labels, current/expired status, clear Accept/Request Changes/Decline actions, and locked historical views.
- **Impact on business:** Defines how the workshop negotiates, corrects mistakes, handles infeasible items, and proves agreement.
- **Recorded outcome:** Immutable numbered revisions, current-revision-only acceptance, and recorded responses are Accepted. Expiry, withdrawal, infeasibility, and reopening remain open.

### DW-003 — Pricing, Currency, Tax, Line Items, and Payment Terms

- **Status:** Partially Accepted.
- **Authoritative answer:** Default configurable currency is SAR; prices have a detailed breakdown; taxes are configurable; Version 1 uses full bank transfer only; deposits are future scope.
- **Remaining question:** Rounding, discount rules, and legally correct tax/invoice presentation were not selected.

- **Merged legacy IDs:** `OD-PRC-01`, `OD-PRC-02`.
- **Question:** What currency, tax treatment, rounding, invoice/legal presentation, quotation line-item structure, discount policy, and full/deposit/staged-payment rule apply?
- **Why it matters:** The documents approve Manager-controlled final pricing but explicitly leave the monetary contract unfinished.
- **Original recommendation (superseded in part):** Use a single Version 1 currency, distinguish estimates from final amounts, itemize meaningful price components, define rounding, use full bank transfer unless actual practice differs, and obtain accounting/legal validation. The Product Owner selected configurable SAR and full payment.
- **Alternative options:** Multi-currency; tax-inclusive single total with no line detail; deposits or milestones; discretionary discounts without explicit line items.
- **Advantages:** Simple Customer explanation, consistent calculations, auditable quotation totals, and a bounded Version 1 payment model.
- **Disadvantages:** Full payment and itemization add operational work; a single default currency limits future markets.
- **Risks:** Incorrect tax or rounding can create legal/accounting errors; hidden adjustments create disputes; premature deposit support complicates payment allocation.
- **Impact on database:** Determines monetary precision, currency facts, tax/discount/delivery components, total derivation, and possible payment schedules.
- **Impact on API:** Determines validation and calculation contracts for drafts, sent revisions, acceptance, and payment status.
- **Impact on UI:** Determines estimate disclaimers, quotation breakdown, tax/currency display, and payment instructions.
- **Impact on business:** Must match actual pricing, invoicing, negotiation, and cash-flow practice.
- **Recorded outcome:** Configurable SAR, detailed breakdown, configurable taxes, and full bank transfer in Version 1 are Accepted. Rounding, discounts, and legal presentation remain open.

### DW-004 — Payment-Proof Submission, Exceptions, Reversal, and Retention

- **Status:** Partially Accepted.
- **Authoritative answer:** Accept JPG, PNG, and PDF; keep every submission; the Manager verifies manually; nothing is deleted automatically.
- **Remaining question:** File-size limit, partial/over/duplicate/incorrect/fraud handling, mistaken-verification correction, and the approved retention/deletion period were not selected.

- **Merged legacy IDs:** `OD-PAY-01` through `OD-PAY-04`.
- **Question:** Which proof files are accepted, how are multiple/duplicate/partial/over/incorrect/fraudulent submissions handled, can verification be corrected, and how long is evidence retained?
- **Why it matters:** Payment proof is sensitive and is the sole gate to production.
- **Recommended option:** Approve a narrow image/PDF allowlist and explicit size limit; create a new immutable submission for every replacement; allow only one current review outcome; treat partial/over/duplicate cases as Manager exceptions that cannot satisfy the gate until reconciled; correct mistaken verification through an append-only audited correction, never by rewriting history; apply an owner/legal-approved retention period.
- **Alternative options:** Accept arbitrary files; overwrite prior proof; automatically infer payment validity; make verification irreversible under all circumstances; retain forever or delete immediately.
- **Advantages:** Strong history, safe resubmission, explainable production gate, and controlled sensitive-file exposure.
- **Disadvantages:** Requires exception handling and operational review; retained files increase privacy obligations; audited corrections add complexity.
- **Risks:** Unsafe uploads, duplicate verification, production on incomplete funds, privacy over-retention, or inability to correct human error.
- **Impact on database:** Determines immutable attempts, current-attempt linkage, verification/correction records, amounts if tracked, and retention/deletion markers.
- **Impact on API:** Determines upload validation, idempotency, review, reject/resubmit, correction, and authorized-download behavior.
- **Impact on UI:** Requires file guidance, upload/review/rejected states, actionable rejection reasons, replacement flow, and Manager exception indicators.
- **Impact on business:** Defines how staff reconcile real bank transfers and correct mistakes without weakening the production gate.
- **Recorded outcome:** JPG/PNG/PDF, preserved submission history, no automatic deletion, and manual Manager verification are Accepted. Size, exceptions, correction, and retention period remain open.

### DW-005 — Cancellation, Refund, Return, Warranty, Repair, and Dispute Policy

- **Status:** Governance Accepted; substantive policy remains Open.
- **Authoritative answer:** The policy is Manager-defined, based on Saudi regulations, assumption-free, and configurable.
- **Remaining question:** The actual stage-based rights, charges, evidence, deadlines, and outcomes have not been supplied and require Product Owner input with appropriate Saudi professional review.

- **Merged legacy IDs:** `OD-POL-01`, `OD-POL-02`, `OD-POL-03`; cancellation portions of domain/state decisions.
- **Question:** What rights, charges, evidence, deadlines, and outcomes apply before acceptance, after acceptance, after payment, during production, and after receipt?
- **Why it matters:** The source explicitly marks these business policies unfinished, and custom furniture may require context-specific legal and operational treatment.
- **Original recommendation, aligned by the Product Owner:** Document the workshop's actual policy by lifecycle stage and obtain appropriate Saudi regulatory/professional review before it is encoded or published.
- **Alternative options:** No cancellation/return after acceptance; limited cancellation with stage-based charges; discretionary case-by-case handling; broad return/refund rights.
- **Advantages:** A written stage-based policy aligns Customer expectations, Manager actions, state transitions, refunds, warranty, and published terms.
- **Disadvantages:** Requires legal/operational review; stricter rules may reduce conversion; flexible rules increase Manager discretion and audit needs.
- **Risks:** Choosing without owner/legal input may create unlawful, commercially harmful, or impossible promises.
- **Impact on database:** Determines cancellation/refund/warranty/repair/dispute records, reasons, amounts, deadlines, and immutable decision history.
- **Impact on API:** Determines who may request/approve each outcome and which states may transition or reopen.
- **Impact on UI:** Determines policy content, available actions, deadlines, reasons, status timelines, and support/escalation views.
- **Impact on business:** Directly affects revenue, production losses, customer trust, legal exposure, and after-sales workload.
- **Recorded outcome:** Governance is Accepted, but no substantive policy was supplied; the stage-based Saudi-compliant policy remains open.

### DW-006 — Production Lifecycle, Delays, Rework, Pause, and Correction

- **Status:** Partially Accepted.
- **Authoritative answer:** Not Started → Materials Preparation → In Production → Quality Inspection → Ready → Delivered/Picked Up; failed inspection returns to In Production. Delivery/Pickup is represented in the fulfilment lifecycle. Resolved `AB-004` adds that Version 1 production is tracked at the Order level only.
- **Remaining question:** Delay, pause, cancellation, correction, evidence, and Customer communication remain Business Policy or Configuration decisions.

- **Merged legacy IDs:** `OD-PRD-01`; production portion of `OD-DOM-03`.
- **Question:** Which production states are authoritative, which may be skipped or reversed, and how are delays, rework, pauses, corrections, and cancellation represented?
- **Why it matters:** The source lists “typical” states but does not approve exception behavior.
- **Original recommendation (superseded in part):** Use a small explicit production sequence with documented inspection rework and visible delay history. The Product Owner selected Not Started → Materials Preparation → In Production → Quality Inspection → Ready, with failed inspection returning to In Production.
- **Alternative options:** A simpler Started → Ready model; free-form updates with no state machine; a detailed workshop/manufacturing workflow; arbitrary Manager state changes.
- **Advantages:** Matches documented Customer expectations, keeps the Manager workflow small, and makes rework/delay history visible.
- **Disadvantages:** May not match real workshop stages; a single Order-level state may not handle items produced at different speeds.
- **Risks:** Overly detailed states burden the Manager; overly simple states hide delays; reversals without history undermine trust.
- **Impact on database:** Determines current state, append-only Production Updates, estimate revisions, item/order granularity, and transition history.
- **Impact on API:** Determines guarded transition commands and verified-payment preconditions.
- **Impact on UI:** Determines Manager update controls and Customer timeline/status language.
- **Impact on business:** Must reflect the workshop’s real production reporting capacity without pretending to manage workers or inventory.
- **Recorded outcome:** The five production states, inspection-rework transition, and Order-level production granularity are Accepted. Order Items remain first-class without an item-level Version 1 production lifecycle. Remaining production choices are non-blocking policy/configuration.

### DW-007 — Delivery and Pickup Commercial and Handoff Policy

- **Status:** Partially Accepted.
- **Authoritative answer:** Delivery is the default; pickup is optional; delivery price is quoted before acceptance; the Customer confirms the address; handoff proof is required.
- **Remaining question:** Service area, scheduling, pickup identity, failed attempt, refusal, damage, partial handoff, and dispute rules were not selected.

- **Merged legacy IDs:** `OD-FUL-01` through `OD-FUL-03`; fulfilment portion of `OD-DOM-03`.
- **Question:** What delivery area/pricing, scheduling, address confirmation, pickup identity, handoff evidence, failed attempt, refusal, damage, partial receipt, and dispute rules apply?
- **Why it matters:** Pickup/delivery is core Version 1, but only the two methods and successful-receipt completion are explicit.
- **Recommended option:** Define Manager-configured service zones and quotation-level delivery price; confirm method/address before acceptance; schedule a window after Ready; record authorized Manager confirmation plus Customer/recipient handoff evidence; add explicit failed/refused/damaged outcomes that do not complete the Order.
- **Alternative options:** Case-by-case free-text delivery; pickup only; third-party carrier integration; completion based only on Manager click with no evidence.
- **Advantages:** Predictable quoting, clear completion criteria, recoverable failures, and better dispute evidence.
- **Disadvantages:** Requires maintaining zones and scheduling details; evidence collection adds operational effort.
- **Risks:** Wrong addresses/prices, premature completion, untraceable damage, or indefinite Ready Orders.
- **Impact on database:** Determines fulfilment terms/snapshots, schedule/address, attempts, evidence, exceptions, and completion facts.
- **Impact on API:** Determines quote-time validation and commands for ready, schedule, attempt, receive, fail, and dispute.
- **Impact on UI:** Determines method/address selection, quoted fees, appointment details, readiness instructions, handoff confirmation, and exception states.
- **Impact on business:** Must match the workshop’s real service area, pricing, vehicle/carrier process, and proof of receipt.
- **Recorded outcome:** Delivery default, pickup option, pre-acceptance delivery price/address, and handoff proof are Accepted. Coverage, scheduling, and exception rules remain open.

### DW-008 — Customer Identity, Manager Access, Account Lifecycle, and Continuity

- **Status:** Partially Accepted.
- **Authoritative answer:** Customers use email + OTP verification. The Manager uses a strong password, MFA, and recovery codes.
- **Remaining question:** Required Customer profile fields, session policy, Manager bootstrap/emergency continuity, and account closure/export/retention were not selected.

- **Merged legacy IDs:** `OD-ID-01` through `OD-ID-04`, `OD-OPS-03`.
- **Question:** Which Customer fields/verification are required, how is the sole Manager bootstrapped/recovered, what session/MFA controls apply, and how are correction/deletion/export and Manager absence handled?
- **Why it matters:** One Manager is both the security root and an operational single point of failure; Customer identity also governs private commercial records.
- **Recommended option:** Minimize required Customer fields to verified contact and business-needed identity data; use a provider-supported secure recovery flow; require MFA for the Manager; document emergency recovery and temporary business-continuity ownership; separate account deactivation from commercial-record retention/export.
- **Alternative options:** Email/password without verification; phone/OTP; passwordless links; social login; no Manager MFA; manual administrator intervention only.
- **Advantages:** Reduced data collection, reachable Customers, stronger privileged access, and an explicit continuity path.
- **Disadvantages:** Verification/MFA can add friction and support work; emergency access needs careful governance.
- **Risks:** Account takeover, lockout of the only Manager, orphaned Orders, duplicate Customers, or deletion of required business history.
- **Impact on database:** Determines profile fields, verification/account states, stable identity, deactivation/anonymization markers, and recovery/audit references.
- **Impact on API:** Determines authentication callbacks, session/revocation rules, account actions, export/deletion requests, and emergency procedures.
- **Impact on UI:** Determines signup/login/recovery/MFA, profile management, verification prompts, and account-rights flows.
- **Impact on business:** Affects conversion, support workload, contact reliability, security, and operation during Manager absence.
- **Recorded outcome:** Customer email + OTP and Manager strong password + MFA + recovery codes are Accepted. Profile, session, account-rights, and continuity rules remain open.

### DW-009 — Data Classification, Upload Security, Media Lifecycle, and Privacy Retention

- **Status:** Partially Accepted.
- **Authoritative answer:** Public: Products and Portfolio. Private: Customers and Orders. Sensitive: Payment proof. Restricted: Internal notes and Audit logs. Everything is private by default.
- **Remaining question:** Upload validation/scanning, access behavior, retention/deletion periods, recovery, and intentional-publication controls were not selected.

- **Merged legacy IDs:** `OD-SEC-01`, `OD-SEC-02`, `OD-SEC-04`, `OD-MED-02`; file/retention portions of payment, message, CMS, and review decisions.
- **Question:** How is each data/file class protected, validated, scanned, delivered, retained, deleted, restored, or intentionally published?
- **Why it matters:** Existing rules define public versus private at a high level but omit the control and retention contract.
- **Recommended option:** Approve a classification matrix with Public, Private Customer, Sensitive Payment, and Restricted Operational classes; deny public access by default; use server authorization and short-lived access where required; validate allowlisted type/size and file signature; quarantine or scan untrusted uploads; generate optimized public derivatives; assign purpose-based retention/deletion and recovery rules.
- **Alternative options:** One storage/access policy for all files; path obscurity; permanent retention; immediate deletion after use; no scanning/quarantine.
- **Advantages:** Clear control ownership, least privilege, safer uploads, predictable privacy behavior, and recoverable public/private media operations.
- **Disadvantages:** More processing, storage metadata, operational tooling, and policy work.
- **Risks:** Data exposure, malware, link leakage, excessive retention, unrecoverable deletion, or accidental publication.
- **Impact on database:** Determines classification/ownership metadata, processing state, checksums, retention/deletion dates, publication facts, and audit references.
- **Impact on API:** Determines upload/download authorization, signed-access behavior, validation, transformation, quarantine, publish, and delete contracts.
- **Impact on UI:** Determines file guidance, progress/errors, private/public indicators, alt/crop tools, retention notices, and safe previews.
- **Impact on business:** Affects privacy promises, payment handling, content operations, support, storage cost, and incident exposure.
- **Recorded outcome:** The four data classes and private-by-default rule are Accepted. Validation, access, retention/deletion, recovery, and publication controls remain open.

### DW-010 — Messaging Context, Notification Events, Channels, Preferences, and Retention

- **Status:** Partially Accepted.
- **Authoritative answer:** One continuous conversation linked to the Project/Order. Email + in-app notifications for Quote Ready, Quote Accepted, Payment Received, Payment Verified, Production Started, Ready, and Delivered. WhatsApp later.
- **Remaining question:** Message/notification retention, Customer preferences, and failed-delivery handling were not selected.

- **Merged legacy IDs:** remaining `OD-MSG-01`, `OD-NTF-01`, `OD-NTF-02`, `OD-NTF-03`, implementation portion of `OD-TEC-06`.
- **Question:** How does the continuous conversation reference Projects/Orders, how long is it retained, which events are mandatory, which channel is used, what can Customers opt out of, and how are delivery failures handled?
- **Why it matters:** Communication is core to the business, but the source gives example events rather than a binding event/channel contract.
- **Recommended option:** Keep one continuous inbox with optional explicit Project/Quotation/Order context; retain commercial clarification under the approved record policy; classify payment, quotation, production, readiness, completion, and direct-message events as transactional; allow preference changes only for non-essential email; always create in-app history; send approved critical events by email; use durable idempotent delivery with retry and visible failure status.
- **Alternative options:** Separate threads per Order; no contextual links; email-only; in-app-only; every event on both channels; fully optional notifications; best-effort delivery with no log.
- **Advantages:** Preserves the personal relationship, gives concurrent work context, limits noise, and makes essential delivery auditable.
- **Disadvantages:** Context selection and template/channel policy add Manager/product work; retention increases privacy obligations.
- **Risks:** Messages attached to the wrong project, missed critical events, duplicate emails, preference violations, or ambiguous commercial history.
- **Impact on database:** Determines conversation/context links, immutable message facts, retention, event/template versions, preferences, delivery attempts, and read state.
- **Impact on API:** Determines message send/attach, context authorization, preference, notification creation, delivery, retry, and reconciliation contracts.
- **Impact on UI:** Determines one-inbox navigation, context labels/filters, unread states, preferences, delivery status, and failure recovery.
- **Impact on business:** Affects response workload, customer confidence, proof of communication, and external email cost/reliability.
- **Recorded outcome:** Project/Order-linked continuous conversation and the seven-event email/in-app matrix are Accepted. Preferences, retention, failure behavior, and provider remain open.

### DW-011 — Catalog/CMS Lifecycle, Localization Completeness, Fallback, and Publication

- **Status:** Partially Accepted.
- **Authoritative answer:** Arabic required; English optional; French removed from Version 1; human approval required for translations.
- **Remaining question:** Catalog/CMS lifecycle, optional-English fallback, correction/versioning, retirement, and retention were not selected.

- **Merged legacy IDs:** `OD-LOC-01`; unnumbered Category/Collection/Material/Color lifecycle and CMS/Translation version-retention decisions.
- **Question:** Which lifecycle actions exist for managed content, when must all locales be complete, what fallback is allowed, and how are published versions corrected/retained?
- **Why it matters:** Arabic-first and language parity are explicit, but incomplete translations and deletion/retirement behavior are undefined.
- **Original recommendation (superseded in language scope):** Use controlled publication and non-destructive retirement, require human approval, and define explicit fallback/version rules. The Product Owner requires Arabic, makes English optional, and removes French from Version 1.
- **Alternative options:** Publish Arabic immediately and fall back everywhere; block all publication until every locale is complete; permit in-place edits to published content; hard-delete unused catalog values.
- **Advantages:** Protects parity and history, avoids broken references, and permits safe editorial work.
- **Disadvantages:** Three-language completion can slow publishing; version retention and review add CMS complexity.
- **Risks:** Wrong-language or stale policy content, broken historical labels, unpublished urgent updates, or public AI errors.
- **Impact on database:** Determines locale/version records, source-version links, statuses, fallback metadata, retirement, and retention.
- **Impact on API:** Determines draft/review/approve/publish/hide/archive commands and locale-completeness validation.
- **Impact on UI:** Determines editorial workflow, missing-locale indicators, preview, comparison, publish blockers, and storefront fallback behavior.
- **Impact on business:** Affects content workload, legal/policy accuracy, catalog agility, and customer trust across languages.
- **Recorded outcome:** Version 1 language scope and human translation approval are Accepted. Lifecycle, fallback, correction/versioning, retirement, and retention remain open.

### DW-012 — Quality, Availability, Error, Browser, Backup, and Recovery Contract

- **Status:** Accepted.
- **Authoritative answer:** Accept the current `QUALITY_GATES.md` recommendation with no changes. The more specific `DW-011` answer controls which languages are in Version 1.
- **Remaining question:** None in the quality target group; provider/runbook details remain architecture work, while retention/geographic-copy procedure remains under residual policy.

- **Merged legacy IDs:** `OD-OPS-01`, `OD-OPS-02`; all target groups formerly Proposed in `QUALITY_GATES.md`.
- **Question:** Which proposed accessibility, Web Vitals, resource/API/media, browser/device, availability/error, RPO/RTO, restore, monitoring, escalation, and exception values become Accepted?
- **Why it matters:** Architecture and provider capacity require measurable goals; the numeric values were intentionally left for Product Owner approval and are now Accepted.
- **Recommended option:** Accept the current `Q-*` values as the Version 1 baseline, define the exact test/load/device profiles, retain the mandatory global Definition of Done, require monthly restore evidence and incident/rollback ownership, and revise targets only through recorded evidence.
- **Alternative options:** Approve stricter targets; relax selected budgets for launch; use qualitative goals only; defer SLO/recovery values until after production.
- **Advantages:** Makes quality testable, guides provider/architecture choices, and provides clear release gates.
- **Disadvantages:** Some values may be costly or unrealistic before representative traffic/assets exist; monitoring and device coverage require effort.
- **Risks:** Unapproved targets cannot gate release; arbitrary relaxation can harm mobile/RTL accessibility; unrealistic recovery promises create false confidence.
- **Impact on database:** Influences backup/PITR, query/index performance, retention, restore testing, and data-loss safeguards.
- **Impact on API:** Sets latency/error/availability expectations and timeout/retry behavior.
- **Impact on UI:** Sets accessibility, browser/device, media, interaction, loading/error-state, and performance acceptance.
- **Impact on business:** Determines acceptable downtime/data loss, release confidence, operational cost, and customer experience.
- **Recorded outcome:** The Product Owner accepted every current Version 1 `Q-*` group with no changes; `DW-011` controls the language scope.

### DW-013 — Brand and Design-System Foundation

- **Status:** Accepted.
- **Authoritative answer:** Accept the recommended accessible warm-neutral, paired-type, consistent, restrained-motion, RTL-first direction. It must reflect premium Saudi interior brands through warm neutrals, elegant typography, generous spacing, and restrained motion.
- **Remaining question:** None at product-direction level; exact creative assets will be designed later.

- **Merged legacy IDs:** `OD-DES-01`, `OD-DES-02`, `OD-DES-03`.
- **Question:** Which palette, Arabic/Latin typography, spacing, components, motion, and illustration rules define the premium brand?
- **Why it matters:** The experience principles are clear, but the actual visual system is explicitly pending.
- **Recommended option:** Approve a small accessible neutral/warm palette, paired Arabic/Latin type strategy, shared semantic tokens, restrained motion with reduced-motion support, and a documented responsive component system validated in RTL first.
- **Alternative options:** Use an existing design system with light branding; commission a fully custom visual system; define styles page-by-page.
- **Advantages:** Consistency, accessibility, faster design/implementation, predictable localization, and a recognizable premium identity.
- **Disadvantages:** Upfront design work; custom typography/licensing/performance considerations; a generic base may feel less distinctive.
- **Risks:** Poor Arabic typography, insufficient contrast, inconsistent components, excessive animation, or late visual rework.
- **Impact on database:** Little direct impact beyond theme/content configuration and media metadata if made Manager-configurable.
- **Impact on API:** Little direct impact; may affect CMS content-block contracts and media metadata.
- **Impact on UI:** Foundational impact on every public, Customer, and Manager surface.
- **Impact on business:** Defines brand perception, content-production consistency, accessibility, and future design cost.
- **Recorded outcome:** The RTL-first brand/design direction is Accepted, including the premium Saudi interior-brand character specified by the Product Owner.

### DW-014 — Version 1 Outcome and Manager-Efficiency Metrics

- **Status:** Accepted.
- **Authoritative answer:** Accept the recommended baseline-derived metric set and add average quotation preparation time, Customer satisfaction, on-time delivery rate, Order completion rate, and production delay rate.
- **Remaining question:** Numeric targets are intentionally set after baseline measurement, as the accepted recommendation specifies.

- **Merged legacy IDs:** `OD-MET-01`, `OD-MET-02`.
- **Question:** Which customer/business outcomes and Manager operational measures define launch success, with what formulas and targets?
- **Why it matters:** Quality can be technically successful while the product fails to reduce uncertainty or Manager work.
- **Recommended option:** Select a small privacy-conscious set: submitted-request completion, time to first Manager review, time to quotation, quotation acceptance, payment-review time, production estimate adherence, completion rate, Customer support/clarification volume, and Manager task backlog; define formulas and targets from a measured baseline rather than invented numbers.
- **Alternative options:** No launch metrics; broad analytics immediately; revenue-only measurement; qualitative interviews only.
- **Advantages:** Connects release evidence to product goals without pulling advanced analytics into Version 1.
- **Disadvantages:** Requires instrumentation definitions and operational discipline; initial targets cannot be credible without baseline data.
- **Risks:** Vanity metrics, privacy over-collection, ambiguous formulas, or optimization that harms the collaborative experience.
- **Impact on database:** May require minimal event/aggregate facts and retention/consent decisions, not a full analytics warehouse.
- **Impact on API:** May require stable event emission and operational timestamps.
- **Impact on UI:** May add limited Manager operational summaries; no advanced analytics dashboard is implied.
- **Impact on business:** Establishes whether the platform improves conversion, clarity, response time, and daily operations.
- **Recorded outcome:** The recommended metric set plus the five Product Owner additions is Accepted; numeric targets follow baseline measurement.

### 3.1 Residual Decision Classification

This re-review applies the stricter Product Owner test: a true Architecture Blocker must be an unresolved product choice that materially changes entities, relationships, aggregates, state machines, database structure, API contracts, authorization, storage, or deployment architecture. A policy value, configuration choice, operational procedure, or architecture-phase implementation mechanism is not a pre-architecture blocker merely because it is unknown.

#### AB-004 — Production Granularity — Resolved

- **Status:** Accepted by the Product Owner.
- **Decision:** Version 1 tracks production at the Order level, not at the Order Item level.
- **Rationale:** One Manager works alone; there are no Worker accounts, inventory, or production-management system; Version 1 prioritizes simple high-level Customer progress.
- **Constraint:** Order Item remains a first-class domain object but has no production lifecycle in Version 1.
- **Extensibility condition:** Future item-level tracking must be additive, preserve Order-level history, and keep immutable historical Order Items readable without rewriting them.

#### True Remaining Architecture Blockers

**None.**

The previous `AB-001` through `AB-003` and `AB-005` through `AB-009` were overstated. Their unresolved portions can be supported by the accepted core model through configuration, append-only history, Manager decisions, existing messaging/CMS capabilities, or implementation choices made during architecture. No additional Product Owner choice is required before architecture begins.

| Former ID | Reclassification | Reason it is not a true blocker |
|---|---|---|
| `AB-001` | Business Policy + Configuration | Request/quotation closure, expiry, reopening, and unpaid follow-up vary by allowed action and timing; the accepted Project, Submitted Request, Quotation, Revision, Acceptance, and Order boundaries do not change. |
| `AB-002` | Business Policy + Configuration + Implementation Detail | Detailed price components and immutable payment attempts/decisions are already accepted. Discounts, rounding, exception reasons, and effective corrections can be policy/configuration over append-only history. |
| `AB-003` | Business Policy | Version 1 requires configurable Saudi-compliant policy and communication, not an unapproved case-management subsystem. Any later structured after-sales workflow is additive scope. |
| `AB-005` | Business Policy + Configuration | The accepted fulfilment model remains Ready until successful evidence-backed handoff. Service failures and disputes can be recorded operationally without changing the core Order aggregate; richer attempt workflows are additive. |
| `AB-006` | Business Policy + Implementation Detail | Customer/Manager roles and authentication methods are fixed. Account wording, timeouts, recovery, revocation, and continuity mechanisms are policy or security implementation work, not unresolved authorization roles. |
| `AB-007` | Configuration + Implementation Detail | Public/private/sensitive/restricted classes and private-by-default are fixed. Validation, scanning, access, deletion, recovery, and publication mechanisms are selected during storage/security architecture. |
| `AB-008` | Configuration + Implementation Detail | Events and channels are fixed. Preference values and delivery retry/failure mechanisms do not change the authoritative business lifecycle. |
| `AB-009` | Configuration + Implementation Detail | Arabic/English scope, RTL, human approval, and core CMS publication capability are fixed. Fallback and editorial rules are configuration; persistence/version mechanics are architecture-phase choices. |

#### Business Policy Decisions

| ID | Source | Business policy still required |
|---|---|---|
| `BP-001` | `DW-002` | Customer withdrawal rights, Manager infeasibility handling, quotation expiry/reopening policy, and accepted-but-unpaid follow-up/closure rules. |
| `BP-002` | `DW-003` | Discount eligibility/approval, rounding rule, and Saudi-compliant tax/invoice wording. |
| `BP-003` | `DW-004` | Partial/excess/duplicate/incorrect/suspected-fraud review policy, mistaken-verification correction authority, escalation, and retention policy. |
| `BP-004` | `DW-005` | Saudi-compliant cancellation, refund, return, warranty, repair, dispute, eligibility, deadline, fee, evidence, and compensation terms. |
| `BP-005` | `DW-006` | Order-level production delay, pause, cancellation, correction, revised-estimate, and Customer communication policy. |
| `BP-006` | `DW-007` | Failed attempt, refusal, damage, partial handoff, dispute, authorized-recipient, compensation, and escalation policy. |
| `BP-007` | `DW-008` | Account closure/export/deactivation policy and Manager continuity responsibilities. |
| `BP-008` | `DW-009` | Retention/deletion/publication governance and recovery expectations by accepted data class. |
| `BP-009` | `DW-010` | Which notifications are optional, message/notification retention, and Customer communication policy. |
| `BP-010` | `DW-011` | English-content scope, editorial approval, correction, retirement, legal review, and content-retention policy. |

#### Configuration Decisions

| ID | Source | Configurable value or rule |
|---|---|---|
| `CFG-001` | `DW-002` | Quotation validity, follow-up timing, closure timing, and enabled withdrawal/reopen actions. |
| `CFG-002` | `DW-003` | Currency setting, rounding mode, tax presentation options, and supported adjustment/discount settings. |
| `CFG-003` | `DW-004`, `DW-009` | Upload size limits, payment exception reason codes, retention schedules, deletion timing, and recovery windows. |
| `CFG-004` | `DW-006` | Order-level progress visibility, delay reasons, revised-estimate prompts, and Customer-facing status wording. |
| `CFG-005` | `DW-007` | Delivery zones/prices, scheduling windows, recipient/evidence fields, and fulfilment exception reasons. |
| `CFG-006` | `DW-008` | Required Customer profile fields beyond email, session timeout values, and account-support settings. |
| `CFG-007` | `DW-010` | Optional notification choices, timing, templates, and retention schedules. |
| `CFG-008` | `DW-011` | Optional-English content scope, locale fallback, completeness gates, and editorial workflow settings. |

#### Implementation Details

These are selected and documented during `DW-015` through `DW-017`; they are not missing Product Owner business decisions.

| ID | Source | Architecture-phase implementation detail |
|---|---|---|
| `IMP-001` | Former `AB-001`/`AB-002` | Representation of configurable closure/reopen policy, price components, immutable payment decisions, and append-only correction history. |
| `IMP-002` | Resolved `AB-004` | Order-level production persistence and an additive seam for future item-level tracking without rewriting Order Items or Order history. |
| `IMP-003` | Former `AB-005` | Representation of fulfilment notes/evidence and any future additive attempt workflow. |
| `IMP-004` | Former `AB-006` | Authentication-provider session revocation, recovery-code handling, bootstrap, emergency recovery, and account export/deactivation mechanics. |
| `IMP-005` | Former `AB-007` | File-signature validation, scanning/quarantine, private access, publication, deletion, backup, and recovery mechanisms. |
| `IMP-006` | Former `AB-008` | Notification preference persistence, durable delivery, idempotency, retry, failure visibility, and provider integration. |
| `IMP-007` | Former `AB-009` | CMS/Translation persistence, version history, publication mechanics, retirement, and locale-fallback resolution. |

Business Policy, Configuration, and Implementation Detail items remain required at their appropriate gates, but none blocks the start of architecture.

---

## 4. Priority 1 — Decisions Completed and Approved During Architecture

### DW-015 — Application Structure, Persistence Category, Stack, Authentication, Database, and Search

- **Status:** Accepted by the Product Owner on 2026-07-16.
- **Authoritative outcome:** The modular monolith, relational PostgreSQL architecture, Node.js/Next.js stack, Supabase database, Drizzle migration approach, Clerk identity, PostgreSQL search, and localization choices in `ADR_INDEX.md` are approved.

- **Merged legacy IDs:** `ADR-001`, `ADR-002`, `OD-TEC-01`, `OD-TEC-02`, `OD-TEC-03`, `OD-TEC-09`.
- **Question:** Which modular application structure, runtime/framework, authentication provider, relational database product/migration approach, and normal-search implementation satisfy the approved product constraints?
- **Why it matters:** The audit recommends a modular monolith and relational consistency, but recommendations and providers are not approved facts.
- **Recommended option:** Adopt the proposed modular monolith and relational database; select a mature supported web stack and managed providers only after scoring Arabic/RTL support, authorization, transactions, migrations, recovery, local development, cost, and team competence; keep normal search independent of AI.
- **Alternative options:** Microservices; serverless functions without a coherent domain boundary; document database; self-hosted identity/data; external search from launch.
- **Advantages:** Lower Version 1 operational complexity, strong transactions, easier consistency, and an evidence-based provider choice.
- **Disadvantages:** A monolith requires boundary discipline; managed services create dependency/cost; relational modeling and migrations require care.
- **Risks:** Tool-first selection, unsupported runtime, provider lock-in, weak transaction support, or search that becomes an AI dependency.
- **Impact on database:** Selects the database/migration/recovery capabilities after the domain is approved.
- **Impact on API:** Establishes runtime, server boundary, authentication integration, module ownership, and search access patterns.
- **Impact on UI:** Influences rendering, routing, authentication UX, localization tooling, and perceived search behavior.
- **Impact on business:** Affects delivery speed, operating cost, hiring/maintenance, availability, and future change cost.
- **Recommended final choice:** Technical owner should run a documented architecture trade-off and accept/reject ADR-001/ADR-002 before selecting named products.

### DW-016 — Storage, Hosting, Environments, Deployment, Migration, Rollback, and Secrets

- **Status:** Accepted by the Product Owner on 2026-07-16.
- **Authoritative outcome:** The AWS S3/GuardDuty storage design, Vercel hosting, isolated environments, expand–migrate–contract release model, recovery boundaries, and staged provider-adoption conditions in `ADR_INDEX.md` are approved. Region, retention, KMS/CDN/replication, and infrastructure-tool values remain their documented configuration/operations gates.

- **Merged legacy IDs:** `OD-TEC-04`, `OD-TEC-05`; provider implementation portion of `DW-009`.
- **Question:** Which storage/hosting platform, regions, environments, deployment flow, secrets, migration, and rollback strategy meet the approved security and recovery contract?
- **Why it matters:** Provider selection cannot precede data classification, RPO/RTO, file controls, and budget decisions.
- **Recommended option:** Use managed hosting, relational data, and object storage with separate environment isolation, private-by-default access, supported backups/versioning, staged migrations, immutable deployment artifacts, tested rollback/recovery, and managed secrets; select region based on approved legal/latency needs.
- **Alternative options:** Self-hosted infrastructure; one shared environment; local filesystem storage; manual deployments; provider-specific irreversible migrations.
- **Advantages:** Lower operations burden, reproducible releases, safer secrets/files, and stronger recovery options.
- **Disadvantages:** Recurring cost, provider dependency, and environment/CI setup work.
- **Risks:** Region/legal mismatch, public storage mistakes, unrecoverable migration, secret leakage, or inability to restore.
- **Impact on database:** Determines backup/PITR, migration execution, environment isolation, replicas, and restore tooling.
- **Impact on API:** Determines runtime/network constraints, object access, deployment health, secrets, and rollback compatibility.
- **Impact on UI:** Influences media delivery, upload reliability, environment configuration, and deployment availability.
- **Impact on business:** Determines monthly cost, operational ownership, outage recovery, data location, and release risk.
- **Recommended final choice:** Select providers only after `DW-009` and `DW-012`; require a documented restore and rollback proof before acceptance.

### DW-017 — Durable Side Effects, Background Jobs, Provider Adapters, Audit Mechanism, and Observability

- **Status:** Accepted by the Product Owner on 2026-07-16.
- **Authoritative outcome:** PostgreSQL transactional outbox and leased jobs, capability-focused provider adapters, Resend, append-only PostgreSQL Audit Events, OpenTelemetry/Sentry/native telemetry, and their failure-isolation rules in `ADR_INDEX.md` are approved. Retry thresholds, retention, and incident procedures remain configuration/operations work.

- **Merged legacy IDs:** `ADR-006`, `ADR-007`, `ADR-008`, `ADR-010`, `OD-TEC-08`, `OD-TEC-10`; unresolved audit portion of `OD-SEC-03`.
- **Question:** How are notifications/media/cleanup and other side effects made durable, how are external providers isolated, and how are business audit, logs, metrics, traces, alerts, retries, and failed jobs operated?
- **Why it matters:** A valid payment or Order transition must not be lost/repeated because email or another provider fails.
- **Recommended option:** Accept a transactional outbox or equivalent atomic intent mechanism, one durable job system, capability-focused provider adapters, idempotent consumers with retry/dead-letter/escalation, append-only business Audit Events, and separate structured operational telemetry with alerts and runbooks.
- **Alternative options:** Synchronous provider calls inside transactions; in-memory events; direct SDK calls throughout business logic; operational logs as the only audit record; multiple job systems.
- **Advantages:** Reliable core state, observable failures, safe retries, provider isolation, and accountable Manager actions.
- **Disadvantages:** Additional components, operational dashboards, idempotency design, and retention work.
- **Risks:** Duplicate notifications, silent backlog, leaked sensitive audit payloads, weak correlation, or provider code controlling business policy.
- **Impact on database:** May require durable intent/job/audit records, idempotency keys, attempt history, and retention/partition planning.
- **Impact on API:** Defines transaction boundaries, asynchronous acknowledgement, correlation, retry/reconciliation, and privileged audit behavior.
- **Impact on UI:** Requires truthful queued/failed states and Manager visibility where action is needed.
- **Impact on business:** Improves reliability and accountability but adds operational responsibility and cost.
- **Recommended final choice:** Technical/security/operations owners should approve the guarantees first, then select the smallest mechanism that proves them.

---

## 5. Priority 2 — Deferred Decisions That Do Not Block Version 1 Architecture

### DW-018 — Post-Version 1 Roadmap Approval

- **Merged legacy IDs:** `OD-RDM-01`.
- **Question:** Are the proposed Version 1.1 and Version 1.2-or-later phase assignments approved?
- **Why it matters:** Unapproved enhancements can silently return to Version 1 and recreate the audit’s scope risk.
- **Recommended option:** Keep AI, advanced analytics, push, Reviews, Favorites, Saved Designs, and 360° in Version 1.1; keep advanced comparison and explicitly future capabilities at Version 1.2 or later; reassess using Version 1 evidence.
- **Alternative options:** Move selected features into Version 1; defer all enhancements beyond Version 1.1; reprioritize after customer research.
- **Advantages:** Protects the complete core transaction and provides a visible long-term path.
- **Disadvantages:** Some discovery/engagement features launch later; roadmap labels may create expectations before evidence.
- **Risks:** Scope creep, premature provider/asset work, or architecture distorted by speculative features.
- **Impact on database:** Avoids implementing deferred entities/events before their policies are approved.
- **Impact on API:** Avoids unused provider and feature contracts in Version 1.
- **Impact on UI:** Keeps Version 1 navigation/workflows focused.
- **Impact on business:** Trades earlier feature breadth for launch quality and operational readiness.
- **Recommended final choice:** Approve the current phases as roadmap intent, not delivery commitments, and require separate entry criteria for each enhancement.

### DW-019 — Saved Design and Favorite Lifecycle

- **Merged legacy IDs:** `OD-CFG-02`; unnumbered Favorite lifecycle decision.
- **Question:** What happens to saved choices when Products/options change, hide, archive, or become unavailable, and how are saves shared/duplicated/deleted?
- **Why it matters:** Reusable drafts can become invalid or misleading after catalog changes.
- **Recommended option:** Preserve the saved snapshot, show current validity, require revalidation before adding to a Project, prevent ordering archived/unavailable choices, and let the Customer duplicate or delete their private save under retention rules.
- **Alternative options:** Automatically migrate values; invalidate/delete affected saves; always reopen against current Product values; keep saves permanently orderable.
- **Advantages:** Preserves Customer intent without bypassing live manufacturing rules.
- **Disadvantages:** Requires comparison/revalidation UX and snapshot storage.
- **Risks:** Silent substitutions, invalid configurations, Customer confusion, or privacy over-retention.
- **Impact on database:** Determines snapshot/current references, validity status, ownership, share/delete facts, and retention.
- **Impact on API:** Determines save, duplicate, validate, share, delete, and add-to-Project behavior.
- **Impact on UI:** Requires stale/invalid warnings, difference display, correction, and recovery actions.
- **Impact on business:** Affects conversion and support when catalog offerings change.
- **Recommended final choice:** Use snapshot-plus-revalidation if Version 1.1 Saved Designs are approved.

### DW-020 — Review Eligibility, Editing, Moderation, Photos, and Manager Response

- **Merged legacy IDs:** `OD-REV-01`.
- **Question:** Exactly who may review, when, how often, whether edits/deletion/moderation are allowed, and when photos/responses are public?
- **Why it matters:** Existing documentation conflicts between “verified Customer” and “verified completed Order.”
- **Recommended option:** One review per completed Order by its owning Customer; allow a limited edit window with visible history; permit Manager response but not Customer-content editing; use explicit moderation reasons and safe photo approval; preserve audit history subject to privacy policy.
- **Alternative options:** Reviews by any verified Customer; immutable reviews; unlimited edits; pre-moderate all content; publish immediately with reporting only.
- **Advantages:** Strong purchase linkage, credible reviews, accountable moderation, and controlled public media.
- **Disadvantages:** Moderation workload, policy complexity, and delayed photo publication.
- **Risks:** Fake reviews, censorship concerns, unsafe photos, privacy complaints, or Manager alteration of Customer speech.
- **Impact on database:** Determines eligibility, uniqueness, versions, moderation state/reason, response, photo publication, and retention.
- **Impact on API:** Determines create/edit/delete/report/moderate/respond authorization and timing.
- **Impact on UI:** Determines eligibility prompts, edit history, moderation status, photo consent, and Manager response display.
- **Impact on business:** Affects trust, reputation, moderation workload, and dispute handling.
- **Recommended final choice:** Adopt completed-Order ownership as eligibility and approve the edit/moderation/photo policy before Version 1.1 work.

### DW-021 — Advanced Analytics Taxonomy, Consent, Formulas, and Retention

- **Merged legacy IDs:** `OD-ANA-01`, `OD-ANA-02`.
- **Question:** Which Version 1.1 events/metrics are collected, under what consent/identity model, with which formulas, attribution, periods, retention, and provider?
- **Why it matters:** The knowledge document lists desired categories but not definitions or privacy rules.
- **Recommended option:** Start from approved `DW-014` outcomes, add only decision-useful events, define each formula/owner, minimize identifiers, separate operational from behavioral analytics, set retention/consent before choosing a provider, and validate dashboard decisions with the Manager.
- **Alternative options:** Broad automatic tracking; provider-default events; self-hosted analytics; no behavioral analytics; aggregate-only reporting.
- **Advantages:** Useful, explainable insights with lower privacy and data-quality risk.
- **Disadvantages:** Requires taxonomy governance and may provide less exploratory data.
- **Risks:** Undefined conversion/revenue numbers, consent violations, identity leakage, excessive cost, or dashboards nobody uses.
- **Impact on database:** Determines event/aggregate storage, identity strategy, retention, and possible external synchronization.
- **Impact on API:** Determines event validation, consent checks, batching, and provider boundaries.
- **Impact on UI:** Determines consent surfaces and Manager analytics definitions/filters.
- **Impact on business:** Affects decision quality, privacy trust, and ongoing analytics cost.
- **Recommended final choice:** Defer provider selection until a minimal taxonomy and decision owner are approved for Version 1.1.

### DW-022 — AI Scope, Provider, Grounding, Privacy, Evaluation, Cost, and Safety

- **Merged legacy IDs:** `OD-AI-01`, `OD-AI-02`; AI provider from the source technical pending list.
- **Question:** Which AI tasks ship first, what data may be sent, how is output grounded/evaluated/reviewed, and what cost/fallback/provider contract applies?
- **Why it matters:** Permitted assistance and prohibited authority are explicit, but safe implementation criteria are not.
- **Recommended option:** Begin Version 1.1 with one low-risk Manager draft task such as translation assistance; send minimum approved data; require human review; ground customer recommendations only in published catalog facts; define offline evaluation, unsafe-output handling, per-task cost limits, logging/redaction, and deterministic fallback before adding tasks.
- **Alternative options:** Launch all documented AI features together; customer recommendations first; self-host models; no AI; provider-native integration without an adapter.
- **Advantages:** Small measurable risk, clear human oversight, bounded cost, and preserved core reliability.
- **Disadvantages:** Slower feature breadth; evaluation and privacy work remain substantial.
- **Risks:** Hallucinated products, leaked Customer conversations, harmful translation, uncontrolled cost, or hidden core dependency.
- **Impact on database:** May require consent, redacted inputs, prompt/output evaluation metadata, grounding references, and retention controls.
- **Impact on API:** Requires isolated provider adapter, timeout/fallback, authorization, rate/cost limits, and review workflow.
- **Impact on UI:** Requires clear draft labeling, review/edit controls, failure fallback, and no false authority.
- **Impact on business:** Affects brand voice, Manager workload, privacy, cost, and customer trust.
- **Recommended final choice:** Approve one low-risk, human-reviewed pilot only after the AI governance/evaluation contract is signed off.

### DW-023 — Push Notification Activation and Provider

- **Merged legacy IDs:** `OD-TEC-07`; push portion formerly in `OD-NTF-01`.
- **Question:** Does push create enough value after Version 1, on which client surface, with which permission/event/provider policy?
- **Why it matters:** Push was explicitly removed from Version 1 and no supported client/permission strategy exists.
- **Recommended option:** Measure in-app/email delivery and Customer response first; introduce web push only if a named critical use case and permission/conversion benefit justify it; reuse the approved event policy and durable delivery contract.
- **Alternative options:** Never add push; launch web push in Version 1.1; wait for native apps; use a marketing notification platform.
- **Advantages:** Evidence-based channel investment and reduced launch complexity.
- **Disadvantages:** Customers may see critical events later if email engagement is weak.
- **Risks:** Low opt-in, notification fatigue, browser inconsistency, privacy/consent issues, or duplicate channels.
- **Impact on database:** Adds device/subscription records, consent, invalidation, preferences, and delivery attempts.
- **Impact on API:** Adds subscription management and provider delivery/retry integration.
- **Impact on UI:** Adds permission education, opt-in/out, device state, and channel preferences.
- **Impact on business:** Adds provider/support cost and may improve response time only if adoption is meaningful.
- **Recommended final choice:** Keep push deferred until Version 1 channel evidence demonstrates a specific unmet need.

### DW-024 — 360° Asset Workflow and Activation Gate

- **Merged legacy IDs:** former `OD-MED-01`, now deferred under `DR-013`.
- **Question:** What capture format, frame count, dimensions, quality, accessibility fallback, storage, device support, and production ownership make 360° viable?
- **Why it matters:** The customer vision values 360° media, but no repeatable asset workflow or representative proof exists.
- **Recommended option:** Keep 360° out of Version 1; before Version 1.1, run a representative Product pilot that meets `Q-MED-006` through `Q-MED-009`, provides keyboard/touch controls and static-gallery fallback, and assigns capture/processing ownership.
- **Alternative options:** Ship a heavy frame sequence immediately; use video; use a third-party viewer/service; omit 360° permanently; move directly to 3D later.
- **Advantages:** Protects mobile performance/accessibility and tests operational feasibility before catalog-wide commitment.
- **Disadvantages:** Delays a visually distinctive feature and requires a media production pilot.
- **Risks:** Excess bandwidth, poor low-end-device behavior, inaccessible controls, inconsistent assets, or ongoing capture cost.
- **Impact on database:** Adds media-set metadata, processing/version state, poster/fallback assets, ordering, and lifecycle.
- **Impact on API:** Adds upload/processing/publication validation and progressive-delivery metadata.
- **Impact on UI:** Adds viewer controls, loading/error/fallback states, responsive behavior, and accessibility semantics.
- **Impact on business:** Requires reliable photography/capture ownership and measurable showroom value.
- **Recommended final choice:** Activate only after the documented pilot passes every approved quality and workflow gate.

---

## 6. Legacy Decision Coverage and Merge Map

| Legacy IDs or approval group | Canonical result |
|---|---|
| `OD-DOM-01` | Accepted as `DW-001` |
| `OD-DOM-02`, `OD-DOM-03`, `OD-QUO-01`, `OD-QUO-02` | Immutable revision/acceptance direction Accepted; residual policy retained in `DW-002`, `DW-006`, and `DW-007` |
| `OD-PRC-01`, `OD-PRC-02` | Partially Accepted as `DW-003`; residual monetary rules retained |
| `OD-PAY-01`, `OD-PAY-02`, `OD-PAY-03`, `OD-PAY-04` | Partially Accepted as `DW-004`; residual exceptions/retention retained |
| `OD-POL-01`–`OD-POL-03` | Governance Accepted under `DW-005`; substantive policy remains open |
| `OD-PRD-01` | Production sequence Accepted under `DW-006`; residual exceptions retained |
| `OD-FUL-01`, `OD-FUL-02`, `OD-FUL-03` | Core fulfilment terms Accepted under `DW-007`; residual exceptions retained |
| `OD-CFG-01` | Resolved as `DR-005` |
| `OD-ID-01`, `OD-ID-02`, `OD-ID-03`, `OD-ID-04`, `OD-OPS-03` | Authentication methods Accepted under `DW-008`; residual lifecycle/continuity retained |
| `OD-SEC-01`, `OD-SEC-02`, `OD-SEC-04`, `OD-MED-02` | Baseline public/private rule resolved as `DR-010`; remaining controls merged into `DW-009` |
| `OD-SEC-03`, `OD-SEC-05` | `DW-009` for retention/classification and `DW-017` for audit/operations |
| `OD-MSG-01` | Continuous thread resolved as `DR-009`; context/retention merged into `DW-010` |
| `OD-NTF-01`–`OD-NTF-03`, `OD-TEC-06` | Version 1 channels resolved as `DR-014`; remaining event/channel/provider work merged into `DW-010` |
| `OD-LOC-01` | Core language rules resolved as `DR-011`; publication/fallback remains `DW-011` |
| `OD-OPS-01`, `OD-OPS-02`, all `Q-*` approval groups | Global Definition of Done resolved as `DR-015`; target/operations approval remains `DW-012` |
| `OD-DES-01`–`OD-DES-03` | Accepted as `DW-013` |
| `OD-MET-01`, `OD-MET-02` | Accepted as `DW-014` |
| `ADR-001`, `ADR-002`, `OD-TEC-01`–`OD-TEC-03`, `OD-TEC-09` | `DW-015` |
| `OD-TEC-04`, `OD-TEC-05` | `DW-016` |
| `ADR-006`–`ADR-008`, `ADR-010`, `OD-TEC-08`, `OD-TEC-10` | `DW-017` |
| `ADR-003`–`ADR-005`, `ADR-009`, `ADR-011` | Accepted from explicit documentation as `DR-012` and `DR-016` |
| `OD-RDM-01` | `DW-018` |
| `OD-CFG-02` | `DW-019` |
| `OD-REV-01` | `DW-020` |
| `OD-ANA-01`, `OD-ANA-02` | `DW-021` |
| `OD-AI-01`, `OD-AI-02` | `DW-022` |
| `OD-TEC-07` | `DW-023` |
| `OD-MED-01` | Version 1 resolved by `DR-013`; future activation remains `DW-024` |

No legacy Open Decision is dropped. Every one is resolved, merged, or explicitly deferred with a canonical owner question.

---

## 7. Workshop Execution Rule

For each future or residual `DW-*` item, record:

- Final selected option.
- Product owner and any required technical/security/legal approver.
- Decision date.
- Rationale and rejected alternatives.
- Any conditions or review date.
- Affected requirement/state/ADR changes.

`DW-001` through `DW-014` now contain the Product Owner, date, authoritative selection, status, and remaining conditions. Do not treat the unanswered portion of a Partially Accepted item as selected merely because the original recommendation describes it.

# STATE MACHINES

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Architecture Ready; accepted Version 1 transitions and Order-level production defined  
**Scope:** Business lifecycle states and transitions only; no API, database, queue, or implementation design  
**Source material:** `PROJECT_KNOWLEDGE.md`, `PROJECT_AUDIT.md`, `MASTER_PRD.md`, `DOMAIN_MODEL.md`, `DECISION_FORM.md`, and the planning-update instruction

---

## 1. Purpose

This document defines the allowed lifecycle transitions needed for the core transaction and publication workflows. Every transition specifies actor, preconditions, validation, side effects, notification, audit, reversal, and recovery behavior.

The source-backed and Product Owner-approved business direction is accepted where identified below. A transition not listed here is forbidden. Cancellation, refund, quotation expiry, dispute, deletion, payment reversal, and other unanswered exception policies are not silently invented.

---

## 2. Non-Negotiable Invariants

1. Production must never start before a successful Manager-created Payment Verification.
2. Every sent Quotation Revision, every accepted Quotation Revision, and Customer Acceptance evidence are immutable. Corrections require a new numbered revision.
3. Historical Order Item Snapshots are immutable under `DR-012`.
4. Under accepted `DM-001` / `DW-001`, accepting the current sent Quotation Revision creates the Order and its immutable Order Item Snapshots.
5. Order Item Snapshots never read mutable commercial detail from the live Product after creation.
6. Failed transitions leave the authoritative source state unchanged.
7. Business-critical transitions and failed privileged attempts produce Audit Events.
8. Notifications are side effects, not the source of truth; notification failure does not roll back a valid business transition unless an approved policy explicitly requires it.
9. AI cannot perform Customer acceptance, Manager payment verification, production authorization, content approval, or publication.
10. Corrections to immutable history require a new append-only event or revision, never in-place rewriting.
11. Version 1 has one production lifecycle per Order. Order Items remain first-class immutable records but have no independent production state machine or Production Updates.

### 2.1 Evidence Status

**Accepted business direction from existing documentation:**

- `CP-01`: a draft Project is submitted and direct Customer editing ends.
- `SR-01` through the review/clarification/quotation/customer-response direction in `SR-05`.
- Payment proof submission, Manager rejection/replacement, and manual verification in `PM-01` through `PM-04`.
- The verified-payment guard in `OR-05` and `PD-01`.
- Manager-posted production progress toward Ready and the pickup/delivery completion branches.
- Manager publication/hiding and human approval of translations.

**Accepted from Product Owner answers:** acceptance-created Order; immutable numbered sent revisions and current-revision-only acceptance; JPG/PNG/PDF proof with preserved submission history and manual verification; the named production sequence and inspection rework; Order-level production granularity; delivery-default/pickup-optional fulfilment with quoted price, confirmed address, and handoff proof; Project/Order-linked continuous messaging; the seven-event email/in-app notification matrix; Arabic-required/English-optional/French-deferred localization; and human translation approval.

**Still unresolved:** quotation expiry/withdrawal/infeasibility/reopening; payment exceptions and mistaken-verification correction; cancellation and after-sales policy; production delay/pause/cancellation; fulfilment failures/damage/disputes; message/notification retention, preferences, and delivery failure; content fallback/version/retirement policy; durable side-effect/audit mechanics (`DW-017`); and deferred Review behavior (`DW-020`).

---

## 3. Transition Conventions

| Term | Meaning |
|---|---|
| Actor | Authenticated role or deterministic system process allowed to request/perform the transition |
| Preconditions | Business facts that must already be true |
| Validation | Checks performed atomically before state changes |
| Side effects | Records or follow-up work created by a successful transition |
| Notification | Required essential in-app/email event; push is Version 1.1 proposed |
| Audit | Required Audit Event name or audit behavior |
| Reversible | Whether the same object may return to its prior state through an allowed transition |
| Failure/recovery | Authoritative state and safe retry/correction behavior after failure |

All customer/manager actions require server-side authentication, authorization, object ownership/scope validation, and concurrency protection. Those common checks are not repeated in full in every row.

---

## 4. Customer Project State Machine

### States

- `DRAFT`
- `SUBMITTED`

`SUBMITTED` is terminal for that Customer Project version. Processing continues on a new Submitted Request.

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| CP-01 | `DRAFT` → `SUBMITTED` | Customer | Project belongs to Customer; contains at least one item; all required data supplied | Every item references an available Product/configuration; configuration constraints pass; attachments are accepted; no concurrent submission | Create immutable Submitted Request and submitted item/configuration snapshots; lock this Project version | Notify Manager of new request; confirm submission to Customer | `customer_project.submitted` | No direct return under `DR-003`; withdrawal/replacement requires `DW-002` | On any validation/transaction failure, remain `DRAFT`, create no partial Submitted Request, show actionable errors; safe retry after correction |

### Forbidden or Unresolved Transitions

- `SUBMITTED` → `DRAFT` is forbidden under `DR-003`. A revision/withdrawal policy must be approved in `DW-002` before any replacement transition is added.
- Project deletion/archive requires `DW-002` and `DW-009` and is not part of this state machine.

---

## 5. Submitted Request State Machine

### States

- `SUBMITTED`
- `UNDER_REVIEW`
- `WAITING_FOR_CUSTOMER_INFORMATION`
- `QUOTED`
- `CONVERTED_TO_ORDER`
- `DECLINED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| SR-01 | `SUBMITTED` → `UNDER_REVIEW` | Manager | Request is complete enough to open; not already claimed/closed | Request exists; Manager authorized; current state exact | Record review start and Manager | Optional acknowledgement to Customer; Manager work queue updates | `submitted_request.review_started` | No direct reversal | Failure leaves `SUBMITTED`; Manager can retry |
| SR-02 | `UNDER_REVIEW` → `WAITING_FOR_CUSTOMER_INFORMATION` | Manager | Clarification is genuinely required | A customer-visible question/message is present; no accepted quote/order | Create/link clarification Message; pause quotation readiness | Notify Customer that information is required | `submitted_request.customer_information_requested` | Yes through SR-03 | Failure leaves `UNDER_REVIEW`; unsent draft message may be retried |
| SR-03 | `WAITING_FOR_CUSTOMER_INFORMATION` → `UNDER_REVIEW` | Customer | Customer provides requested information | Response belongs to request; required attachments/inputs pass validation | Link response/attachments; return request to Manager queue | Notify Manager of customer response | `submitted_request.customer_information_received` | May repeat via SR-02 | Failure leaves waiting state; preserve customer draft and show error |
| SR-04 | `UNDER_REVIEW` → `QUOTED` | Manager | A Quotation Revision draft is valid and ready to send | Detailed SAR breakdown, configurable tax, production estimate, delivery details, and notes present; every item traceable; revision number unique | Atomically send immutable Quotation Revision; update current revision pointer | Email + in-app Quote Ready | `submitted_request.quotation_sent` and `quotation_revision.sent` | Re-enters review only via SR-05 | Failure leaves `UNDER_REVIEW`; revision remains Draft and editable |
| SR-05 | `QUOTED` → `UNDER_REVIEW` | Customer | Current sent revision receives valid Changes Requested response | Actor is quoted Customer; revision is current, sent, unaccepted, and not declined | Mark revision Changes Requested; link Message/reason; reopen Manager work | Notify Manager of requested changes | `submitted_request.changes_requested` and `quotation_revision.changes_requested` | Yes; Manager may send new revision via SR-04 | Failure leaves `QUOTED`; response may be safely retried with idempotency |
| SR-06 | `QUOTED` → `CONVERTED_TO_ORDER` | System within Customer acceptance transaction | Customer validly accepts current sent revision | Revision current/sent/unaccepted; no existing acceptance/order; all snapshot data available | Create Customer Acceptance, Order, and immutable Order Item Snapshots atomically | Email + in-app Quote Accepted and next full-payment step | `submitted_request.converted_to_order`, `quotation_revision.accepted`, `order.created` | No | Any failure rolls back entire transaction; remain `QUOTED`; no partial Order/snapshots; safe idempotent retry |
| SR-07 | `QUOTED` → `DECLINED` | System within Customer decline action | Customer explicitly declines current revision | Revision current/sent/unaccepted; no Order | Mark current revision Declined and request Declined | Notify Manager; confirm decline to Customer | `submitted_request.declined` and `quotation_revision.declined` | No under current proposal | Failure leaves `QUOTED`; customer may retry; reopening policy requires approval |

### Unresolved Behavior

Withdrawal, Manager rejection for infeasibility, automatic expiry, reopening a declined request, and cancellation are not allowed until `DW-002` and `DW-005` are approved.

---

## 6. Quotation Revision State Machine

### States

- `DRAFT`
- `SENT`
- `CHANGES_REQUESTED`
- `SUPERSEDED`
- `ACCEPTED`
- `DECLINED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| QR-01 | `DRAFT` → `SENT` | Manager | Submitted Request under review; draft complete | Required fields present; item traceability; amounts/terms valid under approved policy; unique next revision | Freeze all revision and item fields; record sent time; set current revision | Notify Customer | `quotation_revision.sent` | No; changes require new revision | Failure keeps `DRAFT`; Manager corrects and retries |
| QR-02 | `SENT` → `CHANGES_REQUESTED` | Customer | Current revision open for response | Correct Customer; no prior terminal response; reason/message passes validation | Record response; reopen Submitted Request review | Notify Manager | `quotation_revision.changes_requested` | No direct return; later superseded | Failure leaves `SENT`; retry idempotently |
| QR-03 | `CHANGES_REQUESTED` → `SUPERSEDED` | System when Manager sends next revision | A valid next revision is atomically sent | Next revision belongs to same Quotation, has next unique number, and is `SENT` | Mark old revision superseded; point Quotation to new revision | New-revision notification is emitted by QR-01 | `quotation_revision.superseded` | No | If new send fails, old remains `CHANGES_REQUESTED`, not superseded |
| QR-04 | `SENT` → `ACCEPTED` | Customer within atomic acceptance transaction | Current revision and valid Customer response | No existing terminal response/order; acceptance evidence captured; snapshot creation succeeds | Create immutable Customer Acceptance, Order, Order Item Snapshots | Notify both parties of acceptance and payment step | `quotation_revision.accepted` | No | Full transaction rollback on failure; remain `SENT`; idempotent retry returns existing success if already committed |
| QR-05 | `SENT` → `DECLINED` | Customer | Current revision and explicit decline | Correct Customer; no terminal response/order | Record decline and close Submitted Request under current proposal | Notify Manager; confirm to Customer | `quotation_revision.declined` | No | Failure leaves `SENT`; retry safely |

### Immutability Rules

- Only `DRAFT` fields may be edited under accepted `DW-002`.
- Every `SENT`, `CHANGES_REQUESTED`, `SUPERSEDED`, `ACCEPTED`, and `DECLINED` revision is immutable; corrections require a new numbered revision.
- An `ACCEPTED` revision can never be superseded, edited, declined, or deleted.
- Expiration is not implemented until quotation-validity policy is approved in `DW-002`.

---

## 7. Payment State Machine

This is the Order-level payment state. Each upload and decision remains a separate immutable Payment Submission / Payment Verification record.

### States

- `AWAITING_SUBMISSION`
- `SUBMITTED`
- `REJECTED`
- `VERIFIED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| PM-01 | `AWAITING_SUBMISSION` → `SUBMITTED` | Customer | Order belongs to Customer; quotation accepted; full bank transfer made; no verified payment | Private file is JPG, PNG, or PDF; approved size/security checks pass; upload complete; no conflicting active submission | Create immutable Payment Submission and private Attachment; preserve all prior submissions; queue Manager review | Email + in-app Payment Received | `payment.submitted` | May move to Rejected, not back directly | Failure leaves awaiting state; incomplete upload follows the approved residual file policy; safe retry |
| PM-02 | `REJECTED` → `SUBMITTED` | Customer | Replacement proof requested; Order not verified/cancelled | New private file passes checks; new immutable submission, never overwrite old | Create new Payment Submission; retain prior rejection history | Notify Manager; confirm resubmission | `payment.resubmitted` | May be rejected again | Failure leaves `REJECTED`; customer retries with new/valid proof |
| PM-03 | `SUBMITTED` → `VERIFIED` | Manager | Manager has manually reviewed latest submission | Submission belongs to Order; no existing verified decision; approved verification evidence/notes captured | Create immutable Verified Payment Verification; set Order Payment Verified; unlock ability to start Production but do not auto-start | Email + in-app Payment Verified | `payment.verified` | No under current policy | Transaction failure leaves `SUBMITTED`; Manager retries. Mistaken verification cannot be rewritten; reversal policy remains open |
| PM-04 | `SUBMITTED` → `REJECTED` | Manager | Manager has reviewed submission and found it unacceptable | Rejection reason required; no existing verified decision | Create immutable Rejected Payment Verification; request new proof | Notify Customer with approved actionable reason | `payment.rejected` | Yes through new submission PM-02 | Failure leaves `SUBMITTED`; Manager retries without duplicate decision |

### Forbidden Transitions

- `AWAITING_SUBMISSION` or `SUBMITTED` → Production state is forbidden.
- `VERIFIED` → `REJECTED` is forbidden until correction/reversal policy is approved in `DW-004`.
- Automated or AI verification is forbidden.

---

## 8. Order State Machine

### States

- `AWAITING_PAYMENT`
- `PAYMENT_UNDER_REVIEW`
- `PAYMENT_VERIFIED`
- `IN_PRODUCTION`
- `READY_FOR_FULFILMENT`
- `COMPLETED`
- `CANCELLED` — documented as a possible state, but no transition is approved yet

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| OR-01 | Creation → `AWAITING_PAYMENT` | System in acceptance transaction | Valid accepted Quotation Revision | Customer Acceptance, immutable snapshots, unique Order creation all succeed | Create Order and Order Item Snapshots; initialize Payment Awaiting Submission and Production Not Started | Notify Customer/Manager of accepted order and payment step | `order.created` | No | Atomic rollback on any failure; no partial Order |
| OR-02 | `AWAITING_PAYMENT` → `PAYMENT_UNDER_REVIEW` | System after PM-01/PM-02 | New Payment Submission created | Submission current and tied to Order | Update work queue/current submission pointer | Covered by payment submission notifications | `order.payment_under_review` | Yes through OR-03 | Failure rolls back Payment Submission transaction or remains awaiting; no orphan current pointer |
| OR-03 | `PAYMENT_UNDER_REVIEW` → `AWAITING_PAYMENT` | System after PM-04 | Current submission rejected | Rejection decision committed | Expose replacement-proof action | Covered by payment rejection | `order.payment_rejected` | Yes through OR-02 | Failure leaves under review until decision transaction succeeds |
| OR-04 | `PAYMENT_UNDER_REVIEW` → `PAYMENT_VERIFIED` | System after PM-03 | Verified decision committed | Same Order/submission; no conflicting outcome | Mark payment gate satisfied | Covered by payment verification | `order.payment_verified` | No under current policy | Failure rolls back verification transaction; no partial gate |
| OR-05 | `PAYMENT_VERIFIED` → `IN_PRODUCTION` | Manager | Verified Payment Verification exists | Re-read authoritative verified payment in same transition; Production is Not Started; no cancellation/terminal state | Enter Materials Preparation and create first Production Update | Email + in-app Production Started | `order.production_started` and `production.started` | No | Any failed check leaves `PAYMENT_VERIFIED`; no Production Update; Manager may retry after correction |
| OR-06 | `IN_PRODUCTION` → `READY_FOR_FULFILMENT` | System when Production reaches Ready | Valid final Production transition | Production state is Ready; fulfilment method agreed | Set appropriate Pickup/Delivery ready state | Email + in-app Ready | `order.ready_for_fulfilment` | No under current proposal | Failure leaves `IN_PRODUCTION`; retry after transactional recovery |
| OR-07 | `READY_FOR_FULFILMENT` → `COMPLETED` | System after Pickup/Delivery completion | Pickup is Picked Up or Delivery is Delivered | Completion evidence required by approved policy; no unresolved failure/dispute | Set completion time; make Review eligible in Version 1.1 | Notify Customer and Manager of completion | `order.completed` | No | Failure leaves ready state; retain fulfilment evidence and retry idempotently |

### Cancellation

`CANCELLED` is retained because it appears in the source lifecycle. No Version 1 transition to or from it is authorized by the current Product Owner decisions. The Saudi-compliant cancellation policy remains `BP-004`; any later structured workflow is additive scope rather than a pre-architecture blocker.

---

## 9. Production State Machine

This state machine belongs to the Order. Version 1 does not instantiate it for individual Order Items.

### States

- `NOT_STARTED`
- `MATERIALS_PREPARATION`
- `IN_PRODUCTION`
- `QUALITY_INSPECTION`
- `READY`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| PD-01 | `NOT_STARTED` → `MATERIALS_PREPARATION` | Manager | Order `PAYMENT_VERIFIED` and Verified Payment Verification exists | Authoritative payment gate checked atomically; Manager authorized; no existing start | Create immutable Production Update; set Order In Production | Email + in-app Production Started | `production.started` | No | Failure leaves `NOT_STARTED`; no update; retry only after cause fixed |
| PD-02 | `MATERIALS_PREPARATION` → `IN_PRODUCTION` | Manager | Materials preparation is complete and production work begins | Order still In Production; update note/estimate passes validation | Append Production Update; update current production state | No mandatory event beyond the accepted Production Started notice | `production.in_production` | No | Failure leaves `MATERIALS_PREPARATION`; Manager retries; no partial notification |
| PD-03 | `IN_PRODUCTION` → `QUALITY_INSPECTION` | Manager | Work is ready for quality inspection | Required production note/evidence under the future operational policy | Append Production Update | No mandatory event under the accepted matrix | `production.quality_inspection` | Reversible only through PD-04 | Failure leaves `IN_PRODUCTION` |
| PD-04 | `QUALITY_INSPECTION` → `IN_PRODUCTION` | Manager | Inspection fails | Rework reason required | Append rework Production Update; update estimate only under an approved delay policy | No mandatory event; delay communication remains open | `production.rework_required` | Yes | Failure leaves `QUALITY_INSPECTION`; Manager retries with reason |
| PD-05 | `QUALITY_INSPECTION` → `READY` | Manager | Quality inspection passes | Fulfilment method exists; required completion checks pass | Append Ready Production Update; trigger Order Ready and fulfilment state | Email + in-app Ready | `production.ready` | No | Failure leaves `QUALITY_INSPECTION`; do not mark Order ready; retry after correction |

The sequence, inspection-failure rework transition, and Order-level granularity are Accepted under `DW-006` and resolved `AB-004`. Skipping states is forbidden. Delay, pause, cancellation, correction, evidence, and wording remain Business Policy or Configuration decisions; they do not create an Order Item production lifecycle in Version 1.

Order Items remain first-class immutable records. Future item-level production tracking may add item-specific histories that reference those records, but it must not rewrite historical Order Items, reinterpret existing Order-level Production Updates, or break the Order aggregate.

---

## 10. Pickup State Machine

Pickup is optional and exists only when Pickup was accepted instead of the default Delivery method.

### States

- `AWAITING_PRODUCTION`
- `READY_FOR_PICKUP`
- `PICKED_UP`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| PU-01 | `AWAITING_PRODUCTION` → `READY_FOR_PICKUP` | System after Manager marks Production Ready | Accepted method is Pickup; Production Ready | Order and fulfilment consistent; no terminal state | Set Order Ready for Fulfilment | Notify Customer with approved pickup details | `pickup.ready` | No | Failure leaves awaiting; no ready notification; retry transaction |
| PU-02 | `READY_FOR_PICKUP` → `PICKED_UP` | Manager | Customer has received furniture | Handoff proof is present; identity requirements remain subject to the residual policy | Record pickup proof and completion; trigger Order completion | Completion notification is not added beyond the Product Owner's named event list unless later approved | `pickup.completed` | No | Failure leaves ready; do not complete Order; retry after evidence correction |

Pickup scheduling, identity evidence, no-show, refusal, damage, and dispute behavior require `DW-007` and `DW-005`.

---

## 11. Delivery State Machine

Delivery exists only when the accepted fulfilment method is Delivery.

### States

- `AWAITING_PRODUCTION`
- `READY_FOR_DELIVERY`
- `DELIVERED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| DL-01 | `AWAITING_PRODUCTION` → `READY_FOR_DELIVERY` | System after Manager marks Production Ready | Delivery is the accepted/default method; Production Ready | Quoted delivery price and confirmed Customer address are preserved; Order consistent | Set Order Ready for Fulfilment | Email + in-app Ready | `delivery.ready` | No | Failure leaves awaiting; no ready notification; retry transaction |
| DL-02 | `READY_FOR_DELIVERY` → `DELIVERED` | Manager | Customer has successfully received furniture | Required handoff proof is present | Record delivery proof and completion; trigger Order completion | Email + in-app Delivered | `delivery.completed` | No | Failure leaves ready; do not complete Order; retry after evidence correction |

Scheduling, dispatch/in-transit tracking, failed attempt, refusal, damage, partial delivery, and dispute states are not added until `DW-007` and `DW-005` are approved.

---

## 12. Review State Machine — Version 1.1 Proposed

### States

- `INELIGIBLE`
- `ELIGIBLE`
- `PUBLISHED`
- `RESPONDED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| RV-01 | `INELIGIBLE` → `ELIGIBLE` | System after Order completion | Order Completed; Customer owns Order; no conflicting review policy | One eligibility record per approved rule | Expose review action | Notify Customer only if notification policy includes review request | `review.eligible` | No while Order remains completed | Failure leaves ineligible; retry idempotently |
| RV-02 | `ELIGIBLE` → `PUBLISHED` | Customer | Eligible Order; valid rating/content/files | Rating/content rules; Customer ownership; photo security/moderation policy | Create Review and approved public representation | Notify Manager of new review; confirm Customer | `review.published` | Edit/delete policy open | Failure leaves eligible; preserve draft where supported; show errors |
| RV-03 | `PUBLISHED` → `RESPONDED` | Manager | Review visible and response permitted | Manager cannot edit Customer content; response valid | Append Manager response | Notify Customer | `review.responded` | Response edit/delete policy open | Failure leaves published; Manager retries |

Eligibility, moderation, reporting, edits, deletion, and photo visibility require `DW-020` before Version 1.1.

---

## 13. CMS Content Publication State Machine

### States

- `DRAFT`
- `PUBLISHED`
- `HIDDEN`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| CMS-01 | `DRAFT` → `PUBLISHED` | Manager | Content complete under approved locale and legal policy | Manager authorized; required translations/assets/links valid; no unapproved AI content | Create immutable published version; expose publicly; invalidate/update delivery caches as needed | No customer notification unless separately configured | `cms_content.published` | Yes through CMS-02; published version remains historical | Failure leaves Draft; no partial public version; Manager corrects and retries |
| CMS-02 | `PUBLISHED` → `HIDDEN` | Manager | Content should no longer be public | Manager authorized; hiding does not violate required-policy-page rules | Remove from public visibility; preserve published history | None by default | `cms_content.hidden` | Yes through CMS-03 | Failure leaves Published; retry safely |
| CMS-03 | `HIDDEN` → `PUBLISHED` | Manager | Previously published version may return | Required translations/assets/policies still valid | Restore public visibility of approved version or publish approved new version | None by default | `cms_content.republished` | Yes through CMS-02 | Failure leaves Hidden; correct validation issues and retry |

Human approval is required before a translation is published. Arabic is required, English is optional, and French is outside Version 1. Whether editing Published content creates a separate version, and the exact lifecycle, fallback, retirement, and retention rules, remain open.

---

## 14. Translation Publication State Machine

### States

- `DRAFT`
- `IN_REVIEW`
- `APPROVED`
- `PUBLISHED`

| ID | Start → Destination | Actor | Preconditions | Validation rules | Side effects | Notifications | Audit event | Reversible | Failure and recovery |
|---|---|---|---|---|---|---|---|---|---|
| TR-01 | `DRAFT` → `IN_REVIEW` | Manager | Arabic or optional-English translation draft exists; may be human or AI generated | Locale is in the accepted release scope; source linkage valid; required content present | Record review request/source type | Manager-facing work item only if useful | `translation.review_requested` | Yes through TR-02 | Failure leaves Draft; correct and retry |
| TR-02 | `IN_REVIEW` → `DRAFT` | Manager | Translation requires changes | Review notes required under approved process | Return draft for correction | Manager-facing state update | `translation.changes_requested` | Yes through TR-01 | Failure leaves In Review |
| TR-03 | `IN_REVIEW` → `APPROVED` | Manager | Manager has reviewed content | Manager is human authorized actor; locale/content validation passes | Record approver and approved version | None by default | `translation.approved` | No in-place edit; changes create new Draft version | Failure leaves In Review; retry after correction |
| TR-04 | `APPROVED` → `PUBLISHED` | Manager or deterministic system within CMS publish transaction | Parent content is being published/updated; translation approved | Approved version matches parent/source version and locale policy | Create immutable published translation version; expose with parent | None by default | `translation.published` | No in-place edit; hide parent or publish new version | Failure leaves Approved and prevents incomplete parent publication when locale policy requires it |

AI may create a Draft. AI cannot perform TR-01 as final reviewer, TR-03, or TR-04.

---

## 15. Cross-Machine Side Effects

Under proposed `DW-017`, every successful transition that requires notification, background work, media processing, analytics, or cache/search updates records the authoritative transition and its durable side-effect intent together. A side-effect failure must:

1. Preserve the committed authoritative state.
2. Record failed attempt and reason.
3. Retry only according to approved idempotent policy.
4. Escalate exhausted retries for Manager/operations review.
5. Never repeat a business transition merely to repeat a notification.

---

## 16. Remaining Decision Classification

### 16.1 True Architecture Blockers

**None.** The accepted happy-path state machines and Order-level production decision are sufficient to begin architecture.

The former `AB-001` through `AB-003` and `AB-005` through `AB-009` are reclassified. Their remaining choices govern allowed actions, policy outcomes, configuration, or architecture-phase mechanisms; they do not require additional pre-architecture state machines. `AB-004` is resolved.

### 16.2 Business Policy Decisions

`BP-001` through `BP-010` supply commercial rights/outcomes, durations, thresholds, fees, wording, service areas, and operational guidance. Until approved, no optional transition or automated consequence may be inferred from them.

### 16.3 Configuration Decisions

`CFG-001` through `CFG-008` control policy values and enabled behavior within the accepted lifecycle. Changing them must not rewrite historical records or bypass authorization and payment gates.

### 16.4 Implementation Details

`IMP-001` through `IMP-007` are selected during `DW-015` through `DW-017`. They include durable side effects, append-only correction representation, storage/security controls, CMS persistence, and the future item-level production extension seam.

### 16.5 Deferred Decision

`DW-020` selects Review behavior before Version 1.1.

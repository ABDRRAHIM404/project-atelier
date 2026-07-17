# DOMAIN MODEL

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Architecture Ready; Product Owner decisions integrated; residual policy/configuration tracked separately  
**Scope:** Business objects and relationships only; no database tables, schema types, API contracts, or provider choices  
**Source material:** `PROJECT_KNOWLEDGE.md`, `PROJECT_AUDIT.md`, `MASTER_PRD.md`, `DECISION_FORM.md`, and the planning-update instruction

---

## 1. Purpose

This document establishes a shared business vocabulary and ownership model before technical data modeling begins. It distinguishes live editable business data from immutable submitted, accepted, and historical records.

Where the source material is ambiguous, the definition is linked to a canonical `DW-*` decision rather than presented as approved policy.

---

## 2. Global Modeling Rules

1. **Live catalog data and historical commercial data are separate.** Product edits must never alter submitted requests, sent quotations, accepted terms, or historical orders.
2. **Submission creates a snapshot.** A submitted request preserves what the customer sent at that time.
3. **Sent quotation revisions are immutable.** Changes require a new revision.
4. **Acceptance is explicit and immutable.** Acceptance points to one exact quotation revision.
5. **Order item snapshots are immutable.** They preserve the accepted commercial and configuration record.
6. **Payment verification is a human manager decision.** Uploading proof does not verify payment.
7. **Production cannot start before verified payment.** This invariant applies at every server-side entry point.
8. **Corrections are append-only where history matters.** Important commercial, payment, production, fulfilment, publication, and authorization corrections create new records/events rather than rewriting history.
9. **Authorization follows ownership and business role.** Customers see their own private records; the manager sees records required to operate the business.
10. **Version 1 production is Order-level.** Order Items remain first-class immutable business objects but do not have independent production state or Production Updates.
11. **No database design is implied.** Object boundaries do not dictate table count, keys, indexes, or storage technology.

---

## 3. When a Project Becomes an Order

### Accepted Decision DM-001 / Workshop Decision DW-001

A **Customer Project does not become an Order when it is submitted**. Submission creates an immutable **Submitted Request** for manager review.

A Customer Project becomes an **Order when the customer explicitly accepts one sent Quotation Revision**. The acceptance operation must atomically:

1. Record a `Customer Acceptance` tied to the exact quotation revision.
2. Create one `Order` tied to that accepted revision.
3. Create immutable `Order Item Snapshot` records from the accepted quotation items and their referenced submitted configuration.
4. Place the new Order in `Awaiting Payment`.

Payment submission and verification therefore belong to the Order. Production remains blocked until a manager creates a successful `Payment Verification`.

**Status:** Accepted by the Product Owner through `DW-001` on 2026-07-16. Production still cannot start until payment is manually verified.

---

## 4. Relationship Overview

- A Visitor may become one Customer.
- A Customer owns Customer Projects, Saved Designs, Messages, Payment Submissions, and Reviews.
- A Manager operates catalog/CMS objects and reviews all submitted commercial work.
- A Product belongs to one Category and one or more Collections.
- Products expose assigned Materials, Colors, and Product Options.
- A Product Configuration selects values allowed by one Product.
- A Saved Design preserves a reusable draft Product Configuration.
- A Customer Project contains one or more Project Items.
- Submitting a Customer Project creates one Submitted Request and submitted item/configuration snapshots.
- A Submitted Request may receive one Quotation with multiple sequential Quotation Revisions.
- Each Quotation Revision contains one or more Quotation Items.
- A Customer Acceptance points to exactly one sent Quotation Revision.
- Acceptance creates one Order and one immutable Order Item Snapshot per accepted item.
- An Order may receive multiple Payment Submissions and Payment Verification decisions until one is verified.
- A verified Order may receive Order-level Production Updates and one Fulfilment path. Order Items have no independent Version 1 production lifecycle.
- Messages remain one continuous Customer-Manager conversation linked to the relevant Customer Project or Order. Retention and preference rules remain open.
- Attachments belong to Messages, Submitted Requests, Payment Submissions, Reviews, or CMS Content according to their purpose.
- Notifications refer to a business event and recipient.
- Reviews refer to eligible completed Orders.
- CMS Content has localized Translations and publication history.
- Audit Events refer to actors, business objects, and state-changing actions.

---

## 5. Actors

### 5.1 Visitor

- **Purpose:** Represent a person using the public storefront without authentication.
- **Owner:** No persistent business owner is required by the current requirements.
- **Mutable fields:** Temporary locale and browsing/session preferences where implemented.
- **Immutable fields:** None required by approved business knowledge.
- **Lifecycle:** Begins with an unauthenticated visit; may become associated with a Customer after registration. Optional analytics/consent behavior is deferred to `DW-021`.
- **Relationships:** Browses Products, Categories, Collections, CMS Content, and public media.
- **Authorization considerations:** Public read access only; cannot configure, save, submit, message, track, or review.
- **Historical-record requirements:** No Visitor history is required by the current business rules. Any later analytics collection requires `DW-021`.

### 5.2 Customer

- **Purpose:** Represent a registered person creating and tracking custom-furniture work.
- **Owner:** The Customer owns their profile and customer-side private workspace; the business is custodian of operational records.
- **Mutable fields:** Personal information, contact information, preferred language, notification preferences, password/authentication data through the selected provider.
- **Immutable fields:** Stable identity, verified email identity, and original creation history are required for attributable private/commercial records. Other required profile fields remain open.
- **Lifecycle:** Registered through email + OTP verification and used for ongoing Projects; suspension, closure, deletion, export, and anonymization states remain open.
- **Relationships:** Owns Customer Projects, Saved Designs, Favorites if introduced, Messages, Payment Submissions, Notifications, and Reviews; is party to Submitted Requests, Quotations, Customer Acceptances, and Orders.
- **Authorization considerations:** May access only their own private records and files. Cannot perform manager actions.
- **Historical-record requirements:** Account changes must not erase required commercial history. Deletion, export, anonymization, and retention require `DW-008` and `DW-009`.

### 5.3 Manager

- **Purpose:** Represent the single Version 1 business administrator and human decision-maker.
- **Owner:** The furniture business.
- **Mutable fields:** Profile, contact and notification preferences, authentication data through the selected provider.
- **Immutable fields:** Stable manager identity and action attribution are proposed immutable.
- **Lifecycle:** One active Version 1 Manager using a strong password, MFA, and recovery codes; bootstrap, emergency access, replacement, and absence continuity remain open.
- **Relationships:** Manages catalog/CMS objects; reviews Submitted Requests; authors Quotation Revisions; creates Payment Verifications and Production Updates; manages Fulfilment; participates in Messages; responds to Reviews.
- **Authorization considerations:** Has administrative business access but remains subject to server-side authorization and audit. AI cannot act as Manager.
- **Historical-record requirements:** Actions affecting commercial, payment, production, fulfilment, content, translation, and security state require durable attribution.

---

## 6. Catalog and Configuration Objects

### 6.1 Product

- **Purpose:** Represent a live configurable furniture design template.
- **Owner:** Business; managed by the Manager.
- **Mutable fields:** Name, description, media, starting price, specifications, production information, category, collections, assigned materials/colors/options, live status, and translations.
- **Immutable fields:** Stable product identity and creation history are proposed immutable. Historical commercial data is not read from the mutable Product after submission/acceptance.
- **Lifecycle:** Draft → Published / Hidden / Temporarily Unavailable → Archived according to approved transitions.
- **Relationships:** Belongs to one Category and one or more Collections; uses Materials, Colors, Product Options, media, and Translations; source for Product Configurations and Project Items.
- **Authorization considerations:** Public users read Published products only. Manager controls mutation and visibility.
- **Historical-record requirements:** Product changes do not rewrite Submitted Requests, Quotation Items, or Order Item Snapshots. Archived Products remain referentially available to history.

### 6.2 Category

- **Purpose:** Organize Products by furniture category/type for browsing and management.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Name, description where supported, ordering, visibility, translations, and Product assignments.
- **Immutable fields:** Stable category identity and historical audit entries are proposed immutable.
- **Lifecycle:** Created, edited, visible, hidden, or retired from live use; exact non-destructive publication/retirement semantics require `DW-011`.
- **Relationships:** Has many Products; may appear in CMS navigation and analytics.
- **Authorization considerations:** Manager writes; public reads visible categories.
- **Historical-record requirements:** Category edits do not change category text captured in historical snapshots where preserved.

### 6.3 Collection

- **Purpose:** Group Products into curated furniture sets or themes.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Name, description, ordering, visibility, translations, media, and Product membership.
- **Immutable fields:** Stable collection identity and audit history are proposed immutable.
- **Lifecycle:** Created, edited, visible/published, hidden, or retired; exact non-destructive semantics require `DW-011`.
- **Relationships:** Contains many Products; a Product may belong to multiple Collections.
- **Authorization considerations:** Manager writes; public reads visible Collections.
- **Historical-record requirements:** Live membership changes must not rewrite historical order snapshots.

### 6.4 Material

- **Purpose:** Represent a centrally managed material that may be assigned to Products.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Name, description/media where supported, availability, translations, and Product assignments.
- **Immutable fields:** Stable material identity and audit history are proposed immutable.
- **Lifecycle:** Created, assigned, and made unavailable/retired from live use. Version 1 has no stock state; exact retirement semantics require `DW-011`.
- **Relationships:** Assigned to Products; selected by Product Configurations; copied into submitted/quoted/order history.
- **Authorization considerations:** Manager writes; customers read only materials assigned and available to the Product.
- **Historical-record requirements:** Historical selections remain readable after a Material changes or becomes unavailable.

### 6.5 Color

- **Purpose:** Represent a centrally managed selectable product color.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Name, display value/media, availability, translations, and Product assignments.
- **Immutable fields:** Stable color identity and audit history are proposed immutable.
- **Lifecycle:** Created, assigned, and made unavailable/retired from live use; exact retirement semantics require `DW-011`.
- **Relationships:** Assigned to Products; selected by Product Configurations; copied into historical snapshots.
- **Authorization considerations:** Manager writes; customers read only colors assigned and available to the Product.
- **Historical-record requirements:** Historical color choice remains readable if the live Color changes or is removed.

### 6.6 Product Option

- **Purpose:** Define a manager-approved configurable choice or input for a Product.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Name, option values, required/optional status, ordering, availability, validation constraints, translations, and Product assignment.
- **Immutable fields:** Stable option identity and prior submitted/accepted values in snapshots.
- **Lifecycle:** Draft/configured, active for Product, disabled/retired; exact generic option states and rule types require approval.
- **Relationships:** Belongs to or is assigned to Product; contributes values to Product Configuration.
- **Authorization considerations:** Manager writes. Customers select only active values exposed by the Product.
- **Historical-record requirements:** Option/value edits do not change submitted or accepted configurations.

### 6.7 Product Configuration

- **Purpose:** Capture one coherent set of customer choices for one Product.
- **Owner:** Customer while draft; becomes part of business records when submitted.
- **Mutable fields:** Dimensions, selected materials, fabrics, colors, finishes, product-specific values, and draft notes while the containing object is editable.
- **Immutable fields:** Product reference and values become immutable inside Submitted Request, Quotation Item, and Order Item Snapshot records.
- **Lifecycle:** Draft → Validated → Included in Project → Submitted snapshot → quoted/accepted snapshots. Invalid configurations cannot progress. Version 1 uses only the bounded rule types accepted in `DR-005`.
- **Relationships:** Configures one Product; belongs to a Saved Design or Project Item; copied into later commercial snapshots.
- **Authorization considerations:** Customer edits their own draft; Manager may inspect submitted configurations but may not silently rewrite customer submission history.
- **Historical-record requirements:** Exact submitted and accepted values must remain reconstructable independently of live Product Options.

### 6.8 Saved Design

- **Release phase:** Version 1.1 proposed.
- **Purpose:** Preserve an unfinished reusable Product Configuration outside a submitted project.
- **Owner:** Customer.
- **Mutable fields:** Name where supported, draft Product Configuration, and customer notes.
- **Immutable fields:** Stable identity and creation history are proposed immutable.
- **Lifecycle:** Created → edited/duplicated/compared → added to Project; archive/delete and stale-value behavior require `DW-019`.
- **Relationships:** References one Product and Product Configuration; may create a Project Item.
- **Authorization considerations:** Customer-only private object unless explicitly shared with Manager.
- **Historical-record requirements:** Product/option-change behavior requires `DW-019` before Version 1.1 implementation.

---

## 7. Project and Quotation Objects

### 7.1 Customer Project

- **Purpose:** Customer-owned workspace for assembling one or more furniture items before submission.
- **Owner:** Customer.
- **Mutable fields:** Project name, draft notes, Project Items, item ordering, and draft configuration while state is Draft.
- **Immutable fields:** Stable identity and creation history; after submission the submitted snapshot is immutable.
- **Lifecycle:** Draft → Submitted. Direct Customer edits end at submission; withdrawal, cancellation, and archive behavior remain open.
- **Relationships:** Contains one or more Project Items; submission creates a Submitted Request; later relates to Quotation and proposed Order.
- **Authorization considerations:** Owning Customer edits/reads draft. Manager gains operational read access to the Submitted Request, not permission to rewrite customer history.
- **Historical-record requirements:** The original submitted version must remain reconstructable even if a future project revision is allowed.

### 7.2 Project Item

- **Purpose:** Represent one standard or configured furniture item inside a Customer Project.
- **Owner:** Same Customer as the Project.
- **Mutable fields:** Product Configuration, quantity if later approved, notes, measurements, references, and ordering while Project is Draft. Quantity is not yet an approved business field.
- **Immutable fields:** Product identity and configuration in submitted snapshots.
- **Lifecycle:** Added to Draft → edited/removed → included in submission.
- **Relationships:** Belongs to Customer Project; references Product and Product Configuration; source for submitted and quotation items.
- **Authorization considerations:** Project owner controls draft. Manager reads submitted representation.
- **Historical-record requirements:** Submitted item content must not be reconstructed from mutable live catalog data.

### 7.3 Submitted Request

- **Purpose:** Preserve the exact project content submitted for manager review.
- **Owner:** Customer is the requesting party; business becomes custodian and Manager processes it.
- **Mutable fields:** Workflow state and append-only manager/customer clarification references. Original submitted content is not mutable.
- **Immutable fields:** Customer, submission timestamp, submitted items/configurations, measurements, notes, and submitted references.
- **Lifecycle:** Submitted → Under Review ↔ Waiting for Customer Information → Quoted → Converted to Order or Declined. Withdrawal, infeasibility, decline reopening, expiry, and cancellation remain open.
- **Relationships:** Created from Customer Project; receives one Quotation; links clarification Messages and Attachments.
- **Authorization considerations:** Customer and Manager only. Manager may evaluate but cannot alter the original request.
- **Historical-record requirements:** Permanent submission snapshot for resulting commercial history; abandoned-request retention requires `DW-009`.

### 7.4 Quotation

- **Purpose:** Group all revisions of the manager's commercial proposal for one Submitted Request.
- **Owner:** Business; authored by Manager for Customer.
- **Mutable fields:** Current workflow pointer/status and association to newly created revisions. Existing sent revisions are not mutable.
- **Immutable fields:** Stable identity, Customer, Submitted Request relationship, creation history.
- **Lifecycle:** Open during review/revision → Accepted / Declined / Closed. Sent revisions are sequential and numbered; changes create a new revision and supersede the prior actionable revision. Expiry, withdrawal, reopening, and cancellation remain open.
- **Relationships:** Belongs to one Submitted Request and Customer; contains sequential Quotation Revisions; accepted revision creates Customer Acceptance and proposed Order.
- **Authorization considerations:** Manager authors; Customer reads/responds to sent revisions only.
- **Historical-record requirements:** All sent revisions and customer responses remain available.

### 7.5 Quotation Revision

- **Purpose:** Represent one exact version of the manager's price, production estimate, delivery terms, and notes.
- **Owner:** Business; authored by Manager.
- **Mutable fields:** Draft contents before sending.
- **Immutable fields:** Once sent: revision number, line items, final price, production estimate, delivery details/cost, notes, terms, sender, recipient, and sent timestamp.
- **Lifecycle:** Draft → Sent → Accepted / Changes Requested / Declined / Superseded. Only the current sent revision may be accepted; sent revisions are immutable and corrections require a new numbered revision. Expiry remains open; accepted history is immutable.
- **Relationships:** Belongs to Quotation; contains Quotation Items; may receive one Customer Acceptance; may be superseded by a later revision.
- **Authorization considerations:** Manager edits drafts and sends. Customer may respond only to a sent current revision according to approved rules.
- **Historical-record requirements:** Sent and accepted revisions are immutable. Correction requires a new revision; accepted revision cannot be superseded silently.

### 7.6 Quotation Item

- **Purpose:** Represent the manager-reviewed commercial version of one requested furniture item.
- **Owner:** Business; included in Manager-authored revision.
- **Mutable fields:** Draft fields before the containing revision is sent.
- **Immutable fields:** Once sent: item description/snapshot, configuration, measurements, price components approved by policy, and relationship to submitted item.
- **Lifecycle:** Draft with Quotation Revision → immutable on send → accepted/declined with revision.
- **Relationships:** Belongs to Quotation Revision; relates to a submitted Project Item; source for Order Item Snapshot.
- **Authorization considerations:** Manager authors; Customer reads with quotation. Customer cannot alter it directly.
- **Historical-record requirements:** Remains exactly as presented in that revision.

### 7.7 Customer Acceptance

- **Purpose:** Record the Customer's explicit agreement to one exact Quotation Revision.
- **Owner:** Customer as actor; business as custodian.
- **Mutable fields:** None. Revocation/correction requires a separate approved policy and event.
- **Immutable fields:** Customer, Quotation Revision, acceptance timestamp, accepted terms/version, and available acceptance evidence.
- **Lifecycle:** Created once on valid acceptance; terminal.
- **Relationships:** Belongs to Customer and one accepted Quotation Revision; valid creation triggers one Order and its immutable Order Item Snapshots.
- **Authorization considerations:** Only the quoted Customer may accept. Manager and AI cannot accept for the Customer.
- **Historical-record requirements:** Permanent with resulting Order, subject to approved legal retention.

---

## 8. Payment and Order Objects

### 8.1 Payment Submission

- **Purpose:** Record one Customer attempt to provide bank-transfer proof for an Order.
- **Owner:** Customer uploader; business is custodian.
- **Mutable fields:** Processing/security review status if required. Proof content is not edited after submission.
- **Immutable fields:** Order, Customer, upload timestamp, private JPG/PNG/PDF Attachment reference, and submitted metadata.
- **Lifecycle:** Submitted → reviewed through a Payment Verification. Rejection leads to a new Payment Submission, not replacement of history.
- **Relationships:** Belongs to Order and Customer; contains/references one private Attachment; receives one or more correction/audit events only as policy allows.
- **Authorization considerations:** Only owning Customer and Manager may access. Public URLs are prohibited.
- **Historical-record requirements:** Every submission is retained in history, never overwritten, and never deleted automatically. File-size limit, payment exception/correction behavior, and the approved manual retention/deletion period remain open.

### 8.2 Payment Verification

- **Purpose:** Record the Manager's manual decision about one Payment Submission.
- **Owner:** Business; actor is Manager.
- **Mutable fields:** None after decision. A mistaken decision requires an approved correction event/process.
- **Immutable fields:** Payment Submission, Manager, outcome, timestamp, and manager reason/notes required by policy.
- **Lifecycle:** Created manually by the Manager as Verified or Rejected. Mistaken-verification correction/reversal remains open; no correction may bypass the verified-payment production gate.
- **Relationships:** Belongs to Payment Submission and Order; a Verified outcome enables but does not itself start Production.
- **Authorization considerations:** Manager only. Customer and AI cannot verify.
- **Historical-record requirements:** Permanent audit record with Order; unsuccessful attempts remain traceable according to retention policy.

### 8.3 Order

- **Purpose:** Represent the accepted commercial agreement and its payment, production, fulfilment, and completion lifecycle.
- **Owner:** Business commercial record shared with the Customer.
- **Mutable fields:** Controlled lifecycle state, current payment/production/fulfilment pointers, estimates, and append-only operational notes as approved.
- **Immutable fields:** Customer, accepted Quotation Revision, Customer Acceptance, creation timestamp, configurable SAR currency, accepted full-payment terms, detailed accepted price breakdown, and Order Item Snapshots.
- **Lifecycle:** Awaiting Payment → Payment Under Review → Payment Verified → In Production → Ready for Fulfilment → Completed. The Order is created on quotation acceptance; cancellation remains subject to the Manager-defined Saudi-compliant policy that has not yet been supplied.
- **Relationships:** Created from one accepted Quotation Revision; contains first-class Order Item Snapshots; owns the single Version 1 production lifecycle and its Production Updates; has Payment Submissions/Verifications, Fulfilment, Messages, Notifications, Audit Events, and optional Review.
- **Authorization considerations:** Customer reads own Order and permitted actions; Manager controls payment/production/fulfilment transitions; all transitions server-enforced.
- **Historical-record requirements:** Permanent immutable agreement and event history; mutable live Product/CMS data cannot alter it.

### 8.4 Order Item Snapshot — Version 1 Order Item

- **Purpose:** Represent one first-class Order Item and preserve exactly what the Customer accepted for it.
- **Owner:** Business commercial record visible to Customer.
- **Mutable fields:** None.
- **Immutable fields:** Product identity and displayed details required for history, configuration, measurements, material/color/option labels, quoted price components, and source Quotation Item.
- **Lifecycle:** Created atomically with Order; terminal as an immutable commercial snapshot. It has no production lifecycle in Version 1.
- **Relationships:** Belongs to Order; derived from one Quotation Item and submitted configuration. Production Updates belong to the Order, not to this object.
- **Authorization considerations:** Customer and Manager access through Order; no catalog-management operation may edit it.
- **Historical-record requirements:** Permanent with Order according to approved retention; must remain readable when Product/options archive. Future item-level production records may reference it additively but must not rewrite it, reinterpret existing Order-level production history, or require redesign of the Order aggregate.

---

## 9. Production and Fulfilment Objects

### 9.1 Production Update

- **Purpose:** Record customer-visible Order-level production progress after verified payment.
- **Owner:** Business; authored by Manager.
- **Mutable fields:** None after publication; correction creates another update/audit event.
- **Immutable fields:** Order, production state, Manager, timestamp, and published note/media where supported.
- **Lifecycle:** Created sequentially as production advances through Not Started → Materials Preparation → In Production → Quality Inspection → Ready, with failed inspection returning to In Production.
- **Relationships:** Belongs to exactly one Order; never belongs to an individual Order Item in Version 1; may trigger Notification and appears in the Customer timeline.
- **Authorization considerations:** Manager creates; owning Customer reads. Production start requires Verified Payment.
- **Historical-record requirements:** Append-only chronology retained with Order.

### 9.2 Fulfilment

- **Purpose:** Represent the agreed pickup or delivery path and completion outcome.
- **Owner:** Business operational record shared with Customer.
- **Mutable fields:** Schedule and operational details before handoff according to approved policy; controlled state.
- **Immutable fields:** Delivery-default or optional-pickup method, quoted delivery price, confirmed address where delivery applies, accepted terms, and handoff evidence/completion timestamp once completed.
- **Lifecycle:** Awaiting Production → Ready for Pickup/Delivery → Picked Up/Delivered → Order Completed. Completion requires handoff proof. Service area, scheduling, failed attempt, refusal, damage, partial receipt, and dispute states remain open.
- **Relationships:** One per Order under the current model; linked to Quotation delivery details, Notifications, Messages, and Audit Events.
- **Authorization considerations:** Manager controls operational state; Customer reads and provides only actions approved by policy.
- **Historical-record requirements:** Completion and agreed fulfilment terms remain with Order.

---

## 10. Communication Objects

### 10.1 Message

- **Purpose:** Support continuous Customer–Manager communication across discovery, clarification, quotation, production, and after-sales.
- **Owner:** Sender authors the Message; conversation is a business/customer record.
- **Mutable fields:** Read/delivery metadata. Original sent content is not silently rewritten; correction, deletion, and retention remain subject to the residual communication and privacy policies.
- **Immutable fields:** Sender, recipient/conversation, original sent timestamp, and original content are proposed immutable after send.
- **Lifecycle:** Composed → Sent → Delivered/Read where supported; failure/retry and retention behavior remain open.
- **Relationships:** Between Customer and Manager in one continuous conversation linked to the relevant Project or Order; may have Attachments.
- **Authorization considerations:** Conversation parties only. Attachment authorization inherits Message and business context.
- **Historical-record requirements:** Commercial clarification remains traceable; context and retention require `DW-010`.

### 10.2 Attachment

- **Purpose:** Represent an uploaded image, document, reference photo, payment proof, review photo, or CMS media asset.
- **Owner:** Depends on parent: Customer, Manager/business, or shared business record.
- **Mutable fields:** Scan/processing status, derived variants, access metadata, and allowed display metadata.
- **Immutable fields:** Original upload identity, uploader, parent context, checksum/bytes where retained, and creation timestamp are proposed immutable.
- **Lifecycle:** Uploaded → Validated/Processed → Available; Rejected/Quarantined/Deleted states require `DW-009`.
- **Relationships:** Belongs to Message, Submitted Request, Payment Submission, Review, CMS Content, Product, or other approved parent.
- **Authorization considerations:** Parent-based access; private by default unless intentionally published by Manager. Payment proof always private.
- **Historical-record requirements:** Commercial/private retention and public-media deletion/version behavior require `DW-009`.

### 10.3 Notification

- **Purpose:** Inform a Customer or Manager about an important business event.
- **Owner:** Recipient owns their notification view; business owns event/delivery record.
- **Mutable fields:** Read/unread state, delivery attempts/status, preference-respecting channel state.
- **Immutable fields:** Recipient, triggering event, template/version, locale used, creation timestamp, and business-object reference.
- **Lifecycle:** Created for Quote Ready, Quote Accepted, Payment Received, Payment Verified, Production Started, Ready, or Delivered → queued/delivered/failed by email and in-app → read for in-app. Preferences, retention, and failed-delivery policy remain open; durable delivery implementation requires `DW-017`.
- **Relationships:** References Customer/Manager and triggering Project, Quotation, Payment, Order, Production, Fulfilment, Message, or Review event.
- **Authorization considerations:** Recipient only for private notifications; Manager may see operational delivery status as approved.
- **Historical-record requirements:** Delivery evidence and retention depend on notification policy; business state never depends solely on delivery success.

---

## 11. Review and Content Objects

### 11.1 Review

- **Release phase:** Version 1.1 proposed.
- **Purpose:** Capture Customer feedback for an eligible completed Order.
- **Owner:** Customer authors; business hosts; Manager may respond but not edit Customer content.
- **Mutable fields:** Customer edit and moderation behavior require `DW-020`; Manager response may be appended but cannot alter Customer content.
- **Immutable fields:** Customer, eligible Order, original submission timestamp, and authorship.
- **Lifecycle:** Ineligible → Eligible → Published; Manager response may follow. Exact eligibility, edit, report, moderation, photo, and deletion policy requires `DW-020`.
- **Relationships:** Belongs to Customer and completed Order; may contain review-photo Attachments; may have Manager response.
- **Authorization considerations:** Only eligible Customer creates. Manager cannot rewrite Customer review.
- **Historical-record requirements:** Edit/deletion/moderation/photo-publication policy must be approved before Version 1.1.

### 11.2 CMS Content

- **Purpose:** Represent manager-controlled customer-facing pages and composable content.
- **Owner:** Business; managed by Manager.
- **Mutable fields:** Draft structure, sections, ordering, content, media, visibility, and Translations.
- **Immutable fields:** Stable identity, publication/audit history, and prior published versions where required are proposed immutable.
- **Lifecycle:** Draft → Published ↔ Hidden; updates to published content create a new draft/version under the proposed publication model.
- **Relationships:** Has one or more Translations and Attachments/media; may represent homepage sections, pages, banners, policies, or inspiration.
- **Authorization considerations:** Manager writes/publishes; public reads only Published content.
- **Historical-record requirements:** Publication history is required for policy and significant business content; exact version retention remains part of the residual content/privacy policy.

### 11.3 Translation

- **Purpose:** Store required Arabic and optional English content with review/publication control. French is outside Version 1.
- **Owner:** Business; managed/approved by Manager.
- **Mutable fields:** Draft text and review notes before publication.
- **Immutable fields:** Locale, source object, published version, approver, and approval/publication timestamps are proposed immutable per version.
- **Lifecycle:** Draft → In Review → Approved → Published. Human Manager approval is mandatory for translation publication. Content fallback, correction, retirement, and version retention remain open.
- **Relationships:** Belongs to Product, Category, Collection, Material, Color, Product Option, CMS Content, Notification/email template, or other localizable object.
- **Authorization considerations:** Manager approves and publishes. Public sees only Published translation according to locale policy.
- **Historical-record requirements:** Published version and approval attribution remain auditable; fallback/completeness rules require `DW-011`.

### 11.4 Audit Event

- **Purpose:** Provide an append-only record of security-relevant and business-critical actions.
- **Owner:** Business/system; attributable to Customer, Manager, system process, or approved integration.
- **Mutable fields:** None. Redaction policy may protect sensitive payload details without changing event meaning.
- **Immutable fields:** Event type, actor, action, target object, timestamp, prior/new state references where appropriate, request/correlation identity, and outcome.
- **Lifecycle:** Created once after/with the authoritative transaction; terminal.
- **Relationships:** May reference any domain object and related side-effect/notification result.
- **Authorization considerations:** Customers may see customer-facing history where required; operational audit access is Manager/authorized system only. Audit logs must not leak secrets/private content.
- **Historical-record requirements:** Business Audit Events are append-only under the proposed `ADR-010`; scope, retention, export, monitoring, redaction, and tamper-evidence require `DW-017` and `DW-009`.

---

## 12. Mutability and Snapshot Summary

| Object | Live mutable? | Immutable boundary |
|---|---:|---|
| Product / catalog objects | Yes | Historical copies in submitted/quoted/order records |
| Product Configuration | Yes while draft | Frozen in submission and later snapshots |
| Customer Project | Yes while Draft | Submission creates immutable Submitted Request |
| Submitted Request | Workflow state only | Original submitted content immutable |
| Quotation Revision | Draft while editable | Every sent revision is immutable; correction requires a new numbered revision |
| Customer Acceptance | No | Immutable at creation |
| Payment Submission | No content edits | Immutable upload attempt |
| Payment Verification | No | Immutable manager decision |
| Order | Controlled state only | Accepted agreement and item snapshots immutable |
| Order Item Snapshot | No | Immutable at Order creation |
| Production Update | No | Append-only event |
| Fulfilment | Controlled state/details | Agreed terms and completion evidence immutable |
| Message | Read/delivery metadata | Original sent content immutable; correction/deletion policy remains open |
| Notification | Read/delivery metadata | Triggering event and recipient immutable |
| Review | `DW-020` | Authorship/order link immutable |
| CMS Content / Translation | Draft/version mutable | Published version and approval history immutable |
| Audit Event | No | Entire event immutable |

---

## 13. Remaining Decision Classification

### 13.1 True Architecture Blockers

**None.** The accepted entities, relationships, aggregates, ownership, immutable boundaries, and Order-level production model are sufficient to begin architecture.

`AB-004` is resolved: Version 1 production belongs to the Order. Order Item Snapshot remains a first-class Order Item without its own production lifecycle. Future item-level tracking is an additive extension that must preserve historical Order Items and Order-level history.

### 13.2 Business Policy and Configuration

`BP-001` through `BP-010` and `CFG-001` through `CFG-008` define rights, outcomes, durations, thresholds, fees, wording, service values, and Manager-configurable behavior. They do not require new Version 1 entities or aggregate boundaries and do not block architecture.

### 13.3 Implementation Details

`IMP-001` through `IMP-007` are resolved during `DW-015` through `DW-017`. They cover technical representation, storage/security mechanisms, delivery reliability, CMS persistence, and the future item-level production extension seam. They are architecture work, not pre-architecture Product Owner blockers.

### 13.4 Deferred Decisions

`DW-019` and `DW-020` remain deferred for Saved Designs and Reviews in Version 1.1.

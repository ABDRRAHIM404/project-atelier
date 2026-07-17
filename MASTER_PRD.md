# MASTER PRODUCT REQUIREMENTS DOCUMENT

**Product:** بيتي بذوقي  
**Internal codename:** Project Atelier  
**Document type:** Master Product Requirements Document  
**Version:** 1.6 P0 implementation-authorization revision  
**Status:** Architecture, database/API design, and implementation planning Approved; P0 implementation authorized; residual policy/configuration decisions remain tracked  
**Primary source material:** `PROJECT_KNOWLEDGE.md`, `PROJECT_AUDIT.md`, and the previous `MASTER_PRD.md`  
**Last updated:** 2026-07-16

---

## 1. Document Authority and Interpretation

### 1.1 Source Authority

This PRD is derived exclusively from:

1. `PROJECT_KNOWLEDGE.md` — the authoritative source of validated product and business knowledge.
2. `PROJECT_AUDIT.md` — the review of gaps, inconsistencies, risks, technical debt, and readiness.

The Product Owner record and companion planning documents refine this PRD without selecting implementation technology:

3. `DECISION_FORM.md` — authoritative Product Owner answers dated 2026-07-16.
4. `DOMAIN_MODEL.md` — canonical conceptual business objects, relationships, ownership, mutability, and history.
5. `STATE_MACHINES.md` — canonical lifecycle states, transitions, guards, actors, effects, and recovery behavior.
6. `ARCHITECTURE_DECISIONS.md` — canonical ADR register with explicit Accepted and Proposed status.
7. `QUALITY_GATES.md` — canonical accepted measurable Version 1 targets and global Definition of Done.
8. `DECISION_WORKSHOP.md` — canonical resolution evidence, remaining decision questions, options, impacts, and legacy-ID coverage.
9. `GOAL.md` — current milestone, constraints, non-goals, and exit criteria.
10. `ANTI_PATTERNS.md` — prohibited interpretations and implementation shortcuts.
11. `IMPLEMENTATION_READINESS_REPORT.md` — current readiness assessment and recommendation.

`DECISION_FORM.md` records Product Owner decisions dated 2026-07-16. Those answers are authoritative where they explicitly revise earlier planning, including SAR currency, Saudi-policy context, Version 1 language scope, production stages, fulfilment defaults, quality targets, brand direction, and success measures. Otherwise, `PROJECT_KNOWLEDGE.md` remains the discovery authority. Audit recommendations are not approved business requirements unless selected by the Product Owner.

### 1.2 No-Assumption Rule

This PRD does not fill missing information with invented requirements. When a rule, policy, or provider is unresolved, it is recorded in **Section 22: Decision Status and Workshop Register** and detailed in `DECISION_WORKSHOP.md`. Proposed values are not silently treated as approved.

### 1.3 Requirement Classifications

| Classification | Meaning |
|---|---|
| **V1 Explicit** | Explicitly identified as part of Version 1 in the source material |
| **Core Workflow** | Required to deliver the documented customer or manager journey and business rules |
| **V1.1 Proposed** | Retained in the product roadmap but proposed for the first post-Version 1 release; requires approval |
| **Future** | Explicitly deferred beyond Version 1 |

### 1.4 Approval Status

The Product Owner decisions have been integrated, the strict blocker review found no true Architecture Blocker, and the Product Owner approved the architecture, providers, database/API design, and implementation plan on 2026-07-16. P0 — Delivery Foundation is explicitly authorized. P1 and later phases remain gated by G0 evidence and a separate Product Owner instruction; Business Policy/Configuration decisions remain required for each affected feature or release.

---

## 2. Executive Summary

بيتي بذوقي is a digital platform for a custom-furniture workshop serving the Saudi market. It is not a stocked e-commerce store. Products are configurable furniture templates that customers can order as displayed or customize within Manager-defined manufacturing constraints.

Every commercial transaction follows a collaborative, quotation-based process:

1. A customer creates a project containing one or more furniture items.
2. The customer submits the project without paying.
3. The manager reviews feasibility, pricing, production time, and delivery.
4. The manager sends a final quotation.
5. The customer accepts the quotation or requests changes.
6. The customer pays by bank transfer and uploads proof.
7. The manager manually verifies payment.
8. Production begins only after verification.
9. The customer tracks production through completion and pickup or delivery.

The product must preserve the personal relationship between customer and workshop while reducing uncertainty, administrative effort, and fragmented communication. The experience is Arabic-first, RTL-native, mobile-first, visual, premium, accessible, and manager-controlled.

Version 1 serves one workshop with one manager. It does not include worker accounts, inventory, suppliers, or multi-store operations. The design must avoid blocking future expansion, but Version 1 must remain simple.

---

## 3. Product Vision, Mission, and Positioning

### 3.1 Vision

Become a leading digital platform for custom furniture in Saudi Arabia by combining traditional craftsmanship with modern technology.

### 3.2 Mission

Simplify the complete custom-furniture journey while preserving direct collaboration between the customer and the workshop.

### 3.3 Product Positioning

The product is a **digital furniture atelier**, not a generic online marketplace. It should feel like a premium furniture showroom and collaborative design service rather than a conventional checkout experience.

### 3.4 Brand Promise

Customers should feel:

> This is where I can create furniture made specifically for my home.

### 3.5 Customer Outcomes

Customers should be:

- Inspired while discovering products.
- Confident while configuring furniture.
- Informed throughout ordering and production.
- Connected to the workshop.
- Able to understand their current status, next step, and required action.

### 3.6 Business Outcomes

The manager should be able to:

- Operate the digital customer journey through one primary system.
- Control products, configuration options, pricing inputs, content, and visibility without source-code changes.
- Review every project and make all critical commercial decisions.
- Maintain clear customer communication and production status.
- Preserve reliable historical business records.

---

## 4. Product Goals and Success Definition

### 4.1 Product Goals

| ID | Goal |
|---|---|
| G-01 | Digitize the journey from product discovery through delivery or pickup |
| G-02 | Enable customers to configure furniture only within workshop-supported constraints |
| G-03 | Make the quotation, payment, and production process transparent |
| G-04 | Give the manager complete human control over commercial decisions |
| G-05 | Provide a premium Arabic-first mobile experience; English is optional and French is outside Version 1 |
| G-06 | Preserve customer, quotation, order, payment, communication, and production history securely |
| G-07 | Allow content and business configuration to change without application source-code edits |
| G-08 | Keep core business operations functional when AI services are unavailable |

### 4.2 Qualitative Success Criteria

The product succeeds when:

- Customers can confidently create and submit custom-furniture projects.
- The manager can operate the documented workflow through the platform.
- Customers can always understand order state and expected next action.
- Production cannot begin before manager-verified payment.
- Historical orders remain unchanged when the live catalog changes.
- The experience is premium, trustworthy, usable on mobile and desktop, and accessible.
- The platform remains maintainable and capable of future expansion.

### 4.3 Quantitative Success Metrics

The accepted Version 1 measurement set is: submitted-request completion, time to first Manager review, time to quotation, quotation acceptance, payment-review time, production-estimate adherence, completion rate, Customer clarification volume, Manager task backlog, average quotation-preparation time, Customer satisfaction, on-time delivery rate, Order completion rate, and production delay rate. Numeric targets will be set only after a measured baseline; no target is invented in this PRD. Accessibility, performance, reliability, browser, and recovery targets are Accepted in `QUALITY_GATES.md` through `DW-012`.

---

## 5. Release Scope

### 5.1 Fixed Version 1 Business Constraints

- One furniture workshop and one Manager account.
- Customer accounts.
- Made-to-order manufacturing with no ready-stock inventory workflow.
- Bank transfer as the only payment method and manual Manager verification.
- Production begins only after payment verification.
- Arabic as the required default language and RTL foundation. English is optional; French is not in Version 1.
- Mobile-first customer experience.

### 5.2 Version 1 — Core Transaction

Version 1 is narrowed to a complete, operable transaction from discovery to pickup or delivery:

- Arabic-first, RTL-native public storefront; optional English may be included, while French is deferred beyond Version 1.
- Customer registration, authentication, account settings, and private workspace.
- One Manager account and Manager operational workspace.
- Public catalog, normal non-AI search, collections, categories, product detail, basic responsive images/gallery/zoom, informational content, and CMS publication.
- Manager-managed products, catalog structures, translations, content, visibility, media, and bounded configuration choices.
- Basic Product Configuration using only Manager-defined dimensions, materials, fabrics, colors, finishes, and product-specific options.
- Multi-item Customer Projects containing standard and configured items.
- Submitted Request, Manager feasibility review, clarification, and customer-manager messaging.
- Versioned quotations, quotation revisions, customer change requests, and Customer Acceptance.
- Bank-transfer proof upload, replacement after rejection, manual Manager review, and Payment Verification.
- Immutable accepted quotation history and immutable Order Item Snapshots.
- Production tracking that cannot start before verified payment.
- Pickup or delivery fulfilment and completion history.
- Essential in-app and email notifications for Quote Ready, Quote Accepted, Payment Received, Payment Verified, Production Started, Ready, and Delivered events.
- Customer and Manager views required to perform and understand the core transaction.
- Server-enforced authorization, private-file controls, security review, Audit Events, backup/recovery, accessibility, localization, responsive behavior, and performance gates.

### 5.3 Version 1.1 — Proposed Post-Launch Scope

These capabilities remain part of the long-term product but are **proposed**, not approved, for Version 1.1:

| Capability | Proposed phase | Version 1 boundary |
|---|---|---|
| AI recommendations, AI-assisted search, draft translation, summaries, and drafting | Version 1.1 | Version 1 retains normal search, manual content/translation, and no AI dependency |
| Advanced analytics and decision dashboards | Version 1.1 | Version 1 includes only operational queues/status counts and observability needed to run the transaction |
| Push notifications | Version 1.1 | Version 1 essential notifications use in-app and email channels |
| Reviews and Manager responses | Version 1.1 | Completed Orders and after-sales messaging remain available in Version 1 |
| Favorites and Saved Designs | Version 1.1 | Version 1 supports configuring items directly into a draft Customer Project |
| 360° media | Version 1.1 | Version 1 includes basic optimized media; no production asset workflow is documented, so the prior fallback condition has been met |

### 5.4 Resolved 360° Release Phase

Interactive 360° product media is deferred to Version 1.1 under `DR-013`. No production capture/processing workflow or representative asset proof exists in the planning package, so the documented readiness condition for Version 1 is not met. Activation requires `DW-024`; basic responsive images, gallery, and zoom remain Version 1.

### 5.5 Version 1.2 or Later

- Advanced product comparison beyond simple side-by-side customer decision support.
- Worker accounts and workshop workforce management.
- Inventory, suppliers, material stock, and purchase management.
- Multi-store, multi-workshop, multi-business, or multiple-manager administration.
- Online card processing, additional payment gateways, and installments.
- Native mobile applications.
- Full 3D product models, Augmented Reality placement, room visualization, and AI room planning.
- ERP, accounting, CRM, shipping, marketing, and WhatsApp integrations.
- Voice messages, video attachments, and video consultations.
- Customer lifetime value and other capabilities explicitly marked future in the source material.

The Version 1 scope boundary above resolves the former scope ambiguity. Version 1.1 and later phase assignments remain proposed until the product owner approves the roadmap; they must not be pulled into Version 1 implicitly.

---

## 6. Users and Authorization Model

### 6.1 Visitor

A Visitor is an unauthenticated user.

**Allowed:**

- Browse homepage, collections, categories, products, inspiration, and completed projects.
- View product details and public media.
- Search the public catalog.
- Read public business and policy information.
- Change language.

**Not allowed:**

- Save favorites or designs.
- Customize furniture.
- Submit projects.
- Use internal messaging.
- Track orders.
- Leave reviews.

### 6.2 Customer

A Customer is a registered user and the primary product user.

**Allowed:**

- Manage their account and preferences.
- Browse and configure products.
- Create multi-item projects.
- Submit project requests.
- Review and respond to quotations.
- Upload payment proof.
- View their projects and orders.
- Track production and fulfilment.
- Communicate with the manager.
- Receive notifications.
- In Version 1.1 if approved: save Favorites and Saved Designs, and review eligible completed Orders.

**Authorization boundary:** Customers may access only their own private account, projects, designs, quotations, orders, payment proof, messages, files, notifications, and review actions.

### 6.3 Manager

The Manager is the single Version 1 administrator and business operator.

**Allowed:**

- Manage all business content and configuration described in this PRD.
- Review all customer projects.
- Prepare and send quotations.
- Verify payment proof.
- Control production and fulfilment status.
- Communicate with customers.
- Manage translations and publication.
- View operational notifications and core-workflow status queues/counts.
- In Version 1.1 if approved: manage reviews, advanced analytics, and AI-assisted drafts.

The manager must remain the final decision-maker for quotations, payment, production, and publication.

### 6.4 Worker

Worker accounts are a future role and must not be implemented in Version 1.

### 6.5 Accepted Identity Direction and Remaining Policy

Customers authenticate with email and OTP verification. The Manager uses a strong password, MFA, and recovery codes. Customer profile fields beyond the verified email, session rules, Manager emergency continuity, and account closure/export/retention behavior remain open and must not be assumed.

---

## 7. Product and Experience Principles

### 7.1 Mandatory Principles

- Luxury through simplicity and quality, not feature density.
- Visual communication before long textual explanation.
- Arabic-first and RTL-native design.
- Mobile-first layouts and workflows.
- Manager control over business decisions and configuration.
- AI assistance without AI authority.
- Performance as a product feature.
- Accessibility from the beginning.
- Premium, warm, modern, timeless, trustworthy presentation.
- Transparency about current state, next action, estimates, and uncertainty.

### 7.2 Design Behavior

- Use clean layouts, generous spacing, elegant typography, high-quality media, and clear hierarchy.
- Avoid unnecessary elements, excessive animation, and visual distraction.
- Keep controls and interaction patterns consistent across customer and manager surfaces.
- Use smooth and purposeful transitions.
- Ensure important workflows remain comfortable on small screens.
- Use readable typography, sufficient contrast, keyboard accessibility, clear navigation, and responsive layouts.

The accepted design direction uses an accessible warm-neutral palette, paired Arabic/Latin typography, consistent spacing and components, restrained motion, and RTL-first responsive behavior. It should reflect premium Saudi interior brands through elegant typography and generous spacing. WCAG 2.2 AA and the related accessibility thresholds are Accepted in `QUALITY_GATES.md`.

---

## 8. Domain Glossary

| Term | Planning meaning | Remaining decision |
|---|---|---|
| Product | A configurable furniture design template, not stocked inventory | Exact persistence/version model |
| Saved Design | A Version 1.1 proposed unfinished customer configuration | Behavior after product/options change |
| Customer Project | A customer-owned workspace containing one or more standard or configured Project Items | Post-submission reuse/edit policy |
| Project Request | An immutable submitted-project snapshot reviewed by the Manager before payment | Withdrawal and infeasibility policy |
| Quotation | The commercial negotiation container with sequential immutable sent revisions | Expiry and withdrawal policy |
| Quotation Revision | One numbered Manager-authored version of price, timing, delivery, notes, and item snapshots | Quotation-validity period |
| Order | The commercial, payment, production, and fulfilment record created when the Customer accepts the current sent Quotation Revision | Cancellation/refund behavior |
| Payment Proof | Private JPG, PNG, or PDF evidence of full bank transfer | Size limit, exception/reversal rules, and retention period |
| Production Update | Manager-posted progress through the accepted production lifecycle after verified payment | Delay/pause/cancellation policy |
| Fulfilment | Delivery by default or optional workshop pickup, completed only with handoff proof | Scheduling, failure, damage, and dispute rules |
| Review | Rating, written feedback, and optional photos tied to an eligible completed order | Edit/moderation/deletion rules |

`DOMAIN_MODEL.md` is the canonical object glossary. `STATE_MACHINES.md` is canonical for lifecycle and transition contracts. Product Owner decisions are Accepted where identified; narrowed residual policies remain open.

---

## 9. End-to-End Customer Journey

### 9.1 Discover

The visitor explores homepage content, catalog structures, featured products, inspiration, and completed projects.

### 9.2 Register

The visitor creates a customer account before starting a furniture project. The account enables private saved state, communication, and order tracking.

### 9.3 Explore

The customer reviews product images, available interactive media, description, materials, colors, customization options, and estimated starting price. Interactive 360° media is subject to the Version 1 readiness gate.

### 9.4 Choose Configuration Mode

The customer either:

- Selects the product exactly as displayed, or
- Opens the Design Studio and selects only options configured by the manager.

Both paths are part of the same project, quotation, acceptance, payment-verification, production, and fulfilment workflow. Version 1 has no direct checkout path.

### 9.5 Build Project

The customer creates a project containing one or more independently configured items and may edit or remove items before submission.

### 9.6 Submit Request

The customer submits products, configurations, measurements, notes, and optional references. No payment is requested.

### 9.7 Manager Review

The manager evaluates feasibility, final price, production time, delivery cost, and any recommendations. Clarification may occur through messaging.

### 9.8 Quotation Decision

The Customer may accept only the current numbered sent revision, request changes, or decline. Sent revisions remain immutable and every correction requires a new revision. Quotation expiry, request withdrawal/infeasibility, cancellation, and after-sales semantics remain open.

### 9.9 Payment

After acceptance, the customer pays by bank transfer and uploads private proof. The manager manually reviews the proof.

### 9.10 Production

Only verified payment permits production to begin. The manager updates progress and the customer sees the timeline.

### 9.11 Pickup or Delivery

Delivery is the default and pickup is optional. Delivery price and the confirmed Customer address are agreed before acceptance. After the furniture is Ready, successful delivery or pickup requires handoff proof before completion.

### 9.12 Completion and After-Sales

The manager marks successful receipt as complete. The customer may continue communication for future projects and after-sales needs. Reviews are proposed for Version 1.1.

---

## 10. End-to-End Manager Journey

1. Configure store content, catalog, options, media, policies, and visibility.
2. Receive a notification for each submitted project.
3. Review customer information, items, configurations, dimensions, notes, and references.
4. Discuss missing or unclear information with the customer.
5. Prepare and send the quotation.
6. Receive the customer's response.
7. Review uploaded payment proof after acceptance.
8. Verify or reject the proof; production remains blocked until verification.
9. Start production and maintain customer-visible progress.
10. Arrange pickup or delivery and mark successful completion.
11. Continue communication and use operational queues/status counts; review management and advanced analytics are proposed for Version 1.1.

---

## 11. Functional Requirements — Identity and Account

| ID | Classification | Requirement |
|---|---|---|
| IDN-001 | Core Workflow | The system shall allow visitors to create customer accounts before creating/submitting furniture projects. |
| IDN-002 | Core Workflow | The system shall authenticate customers before providing private customer capabilities. |
| IDN-003 | V1 Explicit | The system shall support exactly one manager account in Version 1. |
| IDN-004 | Core Workflow | The system shall enforce role authorization on the server side for customer and manager operations. |
| IDN-005 | Core Workflow | Customers shall access only records and private files that belong to them. |
| IDN-006 | Core Workflow | Only the manager shall access administrative business-management capabilities. |
| IDN-007 | Core Workflow | Customers shall manage personal information, contact details, password, preferred language, and notification preferences. |
| IDN-008 | Core Workflow | Customer authentication shall use email with OTP verification. |
| IDN-009 | Core Workflow | Manager authentication shall require a strong password, MFA, and recovery codes. |

**Acceptance criteria:**

- An unauthenticated visitor cannot access a customer's private workspace or manager functions.
- Customer A cannot access Customer B's private resources.
- A customer cannot call manager operations through direct requests.
- Manager-only business actions are attributable to the manager.
- Customer profile fields beyond verified email, session rules, Manager emergency continuity, and account closure/export/retention remain unresolved; provider selection remains architecture-phase `DW-015`.

---

## 12. Functional Requirements — Storefront, Catalog, and Search

| ID | Classification | Requirement |
|---|---|---|
| CAT-001 | Core Workflow | The public storefront shall expose homepage, collections, categories, products, inspiration, completed projects, company information, and supported-language switching. |
| CAT-002 | Core Workflow | Each product shall belong to one category, one or more collections, and one furniture type. |
| CAT-003 | Core Workflow | A product shall support name, description, images, starting price, materials, colors, options, specifications, production information, media, and status. |
| CAT-004 | Core Workflow | Product statuses shall include Draft, Published, Hidden, Temporarily Unavailable, and Archived. |
| CAT-005 | Core Workflow | Only Published products shall be visible and orderable by customers. |
| CAT-006 | Core Workflow | Archived products shall remain available to historical orders and shall not be orderable again. |
| CAT-007 | Core Workflow | Product media shall support cover image, gallery, and zoom in Version 1. Interactive 360° viewing is deferred to Version 1.1 under `DR-013` and requires `DW-024`. |
| CAT-008 | Core Workflow | The storefront shall support normal catalog search that continues working without AI. |
| CAT-009 | V1.1 Proposed | Product relationships may expose matching furniture, same-collection items, recommended combinations, and frequently ordered items without allowing AI to invent catalog items. |
| CAT-010 | Core Workflow | Displayed product prices shall be identified as starting or estimated prices; final price is manager-confirmed. |

**Acceptance criteria:**

- Draft, Hidden, and Archived products do not appear as available public products.
- A live product update does not alter a historical agreed order.
- A customer sees only materials, colors, and options assigned to the selected product.
- Search remains available when AI services fail.
- No 360° capability ships in Version 1. A later pilot must satisfy the approved asset workflow, accessibility fallback, support matrix, and budgets before Version 1.1 activation.

---

## 13. Functional Requirements — CMS and Localization

| ID | Classification | Requirement |
|---|---|---|
| CMS-001 | Core Workflow | The manager shall create, edit, publish, hide, temporarily disable where supported, and archive customer-facing content without source-code changes. |
| CMS-002 | Core Workflow | The manager shall manage products, categories, collections, materials, colors, options, dimensions, media, and product visibility. |
| CMS-003 | Core Workflow | The manager shall manage homepage hero, featured collections, featured products, banners, inspiration, and custom content blocks. |
| CMS-004 | Core Workflow | Homepage sections shall be enableable, disableable, reorderable, and editable. |
| CMS-005 | Core Workflow | The manager shall manage About, Contact, FAQ, Privacy Policy, Terms and Conditions, and Warranty Information pages. |
| CMS-006 | Core Workflow | The manager shall be able to add additional content pages without source-code changes. |
| LOC-001 | V1 Explicit | Arabic shall be the default and primary content language. |
| LOC-002 | Product Owner Accepted | English is optional in Version 1; French is outside Version 1. |
| LOC-003 | Core Workflow | All customer-facing text shall be localizable and shall not be hardcoded into the application. |
| LOC-004 | Core Workflow | Localization shall cover UI, catalog, CMS, notifications, email, validation, errors, policies, and customer communication where templated. |
| LOC-005 | Core Workflow | Every translation, whether human- or AI-assisted, shall require human Manager approval before publication. |
| LOC-006 | Core Workflow | The complete application shall support RTL from the beginning. |

**Acceptance criteria:**

- The manager can publish and unpublish content without a code deployment.
- Arabic is presented RTL across public, customer, and manager workflows.
- Arabic content is required. Any English content included in the release must pass the approved checks for its published scope. French is not a Version 1 release requirement.
- Unapproved AI translation is never shown publicly.
- Content lifecycle, English fallback, draft completeness, correction, retirement, and version-retention behavior remain open.

---

## 14. Functional Requirements — Basic Product Configuration and Saved Designs

| ID | Classification | Requirement |
|---|---|---|
| DSG-001 | Core Workflow | Every configurable product shall provide access to the Design Studio for authenticated customers. |
| DSG-002 | Core Workflow | The Design Studio shall expose only options configured for the selected product. |
| DSG-003 | Core Workflow | Supported option categories may include dimensions, materials, fabrics, colors, finishes, and product-specific choices. |
| DSG-004 | Core Workflow | A product may define independent minimum, maximum, fixed, or free dimension constraints. |
| DSG-005 | Core Workflow | The Design Studio shall prevent configurations the workshop cannot manufacture. |
| DSG-006 | Core Workflow | Validation shall cover invalid dimensions, unsupported materials, unavailable colors, and configured option conflicts. |
| DSG-007 | Core Workflow | Customer changes should update the preview immediately whenever the available media/configuration method supports it. |
| DSG-008 | Core Workflow | The Design Studio may display an estimated starting price, never a manager-approved final quotation. |
| DSG-009 | V1.1 Proposed | Authenticated customers may save unfinished designs and later edit, duplicate, share with the Manager, or add them to a project. Advanced comparison is Version 1.2 or later. |
| DSG-010 | Core Workflow | Each project item shall preserve its own selected configuration. |

**Acceptance criteria:**

- A customer cannot select a value unavailable for that product.
- An invalid configuration cannot be submitted.
- Version 1 configuration can be added directly to a draft Customer Project without a Saved Design.
- Before Version 1.1 Saved Designs ship, reopening behavior and behavior after catalog/configuration changes require `DW-019`.
- Version 1 configuration is limited to the source-backed rule types in `DR-005`; a generalized rules engine or unspecified formula language is not authorized.

---

## 15. Functional Requirements — Projects, Quotations, and Orders

### 15.1 Projects

| ID | Classification | Requirement |
|---|---|---|
| PRJ-001 | Core Workflow | A customer shall create a project containing one or more standard or configured furniture items. |
| PRJ-002 | Core Workflow | Each project item shall retain its own product and configuration information. |
| PRJ-003 | Core Workflow | The customer shall add, edit, or remove project items while the project is a draft. |
| PRJ-004 | Core Workflow | A submitted request shall include selected items, configurations, measurements, notes, and optional reference images. |
| PRJ-005 | Core Workflow | Submission shall not request or collect payment. |
| PRJ-006 | Core Workflow | The manager shall receive and review every submitted request. |
| PRJ-007 | Core Workflow | Submission shall create a distinct Submitted Request snapshot without converting the Customer Project directly into an Order. |

### 15.2 Quotations

| ID | Classification | Requirement |
|---|---|---|
| QUO-001 | Core Workflow | Only the manager shall prepare the final quotation. |
| QUO-002 | Core Workflow | A quotation shall include final price, estimated production time, delivery cost/details when applicable, and additional notes or recommendations. |
| QUO-003 | Core Workflow | The manager may seek clarification before sending the quotation. |
| QUO-004 | Core Workflow | The customer shall review the quotation before payment. |
| QUO-005 | Core Workflow | The customer shall accept the quotation or request changes. |
| QUO-006 | Core Workflow | No payment shall be requested until both parties agree. |
| QUO-007 | Core Workflow | A Quotation shall preserve each Quotation Revision and identify the currently actionable sent revision. |
| QUO-008 | Core Workflow | Sending a Quotation Revision shall make that revision and its Quotation Items immutable; changes require a new revision. |
| QUO-009 | Core Workflow | Customer Acceptance shall identify exactly one sent Quotation Revision and preserve immutable acceptance evidence. |
| QUO-010 | Product Owner Accepted | The default quotation currency shall be SAR and shall be configurable as a business setting. |
| QUO-011 | Product Owner Accepted | Quotations shall show a detailed price breakdown and configurable taxes. Rounding, discount, and legal tax-presentation rules remain open. |
| QUO-012 | Product Owner Accepted | Version 1 shall require full payment by bank transfer; deposits are deferred to a future release. |

### 15.3 Orders and History

| ID | Classification | Requirement |
|---|---|---|
| ORD-001 | Core Workflow | Every commercial order shall preserve its own history. |
| ORD-002 | Core Workflow | Historical orders shall remain unchanged when products, prices, materials, colors, media, or availability change. |
| ORD-003 | Core Workflow | Customers shall view quotation, payment state, production, delivery information, timeline, and order history. |
| ORD-004 | Core Workflow | The manager shall update order status, production progress, production notes, fulfilment, and completion. |
| ORD-005 | Core Workflow | Customers shall always be shown the current state, expected next step, required action, production estimate where available, and payment state. |
| ORD-006 | Product Owner Accepted | Accepting the current sent Quotation Revision shall create one Order and immutable Order Item Snapshots in an Awaiting Payment state. |

**Acceptance criteria:**

- A draft can be edited. Direct editing ends at submission; later clarification is appended rather than rewriting the submitted snapshot. Withdrawal, infeasibility, and cancellation policy remain open.
- No payment action is enabled before an approved customer response to a manager quotation.
- Sent and accepted Quotation Revisions and historical Order Item Snapshots cannot be edited in place and are insulated from later catalog edits.
- State transitions that violate the approved lifecycle are rejected by the system.
- The accepted object boundaries and acceptance-to-Order point are defined in `DOMAIN_MODEL.md`; allowed transitions are defined in `STATE_MACHINES.md`.
- Numbered sent revisions, current-revision-only acceptance, recorded changes/declines, new-revision corrections, and immutable acceptance evidence are Accepted. Expiry duration, withdrawal, infeasibility, reopening, and cancellation remain open.

---

## 16. Functional Requirements — Payment Verification

| ID | Classification | Requirement |
|---|---|---|
| PAY-001 | V1 Explicit | Bank transfer shall be the only Version 1 payment method. |
| PAY-002 | Core Workflow | The platform shall not process or store payment-card information. |
| PAY-003 | Core Workflow | A customer shall upload payment proof only after quotation acceptance. |
| PAY-004 | Core Workflow | Payment proof shall be accessible only to the manager and the customer who uploaded it. |
| PAY-005 | Core Workflow | The manager shall view payment proof and accept it, reject it, or request replacement proof. |
| PAY-006 | Core Workflow | Payment verification shall be a manual manager decision. |
| PAY-007 | Core Workflow | Production shall never begin before successful payment verification. |
| PAY-008 | Core Workflow | The customer shall receive the resulting payment state. |
| PAY-009 | Product Owner Accepted | Version 1 shall require full bank-transfer payment; deposits are deferred. |
| PAY-010 | Product Owner Accepted | Payment proof shall accept JPG, PNG, and PDF only; every submission shall remain in history and shall not be overwritten or deleted automatically. |

**Acceptance criteria:**

- An unauthorized user cannot discover or retrieve payment proof.
- Uploading proof does not automatically verify payment or start production.
- A rejected proof does not satisfy the production gate.
- Every verification outcome is attributable to the manager.
- File-size limits, partial/over/duplicate/incorrect payment handling, mistaken-verification correction, and the legally appropriate manual retention/deletion policy remain open. Nothing is deleted automatically.

---

## 17. Functional Requirements — Production and Fulfilment

| ID | Classification | Requirement |
|---|---|---|
| PRD-001 | Core Workflow | Only payment-verified orders shall enter production. |
| PRD-002 | Core Workflow | The manager shall start and update production progress. |
| PRD-003 | Core Workflow | The customer shall see manager-published progress in an order timeline. |
| PRD-004 | Product Owner Accepted | Production shall progress through Not Started → Materials Preparation → In Production → Quality Inspection → Ready. Failed inspection returns the work to In Production. |
| PRD-005 | Core Workflow | Production estimates shall be represented as estimates rather than guarantees. |
| PRD-006 | Product Owner Accepted | Version 1 production shall be tracked once per Order. Order Items remain first-class immutable records but shall not have independent production states or timelines. |
| FUL-001 | Core Workflow | Fulfilment shall support workshop pickup and delivery to the customer's location. |
| FUL-002 | Core Workflow | The manager shall notify the customer when furniture is ready. |
| FUL-003 | Core Workflow | The manager shall mark the order complete after successful receipt. |
| FUL-004 | Core Workflow | Production and fulfilment history shall remain available after completion. |
| FUL-005 | Product Owner Accepted | Delivery shall be the default fulfilment method and pickup shall be optional. Delivery price and Customer address shall be confirmed before quotation acceptance. |
| FUL-006 | Product Owner Accepted | Successful delivery or pickup shall require handoff proof before the Order is completed. |

**Acceptance criteria:**

- An unverified order cannot enter a production state through UI or direct request.
- The customer sees every published progress update in chronological context.
- The system distinguishes pickup from delivery.
- The production sequence and inspection-rework transition are Accepted. Delay, pause, cancellation, service-area, scheduling, failed-attempt, damage, refusal, partial handoff, dispute, and after-sales rules remain open.

---

## 18. Functional Requirements — Communication and Notifications

### 18.1 Messaging

| ID | Classification | Requirement |
|---|---|---|
| MSG-001 | Core Workflow | Customers and the manager shall communicate through a continuous built-in conversation. |
| MSG-002 | Core Workflow | Messaging shall support text, images, documents, and reference photos. |
| MSG-003 | Core Workflow | Customers shall not access other customers' conversations. |
| MSG-004 | Core Workflow | Messaging shall support questions, configuration clarification, measurements, quotations, production updates, and support. |
| MSG-005 | Core Workflow | Communication shall remain available after order completion for future projects and after-sales needs. |

### 18.2 Notifications

| ID | Classification | Requirement |
|---|---|---|
| NTF-001 | Core Workflow | Version 1 shall support essential localized in-app and email notification channels. Push is proposed for Version 1.1. |
| NTF-002 | Product Owner Accepted | Version 1 customer events shall include Quote Ready, Quote Accepted, Payment Received, Payment Verified, Production Started, Ready, and Delivered. |
| NTF-003 | Core Workflow | Manager events shall include registration, project submission, customer messages, quotation response, and payment proof where applicable; review events apply only if the Version 1.1 review scope is approved. |
| NTF-004 | Core Workflow | Unread in-app notifications shall be visually distinguishable. |
| NTF-005 | Core Workflow | Customers shall manage notification preferences. |
| NTF-006 | Core Workflow | Notification content shall be localized. |

**Acceptance criteria:**

- A customer receives no private message or event belonging to another customer.
- Important state changes produce the configured notification event.
- Channel failures do not change the authoritative business state.
- The conversation is one continuous thread linked to the relevant Project or Order. Each accepted event uses email and in-app notification. Message/notification retention, preference rules, failed-delivery handling, and the email provider remain open; WhatsApp is deferred.

---

## 19. Functional Requirements — Dashboards, Reviews, Analytics, and AI

### 19.1 Customer Dashboard

| ID | Classification | Requirement |
|---|---|---|
| CDB-001 | Core Workflow | The customer dashboard shall summarize active projects, order state, pending quotations, recent notifications, messages, and other documented activity where available. |
| CDB-002 | Core Workflow | Version 1 customers shall access My Projects, My Orders, Messages, Notifications, and Account Settings. Saved Designs, Favorites, and Reviews are proposed for Version 1.1. |
| CDB-003 | Core Workflow | Project listings shall show project name, item count, status, creation date, last update, and estimated completion where available. |
| CDB-004 | Core Workflow | Order detail shall expose the customer's quotation, payment state, production, fulfilment, and timeline. |

### 19.2 Manager Dashboard

| ID | Classification | Requirement |
|---|---|---|
| MDB-001 | Core Workflow | The Manager dashboard shall surface work requiring attention, including requests, quotations, payment proof, active production, fulfilment, messages, notifications, and core operational status counts. |
| MDB-002 | Core Workflow | The Version 1 dashboard shall provide access to catalog, CMS, requests, quotations, payment verification, Orders, communication, notifications, and settings. Reviews and advanced analytics are proposed for Version 1.1. |
| MDB-003 | Core Workflow | Settings shall include business information, contact details, supported delivery methods, notification preferences, languages, and general platform configuration as defined by approved decisions. |

### 19.3 Reviews

Reviews are **V1.1 Proposed** and do not block Version 1.

| ID | Classification | Requirement |
|---|---|---|
| REV-001 | V1.1 Proposed | Only an eligible completed Order shall support a customer review. |
| REV-002 | V1.1 Proposed | A review may contain a rating, written feedback, and optional photos. |
| REV-003 | V1.1 Proposed | The Manager may view and reply to reviews. |
| REV-004 | V1.1 Proposed | The Manager shall not edit customer reviews. |

Review eligibility wording, customer edits, moderation, deletion, and photo publication require `DW-020` before Version 1.1.

### 19.4 Analytics

Advanced product, customer, conversion, and decision analytics are **V1.1 Proposed**. Version 1 is limited to the operational queues/status counts and technical observability required to operate and protect the core transaction.

If Version 1.1 scope is approved, analytics may support the documented categories:

- Business: customers, requests, quotations, acceptance, completed/cancelled orders, revenue, average order value.
- Products: views, orders, customizations, collections, and categories.
- Customization: colors, materials, dimensions, options, and combinations.
- Customers: registrations, returning users, activity, and history.
- Orders: review, quotation, payment, production, readiness, and completion pipeline.
- Search: keywords, no-result searches, categories, and filters.

Metric formulas, identity handling, consent, retention, and display periods require `DW-021` before Version 1.1 analytics.

### 19.5 AI

AI capabilities are **V1.1 Proposed**, subject to provider, grounding, evaluation, privacy, and cost decisions. Version 1 shall not depend on an AI provider.

**Permitted AI assistance:**

- Product discovery and natural-language search.
- Recommendations grounded in real published products.
- Color, material, and matching-product suggestions.
- Arabic-to-English draft translation if optional English is activated; French translation is outside Version 1.
- Product description, SEO text, CMS organization, conversation summaries, and manager reply suggestions.

**Prohibited AI authority:**

- Approving quotations.
- Approving or verifying payment.
- Approving production.
- Modifying customer orders automatically.
- Changing business settings automatically.
- Publishing content without manager approval.
- Inventing products or unavailable configurations.

**Required degradation:** Catalog browsing, normal search, projects, quotations, payments, messaging, orders, and CMS shall continue when AI is unavailable.

---

## 20. Business Rules and Invariants

These rules override implementation convenience.

| ID | Invariant |
|---|---|
| BR-001 | Version 1 serves one business and one manager. |
| BR-002 | Products are configurable templates, not inventory items. |
| BR-003 | Customers may use only manager-configured options. |
| BR-004 | A project may contain multiple independently configured items. |
| BR-005 | A draft project is editable until submission. |
| BR-006 | Every order begins through a submitted project and manager review, not immediate checkout. |
| BR-007 | No payment is requested before manager quotation and customer agreement. |
| BR-008 | The manager determines the final price. |
| BR-009 | Version 1 uses bank transfer and manual manager verification. |
| BR-010 | Production never begins before verified payment. |
| BR-011 | Sent and accepted Quotation Revisions and historical Order Item Snapshots remain unchanged when live catalog data changes and cannot be edited in place. |
| BR-012 | Customers access only their own private data. |
| BR-013 | Payment proof and private uploads are not public. |
| BR-014 | If Version 1.1 Reviews are approved, only eligible completed Orders may be reviewed. |
| BR-015 | If Version 1.1 AI assistance is approved, AI assists and humans decide. |
| BR-016 | AI availability must never be required for core business operations. |
| BR-017 | If AI-generated translation is introduced, human Manager approval is required before publication. |
| BR-018 | Arabic is required and RTL is foundational; English is optional and French is outside Version 1. |
| BR-019 | Business content and supported configuration are managed without source-code changes. |
| BR-020 | An Order is created when the Customer accepts the current sent Quotation Revision; production remains blocked until manual payment verification. |
| BR-021 | Version 1 default currency is configurable SAR and Version 1 accepts full bank-transfer payment only. |
| BR-023 | Delivery is the default fulfilment method; pickup is optional; successful handoff requires proof. |

---

## 21. Non-Functional Requirements

### 21.1 Security and Privacy

| ID | Requirement |
|---|---|
| SEC-001 | Authentication and authorization shall be foundational architectural controls. |
| SEC-002 | Authorization shall be enforced for every private record and file. |
| SEC-003 | The platform shall collect only data required to operate the business. |
| SEC-004 | Customer information shall not be exposed to unauthorized users. |
| SEC-005 | Payment proof shall be private to its customer and the manager. |
| SEC-006 | Customer uploads shall remain private unless intentionally published by the manager. |
| SEC-007 | Orders, quotations, and project history shall be protected from accidental loss. |
| SEC-008 | Sent/accepted quotation history and Order Item Snapshots shall be immutable. |
| SEC-009 | Privileged business actions and failed privileged attempts shall create the approved Audit Events. |

Server-enforced authorization and public/private storage separation are Accepted in ADR-004 and ADR-005. Accepted classifications are Public (Products and Portfolio), Private (Customers and Orders), Sensitive (Payment proof), and Restricted (Internal notes and Audit logs), with everything private by default. Encryption, retention/deletion, upload scanning, session hardening, incident response, data residency, consent, audit taxonomy, and Manager emergency continuity remain unresolved.

### 21.2 Localization and RTL

- Arabic is the default locale and every Version 1 route must render correctly in RTL.
- English is optional in Version 1. If included, it must satisfy the approved checks for its published scope. French is outside Version 1.
- UI, content, notification, validation, error, policy, and email text must be localizable.
- The accepted target is 100% Arabic UI-key completeness, no raw keys or unintended fallback, no unintended horizontal overflow, locale-correct formats, and successful Arabic critical-workflow tests. Included English scope must meet its corresponding checks.
- Full criteria are `Q-L10N-001` through `Q-L10N-007` in `QUALITY_GATES.md`; English fallback and content-publication details remain open.

### 21.3 Accessibility

- **Accepted:** conform to WCAG 2.2 Level AA across every Version 1 customer and Manager workflow.
- **Accepted release thresholds:** zero known critical accessibility violations and zero known unresolved WCAG 2.2 A/AA failures.
- Keyboard operation, visible/unobscured focus, screen-reader review, zoom/reflow, forms/errors, contrast, authentication, and text alternatives must be verified as defined by `Q-A11Y-001` through `Q-A11Y-005`.
- These values were Accepted through `DW-012` on 2026-07-16.

### 21.4 Performance

- **Accepted Core Web Vitals at p75:** LCP ≤ 2.5 seconds, INP ≤ 200 milliseconds, and CLS ≤ 0.1, measured separately for mobile and desktop when field data is sufficient.
- **Accepted core-route mobile budgets:** initial compressed JavaScript ≤ 200 KiB; CSS ≤ 75 KiB; non-media transfer ≤ 500 KiB; total initial page weight ≤ 1.5 MiB; repeatable Lighthouse mobile performance score ≥ 90.
- **Accepted server processing targets:** cached/simple reads p95 ≤ 250 ms; standard transactional reads p95 ≤ 400 ms; standard state-changing operations p95 ≤ 800 ms under an approved normal-load profile.
- **Accepted image budgets:** catalog thumbnail ≤ 80 KiB, gallery variant ≤ 300 KiB, and initially loaded hero variant ≤ 400 KiB.
- **Accepted 360° budgets:** poster ≤ 250 KiB, assets required before interaction ≤ 1 MiB, and complete progressively loaded set ≤ 12 MiB per Product when the deferred feature is activated.
- Measurement profiles and all values are governed by `Q-WEB-*`, `Q-PERF-*`, `Q-API-*`, and `Q-MED-*` of `QUALITY_GATES.md`.

### 21.5 Reliability and Continuity

- Core workflows must continue without AI, advanced analytics, push, or an external notification-channel response.
- Historical commercial records must survive live content changes.
- **Accepted availability:** core customer and Manager workflows ≥ 99.9% monthly, excluding approved maintenance windows.
- **Accepted error thresholds:** core API server errors < 0.5% and unhandled client-error sessions < 0.5% over a rolling 30-day window; zero known data-loss defects or authorization bypasses at release.
- **Accepted recovery targets:** transactional-data RPO ≤ 1 hour and core-service RTO ≤ 4 hours, with a documented private-file recovery process and restore tests at least monthly and before major production migrations.
- Retention, geographic-copy, and incident-response procedures remain open; see `Q-REL-*` and `Q-DR-*`.

### 21.6 Maintainability and Scalability

- Business logic, UI, data management, and integrations should have clear responsibilities.
- Business configuration should not require code changes where the CMS is responsible.
- Provider-specific AI and other integrations should not control core business logic.
- Version 1 remains a single-business product; future seams may be preserved without implementing multi-tenancy or speculative services.
- The approved stack, providers, deployment topology, and implementation constraints are recorded in `ARCHITECTURE.md` and `ADR_INDEX.md`; this PRD does not redefine them.
- The modular monolith, relational data category, durable side effects/jobs, provider boundaries, localization, audit, and single-business posture are Accepted architecture constraints.

### 21.7 Browser and Device Support

The Accepted support matrix is the latest two stable desktop Chrome, Edge, and Firefox versions; current and previous major macOS Safari/iOS Safari; latest two Android Chrome versions; and representative widths 360, 390, 412, 768, 1024, 1280, and 1440 px using relevant touch, keyboard, mouse/pointer, and assistive-technology paths. Internet Explorer is not supported. The physical-device list and test network profile are reviewed as required by `QUALITY_GATES.md`.

### 21.8 Global Definition of Done

Every feature and release must satisfy the global Definition of Done in `QUALITY_GATES.md`. It includes business acceptance, server authorization, type checking, linting, unit/integration/Playwright tests, Arabic RTL verification, English verification when included, mobile/desktop verification, accessibility, complete loading/empty/error/success states, no console errors, production build, documentation, security/privacy review where applicable, and performance-budget compliance. Exceptions require written approval and cannot waive production/payment, authorization, privacy, or historical-immutability invariants.

---

## 22. Decision Status and Workshop Register

`DECISION_WORKSHOP.md` is the single canonical register for every remaining decision. The former 60 `OD-*` entries have been evaluated, deduplicated, and mapped to 24 `DW-*` decisions. Legacy IDs remain only in the workshop coverage index for traceability.

### 22.1 Resolved from Existing Documentation

The following rules are no longer Open Decisions:

- Single-business, single-Manager Version 1 with excluded worker/inventory/supplier/multi-store scope (`DR-001`).
- No direct checkout; every path uses request, Manager quotation, Customer agreement, bank transfer, and verification (`DR-002`).
- Projects are editable only before submission; submitted content is not silently rewritten (`DR-003`).
- Customer account requirement and Visitor restrictions (`DR-004`).
- Bounded basic Version 1 configuration types; no generalized rules engine (`DR-005`).
- Manager-controlled final pricing and estimate/final-quote distinction (`DR-006`).
- Bank-transfer/manual-verification/private-proof contract (`DR-007`).
- Absolute verified-payment production gate (`DR-008`).
- One continuous Customer-Manager conversation (`DR-009`).
- Public/published versus private Customer-file boundary (`DR-010`).
- Arabic RTL and first-class localization (`DR-011`), subsequently revised by the Product Owner to require Arabic, make English optional, and remove French from Version 1 (`DW-011`).
- Immutable accepted quotation and historical Order records (`DR-012`).
- 360° deferred to Version 1.1 because no production asset workflow exists (`DR-013`).
- Version 1 in-app/email notification boundary; push deferred (`DR-014`).
- Mandatory global Definition of Done (`DR-015`).
- Server-side authorization, storage separation, first-class localization, and single-business architecture constraints (`DR-016`).

The evidence and affected legacy IDs are documented in `DECISION_WORKSHOP.md`.

### 22.2 Product Owner Decisions — Integrated 2026-07-16

| ID | Status | Integrated decision or residual question |
|---|---|---|
| DW-001 | Accepted | Order is created on Customer acceptance of the current quotation; production still requires manually verified payment. |
| DW-002 | Partially Accepted | Submitted content locks; sent revisions are numbered and immutable; only the current revision may be accepted; changes/declines are recorded. Expiry, withdrawal, infeasibility, and reopening remain open. |
| DW-003 | Partially Accepted | Default configurable currency is SAR; detailed breakdown and configurable taxes; full bank transfer only in Version 1; deposits later. Rounding, discounts, and legal tax presentation remain open. |
| DW-004 | Partially Accepted | JPG/PNG/PDF only; every submission retained in history; manual Manager verification; no automatic deletion. Size limit, payment exceptions, mistaken-verification correction, and retention period remain open. |
| DW-005 | Governance Accepted; Policy Open | The Manager-defined policy must comply with Saudi regulations and remain configurable. The actual stage-based cancellation/refund/return/warranty/repair/dispute policy is not yet supplied. |
| DW-006 | Partially Accepted | Not Started → Materials Preparation → In Production → Quality Inspection → Ready; failed inspection returns to In Production; Version 1 tracking is Order-level. Remaining delay/pause/cancellation/correction choices are policy/configuration. |
| DW-007 | Partially Accepted | Delivery default; pickup optional; delivery price and address confirmed before acceptance; handoff proof required. Service area, scheduling, failures, refusal, damage, partial handoff, and disputes remain open. |
| DW-008 | Partially Accepted | Customer email + OTP; Manager strong password + MFA + recovery codes. Profile fields, sessions, account rights, emergency continuity, and closure/export/retention remain open. |
| DW-009 | Partially Accepted | Public: Products/Portfolio; Private: Customers/Orders; Sensitive: Payment proof; Restricted: Internal notes/Audit logs; everything private by default. Validation, scanning, retention/deletion, recovery, and publication controls remain open. |
| DW-010 | Partially Accepted | One Project/Order-linked continuous conversation; seven named events use email + in-app; WhatsApp later. Preferences, retention, and failed-delivery behavior remain open. |
| DW-011 | Partially Accepted | Arabic required; English optional; French removed from Version 1; human translation approval required. Content lifecycle, fallback, correction, retirement, and version retention remain open. |
| DW-012 | Accepted | All current `QUALITY_GATES.md` Version 1 targets accepted, subject to the more specific `DW-011` language scope. |
| DW-013 | Accepted | Accessible warm-neutral, paired-type, consistent, restrained-motion, RTL-first system reflecting premium Saudi interior brands. |
| DW-014 | Accepted | Recommended outcome set accepted with five added measures; numeric targets follow baseline measurement. |

#### 22.2.1 Strict Residual Classification

The stricter Product Owner review found **no true remaining Architecture Blocker**:

- `AB-004` is resolved: Version 1 production is Order-level; Order Items remain first-class without item-level production lifecycles.
- Former `AB-001` through `AB-003` and `AB-005` through `AB-009` are reclassified as Business Policy, Configuration, or Implementation Detail.
- `BP-001` through `BP-010` remain required before affected policy/feature release.
- `CFG-001` through `CFG-008` remain configurable decisions.
- `IMP-001` through `IMP-007` are resolved during `DW-015` through `DW-017`.

Architecture Readiness is **100% on the pre-architecture-blocker basis**. This status authorizes architecture only when explicitly requested; it does not approve application code.

### 22.3 Priority 1 — Completed and Approved During Architecture

| ID | Canonical decision |
|---|---|
| DW-015 | Accepted through ADR-001, ADR-002, and ADR-012 through ADR-018 |
| DW-016 | Accepted through ADR-013, ADR-014, ADR-016, ADR-021, and ADR-024, subject to staged provider adoption and residual configuration |
| DW-017 | Accepted through ADR-006 through ADR-008, ADR-010, and ADR-019, ADR-020, ADR-022 |

### 22.4 Priority 2 — Deferred; Does Not Block Version 1 Architecture

| ID | Canonical decision |
|---|---|
| DW-018 | Post-Version 1 roadmap approval |
| DW-019 | Saved Design and Favorite lifecycle |
| DW-020 | Review eligibility, editing, moderation, photos, and Manager response |
| DW-021 | Advanced analytics taxonomy, consent, formulas, retention, and provider |
| DW-022 | AI scope, provider, grounding, privacy, evaluation, cost, and safety |
| DW-023 | Push notification activation and provider |
| DW-024 | 360° asset workflow and activation gate |

No Priority 2 decision may be used to expand Version 1 implicitly. Every recommendation, alternative, advantage, disadvantage, risk, database/API/UI/business impact, and recommended final choice is documented in `DECISION_WORKSHOP.md`; none is selected on the product owner’s behalf.

---

## 23. Risks and Mitigations

| ID | Severity | Risk | Required response |
|---|---:|---|---|
| R-01 | Critical | Architecture turns Business Policy or Configuration choices into hardcoded assumptions | Preserve `BP-*`/`CFG-*` configurability and document `IMP-*` choices during architecture |
| R-02 | Critical | Payment proof and private attachments are handled without full security controls | Approve security/file/privacy decisions before upload implementation |
| R-03 | High | Proposed later-phase assignments are pulled back into Version 1 without approval | Approve the roadmap and enforce the Section 5 boundary |
| R-04 | High | Catalog changes alter agreed commercial history | Store immutable quotation and order snapshots |
| R-05 | High | Ambiguous states permit impossible or unsafe workflow transitions | Approve and enforce one lifecycle state machine |
| R-06 | High | Single-manager absence or account loss stalls the business | Define recovery and continuity operations |
| R-07 | High | Generic configurable rules become complex and unsafe | Restrict Version 1 to approved concrete rule types |
| R-08 | High | High-resolution and 360° media harm mobile performance | Approve asset pipeline and quantitative budgets |
| R-09 | High | Arabic RTL or optional-English localization regresses across workflows | Enforce the Accepted language test matrix and define the remaining content lifecycle |
| R-10 | Medium-High | Messaging becomes ambiguous across concurrent projects | Add approved contextual linkage while preserving continuous inbox UX |
| R-11 | Medium-High | Notifications duplicate, disappear, or use incorrect language | Define durable delivery, idempotency, preferences, and logs |
| R-12 | Medium-High | Analytics collects unnecessary data or produces undefined metrics | Approve consent, taxonomy, retention, and formulas |
| R-13 | Medium | AI invents products/configurations or publishes poor content | Ground results, require review, evaluate quality, preserve fallback |
| R-14 | Medium | Future-proofing creates premature complexity | Preserve module seams without speculative infrastructure |
| R-15 | Medium | Accepted quality targets remain unmeasured | Collect evidence against `QUALITY_GATES.md` throughout architecture and delivery |

---

## 24. Delivery and Release Gates

These gates come from the readiness risks in `PROJECT_AUDIT.md`; they do not add customer-facing business functionality.

### Gate 1 — Product Contract Approved

**Current status:** Satisfied for architecture entry.

- Version 1 scope matrix approved.
- `DOMAIN_MODEL.md`, including `DM-001`, approved or revised.
- `STATE_MACHINES.md` approved or revised with no unlisted business transitions assumed.
- Product Owner decisions integrated.
- No true Architecture Blocker remains; `AB-004` is resolved and all other former `AB-*` items are reclassified.
- Business Policy and Configuration Decisions remain tracked for affected feature/release approval.

### Gate 2 — Architecture and Security Approved

**Current status:** Satisfied.

- Every architecture/provider ADR is Accepted with its recorded conditions.
- Application architecture and provider review are approved.
- Authorization and sensitive-file architecture plus the detailed database/API authorization matrix are approved.
- Provider, deployment, backup, recovery, and observability decisions are recorded.

### Gate 3 — Core Workflow Verified

- Customer and manager authorization tested.
- Project-to-quotation-to-payment-verification flow tested.
- Production-before-payment invariant tested through UI and direct requests.
- Historical snapshot immutability tested.
- Private file access tested.
- The applicable global Definition of Done in `QUALITY_GATES.md` satisfied.

### Gate 4 — Experience Verified

- Arabic RTL tested; included English scope tested; French is not a Version 1 gate.
- Mobile and desktop workflows tested against the approved support matrix.
- Accessibility and performance targets met.
- Basic catalog media meets approved budgets; 360° is not a Version 1 release gate.

### Gate 5 — Operational Release Approved

- Backup restoration and rollback verified.
- Monitoring and incident procedures operational.
- Business Policy Decisions applicable to the release and localized customer policies approved.
- Manager acceptance test completed.
- Approved availability, error-rate, backup/recovery, accessibility, localization, browser, and performance evidence completed.
- No unresolved Business Policy Decision affects the release.

---

## 25. Implementation Planning Delivery Sequence

The complete proposed P0–P9 sequence, G0–G9 gates, task dependencies, safe parallel lanes and release controls are defined in the implementation-planning package. At summary level:

1. P0 establishes the delivery, module, test, Arabic RTL and quality foundation.
2. P1 proves trusted data, identity, authorization/RLS, audit and durable operations.
3. P2 delivers Catalog/CMS/search and secure file foundations.
4. P3 delivers Customer Projects, immutable submission, clarification and Messaging.
5. P4 delivers Quotations, Acceptance and immutable Orders.
6. P5 delivers sensitive bank-proof submission and manual Payment Verification.
7. P6 delivers Order-level Production and pickup/delivery completion.
8. P7 completes Customer/Manager workspaces and essential Notifications.
9. P8 qualifies one release candidate against every accepted Quality Gate.
10. P9 verifies production policy/configuration/providers/runbooks and obtains launch authorization.

`BP-001` through `BP-010` and `CFG-001` through `CFG-008` run in parallel as affected feature/release gates. Version 1.1/later work remains outside this sequence until separately approved.

---

## 26. Traceability Matrix

### 26.1 Companion Planning Documents

| Concern | Canonical planning document |
|---|---|
| Business objects, ownership, mutability, history, and proposed Project-to-Order point | `DOMAIN_MODEL.md` |
| Allowed lifecycle states, transitions, actors, guards, effects, audit, and recovery | `STATE_MACHINES.md` |
| Proposed architectural constraints and required approvals | `ARCHITECTURE_DECISIONS.md` |
| Accepted measurable targets and global Definition of Done | `QUALITY_GATES.md` |
| Resolved decisions, remaining questions, recommendations, alternatives, and impact analysis | `DECISION_WORKSHOP.md` |
| Current milestone and prohibited implementation interpretations | `GOAL.md` and `ANTI_PATTERNS.md` |
| Readiness scores, blockers, missing documents, and architecture recommendation | `IMPLEMENTATION_READINESS_REPORT.md` |
| Approved database, migration, authorization, API, error, idempotency, and validation design | `DATABASE_DESIGN.md`, `MIGRATION_STRATEGY.md`, `AUTHORIZATION_MODEL.md`, `API_CONTRACTS.md`, `ERROR_MODEL.md`, `IDEMPOTENCY_RULES.md`, and `VALIDATION_STRATEGY.md` |
| Proposed implementation phases, task ownership, dependency order, testing, release, risk and execution gates | `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PHASES.md`, `IMPLEMENTATION_BACKLOG.md`, `MODULE_IMPLEMENTATION_ORDER.md`, `DEPENDENCY_GRAPH.md`, `TEST_IMPLEMENTATION_PLAN.md`, `RELEASE_PLAN.md`, `IMPLEMENTATION_RISKS.md`, and `IMPLEMENTATION_CHECKLIST.md` |
| Current implementation-planning readiness verdict | `IMPLEMENTATION_REVIEW_REPORT.md` |

### 26.2 Source Traceability

| PRD area | Primary knowledge source | Audit contribution |
|---|---|---|
| Vision, mission, brand | Sections 1, 2, 4, 26 | Executive Summary, Business Knowledge Review |
| Languages and RTL | Sections 4, 5, 22, 23 | Risks R-09; missing localization specification |
| Roles and authorization | Sections 6, 12, 13, 18, 21 | Security and identity gaps |
| Customer journey | Section 7 | Domain ambiguity and missing decisions |
| Manager journey | Section 8 | Single-manager operational risk |
| Catalog | Sections 9, 14, 21 | Configurability and historical-snapshot risks |
| Design Studio | Sections 10, 21 | Rule-engine and media risks |
| Projects, quotations, orders | Sections 7, 8, 11, 21 | Lifecycle/state/revision gaps |
| Payment | Sections 7, 8, 11, 13, 18, 21 | Sensitive-file, policy, and reversal gaps |
| Dashboards and CMS | Sections 12–14 | Scope and operational-readiness review |
| Messaging and notifications | Section 15 | Context, reliability, and provider gaps |
| AI | Section 16 | Scope, grounding, evaluation, cost, and fallback risks |
| Analytics | Section 17 | Scope, consent, taxonomy, and formula gaps |
| Security and privacy | Section 18 | Threat, retention, scanning, audit, and recovery gaps |
| Future vision | Section 19 | Premature future-proofing risk |
| Business rules | Sections 20, 21, 25 | Duplicate decisions and unclear policies |
| Design and technical principles | Sections 22, 23 | Missing measurable NFRs and architecture decisions |
| Risks | Section 24 | Expanded risk prioritization and mitigation |

---

## 27. Final Product Statement

بيتي بذوقي is not simply a furniture website. It is a digital furniture atelier that combines craftsmanship, personalization, transparency, and modern technology so customers can create furniture suited to their homes while the manager retains control over feasibility, pricing, payment, production, and customer trust.

Every implementation and scope decision must strengthen that purpose. When information is missing, the team must resolve and record the decision rather than allowing an implementation assumption to become an undocumented business rule.

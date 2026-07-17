# Module Boundaries

**Status:** Approved 2026-07-16  
**Architecture:** Version 1 modular monolith

## 1. Boundary rules

The monolith is organized by business capability, not technical layer alone. Each module owns its domain rules, application operations, persistence interfaces, and public contracts. Shared infrastructure supplies transactions, identity context, time, identifiers, configuration access, storage, mail, and telemetry, but it does not own business policy.

Rules:

- Modules expose use-case-oriented commands, queries, and domain events; they do not expose writable persistence models.
- Only the owning module writes its records.
- Cross-module references use stable identifiers and documented read contracts.
- Cross-module operations requiring atomicity run through an application coordinator with an explicit database transaction.
- Provider SDK types do not appear in domain contracts.
- Inbound framework adapters do not contain authorization or transition rules.
- No module calls itself a service over HTTP; this is one process and one deployable.
- A later extraction would require evidence and an ADR, not speculative network boundaries.

## 2. Version 1 modules

| Module | Owns | Does not own |
|---|---|---|
| Access and Identity | Local Customer/Manager identity mapping, role state, account eligibility, actor context | Credentials, OTP delivery, password hashes, MFA secrets |
| Business Configuration | Typed policy/configuration values, effective dates, approval/audit metadata, active business and fulfilment locations | Domain transitions or arbitrary executable rules |
| Catalog and Search | Products, Categories, Collections, Materials, Colors, Product Options, allowed configuration rules, published search projection | Customer project selections, accepted commercial snapshots |
| CMS and Localization | CMS Content, Translations, draft/review/publication lifecycle, locale availability | Product business rules or customer-generated messages |
| Customer Projects | Customer Project, Project Items, Product Configurations captured for work, Submitted Request lifecycle | Quotation pricing, Order creation, production state |
| Quotations and Acceptance | Quotations, immutable revisions after sending, quotation items, Customer Acceptance, acceptance validation | Order fulfilment or payment verification |
| Orders | Order aggregate, immutable Order Item Snapshots, commercial/identity/fulfilment snapshots, order lifecycle | Mutable catalog definitions, file bytes |
| Payments | Payment Submission, proof association, manual Payment Verification, payment lifecycle | Bank transfer execution, production transitions |
| Production | Order-level production state and Production Updates | Item-level production lifecycle, workforce or inventory management |
| Fulfilment | Pickup or delivery selection, address/price snapshot, Fulfilment state and handoff evidence | External carrier orchestration unless later approved |
| Messaging | Customer-manager conversations, Messages, attachment associations and visibility | Notification delivery policy, object bytes |
| Notifications | In-app Notification records, event-to-template policy, email delivery attempts and status | Business event truth or provider credential management |
| Files and Media | Attachment/file metadata, classification, ownership, upload/scan/promotion lifecycle, storage object references | S3 bytes as relational data, domain-specific access decision alone |
| Audit and Operations | Append-only Audit Events, correlation, administrative recovery records, durable job/outbox operations | Editable business history or product analytics |

`Review`, `Saved Design`, `Favorites`, and advanced media capabilities may remain recognized future concepts in planning, but they do not have active Version 1 application modules or public behavior.

## 3. Critical aggregate boundaries

### Customer Project aggregate

Customer Project is the working container for Project Items and their current configurations. It remains customer-editable only in allowed project states. Submission creates a stable Submitted Request view of what was sent for manager review; later working changes cannot mutate that submitted history.

### Quotation aggregate

Quotation groups its revisions. Each revision contains its own Quotation Items and commercial terms. A draft revision is editable by the manager; sending freezes it. Superseding creates another revision. Acceptance targets exactly one current sent revision.

### Order aggregate

Order is the root for the accepted transaction. It contains immutable Order Item Snapshots and the current order-level lifecycle. Version 1 production status belongs to Order/Production Update, never to an individual Order Item Snapshot. The snapshot remains first-class for historical display, fulfilment description, and later extensibility.

### Payment aggregate

Each proof upload creates an immutable Payment Submission. Manual verification records the Manager decision separately. Rejected or replaced proof is retained according to approved policy; the system does not overwrite an earlier submission.

### Fulfilment aggregate

Fulfilment records pickup or delivery and its lifecycle. Accepted commercial details are snapshotted. Future showroom support adds another selectable location, not another tenant or Order type.

## 4. Cross-module workflows

| Workflow | Coordinator | Participants | Consistency |
|---|---|---|---|
| Submit customer project | Customer Projects | Catalog read contract, Audit, Notifications | One DB transaction for submitted history, state, audit, outbox |
| Send/revise quotation | Quotations | Customer Projects read contract, Files, Audit, Notifications | One DB transaction per send/supersede action |
| Accept quotation and create order | Quotations and Acceptance application coordinator | Quotations, Orders, Customer Projects, Fulfilment snapshot, Audit, Notifications | One serializable/locked DB transaction; all or nothing |
| Submit payment proof | Payments | Orders read contract, Files, Audit, Notifications | Metadata transaction plus independently durable/verified upload lifecycle |
| Verify payment | Payments coordinator | Payments, Orders, Audit, Notifications | One DB transaction; successful verification unlocks but does not automatically start production unless policy later says so |
| Update production | Production | Orders, Payments verification read contract, Audit, Notifications | One DB transaction; verified-payment precondition is mandatory |
| Complete fulfilment | Fulfilment | Orders, Files/evidence, Audit, Notifications | One DB transaction after required evidence validation |
| Publish content/media | CMS or Catalog | Localization, Files, Audit, cache invalidation outbox | One DB transaction for publication state; cache/media work is durable side effect |

## 5. Dependency direction

```text
Inbound adapters
      |
      v
Application services / coordinators
      |
      v
Domain modules and policy ports
      |
      v
Persistence and provider ports
      |
      v
Drizzle/PostgreSQL, Clerk, S3, Resend, telemetry adapters
```

Domain code may depend on shared value concepts such as Money, Locale, Actor, BusinessTime, Identifier, and transition result. It must not depend on Next.js request objects, Clerk session types, Drizzle row types, S3 clients, or Resend payloads.

## 6. Authorization responsibility

Access and Identity resolves who the actor is. The target module decides what that actor may do with the specific resource in its current state. Examples:

- Catalog decides whether a Visitor may see a Product based on publication state.
- Customer Projects checks Customer ownership and project state.
- Quotations checks Customer ownership for reads and Manager role plus lifecycle for mutations.
- Files combines the requesting module's resource decision with file classification and ownership.
- Audit denies normal mutation and restricts reads to manager/operator policy.

This avoids a single coarse `isManager` switch becoming the only authorization control.

## 7. Data access and read models

Each module owns repository interfaces and migrations for its portion of the relational model once database design begins. Cross-module screens may use application-level composed queries or explicit read projections. A projection is read-only and cannot become a backdoor for cross-module writes.

Search and manager dashboards may use denormalized relational projections maintained transactionally or through the outbox. Advanced analytics and a separate warehouse are outside Version 1.

## 8. Events and side effects

Domain events describe completed facts such as `QuotationSent`, `QuotationAccepted`, `PaymentSubmissionReceived`, `PaymentVerified`, `ProductionStarted`, `OrderReady`, and `FulfilmentCompleted`. Event names here are architectural examples, not API contracts.

Required external effects are serialized into a transactional outbox. Consumers are idempotent and record attempts. Internal module coordination that must be immediately consistent stays in the originating database transaction rather than relying on eventual delivery.

## 9. Extensibility limits

- A showroom extends the Business Configuration and Fulfilment location data; it does not introduce tenant boundaries.
- Item-level production later may add an item-progress concept linked to Order Item Snapshot while preserving existing order-level history; Version 1 snapshots remain unchanged.
- A different identity, storage, mail, search, or monitoring provider is replaced through adapters and migration work. Provider neutrality is not free; lock-in implications are recorded in `ADR_INDEX.md`.
- Microservice extraction, if ever justified, must first establish ownership, transaction, latency, and operational consequences in a new ADR.

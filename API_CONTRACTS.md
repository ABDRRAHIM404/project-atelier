# Version 1 API Contracts

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Accepted by the Product Owner on 2026-07-16  
**API version:** `v1`  
**Scope:** First-party web/API and trusted provider callbacks  
**Important:** These are contracts only. No route, Server Action, controller, or endpoint has been implemented.

## 1. API posture

The Version 1 modular monolith exposes one server-authoritative application contract. Thin Next.js Route Handlers and, where appropriate, thin Server Actions may adapt browser requests to the same application commands/queries. Server Components can call query services in-process rather than making self-HTTP requests, but receive the same actor-scoped projection and authorization checks.

`/api/v1` is a first-party contract, not an unauthenticated third-party integration API. Future mobile clients can reuse it after separate client/security review. Provider webhooks use dedicated signed callback paths and never share Customer authorization semantics.

## 2. Protocol conventions

| Concern | Contract |
|---|---|
| Transport | HTTPS only outside local development |
| Encoding | UTF-8 JSON unless an upload capability explicitly uses S3 object transfer |
| Content type | `application/json`; errors use `application/problem+json` |
| Authentication | Clerk session/cookie verified on server; callbacks use provider signature |
| Authorization | Local actor/resource/state checks from `AUTHORIZATION_MODEL.md` |
| IDs | Opaque UUID strings; human references are display-only |
| Time | ISO 8601 UTC instants |
| Money | `{amountMinor, currency}` semantic object; no floating point |
| Dimensions | Exact decimal string plus unit |
| Locale | Explicit validated preference/header; Arabic fallback; response facts remain canonical |
| Concurrency | ETag/`If-Match` for mutable drafts and stateful commands |
| Idempotency | `Idempotency-Key` where marked Required |
| Correlation | Server returns `X-Correlation-ID`; client may supply a valid non-secret request correlation hint but server owns final value |
| Caching | Public published reads may declare public cache policy; every authenticated/private response is private/no-store unless explicitly proven safe |

Client-supplied `customerId`, `managerId`, role, price, total, current state, file object key, audit actor, and notification recipient are ignored/rejected as authority.

## 3. Response conventions

### Single resource

The representation contains stable `id`, resource `type`, actor-safe fields, and where mutable an opaque `etag`/integer semantic `version`. It may contain `links` only to application routes or explicitly authorized API resources—not private object URLs.

### Collections

Growing collections use cursor pagination:

| Member | Meaning |
|---|---|
| `items` | Ordered actor-safe resources |
| `nextCursor` | Opaque cursor or null |
| `hasMore` | Whether another page exists |

Cursor semantics include the stable sort key and ID. Clients must not decode or construct cursors. Offset pagination is not used for Messages, Notifications, Audit Events, or timelines.

### Async processing

Commands whose authoritative business result is committed return `200` or `201` even if email delivery remains queued. File finalization/scan can return `202 Accepted` with a processing resource and status URL. `202` never means a bank payment is verified.

### Errors

All failures follow `ERROR_MODEL.md`. Cross-Customer lookup uses a non-disclosing `404`. Domain-state conflict uses `409`. Stale ETag uses `412`.

## 4. Shared representations

### 4.1 Money

| Field | Required | Meaning |
|---|---:|---|
| `amountMinor` | Yes | Signed integer minor units serialized safely |
| `currency` | Yes | ISO 4217 code snapshotted on the record |

### 4.2 Localized text

Public and Customer representations contain already selected localized fields plus `locale`. They do not expose all translation drafts. Manager editorial contracts expose translation revision/state metadata separately.

### 4.3 Attachment summary

Contains Attachment ID, purpose, safe display filename, detected media type, byte size, lifecycle (`PROCESSING`, `AVAILABLE`, `REJECTED`, `QUARANTINED` as actor-appropriate), creation time, and an application download action when permitted. It never returns bucket, object key/version, checksum, scanner internals, or a persisted presigned URL.

### 4.4 Timeline entry

Contains stable entry ID/type, occurred time, localized Customer-safe label/detail, actor category where appropriate, source resource reference, and state transition names safe for the caller. Raw Audit Event payloads are not Customer timeline entries.

## 5. Authentication and account contracts

Clerk owns sign-up, email-code verification, password/TOTP, backup-code, session, and logout protocol. Atelier does not duplicate credential endpoints.

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/me` | Customer/Manager | Return local principal type/status and actor-safe Customer/Manager profile/preferences |
| `PATCH /api/v1/me/preferences` | Customer/Manager | Update preferred locale and only currently enabled preference keys; `If-Match` required |
| `PATCH /api/v1/me/profile` | Customer | Update only profile fields enabled by `CFG-006`; unavailable fields are rejected, not silently stored |
| `POST /api/v1/webhooks/clerk` | Clerk | Signed, replay-safe identity lifecycle synchronization; never grants Manager role |

First verified Customer login provisions/links the local Customer idempotently. Manager creation/replacement is an operator bootstrap procedure, not a public endpoint.

## 6. Public catalog and CMS queries

| Method/path | Actor | Inputs | Result |
|---|---|---|---|
| `GET /api/v1/catalog/products` | Any | Cursor, approved category/collection filters, locale | Published Product cards only |
| `GET /api/v1/catalog/products/{productId}` | Any | Product ID, locale | Published Product detail, allowed options/rules, public media |
| `GET /api/v1/catalog/categories` | Any | Locale | Visible Categories |
| `GET /api/v1/catalog/collections` | Any | Cursor, locale | Visible Collections |
| `GET /api/v1/catalog/collections/{collectionId}` | Any | ID, locale, Product cursor | Published Collection and Products |
| `GET /api/v1/catalog/search` | Any | Query, cursor, approved filters, locale | PostgreSQL-backed published results |
| `GET /api/v1/content/{slug}` | Any | Stable slug, locale | Published CMS version or locale-safe not found/fallback |

Product representation contains ID, localized name/description, current published status implied, starting Money, safe production estimate text, public media variants, assigned active Materials/Colors/options, and configuration-rule metadata. It never exposes internal cost, draft translation, restricted note, S3 origin key, or mutable database row shape.

Unavailable/archived Products return non-orderable/not-found public behavior according to their current public lifecycle; historical Orders continue to expose snapshots through authenticated Order APIs.

## 7. Manager catalog and CMS commands

### Catalog resource families

The following paths share the same draft/version/ETag contract: Products, Categories, Collections, Materials, Colors, Product Options, and Product Option Values.

| Method/path pattern | Purpose |
|---|---|
| `POST /api/v1/manager/catalog/{resource}` | Create draft resource; Idempotency Required |
| `GET /api/v1/manager/catalog/{resource}/{id}` | Manager detail including draft/editorial state |
| `PATCH /api/v1/manager/catalog/{resource}/{id}` | Update allowed mutable draft/live-management fields; `If-Match` required |
| `POST /api/v1/manager/catalog/{resource}/{id}/publish` | Validate Arabic/publication/configuration/media and publish; Idempotency Required |
| `POST /api/v1/manager/catalog/{resource}/{id}/hide` | Hide from public reads without deleting history; Idempotency Required |
| `POST /api/v1/manager/catalog/{resource}/{id}/archive` | Non-destructive archive where approved lifecycle permits; Idempotency Required |

Product option assignments, exclusions, dependencies, and dimension rules are updated through Product draft subresources. The command accepts only bounded rule types in `DATABASE_DESIGN.md`; no arbitrary formula/expression payload exists.

### CMS/editorial

| Method/path | Purpose |
|---|---|
| `POST /api/v1/manager/content` | Create stable CMS content identity and first draft version |
| `POST /api/v1/manager/content/{contentId}/versions` | Create a new draft from an authorized prior version |
| `PATCH /api/v1/manager/content/{contentId}/versions/{versionId}` | Edit only a draft structure; `If-Match` |
| `POST /api/v1/manager/content/{contentId}/versions/{versionId}/publish` | Atomically publish approved Arabic/versioned content |
| `POST /api/v1/manager/content/{contentId}/hide` | Remove current version from public reads, preserve history |
| `POST /api/v1/manager/localized-resources/{resourceId}/translations` | Create locale draft revision |
| `PATCH /api/v1/manager/translations/{translationId}` | Edit `DRAFT` only |
| `POST /api/v1/manager/translations/{translationId}/request-review` | `DRAFT` → `IN_REVIEW` |
| `POST /api/v1/manager/translations/{translationId}/request-changes` | `IN_REVIEW` → new/editable draft path with review note |
| `POST /api/v1/manager/translations/{translationId}/approve` | Human Manager approval only |
| `POST /api/v1/manager/translations/{translationId}/publish` | Publish approved revision with parent validation |

All mutation commands require Manager MFA assurance, authorization, `If-Match` where mutable, idempotency for transitions, Audit Event, and durable cache/search invalidation intent.

## 8. Customer Project contracts

### Project representation

Contains ID, Customer-safe name/notes, state, item count, ordered items, creation/update/submission times, version/ETag, and allowed action names. Each Project Item contains ID, Product reference and selected localized summary, configuration values/dimensions, notes, position, validation state, and version. No final price is accepted from the Customer.

### Endpoints

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/projects` | Customer | Own Projects, cursor/filter by current approved state |
| `POST /api/v1/projects` | Customer | Create Draft; Idempotency Required |
| `GET /api/v1/projects/{projectId}` | Owning Customer | Full own draft/submitted summary |
| `PATCH /api/v1/projects/{projectId}` | Owning Customer | Update Draft name/notes only; `If-Match` |
| `POST /api/v1/projects/{projectId}/items` | Owning Customer | Add one physical item/configuration; Idempotency Required |
| `PATCH /api/v1/projects/{projectId}/items/{itemId}` | Owning Customer | Edit Draft item/configuration; `If-Match` |
| `DELETE /api/v1/projects/{projectId}/items/{itemId}` | Owning Customer | Remove item from Draft only; `If-Match`; this is not Project/history deletion |
| `POST /api/v1/projects/{projectId}/submit` | Owning Customer | Atomic snapshot and state transition; Idempotency Required, `If-Match` |

Project deletion/archive/withdrawal endpoints are absent while their policies remain open.

Submit success returns `201` with Submitted Request ID, locked Project state, next-step information, and queued-notification status. It never requests payment.

## 9. Submitted Request and clarification contracts

### Customer

| Method/path | Purpose |
|---|---|
| `GET /api/v1/requests` | List own immutable Submitted Requests |
| `GET /api/v1/requests/{requestId}` | Own submitted snapshots, state, clarification/quotation links, allowed actions |
| `POST /api/v1/requests/{requestId}/provide-information` | Provide requested clarification by creating/linking a Message and clean Attachments; Idempotency Required |

### Manager

| Method/path | Purpose |
|---|---|
| `GET /api/v1/manager/requests` | Cursor queue with approved state/age filters |
| `GET /api/v1/manager/requests/{requestId}` | Immutable request snapshot, Customer operational summary, safe Attachments/history |
| `POST /api/v1/manager/requests/{requestId}/start-review` | `SUBMITTED` → `UNDER_REVIEW`; Idempotency Recommended, `If-Match` |
| `POST /api/v1/manager/requests/{requestId}/request-information` | Create contextual Manager Message and transition to waiting; Idempotency Required |

No withdrawal, expire, infeasible, close, or reopen command exists until `BP-001`/`CFG-001` defines it.

## 10. Quotation contracts

### Manager authoring

| Method/path | Contract |
|---|---|
| `POST /api/v1/manager/requests/{requestId}/quotation` | Create/get one Quotation container; idempotent by Request |
| `POST /api/v1/manager/quotations/{quotationId}/revisions` | Create next draft revision from submitted/current facts; Idempotency Required |
| `GET /api/v1/manager/quotation-revisions/{revisionId}` | Full draft/history view allowed to Manager |
| `PATCH /api/v1/manager/quotation-revisions/{revisionId}` | Edit `DRAFT` terms/items/components only; `If-Match` |
| `POST /api/v1/manager/quotation-revisions/{revisionId}/send` | Validate totals/snapshots, freeze, send; Idempotency Required, `If-Match` |

Draft Revision command fields include ordered Quotation Items traced to submitted items, detailed Money components, configurable tax facts if active, production estimate, fulfilment method, delivery price/address or pickup location snapshot, Customer-visible notes, and approved terms version. The server derives Customer, source ownership, currency defaults, totals, and revision number.

### Customer reads/actions

| Method/path | Contract |
|---|---|
| `GET /api/v1/quotations` | Own Quotation summaries/history |
| `GET /api/v1/quotations/{quotationId}` | Own immutable sent revision history and current allowed action |
| `GET /api/v1/quotation-revisions/{revisionId}` | Own sent revision with item/price/fulfilment/terms snapshots |
| `POST /api/v1/quotation-revisions/{revisionId}/request-changes` | Current sent revision only; reason/Message context; Idempotency Required |
| `POST /api/v1/quotation-revisions/{revisionId}/decline` | Current sent revision only; Idempotency Required |
| `POST /api/v1/quotation-revisions/{revisionId}/accept` | Atomic Acceptance/Order creation; **Idempotency Required**, `If-Match` |

Acceptance response is `201` on first commit and replay-equivalent success on an identical retry. It returns Acceptance ID, Order summary in `AWAITING_PAYMENT`, immutable accepted Revision reference, and next full-bank-transfer step. It does not initiate payment or production.

Quotation expiry/correction/withdrawal/reopening commands are absent. A Manager correction is always a new revision.

## 11. Orders and timelines

### Order representation

Contains ID/display reference, lifecycle, immutable accepted currency/total/price breakdown, Order Item Snapshots, accepted production estimate, accepted fulfilment terms, payment summary, Order-level production state, fulfilment state, Customer-safe timeline, next action, and timestamps. It never resolves historical display from current catalog content.

| Method/path | Actor | Result |
|---|---|---|
| `GET /api/v1/orders` | Customer | Own Orders with cursor/state filter |
| `GET /api/v1/orders/{orderId}` | Owning Customer | Customer-safe complete Order projection |
| `GET /api/v1/orders/{orderId}/timeline` | Owning Customer | Cursor timeline from approved business history |
| `GET /api/v1/manager/orders` | Manager | Operational queue with approved filters |
| `GET /api/v1/manager/orders/{orderId}` | Manager | Manager operational projection; sensitive fields still purpose-limited |

There is no general `PATCH /orders/{id}`. Lifecycle changes are named commands only.

## 12. File upload and download contracts

### Create upload intent

`POST /api/v1/file-upload-intents` requires Idempotency and accepts:

- approved purpose (`REQUEST_REFERENCE`, `MESSAGE_ATTACHMENT`, `PAYMENT_PROOF`, `HANDOFF_PROOF`, `CATALOG_MEDIA`, or `CMS_MEDIA` as actor permits);
- target resource ID;
- display filename, declared media type, declared size, and optional supported checksum.

The server authorizes parent/purpose/state, assigns classification and generated object identity, and returns a short-lived S3 upload capability: intent ID, operation URL, exact method/headers/constraints, expiry, and finalize URL. The capability response is no-store and must not be logged/persisted by the application.

### Finalize and inspect

| Method/path | Contract |
|---|---|
| `POST /api/v1/file-upload-intents/{intentId}/finalize` | Bind exact object/version/metadata, begin validation/scan; Idempotency Required; usually `202` |
| `GET /api/v1/files/{fileId}/status` | Owning/authorized actor sees processing/available/rejected state |
| `POST /api/v1/attachments/{attachmentId}/download-capability` | Authorized parent access returns one short-lived no-store read capability |

Public catalog/CMS media is accessed through published media URLs, not private download capability. Publication is a separate Manager command after clean processing.

## 13. Payment contracts

### Customer

| Method/path | Contract |
|---|---|
| `POST /api/v1/orders/{orderId}/payment-submissions` | Reference one own clean `PAYMENT_PROOF` Attachment; Idempotency Required |
| `GET /api/v1/orders/{orderId}/payment` | Own current payment state and immutable submission/decision history |

Submission success returns `201`, Order/payment state under review, submission summary, and queued Payment Received notification. Uploading/finalizing a file alone does not call this command.

### Manager

| Method/path | Contract |
|---|---|
| `GET /api/v1/manager/payment-submissions` | Review queue; no raw proof in list response |
| `GET /api/v1/manager/payment-submissions/{submissionId}` | Review metadata and separately authorized proof-download action; sensitive view audited |
| `POST /api/v1/manager/payment-submissions/{submissionId}/verify` | Manual explicit decision; Idempotency Required, `If-Match` on payment summary |
| `POST /api/v1/manager/payment-submissions/{submissionId}/reject` | Manual explicit decision with approved safe reason; Idempotency Required |

Verify success changes Payment and Order to verified and queues notifications. It does not automatically start production. Correction/reversal/partial/excess/duplicate/fraud endpoints are absent until `BP-003` approval.

## 14. Production contracts

| Method/path | Required start state → result | Command fields |
|---|---|---|
| `POST /api/v1/manager/orders/{orderId}/production/start-materials` | `NOT_STARTED` → `MATERIALS_PREPARATION` | Optional approved note; Idempotency + `If-Match`; verified payment rechecked |
| `POST /api/v1/manager/orders/{orderId}/production/start-work` | `MATERIALS_PREPARATION` → `IN_PRODUCTION` | Optional note; Idempotency + `If-Match` |
| `POST /api/v1/manager/orders/{orderId}/production/start-inspection` | `IN_PRODUCTION` → `QUALITY_INSPECTION` | Approved note/evidence fields only if configured |
| `POST /api/v1/manager/orders/{orderId}/production/require-rework` | `QUALITY_INSPECTION` → `IN_PRODUCTION` | Required Customer-safe/internal reason according to schema |
| `POST /api/v1/manager/orders/{orderId}/production/mark-ready` | `QUALITY_INSPECTION` → `READY` | Completion checks; triggers fulfilment ready and notifications atomically/durably |

All are Manager MFA commands, Idempotency Required, and Order-level only. There is no endpoint containing an Order Item production target. Pause, delay, skip, correction, cancellation, or arbitrary target-state endpoints do not exist.

Customer reads Production through Order/timeline APIs.

## 15. Fulfilment contracts

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/orders/{orderId}/fulfilment` | Owning Customer | Accepted method/address or pickup location, price, current state, Customer-safe next action |
| `GET /api/v1/manager/fulfilments` | Manager | Ready/operational queue |
| `GET /api/v1/manager/fulfilments/{fulfilmentId}` | Manager | Accepted facts and authorized handoff-proof actions |
| `POST /api/v1/manager/fulfilments/{fulfilmentId}/confirm-handoff` | Manager | Reference clean handoff-proof Attachment(s); method-consistent completion; Idempotency Required, `If-Match` |

Handoff success produces `DELIVERED` or `PICKED_UP` based on the accepted method and completes the Order atomically. Scheduling, attempt, refusal, damage, partial handoff, dispute, or compensation endpoints are absent until policy approval.

## 16. Messaging contracts

One Conversation exists per Customer.

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/conversation` | Customer | Own continuous Conversation summary/unread state |
| `GET /api/v1/conversation/messages` | Customer | Own Messages cursor page |
| `POST /api/v1/conversation/messages` | Customer | Send safe text/clean Attachments with optional own Project or Order context; Idempotency Required |
| `GET /api/v1/manager/conversations` | Manager | Customer conversation queue/search by approved operational facts |
| `GET /api/v1/manager/conversations/{conversationId}/messages` | Manager | Authorized Conversation cursor page |
| `POST /api/v1/manager/conversations/{conversationId}/messages` | Manager | Send safe Message/clean Attachments/context; Idempotency Required |
| `POST /api/v1/conversations/{conversationId}/read-position` | Conversation party | Advance own read position idempotently |

Message fields: body (plain text/approved safe schema), optional context `{type: PROJECT|ORDER, id}`, Attachment IDs, and client message key. Context must belong to the Conversation Customer. Original Message edit/delete endpoints are absent.

## 17. Notification contracts

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/notifications` | Customer/Manager | Own cursor list, optional unread filter |
| `GET /api/v1/notifications/unread-count` | Customer/Manager | Own current count |
| `POST /api/v1/notifications/{notificationId}/read` | Recipient | Idempotently set read timestamp |
| `POST /api/v1/notifications/read-through` | Recipient | Advance read state through an authorized notification/cursor where supported |

Representations contain localized safe text, event type, created/read state, and application deep link. They never embed private object URLs. Notification preference mutation is limited to keys approved by `BP-009`/`CFG-007`; mandatory event/channel treatment is not guessed.

Manager delivery-diagnostic endpoints, if exposed, are separately authorized and return safe status/error categories without full email body or unnecessary Customer data.

## 18. Business configuration contracts

| Method/path | Actor | Contract |
|---|---|---|
| `GET /api/v1/manager/configuration` | Manager | Approved Manager-visible definitions and active/draft revisions |
| `POST /api/v1/manager/configuration/{key}/revisions` | Manager or Operator by key | Create schema-valid draft value; Idempotency Required |
| `POST /api/v1/manager/configuration/{key}/revisions/{revisionId}/activate` | Authorized owner | Effective activation with audit; Idempotency Required, `If-Match` |
| `POST /api/v1/manager/configuration/{key}/revisions/{revisionId}/retire` | Authorized owner | Non-destructive retirement if another valid value/policy allows |

Only code-owned keys exist. Responses never expose secrets/infrastructure configuration. A key cannot weaken authorization, accepted-history immutability, verified-payment production, or Arabic requirements.

## 19. Audit and operational contracts

- Customers receive purpose-built Order/Project timelines, not raw Audit Events.
- Manager Audit Event querying is restricted to the approved business/security viewer policy and cursor/filter allowlist.
- No API can update or delete an Audit Event.
- Job/outbox manual retry or recovery endpoints are Operator/approved Manager operations with explicit handler/resource scope and Audit Event; no generic arbitrary job execution endpoint exists.
- Health endpoints expose only coarse liveness/readiness and no customer/provider secret/detail.

Raw Audit Event export, account data export, retention/purge, and emergency recovery APIs remain gated by policy/operations approval.

## 20. Provider callback contracts

| Path | Authentication | Permitted effect |
|---|---|---|
| `POST /api/v1/webhooks/clerk` | Clerk signature/replay policy | Synchronize provider identity/session/user status; no Manager elevation |
| `POST /api/v1/webhooks/resend` | Resend signature/replay policy | Update email delivery diagnostics only |
| `POST /api/v1/webhooks/aws/storage-events` | AWS event authentication plus event source validation | Bind object/scan results and enqueue file reconciliation; no payment verification |

Callbacks acknowledge valid duplicates idempotently. Unknown/invalid signatures are rejected and monitored. Provider payload versions are adapted to internal stable event types.

## 21. Query consistency and freshness

| Read | Required consistency |
|---|---|
| Acceptance result and resulting Order | Same-transaction authoritative |
| Payment Verification and production start guard | Same-transaction authoritative |
| Sent/current quotation action | Authoritative, not stale cache |
| Private ownership and file capability | Authoritative at issuance |
| Public catalog/CMS | May use explicitly invalidated cache/projection |
| Manager queues/unread counts | Bounded relational projection staleness may be acceptable only if action rechecks authority |
| Email delivery diagnostics | Eventual; not business truth |

Every mutation reads current state inside its transaction regardless of UI/query freshness.

## 22. Rate and abuse controls

Controls apply by actor/IP/resource/global signal to authentication attempts, public search, Project/Message creation, upload intent/finalization, acceptance, payment decisions, production transitions, and webhooks. Exact thresholds remain approved security configuration and are not set here.

A rate-limited mutation is safe to retry under the same idempotency key after `Retry-After`. Limits cannot be bypassed by changing locale or target IDs.

## 23. Compatibility policy

- `/api/v1` keeps existing field and error meanings stable.
- New response fields and enum values are additive only where clients are required to tolerate them.
- Required request fields are not added without a compatibility/version plan.
- Snapshot schemas carry explicit versions.
- A breaking route/field/state semantic requires a new API version or bounded migration/dual-support plan.
- Internal in-process adapters obey the same domain contract even when they do not serialize HTTP.

## 24. Explicitly absent Version 1 contracts

There are no Version 1 APIs for direct checkout, card payments, automated payment verification, cancellation/refund/return/warranty/repair/dispute, worker/inventory/supplier management, item-level production, delivery attempts/carrier integration, Review/Favorite/Saved Design, AI, advanced analytics, push, French, multi-tenancy, or advanced 360° processing.

There is also no generic “set state,” “Manager override,” “execute SQL,” “run arbitrary job,” “publish file,” or “update snapshot” endpoint.

## 25. Contract verification

Before implementation approval, every endpoint/command is traceable to a requirement and state transition. Later contract tests must prove:

- authentication/assurance and cross-Customer non-disclosure;
- positive/negative resource/action matrix;
- input and output schemas in Arabic and optional English;
- ETag and idempotent replay behavior;
- database atomicity and immutable constraints;
- safe async/file processing;
- correct Error Model code/status mapping;
- no private shared caching or field leakage;
- provider callback signature/replay/idempotency;
- accepted API latency/error targets under the approved profile.

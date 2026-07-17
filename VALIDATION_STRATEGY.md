# Version 1 Validation Strategy

**Status:** Accepted by the Product Owner on 2026-07-16  
**Scope:** Browser/API input, domain commands, relational constraints, files, provider callbacks, localization, and outputs

## 1. Principles

1. All external input is untrusted, including authenticated input and provider callbacks.
2. Client validation improves usability but never authorizes or establishes a business fact.
3. Validation rules have one owning module and are reused by inbound adapters; copies in UI are advisory projections.
4. Business invariants are revalidated inside the authoritative transaction after concurrency control.
5. Database constraints protect final consistency.
6. Unresolved business-policy values are not replaced by implementation defaults.
7. Validation errors are stable machine codes with localized Arabic messages and safe field pointers.
8. Original Arabic/Customer text is preserved; derived normalization never silently rewrites it.

## 2. Validation layers

| Layer | Responsibility | Failure class |
|---|---|---|
| Transport | Method/content type, body/file envelope, encoding, parseability, protocol headers | `400`, `413`, `415` |
| Authentication | Session/provider signature and assurance | `401`, `403` |
| Shape/type | Required fields, data types, enum syntax, identifiers, object schema | `422` |
| Authorization | Actor, ownership, purpose, field access | `403` or non-disclosing `404` |
| Domain | Product configuration, commercial totals, lifecycle, payment/production/fulfilment rules | `409` or `422` |
| Concurrency/idempotency | Expected version, request key/digest, unique business fact | `409`, `412` |
| Persistence | Foreign keys, checks, uniqueness, RLS, immutability and transition defenses | Mapped safe domain/internal error |
| Provider/file | Object identity, signature, scan result, webhook signature/order | Accepted processing state or safe provider/file error |
| Output/publication | Field filtering, locale completeness, escaping, accessibility/schema | Block response/publication and alert where unexpected |

Detailed field errors are returned only after the caller is allowed to know and attempt the operation.

## 3. Canonical schema ownership

Each application command/query has a versioned transport schema and maps to a domain command. Domain value validation remains provider/framework independent.

- API schemas own wire names, optionality, pagination, and protocol-safe limits.
- Domain modules own value meaning, allowed combinations, lifecycle, and invariants.
- Database design owns relational/immutability/uniqueness constraints.
- Provider adapters own external payload parsing/mapping.
- UI consumes generated/shared safe schema metadata where appropriate but cannot create authoritative prices, roles, states, or ownership.

JSONB shapes for configurations, snapshots, CMS structures, configuration values, events, and provider diagnostics contain an explicit schema version. Unknown future versions fail safely rather than being partially interpreted.

## 4. Common scalar validation

### Identifiers

- Parse only the documented UUID/public-reference form.
- Parent and nested-resource IDs are cross-checked; a valid child ID under the wrong Customer/parent is not accepted.
- IDs are not authorization evidence.

### Text

- Require valid Unicode and reject invalid control characters where inappropriate.
- Preserve original text and intentional line breaks.
- Apply technical abuse limits through approved/configured schema values; no business meaning is inferred from length.
- Plain text is the default for Customer messages/notes.
- Any approved rich text uses a code-owned allowlist, sanitization before persistence, output encoding, and CSP defense.
- Customer-controlled HTML, SVG, scripts, event attributes, and active URLs are not accepted as renderable content.

### Locale and direction

- Accept only enabled locale identifiers; Arabic is always available.
- English content/action is allowed only where the surface/resource is configured and published.
- French requests do not activate partial Version 1 content.
- Store canonical locale separately from displayed labels.

### Dates and time

- Wire instants are ISO 8601 with timezone/UTC normalization.
- Business-date/deadline calculation requires the configured IANA timezone and approved policy; no server-local implicit timezone.
- Client timestamps never prove event occurrence for acceptance, payment verification, production, or audit.

### Money

- Accept integer minor units and ISO currency through server-owned Manager commands only.
- Reject binary floating point, mixed currencies within one quotation/order, overflow, invalid sign for the component kind, and totals inconsistent with components.
- Currency/default comes from active configuration and is snapshotted on send/acceptance.
- Rounding, discounts, and legal tax display remain configuration/policy; related component kinds are disabled until approved.

### Dimensions and units

- Exact decimal values and explicit supported unit are required.
- Convert only through defined exact conversion rules; keep accepted display/original facts in snapshots.
- Enforce Product-specific fixed/range/free rules and reject missing required dimensions.

## 5. Catalog and Product Configuration

A Product is selectable only if currently `PUBLISHED`. The server loads its current assignments/rules and validates:

- each Material/Color/Option Value belongs to and is currently available for that Product;
- required options are present exactly once;
- single-choice values do not contain duplicates/multiple values;
- dimension values satisfy the declared rule kind/unit/bounds;
- exclusion pairs are not simultaneously selected;
- dependency rules are satisfied;
- no unrecognized option/value/key exists;
- the bounded configuration schema version is supported.

Price shown in catalog/configuration remains estimated. Customer input never supplies the final price.

Project item edits validate against current catalog rules. Submission validates every item again in the transaction. The immutable Submitted Request snapshot captures the validated Customer intent even if the live Product changes later.

## 6. Projects and submission

### Draft operations

- Customer owns the Project and Project state is `DRAFT`.
- Item Product/configuration references are consistent.
- Item ordering remains unique/stable within the Project.
- Quantity is not accepted; multiple desired pieces are separate Project Items.

### Submit

- Project is `DRAFT`, version matches, and contains at least one item.
- Every item has valid current Product/configuration and required Customer data.
- Every referenced Attachment is owned, clean, available, and valid for request/reference purpose.
- No concurrent Submitted Request exists.
- Snapshot serialization succeeds completely before any state is committed.

Failure leaves the Project editable and creates no partial Submitted Request.

## 7. Quotations and acceptance

### Manager draft/send

- Manager has required assurance.
- Source Request/item traceability is complete.
- Each Quotation Item contains a complete immutable display/configuration/price snapshot.
- Detailed price components use one currency and reconcile exactly to item/subtotal/tax/delivery/total fields.
- Production estimate and fulfilment method/details required by the accepted flow are present.
- Delivery includes confirmed address snapshot and quoted delivery price; pickup includes an approved location snapshot.
- Revision number is the next unique value.
- Optional/unapproved discount/tax behavior is rejected unless active configuration permits it.

Sending recomputes and records a digest, then freezes the revision and children.

### Customer response/acceptance

- Authenticated Customer owns the source Request/Quotation.
- Revision is exactly current and `SENT` with no terminal response.
- Expected version and idempotency rules pass.
- Any configured validity policy is evaluated only if approved/active.
- Acceptance evidence and complete Order snapshots can be created.

Acceptance validation repeats under lock in the transaction. Failure creates no Acceptance or Order.

## 8. File validation

### Before capability issuance

- Actor is authorized for target resource/action/purpose.
- Target state permits an upload.
- Declared filename is treated as display metadata only and safely normalized for display.
- Declared media type/size is allowed by purpose and active configuration.
- Server generates the object key, zone, and expected constraints.

### Finalization

- Upload intent is current, unused, and owned by the same actor.
- Exact bucket/zone, object key, S3 version, size, checksum, and metadata match expectation.
- Content signature and safe decoder/parser checks agree with an allowed type.
- Images validate decode/dimensions; PDF handling rejects active/unsupported content according to the approved scanner/decoder profile.
- Filename/extension or browser MIME alone never passes validation.

### Security scan

- `CLEAN` makes the object eligible for its parent workflow.
- `MALICIOUS`, invalid, unsupported, failed, absent, or unknown does not become clean.
- Duplicate/out-of-order scan events cannot regress a terminal stronger state.
- Payment proof accepts detected JPG, PNG, or PDF only and is never publicly transformed.

Exact byte/page/dimension limits remain `CFG-003` and must be set before external upload testing/release.

## 9. Payment validation

- Order belongs to Customer and is in `AWAITING_PAYMENT` or the approved replacement state.
- No verified Payment exists.
- Attachment is a unique clean Sensitive payment-proof object owned by the same Customer/Order purpose.
- New submission never replaces an existing submission.
- Manager decision targets the current reviewable Submission and is the first decision for it.
- Rejection has an approved safe reason; verification is an explicit authenticated Manager command.
- Proof upload/scan, email, AI, webhook, or file metadata cannot infer verification.
- Mistaken-verification correction and exception outcomes are unavailable until `BP-003` is approved.

## 10. Production validation

Every transition validates:

- Manager assurance/authorization;
- Order ownership/business context and non-terminal state;
- current Production state and expected version;
- exact allowed transition pair;
- unique next sequence;
- required reason for inspection failure/rework;
- no Order Item target exists.

`NOT_STARTED` → `MATERIALS_PREPARATION` additionally queries the authoritative verified Payment Verification in the same transaction. A cached Order flag alone is insufficient.

## 11. Fulfilment validation

- Fulfilment method matches the accepted quotation/order snapshot.
- Production is `READY` before fulfilment becomes ready.
- Delivery has accepted address and delivery-price snapshot; pickup has accepted location snapshot.
- Handoff completion targets the correct ready state.
- Every proof Attachment is clean, authorized, and bound to that Fulfilment purpose.
- At least one proof exists before completion.

Unapproved failure, refusal, damage, partial receipt, scheduling, recipient, or dispute fields/actions are rejected unless `BP-006`/`CFG-005` activates their defined contract.

## 12. Messaging and Notifications

### Message

- Sender is the Conversation Customer or Manager.
- Context Project/Order belongs to the Conversation Customer; at most one context is selected.
- Body is valid safe text and/or at least one approved clean Attachment according to the eventual message rule.
- Attachment parent/purpose and classification match Message use.
- Client message idempotency key is unique for sender/conversation.

The original sent content is immutable. Edit/delete operations do not exist until policy approval.

### Notification

- Event type is in the approved Version 1 matrix or explicitly enabled later.
- Recipient is derived from the authoritative business object/event.
- Template key/version and locale exist and pass their strict variable schema.
- Rendered content escapes all Customer/Manager input.
- Private/sensitive objects and direct presigned links are never variables.
- Delivery failure changes delivery diagnostics, not business state.

## 13. CMS, translation, and publication

- Content kind/block structure matches a code-owned versioned schema.
- Slugs/references follow route-safe uniqueness rules and cannot shadow protected application routes.
- Arabic source content is present and approved for publication.
- Optional English references the correct Arabic source revision and is not stale.
- Human Manager approval fields are present; AI/provider identity cannot approve.
- Attachments/media are clean and approved for public publication purpose.
- Links and media references are valid and safe.
- Only a complete immutable version is switched into public state transactionally.

Legal/policy page wording and optional-English scope still require `BP-010`/`CFG-008`; publication is blocked where required approval is absent.

## 14. Provider callbacks

- Read raw body only as required for official signature verification.
- Verify signature, timestamp/replay requirements, endpoint/provider identity, and allowed event type before processing.
- Parse through a provider-versioned adapter schema; unknown fields are ignored safely, unknown required semantics are rejected/dead-lettered.
- Store only an allowlisted digest/diagnostic subset.
- Deduplicate provider ID and business effect.
- Re-fetch/confirm provider state when a security-sensitive adapter contract requires it.
- Provider data never sets Customer ownership, Manager role, acceptance, bank-payment validity, production approval, or content approval.

## 15. Output validation

Before serialization/rendering:

- apply actor-specific field projection;
- ensure no private response enters shared cache;
- encode content for JSON/HTML/URL/email context;
- enforce localized message completeness and bidi-safe presentation contract;
- verify money/date/dimension formatting from stored canonical values;
- replace unexpected internal failure with the safe Error Model envelope;
- ensure file capability responses contain only the one authorized short-lived operation and are not persisted/logged.

## 16. Configuration and missing values

An unset required configuration value does not select a default. The affected command is unavailable with `POLICY_ACTION_NOT_ENABLED` or a release/configuration validation failure.

Before production, a configuration readiness check lists required active values for enabled features and proves their schema, approver, effective date, and audit history. It cannot allow a configuration value to disable authorization, payment verification, immutable history, or the Arabic requirement.

## 17. Test strategy

- Table-driven unit tests cover valid/invalid boundaries and every state transition.
- Property tests cover money total invariants, state pairs, snapshot/digest stability, and normalized search without changing original Arabic.
- PostgreSQL integration tests attempt forbidden updates/inserts and cross-Customer access.
- Concurrency tests repeat validation after locks and prove single outcomes.
- File tests use malformed headers, MIME mismatch, decompression/complexity abuse, unsafe PDFs, duplicates, delayed/out-of-order scans, and clean fixtures.
- Contract tests cover provider payload versions and signature/replay failures.
- Playwright verifies localized actionable errors, focus/error association, loading/processing/retry states, and no leaked raw code/key.
- Fuzzing targets JSON parsers, cursors, identifiers, rich text sanitizer if introduced, and file metadata—not production services.

## 18. Approval record

The Product Owner approved validation ownership/layers, transaction revalidation, file security pipeline, money/configuration behavior, output filtering, and the rule that missing policy values disable only their affected action rather than becoming guessed requirements on 2026-07-16.

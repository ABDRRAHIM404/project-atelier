# Version 1 API Error Model

**Status:** Accepted by the Product Owner on 2026-07-16  
**Format:** RFC 9457-compatible Problem Details with Project Atelier extensions  
**Languages:** Arabic required; approved English optional

## 1. Objectives

Errors must be safe, stable, localizable, actionable, observable, and consistent across Route Handlers, Server Actions, background operations, and provider callbacks. An error response must not expose another Customer's data, a stack trace, SQL, storage key, provider secret, presigned URL, payment-proof content, or internal policy detail.

Stable machine codes drive client behavior. Localized messages explain the result to a human but are never parsed as business state.

## 2. Problem envelope

Every API failure uses `application/problem+json` and contains:

| Member | Contract |
|---|---|
| `type` | Stable documentation URI or namespaced problem identifier |
| `title` | Short localized category title |
| `status` | HTTP status |
| `code` | Stable Project Atelier machine code |
| `detail` | Safe localized explanation appropriate to the authorized caller |
| `instance` | Request instance path/reference without sensitive query data |
| `correlationId` | Opaque support identifier also present in safe telemetry |
| `retryable` | Whether retry can succeed without changing request/business input |
| `retryAfter` | Optional seconds or timestamp when a retry window is known safely |
| `errors` | Optional ordered field/domain issue list |
| `currentVersion` | Optional current aggregate version for an authorized concurrency conflict |

Each entry in `errors` contains a JSON Pointer-style `pointer`, stable issue `code`, localized `message`, and optional allowlisted metadata such as accepted media types. It never echoes unsafe raw input.

## 3. HTTP status policy

| Status | Use |
|---:|---|
| `400` | Malformed JSON, invalid encoding, missing required protocol header, invalid cursor syntax |
| `401` | Missing, expired, invalid, or unverifiable authentication |
| `403` | Authenticated actor lacks role/assurance/action permission when existence disclosure is safe |
| `404` | Unknown resource or deliberately non-disclosing cross-Customer lookup |
| `409` | Valid request conflicts with lifecycle, uniqueness, idempotency, or in-progress command |
| `412` | `If-Match`/expected aggregate version failed |
| `413` | Request or file exceeds the approved configured technical limit |
| `415` | Unsupported declared/detected media type |
| `422` | Authorized request has syntactically valid JSON but fails field/domain validation |
| `428` | Required `If-Match`/expected-version precondition is missing |
| `429` | Rate/abuse limit reached |
| `500` | Unexpected internal failure; generic detail only |
| `502` | Upstream returned an invalid/failing response during a synchronous non-authoritative dependency call |
| `503` | Required service currently unavailable; protected operations fail closed |
| `504` | Approved synchronous upstream timed out |

Validation is not used to reveal whether another Customer's target exists. Authorization/non-disclosure occurs before detailed domain validation.

## 4. Stable error catalogue

### Authentication and authorization

| Code | Status | Meaning/recovery |
|---|---:|---|
| `AUTHENTICATION_REQUIRED` | 401 | Sign in again |
| `SESSION_INVALID` | 401 | Provider session cannot be verified |
| `AUTH_ASSURANCE_REQUIRED` | 403 | Manager must complete required MFA/re-authentication |
| `ACCOUNT_DISABLED` | 403 | Local access is disabled; use approved support/recovery path |
| `FORBIDDEN` | 403 | Action is not permitted; no hidden policy details |
| `RESOURCE_NOT_FOUND` | 404 | Missing or intentionally non-disclosed resource |

### Input and concurrency

| Code | Status | Meaning/recovery |
|---|---:|---|
| `MALFORMED_REQUEST` | 400 | Protocol/body cannot be parsed |
| `VALIDATION_FAILED` | 422 | One or more field/domain issues; inspect `errors` |
| `VERSION_PRECONDITION_REQUIRED` | 428 | Mutation requires an expected version/`If-Match` |
| `VERSION_CONFLICT` | 412 | Reload authorized resource and intentionally retry |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Command requires a client idempotency key |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Key was previously used with different request semantics |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Matching command is still executing; safe retry after hint |
| `RATE_LIMITED` | 429 | Respect `Retry-After` where supplied |

### Workflow and history

| Code | Status | Meaning/recovery |
|---|---:|---|
| `INVALID_STATE_TRANSITION` | 409 | Start state/action pair is not allowed |
| `IMMUTABLE_RECORD` | 409 | Sent/accepted/historical record cannot be edited |
| `PROJECT_ALREADY_SUBMITTED` | 409 | Submitted Project version is locked |
| `QUOTATION_REVISION_NOT_CURRENT` | 409 | Only current sent revision can receive Customer response |
| `QUOTATION_REVISION_NOT_ACTIONABLE` | 409 | Revision is draft/superseded/accepted/declined or otherwise closed |
| `ORDER_ALREADY_CREATED` | 409 | Acceptance already produced its Order; replay returns existing success when idempotency matches |
| `PAYMENT_PROOF_NOT_READY` | 409 | Upload/scan is incomplete or file is not eligible for review |
| `PAYMENT_ALREADY_VERIFIED` | 409 | No further submission/decision permitted under current policy |
| `PAYMENT_DECISION_EXISTS` | 409 | Submission already has a decision |
| `PRODUCTION_REQUIRES_VERIFIED_PAYMENT` | 409 | Absolute production gate failed |
| `PRODUCTION_SEQUENCE_INVALID` | 409 | Requested production action skips or conflicts with approved sequence |
| `HANDOFF_PROOF_REQUIRED` | 409 | Fulfilment cannot complete without valid evidence |
| `CONTENT_NOT_APPROVED` | 409 | Draft/unapproved/stale translation/content cannot publish |
| `LOCALE_NOT_AVAILABLE` | 404 | Optional locale/surface is not published; Arabic remains available |
| `POLICY_ACTION_NOT_ENABLED` | 409 | An unresolved/configuration-disabled action has no active policy |

### File handling

| Code | Status | Meaning/recovery |
|---|---:|---|
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File type not permitted; safe allowed-type metadata may be returned |
| `FILE_TOO_LARGE` | 413 | Exceeds approved current upload limit |
| `FILE_INTEGRITY_MISMATCH` | 422 | Uploaded object differs from declared/expected metadata |
| `FILE_SCAN_PENDING` | 409 | Wait/poll; unknown is not clean |
| `FILE_REJECTED` | 422 | File failed validation/security; no scanner exploit detail |
| `FILE_QUARANTINED` | 409 | File unavailable; approved support path only |
| `UPLOAD_CAPABILITY_EXPIRED` | 409 | Create a new upload intent |

### Dependency and internal

| Code | Status | Meaning/recovery |
|---|---:|---|
| `IDENTITY_SERVICE_UNAVAILABLE` | 503 | Protected operation fails closed |
| `DATA_SERVICE_UNAVAILABLE` | 503 | No partial transition committed |
| `STORAGE_SERVICE_UNAVAILABLE` | 503 | Retry safe file step later |
| `DEPENDENCY_TIMEOUT` | 504 | Retry only where the command/idempotency contract permits |
| `DEPENDENCY_FAILURE` | 502 | Upstream failure mapped safely |
| `INTERNAL_ERROR` | 500 | Unexpected failure; use correlation ID |

Provider names are normally omitted from Customer-facing `detail`. Operational telemetry retains a safe provider category.

## 5. Domain rejection versus system failure

- Expected lifecycle, validation, ownership, configuration, and concurrency rejections are typed results, not exception noise.
- Unexpected programming, database, serialization, or invariant failures become `INTERNAL_ERROR` and alert telemetry.
- Provider email failure after a committed transaction is not returned as failure for the business command. It is a durable delivery state visible to operations.
- File upload/finalization can return an accepted processing response while scanning continues; later scan state is queried separately.

## 6. Localization

- `code`, pointers, identifiers, and enum-like metadata remain language-neutral.
- `title`, `detail`, and field messages are rendered from approved application message catalogs.
- Arabic is the fallback for every Version 1 problem.
- English is returned only for enabled/published English surfaces.
- Raw translation keys and unapproved fallback text never appear.
- Correlation IDs, filenames, URLs, order references, and mixed-direction data are bidi-isolated in UI presentation.

## 7. Retry semantics

`retryable: true` means the same authorized request may be repeated under its idempotency contract after the stated condition. It does not mean a client should retry indefinitely.

- `400`, `403`, `404`, `413`, `415`, `422`: not retryable without changing state/input/authorization.
- `401`: retry only after authentication recovery.
- `409`: depends on code; reload/change state or retry matching in-progress idempotent command.
- `412`: reload current version, re-evaluate user intent, then use a new command attempt/key.
- `428`: reload the authorized resource and repeat with an explicit current precondition and intentional command key.
- `429`, `502`, `503`, `504`: retry with bounded backoff only where idempotency permits.
- `500`: no automatic mutation retry unless the same idempotency key is retained and the client follows the operation's recovery contract.

## 8. Logging and audit

Operational error logs record code, status, correlation, operation, module, safe actor/resource category, latency, and causal chain. They do not record uncontrolled bodies or sensitive content.

Failed privileged actions generate an Audit Event where required. Field validation mistakes and high-volume anonymous abuse generally remain operational telemetry to avoid an unbounded sensitive audit store.

## 9. Error compatibility

- Published machine codes are additive and stable within API version 1.
- Existing codes do not change meaning.
- New optional envelope members can be added; clients ignore unknown members.
- Removing/renaming a code or changing its HTTP semantics requires a versioned contract change.
- Localized wording can improve without changing code semantics or historical template evidence.

## 10. Verification

Contract tests cover every catalogue code, Arabic rendering, optional-English behavior, field pointer safety, non-disclosure, correlation propagation, retry flags, provider mapping, and absence of secrets/PII. The same domain failure must map consistently from every inbound adapter.

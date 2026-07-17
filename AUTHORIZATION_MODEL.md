# Version 1 Authorization Model

**Status:** Accepted by the Product Owner on 2026-07-16  
**Identity provider:** Approved Clerk integration  
**Authorization authority:** Project Atelier server and relational business state  
**Scope:** Product/API/database authorization; provider administration remains outside application roles

## 1. Core rule

A valid Clerk session proves an external identity and authentication assurance. It never proves Customer ownership, Manager role, resource visibility, or permission to perform a business transition.

Every protected operation evaluates:

> verified identity + local principal status + actor role + resource relationship + resource state + requested action + required assurance + purpose

The server derives actor and ownership identifiers. It never accepts them as authority from request fields.

## 2. Actors and trusted identities

| Actor | How established | Allowed authority |
|---|---|---|
| Visitor | No authenticated principal | Read intentionally published storefront/CMS resources only |
| Customer | Verified Clerk email-OTP session mapped to one active local Customer principal | Own Customer resources and allowed Customer actions |
| Manager | Verified Clerk password session with required TOTP assurance mapped to the single active Manager principal | Explicit business-management actions across the one business, subject to state/purpose/audit |
| System job | Authenticated internal job claim and handler capability | Only the named idempotent system effect; cannot impersonate Customer/Manager decisions |
| Provider webhook | Valid provider signature/replay checks and provider event identity | Update provider diagnostic/synchronization state only as allowed by that webhook contract |
| Operator | Human provider/deployment/database account outside normal application sessions | Operational administration under separate provider controls and runbooks |

There is no Worker, Driver, Reviewer, Showroom Employee, Tenant Admin, or application Super Admin in Version 1.

## 3. Authentication assurance

### Customer

- Email OTP must be successfully verified by Clerk.
- The Clerk subject must map to exactly one active local Customer principal.
- Email address is mutable contact/login data and is never an ownership key.

### Manager

- Password authentication and current TOTP second-factor assurance are required for Manager routes and commands.
- Backup codes are a provider-supported recovery factor, not an application credential.
- Public registration, Clerk public metadata, or an email allowlist alone cannot create/elevate the Manager.
- Manager bootstrap, replacement, recovery, factor changes, and local identity-link changes create Audit Events and follow the approved operator runbook.

### Sessions

- The server verifies session authenticity and resolves the local principal for each protected operation.
- Disabled, unmapped, revoked, or insufficient-assurance sessions fail closed.
- Exact session and recent-authentication windows remain `CFG-006`; no duration is assumed.
- Middleware redirects are convenience only. Server queries, commands, jobs, and file access each enforce authorization.

## 4. Decision sequence

Every protected request follows this order:

1. Establish correlation and validated request context.
2. Authenticate the provider session or trusted system/provider callback.
3. Resolve one active local principal and actor type.
4. Verify required authentication assurance.
5. Load the minimum target ownership/state context from the owning module.
6. Evaluate role, relationship, lifecycle, purpose, and field-level policy.
7. Validate command data and concurrency precondition.
8. Recheck authorization and lifecycle inside the write transaction.
9. Apply the state change with Audit Event and outbox intent atomically where required.
10. Return only fields permitted for that actor.

A stale authorization check never survives a changed target state.

## 5. Resource/action matrix

Legend: `R` read, `C` create, `U` allowed controlled update, `T` state transition, `—` denied. “Own” always means server-verified ownership.

| Resource/action | Visitor | Owning Customer | Other Customer | Manager | System/provider |
|---|---:|---:|---:|---:|---:|
| Published Product/Category/Collection/CMS read | R | R | R | R | Read projection only |
| Draft/hidden/archived catalog/CMS read | — | — | — | R | Scoped indexing/cache job |
| Catalog/CMS draft mutation/publication | — | — | — | C/U/T | Cache/search side effect only |
| Customer profile | — | R/U approved fields | — | Minimum operational R only when required | Identity sync only |
| Customer Project draft | — | C/R/U | — | — until submitted | — |
| Submit Customer Project | — | T | — | — | Transactional side effects only |
| Submitted Request | — | R | — | R/T | Notification projection only |
| Quotation draft/revision authoring | — | R after send only | — | C/U-draft/T-send | Outbox only |
| Request changes / decline current revision | — | T | — | — | — |
| Customer Acceptance | — | C/read own | — | R | Atomic coordinator creates Order |
| Order and snapshots | — | R | — | R/T as assigned below | Read/update only through scoped coordinator |
| Payment proof upload | — | C/R own | — | R with sensitive purpose/audit | Scanner only |
| Payment Verification | — | R outcome | — | C decision | Never automated |
| Production state/update | — | R | — | T | Order-ready coordination only |
| Fulfilment and handoff proof | — | R | — | C/T | Completion coordination only |
| Conversation/Message | — | C/R own | — | C/R for that Customer | Delivery/scan side effects only |
| Notification | — | R/U read state own | — | Own Manager notifications; delivery diagnostics by policy | Create/deliver scoped event |
| Private file | — | R only when parent grants own access | — | R only when business purpose grants access | Scanner/recovery role by zone |
| Sensitive payment file | — | R own as approved | — | Purpose-bound R with Audit Event | Scanner; recovery role only |
| Restricted notes/Audit Events | — | Customer-facing derived timeline only | — | Approved business audit read; no mutation | Operator/recovery policy |
| Business configuration | — | — | — | Approved business keys C/U/activate | Operator-only infrastructure keys |

## 6. Command-specific authorization

### Projects and Requests

- Only the owning Customer creates or mutates a `DRAFT` Customer Project.
- Submission requires ownership, `DRAFT` state, at least one valid item, and current allowed catalog configuration.
- Manager access begins with the Submitted Request; it does not grant permission to rewrite the Customer's submitted snapshot.
- Unapproved withdrawal/reopen/infeasibility actions are absent, not Manager overrides.

### Quotations and acceptance

- Only the Manager authors/edits a draft and sends a Quotation Revision.
- The Customer can read only Quotations for their own Submitted Request.
- Only the quoted Customer can request changes, decline, or accept the current `SENT` revision.
- The Manager, Operator, System job, provider webhook, and AI cannot accept for the Customer.
- A sent revision cannot be edited even by the Manager.

### Payment

- Only the Order Customer can create a payment-proof upload intent and submit its resulting clean Attachment.
- Customer access never crosses Order ownership.
- Manager proof access is purpose-bound to payment review and recorded as a sensitive-view Audit Event where feasible.
- Only the Manager creates `VERIFIED` or `REJECTED` Payment Verification.
- File scan/provider results cannot verify a bank payment.

### Production and fulfilment

- Only the Manager requests production transitions.
- The first production transition rechecks verified payment in the same transaction.
- No Manager privilege bypasses state sequence, handoff-proof requirements, or immutable Order Items.
- System coordination may mirror an already committed Production `READY` or fulfilment completion fact into Order state; it cannot originate the human decision.

### CMS and localization

- Only the Manager creates/edits drafts, requests review, approves translation, and publishes/hides content.
- AI or provider callbacks can create at most a labelled draft in later approved scope; they cannot approve or publish.
- Public reads return only currently published content and approved locale variants.

## 7. Field-level authorization

Resource access does not imply access to every field.

### Customer responses exclude

- internal Manager/restricted notes;
- Audit Event internal metadata;
- provider identifiers and delivery diagnostics not intended for the Customer;
- object bucket/key/version and any presigned URL after its immediate capability response;
- another Customer's identity/contact facts;
- security, abuse, scan-engine, or infrastructure details that would weaken controls.

### Manager responses exclude unless an explicit operational screen requires them

- Clerk credentials/factors/recovery secrets, which are never stored locally;
- raw provider secrets and infrastructure credentials;
- unrestricted telemetry or backup material;
- unnecessary file content or Customer data unrelated to the business task.

### Public responses contain only

published, Customer-safe catalog/CMS fields and intentionally public media derivatives. Stable internal records can exist without becoming public.

## 8. Files inherit parent authorization

An Attachment has no independent broad sharing rule. Access requires all of:

1. authenticated actor where the file is non-public;
2. parent resource exists and is visible to that actor;
3. requested action is allowed for the file classification/purpose;
4. file is in an allowed clean/available lifecycle state;
5. requested object version exactly matches authoritative metadata;
6. a short-lived object/action-specific capability is issued or the server streams the object.

Object paths and possession of an expired/old URL are never ownership evidence. A Manager's ability to view a payment proof does not permit publication, forwarding, or use as catalog media.

## 9. Database enforcement

### Roles

- Object/migration owner is not used by runtime.
- Runtime and job database roles have no superuser, ownership, or `BYPASSRLS` privilege.
- Backup/recovery and operational diagnostics use separate identities.
- Grants follow schema/module need; `PUBLIC` receives no private schema privileges.

### Row-level security

RLS is forced on Customer-owned relations as defense in depth. Every protected transaction sets trusted transaction-local principal, actor type, and Customer context. Policies permit the owning Customer or the approved Manager context. Connection pooling cannot retain context outside the transaction.

RLS does not replace command/state authorization. For example, it may allow the Manager to see an Order row, but a production transition still requires the Production command guard and verified payment.

### Constraints and triggers

Database uniqueness, foreign keys, state constraints, and narrow triggers enforce acceptance/order uniqueness, immutable history, one verified payment, allowed production pairs, and parent ownership consistency. The runtime cannot bypass those protections through a different inbound adapter.

## 10. System jobs and provider callbacks

- Jobs operate under a named handler capability and resource ID from a claimed durable record.
- A job cannot construct an arbitrary Manager actor or invoke a command requiring human judgment.
- Provider webhooks verify signature and replay state before parsing business effects.
- Clerk webhooks may synchronize identity status but never grant Manager role.
- GuardDuty events change scan lifecycle only; unknown is never clean.
- Resend events update delivery diagnostics only; they cannot alter the originating business fact.
- Vercel scheduler invocation may lease jobs only after scheduler authentication.

## 11. Denial and non-disclosure behavior

- Missing authentication returns `401`.
- Valid identity with insufficient authentication assurance returns `403` with a safe reauthentication requirement.
- Cross-Customer direct-object requests return the same `404` envelope as an unknown object where disclosure would reveal existence.
- A known owned resource in the wrong lifecycle returns a stable `409` domain-state conflict.
- Field validation returns `422` only after the caller is authorized to attempt the action.
- Responses never identify another Customer, reveal private state, or expose provider/security details.

Security-significant denials are audited with safe metadata. High-volume anonymous abuse may use operational telemetry rather than unbounded business Audit Events.

## 12. Caching and projections

- Only an explicit allowlist of published catalog/CMS queries may use shared public caching.
- Customer, Manager, signed-file, account, Project, Quotation, Order, Payment, Message, Notification, configuration, and Audit responses are private/non-shared.
- Read projections carry the same ownership classification as their source and cannot be used to bypass RLS or field filtering.
- Search projection contains public published content only.

## 13. Test obligations

Every resource/action pair has positive and negative tests covering:

- unauthenticated access;
- owning Customer versus another Customer;
- Manager with correct and insufficient assurance;
- disabled/unmapped principal;
- valid actor in invalid state;
- guessed identifiers and nested-resource mismatch;
- direct API request despite hidden UI;
- stale version/concurrent transition;
- file parent/classification/state;
- job/webhook scope, replay, and forged input;
- cache leakage and response-field minimization.

Authorization tests use two or more Customers and prove that list, search, detail, mutation, attachment, notification, and error behavior do not disclose cross-Customer existence.

## 14. Approval-dependent actions

The model supports but does not expose these actions until policy approval:

- account closure/export/anonymization;
- request withdrawal, quotation expiry/reopening, or Manager infeasibility closure;
- payment-verification correction or exception outcomes;
- cancellation, refund, return, warranty, repair, or dispute;
- production pause/delay/cancellation correction;
- delivery failure/refusal/damage/partial handoff/dispute;
- retention/purge and Customer-configurable notification opt-out;
- raw Audit Event export/view scope beyond the approved Manager operational need.

Changing a policy later adds an explicit action and matrix row; it never creates a generic Manager override.

## 15. Approval record

The Product Owner approved the actor model, resource/action matrix, RLS defense, field filtering, parent-inherited file access, Manager-assurance requirement, and absence of generic bypass on 2026-07-16. Exact policy-dependent actions remain closed until their separate approvals.

# Version 1 Implementation Backlog

**Status:** Approved by the Product Owner on 2026-07-16  
**Planning date:** 2026-07-16  
**Scope:** Complete Version 1 implementation backlog; no work item is implemented by this document

## 1. Backlog rules

- IDs are stable planning identifiers, not issue-tracker numbers or execution approval.
- “Owner” names the owning module or coordinator, not a person.
- “Outputs” describe future implementation/test/documentation results; none are created in this planning phase.
- Every task inherits the applicable Global Definition of Done in `QUALITY_GATES.md`.
- Completion always includes relevant authorization, Arabic RTL, loading/empty/error/success, accessibility, telemetry, documentation, and safe rollback/recovery evidence even when abbreviated in a row.
- Tasks touching `BP-*` or `CFG-*` remain closed, disabled, or synthetic-only until the recorded gate is approved.
- `Critical` marks the core launch dependency; `Supporting` marks required parallel/enabling work.

## 2. P0 — Delivery Foundation

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| FND-001 | Critical | Shared Platform | Approved ADRs | Deterministic Node 24/Next.js 16/strict-TypeScript project and dependency workflow | Clean install, type check, build, and documented local commands pass without application behavior |
| FND-002 | Critical | Shared Platform + all modules | FND-001 | Capability-oriented module structure and import/boundary rules | Automated tests reject framework/provider/row-type leakage into domain modules and cross-module writes |
| FND-003 | Critical | Shared Kernel | FND-001 | Identifier, UTC/business-time, Money/currency, Locale/direction, Actor, version, and result contracts | Unit/property tests prove exact money, SAR-as-configured-default, UTC storage, locale handling, and no provider types |
| FND-004 | Critical | Shared Validation/Error | FND-003, approved error/validation models | Canonical input/output schema ownership and RFC 9457 Problem Details mapping | Stable codes, safe field pointers, Arabic fallback, retry semantics, and non-disclosure tests pass |
| FND-005 | Critical | CMS and Localization + Presentation | FND-001, ADR-018 | Arabic-default `next-intl` foundation, RTL document/layout semantics, typed message catalogs | Arabic smoke renders RTL; missing keys fail; optional English is gated; French runtime scope is absent |
| FND-006 | Critical | Business Configuration + Platform | FND-003 | Typed environment/config readiness and secret/public separation | Missing required values fail closed with safe diagnostics; no secret reaches client, logs, or docs |
| FND-007 | Supporting | Audit and Operations | FND-001, FND-004 | Correlation, safe structured logging, OTel/Sentry ports, redaction rules | Correlation propagates; prohibited fields are scrubbed; telemetry failure does not alter business outcome |
| FND-008 | Critical | Delivery Platform | FND-001–FND-007 | Pull-request CI gates for static checks, tests, build, accessibility and budget hooks | A deliberate failure blocks CI; artifacts/reports are retained under documented privacy-safe policy |
| TST-001 | Critical | Test Platform | FND-001, FND-002 | Vitest projects, isolated integration categories, fixture conventions | Unit and integration test discovery is deterministic and environment isolation is verified |
| TST-002 | Critical | Test Platform + Localization | FND-005, FND-008 | Playwright projects, browser/device baseline, axe integration, console-error capture | Arabic smoke passes in supported engines/viewports with no critical axe or unexpected console failure |
| TST-003 | Supporting | Test Platform + Audit and Operations | FND-008 | Traceable quality-evidence format and gate report | Evidence links task, requirement, environment, result, owner, and exception metadata where applicable |

## 3. P1 — Trusted Data, Identity, Authorization, and Durable Operations

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| DAT-001 | Critical | Data Platform | G0, ADR-014/024 | Reviewed migration workflow using Drizzle plus authoritative SQL chain | Empty install, ordering, checksum, transaction/lock policy, no dashboard drift, and CI execution pass |
| DAT-002 | Critical | Data Platform + Shared Kernel | DAT-001, FND-003 | PostgreSQL conventions for IDs, versions, timestamps, money, locale, deletion, JSON schemas, ownership | Schema-review checks match `DATABASE_DESIGN.md`; no floating money or unowned generic tables exist |
| DAT-003 | Critical | Access and Identity + Business Configuration | DAT-002 | Principal/external identity/Customer/Manager and typed configuration persistence | One active Manager, unique external mapping, effective/audited config revisions, and fail-closed missing values are enforced |
| DAT-004 | Critical | Audit and Operations | DAT-002, FND-007 | Append-only Audit Event persistence and safe metadata schema | Update/delete is rejected; actor/correlation/state evidence is present; prohibited sensitive fields cannot persist |
| DAT-005 | Critical | Audit and Operations | DAT-002, FND-004 | Idempotency request/result, outbox, leased job, attempt, and provider-event persistence | Scope/digest uniqueness, lease recovery, deduplication, and retention hooks match approved contracts |
| DAT-006 | Critical | Access and Identity + Data Platform | DAT-003 | Runtime/job/migration roles, transaction-local actor context, forced RLS policies, field-filtering foundation | Roles lack owner/bypass privilege; pooled-context and cross-Customer tests prove isolation; Manager does not bypass state policy |
| DAT-007 | Supporting | Data Platform + Audit and Operations | DAT-001–DAT-006 | Synthetic fixtures, drift detection, backup point and restore/reconciliation harness | Fixtures contain Arabic/bidi/concurrency cases and no production data; restore/drift evidence is reproducible |
| IAM-001 | Critical | Access and Identity | FND-002, ADR-015 | Provider-neutral identity/session/assurance ports and Clerk adapter boundary | Domain contracts contain no Clerk types; provider unavailable/unmapped/disabled cases fail closed |
| IAM-002 | Critical | Access and Identity | IAM-001, DAT-003 | Signed identity synchronization and local mapping workflow | Duplicate/reordered webhooks are idempotent; roles/ownership cannot be set by untrusted provider data |
| IAM-003 | Critical | Access and Identity + Presentation | IAM-001, IAM-002 | Customer email-OTP authentication and local Customer eligibility flow | Valid own session succeeds; invalid/expired/unmapped/disabled paths are accessible, safe, and audited where required |
| IAM-004 | Critical | Access and Identity + Presentation | IAM-001, IAM-002 | Manager password/TOTP/backup-code assurance and reauthentication boundary | Only the single Manager obtains Manager context; required MFA actions reject insufficient assurance; no bypass exists |
| IAM-005 | Critical | Access and Identity + all modules | DAT-006, IAM-003, IAM-004 | Actor-scoped authorization service and command/query enforcement pattern | Full actor/owner/state/action/assurance matrix passes including non-disclosing cross-Customer denial |
| OPS-001 | Critical | Audit and Operations | DAT-005, FND-007 | Bounded outbox/job dispatcher and authenticated reconciliation entry contract | Concurrent runs lease safely; crash/timeout resumes; poison work is visible; no in-memory timer owns correctness |
| TST-004 | Critical | Test Platform + Data Platform | DAT-001 | Disposable production-major PostgreSQL integration harness | Parallel tests are isolated; migrations apply from empty; teardown cannot address staging/production |
| TST-005 | Critical | Test Platform + Access and Identity | DAT-006, IAM-005 | Generated authorization/RLS negative matrix | Visitor/Customer A/Customer B/Manager/system cases pass for representative public/private resources and pooled connections |
| TST-006 | Critical | Test Platform + Audit and Operations | DAT-004, DAT-005, OPS-001 | Transaction, idempotency, outbox, job and provider-event failure suite | Rollback, replay, duplicate, stale lease, reordered event, and recovery cases yield one semantic outcome |

## 4. P2 — Discovery, Content, Search, and Files

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| CAT-001 | Critical | Catalog and Search | G1, DAT-002 | Product, Category, Collection, Material, Color, Option and assignment domain/persistence | Ownership, active/publication state, uniqueness and relational rules match approved design |
| CAT-002 | Critical | Catalog and Search | CAT-001, FND-003 | Bounded Product configuration rules and validation | Only approved Version 1 rule types exist; invalid combinations/dimensions reject server-side; no expression engine appears |
| CAT-003 | Critical | Catalog and Search + Presentation | CAT-001, CAT-002, IAM-005 | Manager catalog authoring and publication commands/surfaces | MFA Manager-only writes, optimistic concurrency, audit, complete states, and Arabic publication prerequisites pass |
| CAT-004 | Critical | Catalog and Search | CAT-001, CMS-002 | Public catalog detail/list query contracts and cache policy | Only published safe fields/approved translations return; drafts/internal costs/storage keys never leak |
| CAT-005 | Critical | Catalog and Search + Audit and Operations | CAT-004, DAT-005 | PostgreSQL Arabic search projection, normalization and durable refresh | Published-only index, ranking fixtures, injection safety, idempotent refresh and cache reconciliation pass |
| CAT-006 | Critical | Catalog and Search + Presentation | CAT-004, FND-005 | Arabic storefront, discovery, browse, search and Product detail experience | Mobile/desktop RTL, keyboard, loading/empty/error/success, SEO metadata, axe and no-console checks pass |
| CAT-007 | Supporting | Catalog and Search + Presentation | CAT-006, FIL-006 | Responsive basic media/gallery/zoom and cache budgets | Q-MED/Q-PERF/Lighthouse budgets pass; originals are not served; advanced 360 behavior is absent |
| CMS-001 | Critical | CMS and Localization | G1, DAT-002 | CMS Content/localizable resource/version domain and persistence | Mutable draft and immutable approved/published version boundaries are enforced |
| CMS-002 | Critical | CMS and Localization | CMS-001, FND-005 | Arabic source and optional-English Translation revision workflow | Human approval, source-revision linkage, stale detection, Arabic fallback/gating, and no French publication pass |
| CMS-003 | Critical | CMS and Localization + Presentation | CMS-002, IAM-005 | Manager editorial review/publication commands and surfaces | Manager-only transitions, optimistic versions, audit/outbox, accessible states, and complete Arabic validation pass |
| CMS-004 | Critical | CMS and Localization | CMS-003 | Public CMS query/cache/invalidation contracts | Only current approved versions return; cache invalidation is durable; drafts and keys never leak |
| CMS-005 | Supporting | CMS and Localization + Audit | CMS-003 | Editorial version history and correction readiness boundary | Historical versions are immutable/auditable; unsupported legal correction/retirement actions stay policy-gated |
| FIL-001 | Critical | Files and Media | G1, DAT-002 | File object, upload intent, scan event, attachment and parent-link metadata | Classification/zone/purpose/owner/S3 version/checksum/lifecycle relationships are enforced |
| FIL-002 | Critical | Files and Media + Storage Adapter | FIL-001, IAM-005 | Purpose-scoped signed upload-intent flow | Capability binds actor, purpose, key, content constraints and expiry; server never trusts client storage keys |
| FIL-003 | Critical | Files and Media | FIL-002 | Finalization, metadata/signature/MIME/checksum validation and quarantine | Incomplete/mismatched/oversized/unsupported files remain unusable with recoverable safe errors |
| FIL-004 | Critical | Files and Media + GuardDuty Adapter | FIL-003, DAT-005 | Signed/deduplicated scan-event lifecycle for clean/malicious/failed/unknown results | Duplicate/reordered/late events converge safely; only clean files become usable; real external use waits for GuardDuty trigger |
| FIL-005 | Critical | Files and Media + owning modules | FIL-001, DAT-006 | Parent-inherited authorization and short-lived private download | Cross-Customer, wrong-purpose, expired and guessed-key attempts fail without existence disclosure; sensitive views audit |
| FIL-006 | Critical | Files and Media + Catalog/CMS | FIL-004, CAT-003, CMS-003 | Explicit public-media promotion and optimized-derivative references | Only Manager-approved clean catalog/CMS media promotes; Customer/payment files cannot enter public zone |
| FIL-007 | Supporting | Files and Media + Audit and Operations | FIL-001–FIL-006 | Object/version reconciliation, orphan/missing detection and recovery records | Reordered/missing events and metadata/object drift are observable, retryable, and covered by recovery procedure |
| TST-007 | Critical | Test Platform + Catalog/CMS | CAT-001–CAT-005, CMS-001–CMS-005 | Domain/database/publication integration suite | Draft/public/translation/configuration/history and cache invalidation cases pass |
| TST-008 | Critical | Test Platform + Catalog | CAT-005 | Arabic search corpus and query-plan/performance suite | Approved representative queries meet relevance baseline and Q-API target under documented profile |
| TST-009 | Critical | Test Platform + Files/Security | FIL-001–FIL-007 | File threat/authorization/provider contract suite | Type confusion, malware, duplicate events, capability leakage, zone isolation, and recovery tests pass |
| TST-010 | Critical | Test Platform + Presentation | CAT-006, CAT-007, CMS-004 | Arabic Visitor discovery Playwright/accessibility/performance journey | Published content works across accepted matrix; unpublished/private content remains inaccessible; quality budgets pass |

## 5. P3 — Customer Projects, Clarification, and Messaging

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| PRJ-001 | Critical | Customer Projects | G2, CAT-002 | Customer Project/Project Item/Product Configuration aggregate and lifecycle | Ownership, allowed draft states, multi-item rules, versions, and no Saved Design persistence match contracts |
| PRJ-002 | Critical | Customer Projects | PRJ-001, IAM-005 | Actor-scoped Project commands/queries and persistence | Server derives Customer/prices/rules; ETag and non-disclosure behavior pass |
| PRJ-003 | Critical | Customer Projects + Presentation | PRJ-002 | Arabic multi-item build/configure experience | Standard/configured items, validation, accessible controls, responsive states, and error recovery pass |
| PRJ-004 | Critical | Customer Projects + Audit/Notifications | PRJ-002, DAT-004, DAT-005 | Atomic submit coordinator and complete immutable Submitted Request snapshot | Current catalog rules revalidate; exactly one snapshot/audit/outbox commits; draft history cannot mutate it |
| PRJ-005 | Critical | Customer Projects + Presentation | PRJ-004, IAM-005 | Manager review queue/detail and clarification initiation | Manager-only access, safe Customer-visible/internal fields, loading/empty/error/success and audit pass |
| PRJ-006 | Supporting | Customer Projects | PRJ-004 | Customer/Manager submitted-history read projections | Snapshot renders independently of live catalog; pagination/freshness/ownership and Q-API target pass |
| MSG-001 | Critical | Messaging | G2, IAM-005 | One Conversation per Customer, immutable Message and context-link domain/persistence | Customer/Manager membership, stable context validation, ordering and no edit/delete endpoints are enforced |
| MSG-002 | Critical | Messaging | MSG-001, FND-004 | Send/list/read commands and idempotent client message key | Duplicate send yields one Message; original content is preserved safely; cross-Customer access is hidden |
| MSG-003 | Critical | Messaging + Files | MSG-002, FIL-005 | Private clean attachment association by approved purpose | Wrong parent/purpose/owner/scan state rejects; downloads inherit Message/Conversation authorization |
| MSG-004 | Critical | Messaging + Presentation | MSG-002, MSG-003 | Continuous Arabic conversation experience with Project/Order context | Keyboard/screen-reader/bidi, upload/retry, empty/loading/error/success, responsive and no-console checks pass |
| MSG-005 | Supporting | Messaging + Audit/Operations | MSG-002 | Audit/notification intent and operational failure visibility | Business message persists independently of notification provider; duplicates/retries remain observable |
| TST-011 | Critical | Test Platform + Customer Projects | PRJ-001, PRJ-004 | Project/configuration/submission unit and property suite | Multi-item, invalid-current-rule, stale version, replay and snapshot-stability cases pass |
| TST-012 | Critical | Test Platform + Projects/Messaging | PRJ-002–PRJ-006, MSG-001–MSG-005 | Real-PostgreSQL transaction/authorization/concurrency suite | Customer isolation, atomic submission, attachment inheritance, pagination and rollback pass |
| TST-013 | Critical | Test Platform + Presentation | PRJ-003, PRJ-005, MSG-004 | Customer submit and Manager clarification Playwright journey | Arabic RTL path completes with all states, axe, browser matrix subset and no console error |

## 6. P4 — Quotations, Acceptance, and Orders

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| QUO-001 | Critical | Quotations and Acceptance | G3, FND-003 | Quotation, Revision, Item, price component and lifecycle domain/persistence | Numbering, money totals, source trace, current sent uniqueness and immutable sent-state rules pass |
| QUO-002 | Critical | Quotations and Acceptance | QUO-001, IAM-005 | Manager draft authoring/update/delete for drafts only | Manager MFA, optimistic versions, derived totals, complete terms and safe validation pass |
| QUO-003 | Critical | Quotations and Acceptance + Audit/Notifications | QUO-002, DAT-004, DAT-005 | Atomic send/supersede coordinator | Complete revision freezes with audit/outbox; prior sent revision supersedes; rollback leaves no partial state |
| QUO-004 | Critical | Quotations and Acceptance | QUO-003 | Customer quotation/current-action/history queries and change-request command | Own-only immutable history, current action, localized Money/terms and recorded change request pass |
| QUO-005 | Critical | Quotations and Acceptance + Presentation | QUO-002–QUO-004 | Manager authoring and Customer review/decision experiences | Arabic responsive tables/forms/history, accessible comparison, error/stale/retry/success states pass |
| QUO-006 | Supporting | Quotations and Acceptance + Audit | QUO-003, QUO-004 | Stable error/audit/notification mappings for revision actions | Codes and events match approved catalog; sensitive/internal fields are excluded |
| ORD-001 | Critical | Orders | QUO-001, FND-003 | Order aggregate, immutable Order Item/price/terms/identity/fulfilment snapshot persistence | Snapshot schema completeness, ownership, initial states and no mutable catalog dependency pass review |
| ORD-002 | Critical | Quotations/Orders/Fulfilment coordinator | QUO-003, ORD-001, DAT-005 | Serializable/locked idempotent Acceptance transaction | Exactly one Acceptance and Order commit with initial Payment/Production/Fulfilment, Audit and outbox; all-or-nothing proven |
| ORD-003 | Critical | Orders | ORD-001, ORD-002 | Customer/Manager Order summary/detail/history queries | Own/Manager field filtering, immutable display facts, pagination and cache/privacy rules pass |
| ORD-004 | Supporting | Orders | ORD-003 | Customer-safe Order timeline projection | Events are authorized, ordered, localized and exclude raw audit/internal/provider data |
| ORD-005 | Critical | Orders + Data Platform | ORD-001, ORD-002 | Database immutability/uniqueness/transition protections | Update/delete, duplicate acceptance/order and direct invalid state changes fail even outside UI path |
| ORD-006 | Critical | Orders + Presentation | ORD-003, ORD-004 | Awaiting-payment Order/history experience | Arabic/mobile/desktop/loading/empty/error/success/accessibility/no-console evidence passes |
| TST-014 | Critical | Test Platform + Quotations | QUO-001–QUO-004 | State/Money/revision unit-property suite | All transition rows, totals, numbering, freeze, supersede and stale cases pass |
| TST-015 | Critical | Test Platform + Quotations/Orders | ORD-001, ORD-002, ORD-005 | Acceptance transaction/concurrency/failure-injection suite | Same/different keys, concurrent Customers requests, rollback points and one-order uniqueness pass |
| TST-016 | Critical | Test Platform + Security | QUO-004, ORD-003–ORD-005 | Commercial history authorization/immutability suite | Customer isolation and every forbidden mutation/direct request fail without leaking existence |
| TST-017 | Critical | Test Platform + Presentation | QUO-005, ORD-006 | Manager quote/revise and Customer accept Playwright journey | One current revision accepted once; awaiting-payment snapshot matches agreement across Arabic core browsers |

## 7. P5 — Payment Proof and Verification

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| PAY-001 | Critical | Payments | G4, ORD-001 | Payment, immutable Submission, immutable Verification/decision lifecycle persistence | Allowed states, one verified fact, attempt history and Order ownership constraints pass |
| PAY-002 | Critical | Payments + Files | PAY-001, FIL-004, FIL-005 | Clean own proof-to-Payment Submission command | Correct purpose/Order/Customer/scan/version required; replay is safe; upload alone never changes verification state |
| PAY-003 | Critical | Payments + Presentation | PAY-002, IAM-005 | Manager review queue/detail and audited sensitive proof download | MFA Manager-only access, field minimization, short-lived capability, audit and complete UI states pass |
| PAY-004 | Critical | Payments/Orders coordinator | PAY-001, PAY-003, DAT-005 | Idempotent manual verify/reject transactions | Manager decision changes Payment/Order/Audit/outbox exactly once; verification unlocks but does not start Production |
| PAY-005 | Supporting | Payments + Orders | PAY-001, PAY-004 | Customer/Manager payment state and immutable attempt/decision projections | Own-only history, safe reason presentation, current next action and no raw proof in lists pass |
| PAY-006 | Supporting | Payments + Audit/Notifications | PAY-002, PAY-004 | Payment Received/Verified event and audit mappings | Events follow committed fact, contain no proof bytes/URL, deduplicate and remain retryable |
| TST-018 | Critical | Test Platform + Payments/Files | PAY-001, PAY-002 | Submission/file lifecycle integration suite | Invalid/unsafe/duplicate/late/reordered/expired/wrong-owner cases and clean success pass |
| TST-019 | Critical | Test Platform + Security | PAY-003, PAY-005 | Sensitive payment authorization/cache/log suite | Cross-Customer, insufficient-MFA, list leakage, cache and telemetry leakage tests pass |
| TST-020 | Critical | Test Platform + Payments/Orders | PAY-004 | Manual decision idempotency/concurrency/rollback suite | Proof/provider/job cannot verify; concurrent decisions yield one authoritative outcome; rollback is complete |
| TST-021 | Critical | Test Platform + Presentation | PAY-002–PAY-005 | Customer proof/recovery and Manager verify Playwright journey | Arabic accessible flow proves rejection/replacement history and no automatic production start |

## 8. P6 — Production and Fulfilment

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| PRO-001 | Critical | Production | G5, PAY-004 | Order-level Production domain and exact transition policy | Accepted sequence/rework pairs pass; no Order Item production state/API/relation exists |
| PRO-002 | Critical | Production + Data Platform | PRO-001 | Current Production and immutable ordered update persistence | Sequence/version uniqueness, from/to checks, timestamps and update immutability pass |
| PRO-003 | Critical | Production/Payments/Orders coordinator | PRO-002, PAY-004, IAM-005 | Named Manager transition commands with first-transition payment recheck | MFA, verified-payment, expected state/version, audit/outbox and rollback pass atomically |
| PRO-004 | Critical | Production + Presentation | PRO-003 | Manager controls and Customer-safe production timeline | Only valid action appears, but direct requests remain guarded; Arabic accessible states pass |
| PRO-005 | Supporting | Production + Notifications/Audit | PRO-003 | Production Started/Ready facts and timeline/audit mappings | One event per committed semantic transition; safe notes/reasons and retryability pass |
| FUL-001 | Critical | Fulfilment | ORD-001, PRO-001 | Fulfilment aggregate initialized from accepted method/address/location/price snapshots | Method-specific immutable facts and initial state are present without live config dependency |
| FUL-002 | Critical | Fulfilment | FUL-001, PRO-003 | Pickup readiness and completion transitions | Production READY prerequisite, accepted pickup location and allowed actor/evidence rules pass |
| FUL-003 | Critical | Fulfilment | FUL-001, PRO-003 | Delivery readiness and completion transitions | Production READY, accepted address/price and allowed actor/evidence rules pass |
| FUL-004 | Critical | Fulfilment + Files | FUL-002, FUL-003, FIL-005 | Clean handoff-proof association and validation | Correct Order/method/purpose/actor/scan required; evidence private, versioned, immutable and audited |
| FUL-005 | Critical | Fulfilment/Orders coordinator | FUL-004, DAT-005 | Idempotent fulfilment/order completion transaction | Handoff proof, Fulfilment and Order complete with audit/outbox once; unsupported exception transitions reject |
| FUL-006 | Critical | Fulfilment + Orders + Presentation | FUL-002–FUL-005 | Manager handoff controls and Customer fulfilment/timeline experience | Pickup/delivery paths are localized, responsive, accessible, authorized and snapshot-backed |
| TST-022 | Critical | Test Platform + Production | PRO-001–PRO-003 | Table-driven transition/property/concurrency suite | Every accepted/forbidden pair, rework, replay, stale and skipped state case passes |
| TST-023 | Critical | Test Platform + Security | PRO-003 | Verified-payment production gate suite | UI/direct/database attempts before verification fail; no config/Manager/job bypass exists |
| TST-024 | Critical | Test Platform + Fulfilment/Files | FUL-001–FUL-005 | Method/evidence/authorization/completion integration suite | Wrong method/owner/evidence/state, duplicate completion and unresolved exception cases fail safely |
| TST-025 | Critical | Test Platform + Presentation | PRO-004, FUL-006 | Verified-payment-to-production-to-handoff Playwright journey | Arabic pickup and delivery representative paths complete with exact snapshots and the applicable accepted essential-event intents |

## 9. P7 — Workspaces and Essential Notifications

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| WRK-001 | Critical | Composed Reads + Presentation | G6 | Customer dashboard for Projects, Quotes, Orders, payment, production, fulfilment, Messages, Notifications | Own-only projections, next actions, full states, Arabic/mobile/accessibility and Q-API targets pass |
| WRK-002 | Critical | Composed Reads + Presentation | G6 | Manager request/quotation queues and detail navigation | Single-Manager authorization, freshness, filters/pagination and operational empty/error/retry states pass |
| WRK-003 | Critical | Composed Reads + Presentation | G6 | Manager payment/production/fulfilment queues | Sensitive field minimization, action-state accuracy, MFA boundaries and accessibility pass |
| WRK-004 | Supporting | Catalog Search + Composed Reads | WRK-001–WRK-003 | Safe operational search/filter/sort projections | No advanced analytics/warehouse; no private data enters public index; query plans meet target |
| WRK-005 | Supporting | Presentation + Localization | WRK-001–WRK-003 | Cross-workspace responsive navigation and universal states | RTL/bidi, supported widths/inputs, no raw keys, no console errors and optional-English gating pass |
| NOT-001 | Critical | Notifications | All core event contracts | Typed registry for seven essential events, recipients, channels and idempotency identity | Every event maps to allowed recipient/template facts; no optional/push event is silently activated |
| NOT-002 | Critical | Notifications + Localization | NOT-001, CMS-002 | Versioned Arabic in-app/email templates and optional-English gating | Human-approved content, escaping/bidi/accessibility, schema validation and sensitive-field exclusion pass |
| NOT-003 | Critical | Notifications + Data Platform | NOT-001, DAT-005 | In-app Notification fan-out/read/unread persistence and queries | One semantic notification per recipient/event; own-only reads; replay/dedupe and pagination pass |
| NOT-004 | Critical | Notifications + Resend Adapter | NOT-002, OPS-001 | Provider-neutral email dispatch and signed delivery callback | Provider idempotency, transient/permanent mapping, signature/replay and no provider authority pass |
| NOT-005 | Critical | Notifications + Audit/Operations | NOT-003, NOT-004 | Delivery attempts, retry/dead-letter/reconciliation and status visibility | Outage/delay/duplicate tests preserve business truth and expose actionable recovery without repeating transition |
| NOT-006 | Supporting | Notifications + Presentation | NOT-003, NOT-005 | Customer notification center and Manager delivery-operations view | Authorized safe fields, full states, Arabic accessibility and no raw provider/secrets pass |
| TST-026 | Critical | Test Platform + Notifications | NOT-001–NOT-003 | Event/template/in-app unit and integration suite | Seven events, locale, schema, dedupe, ownership and missing-template fail-closed cases pass |
| TST-027 | Critical | Test Platform + Provider Adapters | NOT-004, NOT-005 | Resend/outbox/provider outage and replay contract suite | Duplicate/late/failed callbacks and outages recover without duplicate business effects |
| TST-028 | Critical | Test Platform + Security | WRK-001–WRK-004, NOT-006 | Dashboard/projection authorization and field-leak suite | Cross-Customer, stale action, cache, internal note, proof and provider metadata leakage tests pass |
| TST-029 | Critical | Test Platform + Presentation | WRK-001–WRK-005, NOT-006 | Full Customer/Manager workflow and seven-notification Playwright suite | All core journeys and universal states pass in Arabic with accepted accessibility/browser subset |

## 10. P8 — Release Candidate Hardening

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| HARD-001 | Critical | Product/Architecture QA | G7 | Requirement/domain/state/API/backlog traceability and scope audit | Every Version 1 requirement has implementation/test evidence; deferred features have no active route/schema/module |
| HARD-002 | Critical | Security + all modules | G7 | Threat-model review and remediation for identity, authorization, XSS, files, webhooks, cache/log leakage | No open critical/high exploitable issue or authorization bypass; reviewed exceptions exclude non-waivable invariants |
| HARD-003 | Critical | Accessibility + Presentation | G7 | WCAG 2.2 AA automated/manual evidence and remediation | Zero critical automated violations and no unresolved A/AA failures across core workflows |
| HARD-004 | Critical | Localization + Presentation | G7 | Full Arabic RTL/bidi/key/content and accepted browser/device evidence | All routes Arabic-complete; optional English only where complete; French absent; matrix passes |
| HARD-005 | Critical | Performance + Data/Presentation | G7 | Lighthouse/media/CWV lab, query-plan and k6 evidence under documented profiles | Every accepted Q-WEB/Q-PERF/Q-MED/Q-API target passes or has valid non-prohibited exception |
| HARD-006 | Critical | Reliability + Provider Adapters | G7 | Timeout/outage/replay/job/scan/cache resilience report | Core transaction remains consistent; side effects recover; error/availability instrumentation works |
| HARD-007 | Critical | Data Platform | G7 | Empty/prior-version migration, lock/backfill/rollback/forward-recovery rehearsal | Migration chain, compatibility, integrity, query plans, rollback and no drift pass in staging |
| HARD-008 | Critical | Data/Files/Operations | G7 | Database restore and versioned private-object reconciliation exercise | Accepted RPO ≤1h/RTO ≤4h evidence, missing/orphan checks, owner and remediation recorded |
| HARD-009 | Critical | Release Management | HARD-001–HARD-008 | Frozen release-candidate bill of evidence, defect disposition and change control | All G8 sign-offs, no release blocker, exact artifact/config/migration set and rerun scope recorded |
| TST-030 | Critical | Test Platform | All feature tasks | Full static/unit/property suite | Deterministic pass with critical domain/auth branches fully behavior-covered |
| TST-031 | Critical | Test Platform + Data | All feature tasks | Full PostgreSQL migration/integration/concurrency/provider-contract suite | Empty/upgrade, invariants, RLS, transactions, outbox, search, files and adapters pass |
| TST-032 | Critical | Test Platform + Presentation | All feature UI tasks | Full Playwright/browser/RTL/axe journey matrix | Twelve approved journeys plus universal states pass with no unexpected console errors |
| TST-033 | Critical | Security | HARD-002 | Security automation and focused manual review evidence | Dependency/secret/SAST/headers/CSP/upload/webhook/auth/cache/log checks pass |
| TST-034 | Critical | Performance | HARD-005 | Repeatable Lighthouse/k6/query/media measurements | Profiles and datasets documented; targets pass without changing route/profile to conceal regression |
| TST-035 | Critical | Operations | HARD-006–HARD-008 | Restore, rollback, reconciliation, alert and incident exercise evidence | Exercises are timed, complete, owned, and corrective actions resolved or release-blocking |

## 11. P9 — Production Readiness and Launch

| ID | Path | Owning module(s) | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| REL-001 | Critical | Product Owner + Business Configuration | G8, GOV tasks | Approved release-affecting policy/configuration register and Arabic public wording | No released path depends on an unresolved value; effective versions/owners and fail-closed behavior verified |
| REL-002 | Critical | Deployment + Security | G8 | Environment/secret/domain/access inventory and least-privilege production plan | Environments isolated; previews use non-production data; rotation/ownership documented; no secret exposed |
| REL-003 | Critical | Provider Adapters + Operations | REL-002 | Staged Supabase/Clerk/AWS/Resend/Vercel/Sentry readiness evidence | Each provider meets accepted trigger, region/legal/budget, smoke, alert, outage and exit conditions |
| REL-004 | Critical | Data Platform + Deployment | HARD-007, REL-002 | Reviewed production migration order, backup point, compatibility and rollback/forward-recovery plan | Independent reviewer approves lock/runtime/data risks and exact verification/abort criteria |
| REL-005 | Critical | Data/Files/Operations | HARD-008, REL-003 | Current production backup/PITR/version/reconciliation and restore schedule | RPO/RTO, monthly owner, alarms and isolated restore procedure are verified before launch |
| REL-006 | Critical | Observability + Operations | HARD-006, REL-003 | SLO dashboards, critical-journey/queue/backup/security/spend alerts and scrubbed telemetry | Test alerts reach owner; sensitive fields absent; runbook links and escalation are current |
| REL-007 | Critical | Operations + Security | REL-003–REL-006 | Incident, provider outage, credential, Manager recovery, rollback, reconciliation and support runbooks | Named owners execute tabletop/smoke drills successfully; no undocumented console-only dependency remains |
| REL-008 | Critical | Product Owner + Manager | REL-001, HARD-009 | Manager acceptance test and operational sign-off | Manager completes all queues/journeys/recovery scenarios in Arabic with approved policies/content |
| REL-009 | Critical | Product Owner + Release Management | REL-001–REL-008 | Launch decision, monitored promotion steps, abort/rollback thresholds and post-launch verification | G9 signed explicitly; production deployment remains a separate authorized action |

## 12. Governance and decision lane

These tasks run in parallel with engineering but are owned by the Product Owner/authorized operations roles. They do not select answers in this plan.

| ID | Target gate | Owning role/module | Depends on | Expected outputs | Completion criteria |
|---|---|---|---|---|---|
| GOV-001 | Continuous | Product Owner + Documentation | Implementation-plan approval | Decision/change register synchronized across authoritative documents | Each decision records owner/date/rationale/conditions; duplicates and contradictions are removed |
| GOV-002 | G4/G9 | Product Owner + Quotations/Payments | `BP-001`, `BP-002` | Approved quotation, expiry/withdrawal/infeasibility, discount/rounding/tax/invoice policies or explicit unavailable paths | Every affected command, public term and test has one approved policy source; no default invented |
| GOV-003 | G5/G9 | Product Owner + Payments/Security | `BP-003` | Approved payment exception, correction/escalation and retention policy or explicit unavailable paths | Verification/rejection/correction surfaces and evidence retention match approved policy/legal review |
| GOV-004 | G6/G9 | Product Owner + Orders/Production | `BP-004`, `BP-005` | Approved cancellation/refund/return/warranty/repair/dispute and production exception policy or explicit unavailable paths | Unapproved transitions remain absent; published Customer policy and Manager procedures align |
| GOV-005 | G6/G9 | Product Owner + Fulfilment | `BP-006` | Approved recipient, failure/refusal/damage/partial/dispute/service-area/scheduling policy or explicit unavailable paths | Handoff behavior, evidence and Customer wording have one approved source |
| GOV-006 | G1/G9 | Product Owner + Access/Operations | `BP-007` | Account lifecycle, Manager continuity and recovery operating policy | Access/recovery tests and support runbooks use approved actors; no hidden super-admin is introduced |
| GOV-007 | G2/G7/G9 | Product Owner + Security/Files/Messaging/Notifications | `BP-008`, `BP-009` | Classification-specific retention/deletion/recovery and optional communication policy | Lifecycle jobs/actions remain disabled until policy; privacy/security/legal approval is recorded |
| GOV-008 | G2/G9 | Product Owner + CMS/Localization | `BP-010` | Optional-English scope and editorial/legal correction/retirement/version policy | Published scope and Arabic policy pages are approved; no partial language or silent rewrite occurs |
| GOV-009 | Affected gates/G9 | Product Owner + Business Configuration | `CFG-001`–`CFG-008` | Approved typed values, owners, effective dates and validation for each enabled feature/environment | Readiness check passes; missing-value cases fail closed; values are audited rather than hard-coded |
| GOV-010 | G9 | Product Owner + Security/Deployment | ADR staged conditions | Approved regions/data-residency/legal posture, budgets, provider ownership and purchase triggers | Current provider evidence is checked at trigger and no production resource is used before authorization |

## 13. Backlog completion rule

The Version 1 backlog is complete only when every Critical task is Done, every Supporting task required by the released scope is Done, all G0–G9 evidence is approved, and no unresolved policy/configuration affects a released behavior. Tasks cannot be marked Done by deleting or weakening an accepted Quality Gate.

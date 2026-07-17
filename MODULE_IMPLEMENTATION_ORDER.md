# Version 1 Module Implementation Order

**Status:** Approved by the Product Owner on 2026-07-16  
**Architecture:** Approved modular monolith  
**Rule:** Ordering follows business/data dependencies, not UI navigation or provider preference

## 1. Ordering principles

- A module owns its domain rules, persistence, application operations, public contracts, audit mapping, and tests.
- Shared contracts are stabilized before parallel consumers begin.
- Only the owning module writes its records.
- Cross-module transactions are implemented after participant contracts pass independently.
- Provider adapters may be developed against contract fixtures in parallel; live integration waits for the relevant environment gate.
- Migrations, shared contracts, generated artifacts, localization catalogs, lockfiles, and global build/test configuration are serialized.
- A future module may consume an earlier read contract but cannot reach into its persistence model.

## 2. Implementation waves

| Wave | Modules/lane | Why now | Must wait for | Safe parallel work |
|---|---|---|---|---|
| W0 | Shared Platform, Shared Kernel, Localization foundation, Test Platform | Establishes language, quality, boundary, and value contracts used everywhere | Approved plan | Four disjoint lanes after runtime baseline |
| W1 | Data Platform, Access and Identity, Audit and Operations, Business Configuration | Creates trusted actor/data/transaction/durability foundation | W0 contracts | Data conventions, identity port, telemetry/audit design after contract freeze |
| W2 | Catalog and Search, CMS and Localization, Files and Media, public Presentation | Supplies published products/content, configuration reads, and secure file capability | G1 | Catalog, CMS, Files, and storefront lanes; integration points serialized |
| W3 | Customer Projects, Messaging, Customer/Manager request Presentation | Creates immutable Customer intent and clarification channel | Catalog rules, identity, files | Projects and Messaging domain lanes; submission integration single-owner |
| W4 | Quotations and Acceptance, Orders, initial Fulfilment snapshot | Establishes immutable commercial boundary and Order creation | Submitted Request | Quotation authoring and Order snapshots; Acceptance integration serialized |
| W5 | Payments and sensitive Files integration | Establishes manual verification boundary | Orders, clean-file lifecycle | Payment model/read UI and security test lane; decision coordinator serialized |
| W6 | Production, Fulfilment, Orders timeline | Completes verified-payment-to-handoff transaction | Verified Payment | Production and Fulfilment domains; two cross-module joins serialized |
| W7 | Notifications, composed Customer/Manager workspaces, provider delivery adapters | Makes the workflow operable and recoverable | Stable core event/read contracts | Workspaces, templates, in-app, email adapter, operational views |
| W8 | Cross-cutting hardening and Release Management | Produces one qualified release candidate | Full core workflow | Security, accessibility, localization/browser, performance, resilience, migration/recovery lanes |

## 3. Module dependency register

| Module | Hard prerequisites | First implementation output | Completion boundary | Downstream consumers |
|---|---|---|---|---|
| Shared Platform | None beyond approved ADRs | Runtime/build/config/module-boundary foundation | Clean reproducible build/CI and server-only boundary proof | Every module |
| Shared Kernel | Shared Platform | Money, ID, Actor, Locale, time, version and result concepts | Unit/property evidence and no framework/provider coupling | All domain/application modules |
| Test Platform | Shared Platform | Unit/integration/browser/quality evidence harness | Failing checks block CI; isolated real-PostgreSQL path ready | Every phase |
| CMS and Localization foundation | Shared Platform/Kernel | Arabic default, typed messages, RTL/bidi/formatting foundation | Arabic smoke and missing-key gates pass | Every presentation, notification and content module |
| Data Platform | Shared Platform/Kernel/Test Platform | Migration/convention/transaction foundation | Empty apply, drift, role, lock, restore and compatibility checks | All persistent modules |
| Business Configuration | Shared Kernel/Data Platform/Audit | Typed versioned config registry | Effective/audited/fail-closed values; no general rules engine | Catalog, Quotations, Payments, Production, Fulfilment, Notifications, Release |
| Access and Identity | Shared Kernel/Data Platform | Clerk-to-local principal/actor boundary | Customer/Manager assurance and authorization matrix pass | Every protected module |
| Audit and Operations | Data Platform/Telemetry | Audit, idempotency, outbox, jobs, provider-event handling | Atomicity, append-only, retry, dedupe and recovery pass | Every state-changing module and provider adapter |
| Files and Media | Identity/Data/Audit/Storage adapter | Classified upload/scan/access lifecycle | Private-by-default, clean-before-use, parent authorization, recovery pass | Catalog/CMS media, Projects, Messaging, Payments, Fulfilment |
| Catalog and Search | Identity/Data/Config/Audit/Localization | Published catalog/configuration/search contracts | Manager publication and Arabic public reads/search pass | Projects, Quotations, Storefront |
| CMS and Localization content | Identity/Data/Audit/Localization | Versioned Content/Translation publication | Arabic-approved public versions and optional-English gating pass | Storefront, policy pages, Notifications |
| Customer Projects | Identity/Catalog/Data/Audit | Draft and immutable Submitted Request | Atomic submission/snapshot/ownership pass | Quotations, Manager workspace, Messaging context |
| Messaging | Identity/Data/Files/Audit | Continuous Conversation and immutable Messages | Own/Manager access, context, attachment and retry pass | Projects/Orders workspaces, Notifications |
| Quotations and Acceptance | Submitted Request/Config/Data/Audit | Revision authoring/send/supersede | Current-sent-only immutable Revision contract passes | Acceptance coordinator, Orders, Payments |
| Orders | Quotations/Shared values/Data | Immutable Order/Item/commercial snapshot contract | Historical independence and ownership pass | Payments, Production, Fulfilment, workspaces |
| Acceptance coordinator | Quotations/Orders/Fulfilment init/Audit/Operations | Atomic accept-and-create-Order use case | Exactly-once/concurrent/all-or-nothing evidence passes | Payments and all post-acceptance work |
| Payments | Orders/Files/Identity/Audit | Submission and manual Verification | Sensitive access, history, idempotency and no-auto-verification pass | Production, dashboards, Notifications |
| Production | Orders/verified Payment/Audit | Order-level state/update lifecycle | Exact sequence and verified-payment first-transition guard pass | Fulfilment, timelines, Notifications |
| Fulfilment | Orders/Production READY/Files/Audit | Pickup/delivery and handoff lifecycle | Accepted snapshot/method/evidence/completion rules pass | Orders completion, workspaces, Notifications |
| Notifications | Stable domain events/Localization/Audit/Operations | Event registry, in-app and email delivery | Seven events, dedupe, provider isolation and recovery pass | Customer/Manager workspaces and operations |
| Composed Workspaces | Stable module read contracts/Identity | Customer dashboard and Manager queues | Own/Manager fields, freshness, full states, performance pass | Release candidate |
| Observability/Operations | Shared telemetry plus all critical journeys | SLO/queue/security/backup/spend signals and runbooks | Alerts/drills/scrubbing/reconciliation pass | Release Management |
| Release Management | All modules/gates/policy/config approval | Frozen release candidate and launch evidence | G8/G9 signed; deployment remains separately authorized | Production operation |

## 4. Sequential integration points

The following work must not be split across concurrent writers:

1. shared value/error/Actor contracts;
2. migration numbering and changes to common database conventions;
3. transaction-local actor context and RLS role model;
4. Project Submission transaction and snapshot schema;
5. Quotation send/freeze transition;
6. Customer Acceptance → Order creation transaction;
7. Payment Verification → Order payment-state transaction;
8. first Production transition with verified-payment guard;
9. Production `READY` → Fulfilment readiness coordination;
10. Fulfilment completion → Order completion transaction;
11. canonical event/template registry;
12. release-candidate artifact/configuration/migration manifest; and
13. production promotion.

Two agents may review or test an integration point, but only one owns its implementation branch at a time.

## 5. Parallel implementation packages

### Package A — W0 foundation

| Agent lane | Exclusive ownership | Shared dependency | Merge order |
|---|---|---|---|
| A1 | runtime/build and module-boundary rules | initial package/lock/build configuration | First |
| A2 | unit/integration/browser harness | stable runtime commands | Second |
| A3 | Arabic localization/RTL foundation | stable presentation shell contract | Second |
| A4 | telemetry/error/redaction conventions | shared Error/Actor draft | After shared contracts reviewed |

### Package B — W2 discovery/file foundation

| Agent lane | Exclusive ownership | Integration boundary | Merge order |
|---|---|---|---|
| B1 | Catalog/configuration/search | published Catalog read/event contracts | Domain before storefront consumer |
| B2 | CMS/Translation | localized content read/publication contracts | Domain before public content consumer |
| B3 | Files/storage/scan | file status/access/promotion contracts | Core lifecycle before media/attachment integration |
| B4 | Storefront experience | consumes Catalog/CMS/File public reads only | After contract fixtures; final after providers |

### Package C — W3 request foundation

| Agent lane | Exclusive ownership | Integration boundary | Merge order |
|---|---|---|---|
| C1 | Project aggregate/drafts | Catalog configuration read | Before submission coordinator |
| C2 | Messaging aggregate | Identity and file attachment contract | Independent, then context integration |
| C3 | Customer Project experience | Project commands/queries | After contract fixtures |
| C4 | Manager review experience | Submitted Request and Messaging reads | After submission contract |

### Package D — W4 commercial boundary

| Agent lane | Exclusive ownership | Integration boundary | Merge order |
|---|---|---|---|
| D1 | Quotation draft/send/revision | Submitted Request | First participant |
| D2 | Order snapshot/read model | accepted Revision snapshot contract | First participant |
| D3 | Quotation/Order experiences | fixed query/action contracts | Parallel consumer |
| D4 | Acceptance transaction and concurrency tests | D1 + D2 + Fulfilment init | Last; single integration owner |

### Package E — W6/W7 completion

| Agent lane | Exclusive ownership | Integration boundary | Merge order |
|---|---|---|---|
| E1 | Production | verified Payment read contract | Before READY integration |
| E2 | Fulfilment | Order snapshot and Files | Before completion integration |
| E3 | Notifications/templates | stable event schemas | Per event after owning fact merges |
| E4 | Customer/Manager workspaces | stable read projections | Incremental after each module contract |

## 6. Conflict-prone artifacts

| Artifact/category | Ownership rule |
|---|---|
| Dependency manifest and lockfile | One foundation/integration owner per merge window |
| Shared config/build/lint/test files | One integration owner; changes requested through reviewed patch |
| Shared kernel and error catalogue | Contract owner; consumers cannot extend locally |
| Migration chain and schema journal | One migration owner/number allocator at a time |
| RLS actor context/common policies | Data-security owner plus mandatory independent review |
| Localization message catalogs | Locale owner or partitioned namespaces with deterministic merge ownership |
| Event/template registry | Notifications contract owner after producer review |
| Global route/navigation shell | Presentation integration owner; feature modules own injected entries/contracts |
| Generated clients/types/snapshots | Generated only by integration owner after source contract merge |
| Release manifests/runbooks | Release owner; reviewers contribute evidence, not competing copies |

## 7. Dependency-change rule

Changing a module contract after downstream work starts requires:

1. identifying all consumers in `DEPENDENCY_GRAPH.md`;
2. recording compatibility and migration impact;
3. assigning one integration owner;
4. updating contract, tests, documentation, and fixtures together;
5. rerunning the owning phase gate and every affected downstream gate; and
6. obtaining a new ADR/Product decision if the change alters an accepted boundary or behavior.

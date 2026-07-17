# Architecture Review Report

> **Historical phase report:** This report captured the architecture handoff before approval. The Product Owner approved the architecture and provider decisions on 2026-07-16. Current ADR status is in `ADR_INDEX.md`; current database/API readiness is in `DATABASE_API_DESIGN_REVIEW_REPORT.md`.

**Project:** Project Atelier / بيتي بذوقي  
**Review date:** 2026-07-16  
**Phase:** Version 1 technical architecture  
**Outcome:** **Ready for database and API design**

## 1. Architecture summary

Version 1 is designed as one server-authoritative Next.js modular monolith backed by one relational PostgreSQL system of record. Business modules have explicit ownership and communicate in process through application services and transactional coordinators. Provider integrations are adapters, not domain authorities. There are no microservices and no tenant abstraction.

The architecture preserves the accepted transaction: project submission and manager review lead to immutable sent quotation revisions; customer acceptance atomically creates an awaiting-payment Order and immutable Order Item Snapshots; manual Manager verification creates the authoritative payment fact; only then may Order-level production start; fulfilment completes by delivery or optional pickup with handoff evidence.

Arabic is the required default and RTL foundation. English is optional and publication-gated. French is outside Version 1. SAR is the initial configurable currency. A future showroom is another business/fulfilment location within the same business, not another tenant, and can be added without changing Order history or customer authorization.

Public media, private customer files, sensitive payment proof, restricted operational files, quarantine, and recovery material are separate storage zones. Durable notification and provider work uses a PostgreSQL transactional outbox with retryable leased jobs. Business Audit Events are append-only and separate from operational logs/traces.

## 2. Documents created

| Document | Purpose | Status |
|---|---|---|
| `ARCHITECTURE.md` | Architectural drivers, principles, stack, runtime, consistency, and future constraints | Complete — Proposed baseline |
| `SYSTEM_CONTEXT.md` | Actors, external systems, trust boundaries, environments, and information flows | Complete |
| `MODULE_BOUNDARIES.md` | Version 1 business modules, aggregate ownership, dependencies, and cross-module transactions | Complete |
| `DATA_ARCHITECTURE.md` | Data authority, transactions, immutability, configuration, concurrency, backup, and migration model | Complete |
| `SECURITY_ARCHITECTURE.md` | Data classification, authorization, workflow integrity, upload/security controls, and threat priorities | Complete |
| `STORAGE_ARCHITECTURE.md` | Public/private/sensitive zones, upload scanning, versioning, access, and recovery | Complete |
| `AUTH_ARCHITECTURE.md` | Customer and Manager authentication, local authorization, bootstrap, and recovery boundaries | Complete |
| `LOCALIZATION_ARCHITECTURE.md` | Arabic RTL model, optional English, content publication, bidi, and quality controls | Complete |
| `NOTIFICATION_ARCHITECTURE.md` | Essential events, in-app/email delivery, outbox/jobs, templates, and recovery | Complete |
| `OBSERVABILITY_ARCHITECTURE.md` | Logs, metrics, traces, SLOs, alerts, privacy, and audit separation | Complete |
| `DEPLOYMENT_ARCHITECTURE.md` | Environments, CI/CD, migration/rollback, durable work, secrets, hosting, and recovery | Complete |
| `TEST_STRATEGY.md` | Risk-based static, unit, database, browser, accessibility, security, performance, and recovery testing | Complete |
| `ADR_INDEX.md` | Carried-forward ADRs and complete provider/technology evaluations | Complete — Proposed decisions await approval |
| `ARCHITECTURE_REVIEW_REPORT.md` | Architecture-phase review and handoff | Complete |

No application source, database schema, migration, API endpoint contract, UI component, infrastructure definition, or deployment was created.

## 3. Proposed stack

| Area | Recommendation | ADR status |
|---|---|---|
| Runtime and language | Node.js 24 LTS and strict TypeScript | Proposed |
| Framework | Next.js 16 App Router, Node runtime | Proposed |
| Application shape | One modular monolith | Proposed |
| Database | Supabase managed PostgreSQL Pro with PITR | Proposed |
| Data access/migrations | Drizzle ORM/Kit, reviewed committed SQL, Supabase CLI local environment | Proposed |
| Authentication | Clerk Pro; email OTP for Customer, password + TOTP + backup codes for Manager | Proposed |
| Authorization | Local server-enforced role + relationship + state/resource policy | Accepted constraint |
| Storage | AWS S3 with versioning and separated zones | Proposed; separation is Accepted |
| Upload protection | GuardDuty Malware Protection for S3 and quarantine lifecycle | Proposed |
| Catalog search | PostgreSQL full-text search, Arabic normalization, and `pg_trgm` | Proposed |
| Localization | `next-intl`, Arabic source/fallback, optional approved English | Proposed; localization constraint is Accepted |
| Durable work | PostgreSQL transactional outbox and leased jobs with Vercel reconciliation | Proposed |
| Email | Resend behind a provider adapter | Proposed |
| Hosting | Vercel Pro | Proposed |
| Observability | OpenTelemetry, Sentry, Vercel/Supabase/AWS native telemetry | Proposed |
| Tests | Vitest, Playwright Test, axe-core, Lighthouse CI, k6 | Proposed |

Every proposed technology/provider has fit, alternatives, tradeoffs, risks, costs, lock-in, recommendation, and status recorded in `ADR_INDEX.md` or, for individual test tools, `TEST_STRATEGY.md`.

## 4. Documentation and capability evidence

Current official documentation was evaluated through the local Context7 MCP server for Next.js, Supabase, Clerk, Resend, Sentry, `next-intl`, Playwright, Vitest, and Drizzle. Official AWS, Vercel, Node.js, and provider pages supplemented capability and operational constraints where necessary.

### Supabase MCP

Read-only capability verification succeeded against the configured Supabase project:

- PostgreSQL project access and public-schema inspection succeeded.
- Extension capability was visible, including `pg_trgm`; no extension was enabled during this phase.
- Migration-history visibility succeeded.
- Storage capability/settings were visible and no bucket was created.
- No schema or migration was created or executed.

Current Supabase documentation states that database backups do not contain Storage objects, and its S3 compatibility does not support object versioning. That evidence drove the proposed use of standard PostgreSQL for data and AWS S3—not Supabase Storage—as the primary Version 1 object store.

### Vercel MCP and compatibility

No deployment was performed. Vercel MCP OAuth login was refreshed successfully, but the already-running Codex process retained its expired MCP transport session, so a live account/project/log read could not be repeated without restarting Codex. This is a remaining read-only operational check, not evidence of platform incompatibility.

Current official Vercel documentation confirms Next.js support, Node functions, preview/production promotion, rollback, runtime logs, and scheduled jobs. It also confirms the architectural warning that rolling back an application deployment does not roll back a database migration and that minute-level scheduled reconciliation is a paid-plan concern.

## 5. Remaining architecture decisions

There are no unresolved domain or architecture blockers inherited from planning. The following proposed ADRs require approval before implementation treats them as final:

- ADR-001, ADR-002, ADR-006, ADR-007, ADR-008, and ADR-010 carried forward from planning.
- ADR-012 through ADR-024 covering runtime/framework, database/provider, data access, identity, storage/scanning, search, localization library, durable jobs, email, hosting, observability, tests, and release topology.

The following specializations can be decided during database/API/infrastructure design without redesigning the accepted domain:

- exact provider regions after Saudi legal/data-residency, latency, and budget review;
- plan budgets for Supabase PITR, Clerk MFA, Vercel, S3/GuardDuty, Resend, and Sentry;
- infrastructure-as-code tool;
- PostgreSQL connection mode/capacity values and exact job leases/retry/alert thresholds;
- locale URL shape and optional-English publication configuration;
- KMS, replication, Object Lock, and lifecycle settings after retention policy approval;
- read-only Vercel MCP account/project/log verification after Codex restart.

The `BP-*` and `CFG-*` items in `IMPLEMENTATION_READINESS_REPORT.md` remain business-policy/configuration inputs. They are not silently resolved here and must be supplied before the affected feature, wording, deletion rule, exception flow, or operating procedure is released.

## 6. Risks

| Risk | Severity | Architectural response |
|---|---|---|
| Provider and region selection conflicts with Saudi legal/data-residency obligations | High | Keep region/provider ADRs Proposed; complete legal/privacy and data-flow review before provisioning |
| Only one Manager creates security and operational continuity risk | High | TOTP/backup codes, provider-admin separation, controlled bootstrap/recovery, audit; continuity procedure still requires approval |
| Human payment verification is wrong or later disputed | High | Immutable submissions/decisions, audited correction seam, proof isolation; substantive correction/dispute policy remains open |
| Production starts without verified payment | Critical | Authoritative transactional precondition, negative/concurrency tests, invariant telemetry; no configurable bypass |
| Accepted commercial history is mutated | Critical | Immutable application APIs, relational constraints, pinned object versions, snapshots, audit |
| Sensitive upload carries malware or leaks through caching/URL | High | S3 quarantine, managed scan, short-lived capabilities, no shared cache, narrow credentials, security tests |
| Serverless job interruption loses essential notifications | High | Transactional outbox, leases, idempotency, retry/dead-letter, scheduled reconciliation and alerts |
| Application rollback conflicts with database migration | High | Expand–migrate–contract, backward compatibility, PITR/backup, independent migration runbook |
| Arabic relevance/RTL/accessibility fails despite library support | High | Arabic query corpus, RTL-first component contracts, Playwright/axe/manual WCAG checks and production RUM |
| Costs grow across multiple managed providers | Medium | Approve plan budget, quotas and alerts; adapters preserve replacement seams; avoid unneeded services |
| Observability copies sensitive customer/payment data | High | Allowlisted context, scrubbing tests, no replay by default, audit/log separation and retention approval |
| Unapproved business-policy values become accidental defaults | High | Typed configuration with provenance/effective dates; absence blocks affected action instead of guessing |

## 7. Contradictions found and disposition

| Contradiction or tension | Resolution |
|---|---|
| Older `PROJECT_KNOWLEDGE.md` sections refer to Morocco, MAD, and Arabic/French/English, while later Product Owner decisions specify the Saudi market, configurable SAR, Arabic required, optional English, and no French in Version 1 | Applied the precedence stated in `MASTER_PRD.md`: the dated Product Owner answers supersede older discovery text. The architecture is Saudi/SAR/Arabic-first and does not ship French. |
| Catalog language says a product may be ordered “as displayed,” while the business rules prohibit direct checkout | “As displayed” is a valid requested configuration, but it still passes through project/request, quotation, acceptance, payment verification, production, and fulfilment. No checkout path was introduced. |
| “Complete Manager access” could be read as infrastructure-root authority | Interpreted as business capability within server authorization and lifecycle rules. Provider owner/database/AWS/operator access is separate and least-privileged. |
| Files are described as permanently retained in some source material while privacy/deletion/retention periods remain open | No duration or automatic deletion was invented. Versioning and lifecycle configuration support a later approved data-class policy while accepted transaction history remains protected. |
| Supabase MCP confirms Storage is available, but recovery requirements need object history and independent restore | Capability does not equal suitability. AWS S3 is proposed for versioning, separation, malware scanning, and recovery; Supabase remains the PostgreSQL provider. |
| Manager recovery codes are required, but Supabase Auth does not directly issue recovery codes in its current documented MFA model | Clerk Pro is proposed because its current TOTP and backup-code support matches the accepted requirement; local authorization avoids making Clerk metadata the business authority. |
| Fulfilment labels appear alongside production in some planning wording | Production ends at Ready and is Order-level. Delivery/Pickup belongs to the separate Fulfilment lifecycle; Order coordinates both without giving Order Items a production state. |

No unresolved contradiction prevents database or API design.

## 8. Readiness assessment

| Area | Result |
|---|---|
| Domain and aggregate ownership | Ready |
| State and transaction boundaries | Ready |
| Data architecture and immutability rules | Ready |
| Server authorization model | Ready |
| Storage classifications and upload lifecycle | Ready |
| Arabic/English localization constraints | Ready |
| Notifications and durable work | Ready |
| Deployment/environment/recovery model | Ready, with provider ADR and region approval before provisioning |
| Testing and quality evidence model | Ready |
| Business-policy values | Still tracked as configuration/policy; not a structural design blocker |

## 9. Final recommendation

### Ready for database and API design

The Version 1 technical architecture is complete enough to begin logical database design and API/application-contract design in the next explicitly authorized phase. That work should use the Proposed ADRs as the review baseline and either accept or revise them explicitly; it must not create schemas, migrations, endpoints, or application code as part of this completed architecture phase.

Before provider provisioning or implementation, approve the proposed stack ADRs, region/data-residency posture, operating budget, and infrastructure ownership. Before release, complete the remaining business-policy/configuration values relevant to each feature and the live Vercel MCP read-only verification.

# Architecture Decision Record Index

**Status:** Approved Architecture Decision Record register  
**Last reviewed:** 2026-07-16

**Approval record:** The Product Owner approved the architecture and provider decisions on 2026-07-16. ADR-015, ADR-016, and ADR-021 retain the staged-adoption conditions established by the focused provider review.

## 1. Decision policy

This register carries forward the planning ADRs and the approved Version 1 technology decisions. `Accepted` means the Product Owner or authoritative planning package has fixed the architectural rule. Later conditions and configuration values remain governed by their recorded approval gates.

This approval record does not authorize application code, schema, migration, deployment, or provider provisioning in the current phase.

## 2. Register

| ADR | Decision | Status | Source / detail |
|---|---|---|---|
| ADR-001 | Version 1 modular monolith | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-002 | Relational database architecture | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-003 | Immutable sent/accepted quotation revisions and Order snapshots | Accepted | `ARCHITECTURE_DECISIONS.md`, Product Owner decisions |
| ADR-004 | Separate public and private storage | Accepted | `ARCHITECTURE_DECISIONS.md`, Product Owner decisions |
| ADR-005 | Server-enforced authorization and state transitions | Accepted | `ARCHITECTURE_DECISIONS.md`, Product Owner decisions |
| ADR-006 | Transactional outbox / durable side effects | Accepted | Product Owner architecture approval; expanded by ADR-019 |
| ADR-007 | Provider adapters | Accepted | Product Owner architecture approval; expanded across ADR-015, 016, 020, 022 |
| ADR-008 | Durable background jobs | Accepted | Product Owner architecture approval; expanded by ADR-019 |
| ADR-009 | First-class Arabic localization | Accepted | `ARCHITECTURE_DECISIONS.md`, Product Owner decisions |
| ADR-010 | Append-only business audit | Accepted | Product Owner architecture approval; expanded by ADR-022 separation of telemetry/audit |
| ADR-011 | Single-business Version 1; no premature multi-tenancy | Accepted | `ARCHITECTURE_DECISIONS.md`, Product Owner decisions |
| ADR-012 | Node 24 LTS, strict TypeScript, Next.js 16 App Router | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-013 | Supabase managed PostgreSQL Pro with PITR | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-014 | Drizzle data access and reviewed SQL migrations | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-015 | Clerk Pro for identity; local authorization | Accepted | Product Owner provider approval; staged adoption retained |
| ADR-016 | AWS S3 and GuardDuty for object storage/security | Accepted | Product Owner provider approval; staged adoption retained |
| ADR-017 | PostgreSQL catalog search for Version 1 | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-018 | `next-intl` localization implementation | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-019 | PostgreSQL outbox, leased jobs, Vercel reconciliation | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-020 | Resend transactional email adapter | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-021 | Vercel Pro application hosting | Accepted | Product Owner provider approval; staged adoption retained |
| ADR-022 | OpenTelemetry, Sentry, provider telemetry, separate audit | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-023 | Vitest, Playwright, axe, Lighthouse, k6 test stack | Accepted | Product Owner architecture approval, 2026-07-16 |
| ADR-024 | Isolated environments and expand–migrate–contract releases | Accepted | Product Owner architecture approval, 2026-07-16 |

## 3. Carried-forward structural decisions

### ADR-001 — Modular monolith

- **Why it fits:** one manager, one business, one transaction-heavy product, and a small Version 1 operational footprint benefit from in-process modules and one atomic relational boundary.
- **Alternatives considered:** microservices and an unmodularized monolith.
- **Tradeoffs:** module discipline is social/architectural rather than network-enforced; the deployment scales as one unit.
- **Risks:** boundary erosion and an oversized framework layer.
- **Cost implications:** lowest infrastructure and operations cost of the considered structures.
- **Lock-in implications:** low if modules and provider ports remain explicit; no distributed-protocol lock-in.
- **Final recommendation:** accept the modular monolith and revisit only with measured team/scale/isolation evidence.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-002 — Relational architecture

- **Why it fits:** quotations, acceptance, payment, production, fulfilment, ownership, and audit need transactions, constraints, relationships, and consistent history.
- **Alternatives considered:** document database, event-sourced primary store, and multiple persistence technologies.
- **Tradeoffs:** schema evolution requires controlled migrations; some search/read projections need deliberate design.
- **Risks:** poor migrations, connection exhaustion, or treating ORM types as domain boundaries.
- **Cost implications:** managed database compute, storage, backup, and network.
- **Lock-in implications:** low at standard SQL/PostgreSQL level; provider operations add moderate coupling.
- **Final recommendation:** relational PostgreSQL system of record.
- **ADR status:** Accepted by the Product Owner on 2026-07-16, with provider choice accepted in ADR-013.

### ADR-006/007/008 — Durable effects, adapters, and jobs

- **Why it fits:** required email, scan, audit-related operations, and notification work must survive request/process/provider failure while providers remain replaceable.
- **Alternatives considered:** synchronous provider calls only, fire-and-forget, direct provider SDK use in modules, and a separate event platform.
- **Tradeoffs:** creates durable operations data and recovery responsibilities.
- **Risks:** duplicate processing, stale leases, silent dead letters, or leaky provider abstractions.
- **Cost implications:** database/compute usage and monitoring rather than a separate initial queue bill.
- **Lock-in implications:** low for domain events/ports; provider adapters contain specific coupling.
- **Final recommendation:** transactional outbox and explicit provider ports, specialized by ADR-019/020/022.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-010 — Append-only audit

- **Why it fits:** Manager actions and immutable commercial/payment history require durable, queryable evidence independent of operational log retention.
- **Alternatives considered:** platform logs only, mutable activity feed, and full event sourcing.
- **Tradeoffs:** storage/retention/access-control work and careful payload minimization.
- **Risks:** sensitive payload duplication or privileged mutation if protections are weak.
- **Cost implications:** PostgreSQL storage, backup, and manager/operator review tooling.
- **Lock-in implications:** low; relational append-only records are portable.
- **Final recommendation:** append-only Audit Event owned by the application; not event sourcing.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

Accepted ADR-003, ADR-004, ADR-005, ADR-009, and ADR-011 are constraints and are not reopened by provider selection.

## 4. Technology and provider decisions

### ADR-012 — Runtime and web framework

**Decision:** Node.js 24 LTS, strict TypeScript, and Next.js 16 App Router using Node runtime for the Version 1 modular monolith.

- **Why it fits:** current supported LTS runtime, strong Next.js/Vercel compatibility, server components and server adapters in one deployment, and a mature typed ecosystem.
- **Alternatives considered:** Node 22 LTS, Bun, Deno, Remix/React Router, Nuxt, SvelteKit, and separate SPA/API applications.
- **Tradeoffs:** Next.js caching/runtime conventions require explicit control; full-stack coupling is greater than a framework-neutral API plus SPA.
- **Risks:** framework upgrade cadence, accidental Edge/runtime incompatibility, server/client boundary leaks, and misuse of Server Actions as domain code.
- **Cost implications:** open-source runtime/framework; engineering upgrade and Vercel/runtime consumption costs.
- **Lock-in implications:** moderate to Next.js rendering/routing and Vercel optimizations; domain/application modules remain ordinary TypeScript and provider-independent.
- **Final recommendation:** use Node 24 LTS and pin a supported Next.js 16 release; Server Actions/Route Handlers stay thin and private paths dynamic.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

References: [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation), [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), and [Node releases](https://nodejs.org/en/about/previous-releases).

### ADR-013 — Relational database provider

**Decision:** Supabase managed PostgreSQL Pro with PITR, plus independent encrypted logical backups.

- **Why it fits:** standard PostgreSQL transactions/extensions and managed operations; existing Supabase account capability was verified read-only through MCP.
- **Alternatives considered:** AWS RDS/Aurora, Neon, self-hosted PostgreSQL, and other managed Postgres services.
- **Tradeoffs:** introduces Supabase control-plane/backups/networking behavior; independent recovery export is still necessary.
- **Risks:** wrong region, connection exhaustion from serverless functions, project-level operator error, backup assumptions, and cost growth with compute/PITR.
- **Cost implications:** Pro base project, compute, PITR, egress, and independent backup storage. Current provider pricing must be approved; PITR is an additional material cost.
- **Lock-in implications:** moderate operationally; low-to-moderate for data if standard PostgreSQL and portable migrations are retained.
- **Final recommendation:** Supabase Pro production database with PITR capable of the accepted RPO/RTO, pooled serverless access, and off-provider logical recovery copies.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

Reference: [Supabase backups](https://supabase.com/docs/guides/platform/backups).

### ADR-014 — Data access and migration tooling

**Decision:** Drizzle ORM for server-only typed PostgreSQL access, Drizzle Kit/reviewed SQL migrations, and Supabase CLI for local migration execution.

- **Why it fits:** keeps SQL and transactions visible while providing TypeScript inference and generated migration workflow.
- **Alternatives considered:** Prisma, Kysely, raw `pg`, TypeORM, and Supabase client/PostgREST as primary business data access.
- **Tradeoffs:** schema definitions and relational mapping add tooling; complex queries still require SQL knowledge.
- **Risks:** generated SQL accepted without review, ORM models leaking into domain/API, or production `push` causing drift.
- **Cost implications:** open source; CI/database engineering time.
- **Lock-in implications:** low-to-moderate in query/schema APIs; committed SQL and PostgreSQL semantics make migration feasible.
- **Final recommendation:** Drizzle plus reviewed committed SQL; prohibit dashboard drift and direct production schema push.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

Reference: [Drizzle documentation](https://orm.drizzle.team/docs/overview).

### ADR-015 — Identity provider

**Decision:** Clerk Pro for customer email OTP and manager password + TOTP + backup codes; the local database remains the authorization authority.

**Provider review disposition (2026-07-16):** Accept with staged adoption. Use Clerk development instances for local and synthetic staging work. Clerk Pro is required before production Manager MFA/backup-code enrollment and before any real Customer production authentication.

- **Why it fits:** directly matches accepted authentication methods, including recovery/backup codes, with current Next.js server support.
- **Alternatives considered:** Supabase Auth, Auth0, AWS Cognito, and self-managed auth.
- **Tradeoffs:** adds a provider alongside Supabase and requires robust subject mapping; paid MFA is required.
- **Risks:** identity-provider outage, linking/elevation bugs, recovery-process weakness, and migration complexity.
- **Cost implications:** Clerk Pro is $25/month or $20/month billed annually as checked on 2026-07-16, with 50,000 MRU included per application and usage-dependent overage above that threshold. Development instances can exercise Pro features without a production subscription.
- **Lock-in implications:** high for credentials/MFA/session migration; low for business authorization because roles/ownership remain local.
- **Final recommendation:** Clerk Pro with staged adoption, no Organizations/multi-tenancy, a controlled single-Manager bootstrap, and server-side local authorization. Select annual billing only after staging and production-exit verification.
- **ADR status:** Accepted by the Product Owner on 2026-07-16 with staged adoption.

### ADR-016 — Object storage and malware protection

**Decision:** Amazon S3 separated into public/private/sensitive/restricted/recovery zones, with versioning, Block Public Access, and GuardDuty Malware Protection for uploads.

**Provider review disposition (2026-07-16):** Accept with staged adoption. S3 begins with integrated file work. GuardDuty may be omitted only for local or synthetic test files and must be enabled and verified before any non-team external upload can become available for use or review, including every production payment proof.

- **Why it fits:** versioned recovery, strong IAM/KMS options, immutable object references, independent backup location, and managed malware scanning.
- **Alternatives considered:** Supabase Storage, Cloudflare R2, Vercel Blob, and third-party scanning pipelines.
- **Tradeoffs:** another provider/control plane and more IAM/event complexity.
- **Risks:** permission/presigned-URL errors, failed scan event handling, version-cost growth, KMS recovery, and regional/legal mismatch.
- **Cost implications:** no minimum paid plan; usage covers storage, requests, egress, old versions, and GuardDuty scans. The 2026-07-16 Bahrain model is $0.59–$3.69/month at modeled MVP usage before optional KMS, CDN, replication, Object Lock, or other unapproved services; deployment region remains subject to its existing approval process.
- **Lock-in implications:** moderate; S3 API is portable, while IAM/KMS/GuardDuty/Object Lock/events are AWS-specific.
- **Final recommendation:** AWS S3/GuardDuty with staged activation and cost alarms; use Supabase Storage only if recovery/versioning and malware-scan requirements are explicitly redesigned and approved.
- **ADR status:** Accepted by the Product Owner on 2026-07-16 with staged adoption.

### ADR-017 — Catalog search

**Decision:** PostgreSQL full-text search, Arabic normalization, and `pg_trgm` for published Version 1 catalog content.

- **Why it fits:** one source of truth, transactional publication, low initial scale/operations, and no advanced comparison/AI search scope.
- **Alternatives considered:** Meilisearch, Typesense, Elasticsearch/OpenSearch, Algolia, and PGroonga.
- **Tradeoffs:** Arabic morphology/ranking may be less capable than specialized search and needs a curated relevance corpus.
- **Risks:** poor Arabic recall, expensive wildcard/fuzzy queries, and accidental indexing of private content.
- **Cost implications:** PostgreSQL compute/index storage; external service avoided initially.
- **Lock-in implications:** low; search remains behind a Catalog port and can later move.
- **Final recommendation:** PostgreSQL search for Version 1, with Arabic relevance and performance exit criteria before production.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-018 — Localization library

**Decision:** `next-intl` for application localization, with Arabic source/fallback and optional approved English.

- **Why it fits:** current App Router/server-component integration, ICU formatting, and typed messages.
- **Alternatives considered:** custom Web `Intl`, `react-i18next`, and Lingui.
- **Tradeoffs:** library-specific routing/hooks and separate domain workflow for CMS translations.
- **Risks:** locale cache leaks, catalog bloat, missing Arabic, stale English, and bidi errors.
- **Cost implications:** open source; human translation and QA costs remain.
- **Lock-in implications:** low-to-moderate; ICU/Intl content is portable, integrations require migration.
- **Final recommendation:** `next-intl`, server-first messages, Arabic mandatory and English publication-gated.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-019 — Durable work execution

**Decision:** transactional PostgreSQL outbox plus leased job records, opportunistic dispatch, and Vercel Cron reconciliation.

- **Why it fits:** side-effect intent is atomic with business data, adequate for Version 1 volume, serverless-safe, and avoids another core queue provider.
- **Alternatives considered:** direct calls, `pgmq`, Inngest, Trigger.dev, AWS SQS/Lambda, and a dedicated worker host.
- **Tradeoffs:** application owns leases, retry/backoff, dead-letter, batching, and monitoring.
- **Risks:** duplicates, stuck jobs, table growth, DB contention, cron gaps, and serverless duration limits.
- **Cost implications:** PostgreSQL/Vercel compute and Pro schedule support; external queue may be justified later by measured operations.
- **Lock-in implications:** low for PostgreSQL outbox; moderate for scheduler/invocation adapter.
- **Final recommendation:** PostgreSQL outbox with minute-level Vercel Pro reconciliation; config values require load testing.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-020 — Transactional email provider

**Decision:** Resend behind an application-owned email provider adapter.

- **Why it fits:** transactional API, current webhook and idempotency support, straightforward Next.js operation.
- **Alternatives considered:** Amazon SES, Postmark, SendGrid, and generic SMTP.
- **Tradeoffs:** less infrastructure control than SES; deliverability/domain setup remains operational work.
- **Risks:** finite provider idempotency window, outage/rate limit, bounce handling, and privacy/retention configuration.
- **Cost implications:** usage tier and retention/features at current [Resend pricing](https://resend.com/pricing), plus domain/DNS.
- **Lock-in implications:** low-to-moderate behind the adapter; provider event vocabulary requires mapping.
- **Final recommendation:** Resend with internal durable idempotency and signed webhook processing.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-021 — Application hosting

**Decision:** Vercel Pro for the Next.js modular monolith and scheduled reconciliation.

**Provider review disposition (2026-07-16):** Accept with staged adoption. Local development requires no hosted plan. Vercel Hobby is restricted to non-commercial personal use, so Pro is required before the first commercial or shared-business Vercel deployment, after any bounded trial.

- **Why it fits:** first-party Next.js deployment, previews, promotion/rollback, Node functions, logs, and schedules.
- **Alternatives considered:** AWS ECS/App Runner, Fly.io, Render, Railway, and self-managed hosting.
- **Tradeoffs:** serverless limits and usage pricing; job and database connection design need care.
- **Risks:** cost/limits, platform outage, regional mismatch, secret scoping, and confusing app rollback with DB rollback.
- **Cost implications:** Pro starts at $20/month for one deploying seat as checked on 2026-07-16 and includes a $20 usage credit; functions, bandwidth, image operations, logs/drains, and other usage can exceed that credit. Hobby is not a valid commercial launch tier.
- **Lock-in implications:** moderate-to-high operationally; application/domain logic remains portable Node/TypeScript.
- **Final recommendation:** Vercel Pro with staged adoption, Node runtime, isolated environments, provider-neutral core, and spend alerts before public use.
- **ADR status:** Accepted by the Product Owner on 2026-07-16 with staged adoption.

### ADR-022 — Observability and audit separation

**Decision:** OpenTelemetry instrumentation, Sentry errors/traces, native Vercel/Supabase/AWS telemetry, and a separate append-only PostgreSQL Audit module.

- **Why it fits:** portable instrumentation plus practical managed diagnostics and provider-specific infrastructure visibility.
- **Alternatives considered:** provider-only logs, Datadog, New Relic, Grafana Cloud, and self-hosted OTel/Grafana.
- **Tradeoffs:** multiple consoles and careful correlation/scrubbing; managed ease in exchange for quotas/provider coupling.
- **Risks:** sensitive-data leakage, high-cardinality cost, sampling blind spots, alert fatigue, and treating logs as audit.
- **Cost implications:** Sentry quota/plan, Vercel logs/drains, native provider telemetry, and optional backend exports.
- **Lock-in implications:** low for OTel, moderate for Sentry workflow and native dashboards.
- **Final recommendation:** OTel + Sentry + native telemetry; no session replay unless separately privacy-approved; business audit stays relational.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-023 — Test toolchain

**Decision:** Vitest, Playwright Test/browser binaries, axe-core, Lighthouse CI, and k6.

- **Why it fits:** covers fast domain/integration tests, real multi-browser journeys, automated accessibility, web budgets, and load evidence.
- **Alternatives considered:** Jest, Cypress, WebdriverIO, Pa11y, WebPageTest, Artillery, and hosted-only testing.
- **Tradeoffs:** multiple tools and CI/browser cost; manual accessibility and real-user monitoring remain required.
- **Risks:** flaky E2E tests, unrealistic mocks/load, lab-performance variance, and mistaking axe for WCAG certification.
- **Cost implications:** tools are open source; CI compute/browser artifact storage and optional hosted services cost money.
- **Lock-in implications:** low-to-moderate in test APIs/configuration.
- **Final recommendation:** the stated stack, preserving existing Playwright Test; no Playwright MCP dependency for CI.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

### ADR-024 — Environment and release topology

**Decision:** isolated local/CI/staging/production resources, Vercel previews bound only to non-production data, and expand–migrate–contract releases with independent backup/rollback.

- **Why it fits:** protects customer/payment data, supports repeatable verification, and recognizes that application rollback does not reverse database change.
- **Alternatives considered:** shared database across previews, direct production deployment, long-lived feature environments, and destructive up/down migration strategy.
- **Tradeoffs:** additional provider resources, configuration management, seed data, and deployment discipline.
- **Risks:** environment drift, secret scope errors, migration incompatibility, untested restore, and cost of duplicate services.
- **Cost implications:** staging provider plans/resources, CI usage, backup storage, and infrastructure management.
- **Lock-in implications:** moderate to provider environment controls; release pattern and migrations are portable.
- **Final recommendation:** strict environment isolation and staged compatible releases; select infrastructure-as-code tool before production provisioning.
- **ADR status:** Accepted by the Product Owner on 2026-07-16.

## 5. Post-approval conditions and configuration

The Product Owner approved ADR-001 through ADR-024 on 2026-07-16. The following choices specialize the accepted architecture but do not reopen it or authorize guessed values:

- provider regions and Saudi legal/data-residency approval;
- production plan/budget for Supabase PITR, Clerk MFA, Vercel, S3/GuardDuty, Resend, and Sentry;
- exact infrastructure-as-code tool;
- URL locale shape and exact monitoring/job configuration;
- backup, object, audit, and telemetry retention values;
- S3 KMS/Object Lock/replication choices based on approved policy;
- live Vercel MCP read verification after the Codex session reloads its refreshed OAuth token.

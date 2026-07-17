# Version 1 Technical Architecture

**Status:** Approved Version 1 architecture baseline  
**Scope:** Version 1  
**Last reviewed:** 2026-07-16

## 1. Purpose

This document defines the technical architecture for the Version 1 Atelier product described by `MASTER_PRD.md`. It translates the accepted product and domain decisions into system structure without defining database schemas, HTTP endpoints, UI components, or application code.

The architecture is a server-authoritative modular monolith. One deployable web application contains independently owned business modules, backed by one relational database and explicit adapters for identity, object storage, email, monitoring, and hosting providers.

## 2. Architectural drivers

- Arabic-first, right-to-left customer and manager experiences.
- A complete quote-to-order transaction with immutable commercial history.
- Manual bank-transfer verification before any production work can start.
- Order-level production tracking in Version 1.
- Strong server-side authorization and append-only audit evidence.
- Separate public, private, sensitive, and restricted file handling.
- One home-based Saudi business today, with a future showroom represented as another fulfilment/business location rather than another tenant.
- Policy values that can change without structural redesign.
- Operational simplicity for a single manager while retaining reliable transactions, notifications, backups, and recovery.

## 3. System shape

```text
Browser
  |
  | HTTPS
  v
Vercel / Next.js modular monolith
  |-- presentation adapters (pages, actions, route handlers)
  |-- application services and transaction coordinators
  |-- domain modules and policy enforcement
  |-- provider adapters
  |
  +--> Supabase managed PostgreSQL
  +--> Clerk identity service
  +--> AWS S3 object storage / GuardDuty malware scanning
  +--> Resend transactional email
  +--> Sentry, OpenTelemetry, and provider telemetry
```

The web process is never the sole owner of durable work. State changes and their required side effects are committed atomically through a PostgreSQL transactional outbox. A leased dispatcher processes pending work, and a scheduled reconciliation trigger recovers missed dispatch attempts.

## 4. Architectural principles

### 4.1 Server authority

Every protected read, mutation, transition, file operation, and manager action is authenticated and authorized on the server. UI visibility is convenience, not access control. Client-supplied prices, roles, workflow states, ownership, storage keys, locale trust decisions, or audit fields are never authoritative.

### 4.2 Module ownership

Each business module owns its invariants, application operations, and persistence access. A module may refer to another module by stable identifier or an intentional read contract, but it may not write another module's data directly. Cross-module workflows use explicit application coordinators and one database transaction where atomicity is required.

### 4.3 Immutable commercial history

A sent quotation revision is not edited in place. An accepted revision remains immutable. Acceptance creates the Order and its immutable Order Item Snapshots atomically. Later catalog, product, translation, price, option, or address changes do not rewrite accepted history.

### 4.4 Configurable policy, fixed invariants

Structural invariants are code and database rules: production requires verified payment, ownership cannot be forged, and historical snapshots cannot change. Unresolved durations, wording, retention, prices, thresholds, notification timing, and operating procedures are typed, validated configuration with audit history and effective dates. Configuration cannot weaken authorization or historical immutability.

### 4.5 Durable side effects

Email, in-app notification fan-out, file scanning follow-up, and operational jobs are idempotent and retryable. No required business effect depends on an in-memory timer, a fire-and-forget promise, or a single provider webhook delivery.

### 4.6 Secure-by-default data handling

Data and files default to private. Published catalog media is deliberately promoted to the public-media zone. Payment proofs and restricted material use narrower credentials and access paths. Signed links are short-lived capability URLs and are never persisted in business records or shared caches.

## 5. Recommended Version 1 stack

All technology selections below were approved by the Product Owner on 2026-07-16 and are recorded as Accepted in `ADR_INDEX.md`.

| Concern | Approved choice | Architectural role |
|---|---|---|
| Runtime | Node.js 24 LTS, strict TypeScript | Supported long-lived server runtime and type safety |
| Web framework | Next.js 16 App Router, Node runtime | One full-stack deployable modular monolith |
| Hosting | Vercel Pro | Preview/production lifecycle, functions, logs, scheduled reconciliation |
| Relational database | Supabase managed PostgreSQL Pro with PITR | Transactional system of record |
| Data access | Drizzle ORM and reviewed SQL migrations | Server-only typed queries and explicit schema evolution |
| Identity | Clerk Pro | Customer email OTP; manager password, TOTP MFA, backup codes |
| Object storage | AWS S3 with versioning and GuardDuty Malware Protection | Segregated, recoverable public/private uploads |
| Localization | `next-intl` | Typed Arabic-first messages, ICU formatting, server rendering |
| Email | Resend | Transactional email behind a provider adapter |
| Durable work | PostgreSQL outbox and leased jobs | Reliable notifications and background work |
| Observability | OpenTelemetry, Sentry, and native provider telemetry | Errors, traces, operational metrics, and alerts |
| Testing | Vitest, Playwright Test, axe-core, Lighthouse CI, k6 | Layered functional and quality verification |

Official references used in evaluation include [Next.js App Router](https://nextjs.org/docs/app), [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Clerk authentication strategies](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [Amazon S3 security](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html), and [Vercel Next.js support](https://vercel.com/docs/frameworks/full-stack/nextjs). Detailed alternatives, cost, risk, and lock-in evaluations are in `ADR_INDEX.md`.

## 6. Request and transaction flow

1. The presentation adapter validates the request shape and establishes locale and correlation context.
2. The server resolves the current identity and local Customer or Manager record.
3. An application service performs resource-level authorization.
4. The owning domain module checks state, policy, and invariant preconditions.
5. A database transaction commits the state change, immutable history or snapshot, audit event, and outbox records together.
6. Only after commit does the adapter return success.
7. Dispatchers deliver notifications or provider work idempotently. Failed delivery does not roll back committed business state and remains visible for retry or manager recovery.

The acceptance transaction is the key cross-module exception: it locks the submitted request and current quotation revision, revalidates that the revision is the currently sent one and still acceptable under configured policy, records Customer Acceptance, creates the Order and immutable Order Item Snapshots, sets the Order to Awaiting Payment, writes the audit event, and queues notifications in one transaction.

## 7. Runtime and rendering model

- Server Components are preferred for authenticated and public reads.
- Client Components are limited to interaction that genuinely requires browser state.
- Server Actions and Route Handlers are thin inbound adapters, not locations for domain policy.
- Transactional, identity, storage-signing, job, and observability paths use the Node runtime, not Edge runtime.
- Public, published catalog and CMS reads may use explicit cache tags and invalidation.
- Account, project, quote, payment, message, order, manager, signed-URL, and policy-sensitive responses are dynamic and must not enter shared public caches.
- Provider SDKs and database clients are server-only dependencies.

## 8. Data and consistency model

PostgreSQL is the source of truth for business state, configuration, notification state, file metadata, audit events, and provider references. Object bytes live in S3; identity credentials live in Clerk. The application stores stable external subject identifiers, never provider passwords or MFA secrets.

Transactions, row or advisory locks where appropriate, optimistic versions, uniqueness rules, and idempotency keys protect concurrent operations. Money uses exact decimal or integer-minor-unit representation plus an ISO currency code; floating-point money is prohibited. SAR is the initial configured default, not a hard-coded universal assumption. Timestamps are stored in UTC and rendered using explicit locale and business-time-zone configuration.

## 9. Search architecture

Version 1 catalog search stays inside PostgreSQL using full-text search, Arabic-aware normalization, and `pg_trgm` for tolerant matching. Search indexes include only published catalog content and approved translations. Private messages, customer data, payment material, and restricted notes are never indexed into the public search surface.

This avoids a second data store and synchronization pipeline for the initial catalog. Arabic relevance must be measured against an approved query corpus before release. If the target cannot be met, a later ADR may introduce PGroonga or an external search adapter without changing Catalog ownership.

## 10. Future showroom support

Version 1 is single-business and single-manager. It does not use tenant IDs, Clerk Organizations, tenant-scoped databases, or tenant-aware authorization. Business and fulfilment location are still represented with stable identities and snapshotted fulfilment details. The home workshop is the only active Version 1 location. A showroom can later be added as another location and customer handoff option without changing Order identity, accepted snapshots, or the authorization model.

This extensibility does not imply inventory, worker accounts, point-of-sale, or location-specific production workflows in Version 1.

## 11. Out-of-scope architecture

Version 1 does not include microservices, multi-tenancy, event sourcing, AI recommendation infrastructure, advanced analytics pipelines, push-notification providers, review publication, Favorites, Saved Designs, item-level production state, or advanced 360-degree processing. Domain names that preserve later product intent do not make those capabilities active Version 1 modules.

## 12. Quality and operational conformance

`QUALITY_GATES.md` remains authoritative. Architecture adds enforcement locations:

- CI gates type checking, linting, tests, production build, accessibility automation, and performance budgets.
- Runtime monitoring evaluates availability, API latency, and error-rate service levels.
- Monthly recovery exercises validate database restore and private-object reconciliation.
- Release verification covers Arabic RTL, optional English where a translation exists, supported browsers, responsive breakpoints, and all loading/empty/error/success states.
- The production-readiness checklist blocks release if required telemetry, alerts, backups, scan paths, or rollback procedures are unverified.

## 13. Decision authority

Accepted product, planning, architecture, and provider decisions remain authoritative. Business policies listed in `DECISION_WORKSHOP.md` remain configuration points until the Product Owner decides their values. Architecture approval does not authorize guessed policies or application implementation.

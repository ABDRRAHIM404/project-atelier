# Deployment Architecture

**Status:** Approved 2026-07-16  
**Recommended application platform:** Vercel Pro

## 1. Deployment unit

Version 1 has one deployable Next.js modular monolith. It contains the public storefront, authenticated customer and manager experiences, server-side application services, provider adapters, and durable-job execution entry points. There are no microservices, independently deployed business modules, or always-on worker fleet.

The runtime baseline is Node.js 24 LTS and strict TypeScript. Next.js 16 App Router runs on the Node runtime for database, identity, storage signing, transactions, jobs, and telemetry. Edge runtime is not the default because the core paths need consistent Node provider libraries and transactional behavior.

## 2. Environment topology

| Environment | Purpose | Data/providers |
|---|---|---|
| Local | Development and fast tests | Supabase local PostgreSQL, provider test/emulator modes, synthetic fixtures |
| CI | Build, tests, migration verification, security/quality gates | Ephemeral isolated database and non-production credentials; no customer data |
| Staging | Integrated release candidate and operational rehearsal | Dedicated non-production Supabase/Clerk/S3/Resend/Sentry resources and synthetic accounts |
| Production | Real business operation | Dedicated production projects/accounts, scoped credentials, backups, monitoring, approved domains |
| Vercel Preview | Per-change review | Staging-like/sandbox services only; never production customer/payment data |

Environment boundaries are explicit. A preview cannot inherit production database or private-storage credentials through a broad environment-variable scope.

## 3. Regional strategy

Application, PostgreSQL, and S3 regions should be co-located as closely as provider availability, Saudi legal/data-residency obligations, latency targets, and budget allow. Exact region selection remains an approved architecture configuration/legal gate; implementation must not choose it silently.

Email and telemetry may process data in other regions according to provider terms. Only minimum data is sent, and the legal/privacy review must approve the resulting flows.

## 4. CI/CD flow

1. Install from the locked dependency graph on Node 24 LTS.
2. Run formatting check, strict type check, lint, unit/integration tests, authorization/state tests, and secret/dependency scanning.
3. Build the production artifact.
4. Run migration lint/dry-run against a disposable database; no production schema is created during this architecture phase.
5. Deploy a Preview linked only to non-production services.
6. Run Playwright critical journeys, axe checks, localization/RTL checks, Lighthouse budgets, and selected k6 checks.
7. Require review and all `QUALITY_GATES.md` evidence.
8. Apply the approved production migration under the migration runbook.
9. Promote the immutable deployment to production and run smoke/synthetic verification.
10. Observe release health and roll back application traffic if gates fail.

Protected branches, required reviews, and least-privilege deployment identities are required. Exact branching policy is a team configuration decision.

## 5. Database deployment and rollback

Vercel deployment rollback does not roll back PostgreSQL changes. Schema evolution follows expand–migrate–contract and maintains backward compatibility across at least the rollback window. Destructive changes wait for a later release. Before risky migration, verify PITR/backup health and recovery access.

If a release fails, promote the last known-good Vercel deployment while keeping the compatible expanded schema. Data correction uses an approved forward/compensating migration, not an unreviewed destructive down migration.

Official references: [Vercel deployment promotion](https://vercel.com/docs/deployments/promoting-a-deployment), [rollback](https://vercel.com/docs/deployments/rollback-production-deployment), and [Supabase local development](https://supabase.com/docs/guides/local-development).

## 6. Durable work on serverless runtime

Business transactions write outbox/job rows. A scheduled Vercel invocation reconciles and dispatches leased batches; normal requests may trigger best-effort post-commit dispatch without owning correctness. Work is bounded to runtime limits, checkpointed, retryable, and safe under concurrent invocation.

Long-running malware scanning is performed asynchronously by GuardDuty and event processing, not inside a Vercel request. Large media transformation workflows and advanced 360 processing are outside Version 1.

Vercel Cron frequency depends on plan; the current official documentation gives Pro finer schedules than Hobby. Vercel Pro is accepted with staged adoption, and the one-minute reconciliation expression remains subject to capacity validation and operational configuration. See [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 7. Secrets and configuration

Secrets are environment-scoped in provider secret stores and injected only where required. Public build-time variables contain no secrets. Each provider adapter receives the narrow credential for its environment and purpose. Rotation does not require code changes.

Business policy values live in the validated configuration model rather than deployment environment variables when they require history, manager visibility, effective dates, or audit. Infrastructure parameters and secrets remain deployment configuration. No actual credential or environment value belongs in these architecture documents.

## 8. Infrastructure management

AWS buckets, IAM, KMS, GuardDuty, CDN/origin controls, Vercel project settings, DNS, and provider webhook configuration should be reproducible through reviewed infrastructure-as-code or provider configuration manifests after their ADRs are accepted. Supabase SQL migrations remain in the application migration history. Manual console changes are documented, reviewed, and reconciled to the declared configuration.

The infrastructure tool (Terraform, Pulumi, or provider-specific approach) is a remaining implementation decision. It does not alter the domain architecture but must be selected before production provisioning.

## 9. Availability, scaling, and capacity

Stateless application instances scale horizontally on Vercel. PostgreSQL connection management uses a provider-supported pooled path appropriate to serverless workloads; transaction semantics determine which connection mode is allowed. Connection limits, function concurrency, outbox batch size, email rate, and upload concurrency are measured and configured, not guessed.

Caching is limited to explicitly public published content. Private/authenticated reads do not use shared caches. CDN/image transformation behavior must respect the accepted media and mobile budgets.

## 10. Backup and recovery operations

- Supabase PITR and independent encrypted logical database backup.
- S3 versioning and object inventory/reconciliation.
- Environment configuration and infrastructure declarations backed up independently of the production account.
- Monthly restore drills against an isolated target.
- Provider account recovery and break-glass access stored securely outside the application.
- Runbooks for application rollback, migration failure, database restore, storage recovery, identity outage, notification backlog, and compromised credentials.

Exact retention and cross-region/cross-account topology require approval.

## 11. Vercel provider evaluation

- **Why it fits:** first-party current Next.js support, immutable preview deployments, promotion/rollback, functions, runtime logs, and scheduled invocations match one modular monolith.
- **Alternatives considered:** AWS ECS/App Runner, Fly.io, Render, Railway, and a self-managed Node host.
- **Tradeoffs:** easy Next.js operations but serverless duration/concurrency/egress constraints and a separate job design; deep framework/platform coupling.
- **Risks:** cost growth with usage, regional availability constraints, provider outage, environment-secret scope mistakes, cron limitations, and assuming application rollback includes database rollback.
- **Cost implications:** Pro seats/base plan plus function, bandwidth, image, log/drain, and schedule usage. Current costs must be approved from [Vercel pricing](https://vercel.com/pricing).
- **Lock-in implications:** moderate-to-high for preview/deployment/functions/image/runtime operations; Next.js can run on Node-compatible hosts, but migration would require platform and job rework.
- **Final recommendation:** Vercel Pro for the Next.js monolith; keep business modules and provider ports platform-independent.
- **ADR status:** Accepted with staged provider adoption (ADR-021 and ADR-024).

## 12. Compatibility verification status

Current official Vercel documentation confirms full Next.js deployment compatibility, preview/production promotion, rollback, functions/logs, and scheduled jobs. No deployment was created, as required. The Vercel MCP account login was refreshed successfully during architecture review, but the already-running Codex MCP process retained its expired session and could not complete a live project/log read in this session. A Codex restart and read-only MCP check remains an operational verification item, not a structural architecture blocker.

Supabase MCP read-only verification confirmed managed PostgreSQL access, extension visibility, Storage capability, and migration-history visibility. No schema, migration, or bucket was created.

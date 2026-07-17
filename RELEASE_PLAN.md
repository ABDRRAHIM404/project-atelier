# Version 1 Release Plan

**Status:** Approved by the Product Owner on 2026-07-16  
**Scope:** Release preparation and gates only  
**Deployment authorization:** None

## 1. Release objective

Promote one verified Version 1 modular-monolith artifact and its compatible reviewed migration/configuration set through isolated environments, with a safe rollback/forward-recovery path and no unresolved released business policy. This document does not create infrastructure or deploy anything.

## 2. Release unit

One Version 1 release consists of:

- one immutable application build identifier;
- one reviewed ordered database migration range;
- one compatible typed configuration schema and approved effective values;
- one localization/catalog/CMS content compatibility statement;
- provider-adapter versions and environment-specific capability inventory;
- test/security/accessibility/performance/recovery evidence;
- migration, rollback, restore, reconciliation and incident runbooks; and
- a signed release decision.

Catalog/CMS business content can publish independently through its approved workflow after launch, but cannot bypass publication, localization, accessibility, media, audit or policy gates.

## 3. Environment progression

| Environment | Purpose | Data | Provider posture | Exit condition |
|---|---|---|---|---|
| Local | Fast domain/application work | Synthetic only | Fakes/emulators/development instances | Relevant task tests pass |
| CI | Deterministic gates and isolated integration | Ephemeral synthetic | Contract fixtures; no production credentials | Merge evidence passes |
| Preview | Review one change/artifact | Synthetic/non-production only | Non-production resources only | Review complete; no private production data |
| Staging | Production-like integration, migration, provider, load, security and Manager acceptance | Synthetic representative | Isolated staged provider resources with explicit smoke authorization | G8 evidence complete |
| Production | Real business service | Production data only | Accepted plans/regions/IAM/backup/monitoring | G9 authorization plus separate deploy instruction |

No environment shares database, object storage zone, identity population, secrets or callback endpoints with production except through an explicitly approved read-only operational mechanism, if any.

## 4. Incremental internal release milestones

These are integration milestones, not public partial launches:

| Milestone | Included capability | Exit gate | Public production eligible? |
|---|---|---|---|
| M0 | Foundation/build/test shell | G0 | No |
| M1 | Identity/data/authorization/durability | G1 | No |
| M2 | Arabic discovery/CMS/search/files | G2 | No; external uploads still gated |
| M3 | Projects/submission/messaging | G3 | No |
| M4 | Quotation/acceptance/Order | G4 | No |
| M5 | Payment proof/manual verification | G5 | No |
| M6 | Production/fulfilment complete transaction | G6 | No |
| M7 | Workspaces/notifications/operations | G7 | No |
| RC1 | Fully hardened release candidate | G8 | No; candidate only |
| V1 | Production-ready complete Version 1 | G9 | Only after separate deployment authorization |

The business transaction is not split into public feature releases because partial availability could create unsupported commercial states.

## 5. Release gates

### G0–G2 — Foundation gates

- deterministic build/test and boundary enforcement;
- identity, authorization, RLS, audit/outbox/migration foundation;
- Arabic public discovery and secure public/private file boundary; and
- no production data or commercial provider dependency.

### G3–G6 — Core transaction gates

- immutable Submitted Request;
- immutable sent/current Quotation and exactly-once Order creation;
- clean proof versus manual Payment Verification separation;
- verified-payment-before-Production direct and database evidence;
- Order-level Production only; and
- accepted pickup/delivery and handoff evidence through Order completion.

### G7 — Operational gate

- Customer and Manager workspaces support every core next action;
- all seven essential in-app/email intents are durable and observable;
- provider outage/reconciliation drills pass; and
- Manager can operate the staging workflow without database/provider-console intervention.

### G8 — Release-candidate gate

- full Global Definition of Done;
- no critical/high security defect, critical accessibility violation, data-loss risk, authorization bypass or invariant failure;
- accepted browser/language/mobile, API/page/media performance, error/availability instrumentation and recovery evidence;
- production build and migration/rollback/restore rehearsals; and
- release-affecting policies/configurations either approved or the affected unavailable path shown not to violate Version 1.

### G9 — Production launch gate

- approved customer-facing Arabic policies and business configuration;
- approved provider region/legal/budget/ownership and staged-adoption triggers;
- least-privilege secrets/access, backup/PITR/versioning/scan/alerts/runbooks;
- Manager operational acceptance; and
- explicit Product Owner launch authorization.

## 6. Policy and configuration readiness

Before G9, `BP-001` through `BP-010` and `CFG-001` through `CFG-008` are reviewed against the exact release contents.

- If a policy governs a core promised behavior or legally required wording, it must be approved and published.
- If it governs an unsupported exception action, that action remains absent and the public/operational policy must accurately state the available process.
- If a configuration value is required to enable a feature safely, readiness fails closed until it is approved.
- No environment variable or implementation constant substitutes for a versioned business policy requiring history/approval.

`GOV-001` through `GOV-010` in `IMPLEMENTATION_BACKLOG.md` own this evidence; this plan does not answer them.

## 7. Provider staged-adoption plan

| Provider | Pre-launch posture | Required production trigger/evidence |
|---|---|---|
| Supabase | Local/CI isolated database; authorized staging project later | Approved production region/legal posture, Pro/PITR capability, migration/restore and access evidence |
| Clerk | Development instance and synthetic users | Pro before production Manager MFA/backup-code enrollment or real Customer authentication |
| AWS S3 | Emulator/test objects then isolated staging S3 | Production zones/versioning before external uploads; GuardDuty verified before any non-team upload becomes usable |
| GuardDuty | Synthetic events acceptable during early work | Clean/malicious/failed event path and quarantine verified before external upload review, especially payment proof |
| Resend | Adapter fixtures; authorized staging sender/sandbox | Domain/DNS/template/delivery/retry evidence; paid upgrade only at approved volume/feature trigger |
| Sentry/OTel | Local/test exporter or free isolated project | PII scrubbing, release correlation, alerts and quota/retention ownership before production |
| Vercel | Local/CI and non-commercial review as allowed | Pro before first commercial/shared-business Vercel deployment; environment isolation and scheduler auth verified |

Current pricing and provider terms must be rechecked at purchase/launch; `PROVIDER_DECISION_REVIEW.md` remains the dated baseline, not a perpetual quote.

## 8. Database and application release sequence

Each release follows `MIGRATION_STRATEGY.md`:

1. freeze and review the release artifact, migration range and configuration schema;
2. verify staging backup point and restore path;
3. apply backward-compatible expansion under lock/runtime limits;
4. run restartable observable backfills, if any;
5. validate constraints, invariants, ownership, RLS, query plans and drift;
6. promote the compatible application artifact;
7. run authenticated/public smoke and durable-job reconciliation;
8. observe error, latency, queue, database and provider signals;
9. defer destructive contraction to a later release after compatibility evidence; and
10. record release Audit/operations evidence.

No destructive down migration is used as an automatic rollback.

## 9. Promotion, rollback, and recovery

### Promotion

- Promote the exact qualified artifact; do not rebuild differently for production.
- Bind only approved production configuration/secrets.
- Verify schema compatibility before traffic/promotion.
- Run a bounded non-destructive smoke plan using authorized synthetic/operational identities.
- Keep the previous compatible application deployment available during the observation window defined by approved operations configuration.

### Application rollback

- Promote the last known-good compatible artifact when application behavior fails and the expanded schema remains compatible.
- Stop/restrict unsafe new actions if needed without deleting authoritative business state.
- Durable outbox/jobs remain queued and reconcile after recovery.

### Data/migration recovery

- Prefer reviewed forward/compensating correction for a migration/data defect.
- Use PITR only through the coordinated recovery runbook because it affects all later transactions.
- Reconcile S3 object versions and relational references after any restore.
- Preserve Audit/recovery evidence and communicate Customer impact according to approved policy.

## 10. Automatic release blockers and abort signals

Promotion or continued rollout stops for:

- any authorization bypass or cross-Customer/private-file exposure;
- Production starting without authoritative verified Payment;
- mutation/corruption of sent/accepted Quotation or Order snapshots;
- partial/duplicate Acceptance, Payment Verification or completion transaction;
- failed migration integrity/RLS/drift/postcondition check;
- missing backup point or failed restore/recovery prerequisite;
- critical/high exploitable security issue;
- critical accessibility violation or unresolved WCAG A/AA failure;
- accepted performance/availability/error gate failure without valid approved exception;
- persistent outbox/job/scan backlog that invalidates a core workflow;
- secret or sensitive-data exposure in client/cache/log/telemetry/artifact;
- unresolved required business policy/configuration; or
- inability to execute the rollback/incident path.

Exact alert windows and operational thresholds remain approved configuration; no values are invented here.

## 11. Post-promotion verification

After an authorized deployment, verify:

- public Arabic catalog/CMS/search and unpublished exclusion;
- Customer and Manager authentication assurance;
- safe synthetic core reads and one authorized non-destructive workflow subset;
- database connectivity, RLS context and migration postconditions;
- object upload/scan/quarantine/download path using approved synthetic files;
- outbox/job scheduler leasing/reconciliation;
- in-app/email delivery test intent;
- errors/traces/log redaction and critical alerts;
- backup/PITR/version status; and
- no unexpected rate, cost or quota signal.

Real Customer transactions are never created merely to smoke test production unless an approved operational procedure defines ownership and cleanup/history treatment.

## 12. Launch and post-launch governance

- The Product Owner owns the go/no-go decision.
- The release owner owns artifact/promotion/rollback evidence.
- Security/data/files/provider owners remain on-call according to the approved operational plan.
- Early production reviews core journey success, unexpected error rate, queue age, scan delays, email failures, database health, file reconciliation and costs.
- Numeric product-success targets are set only after the approved baseline measurement; no target is invented here.
- Version 1.1 discovery starts only after Version 1 evidence and explicit roadmap approval.

## 13. Approval boundary

Approval of this release plan authorizes preparation during implementation. It does not authorize provider provisioning, migration execution, infrastructure changes, production data access, or deployment. Those require the phase-specific and final explicit instructions described above.

# Provider Review Report

**Project:** Project Atelier / بيتي بذوقي  
**Review date:** 2026-07-16  
**Scope:** Provider-and-cost review only; no architecture redesign or implementation work

## 1. Provider decisions reviewed

| ADR | Provider decision | Review outcome |
|---|---|---|
| ADR-015 | Clerk Pro for identity; local authorization | **Accept with staged adoption** |
| ADR-016 | AWS S3 + GuardDuty for object storage and upload security | **Accept with staged adoption** |
| ADR-021 | Vercel Pro for application hosting | **Accept with staged adoption** |

The full capability, alternative, cost, lock-in, outage, and upgrade-trigger evidence is in `PROVIDER_DECISION_REVIEW.md`.

## 2. Cost summary

All prices were checked against current official sources on **2026-07-16**. Values are USD before tax and currency conversion. These are transparent usage models, not business-volume forecasts.

| Operating stage | Estimated provider total per month | Main assumptions |
|---|---:|---|
| Development / pre-launch | **$0–$0.14** | Local development; provider development/free tiers; only optional minimal AWS test usage |
| MVP, very low traffic | **$175.59–$178.69** | Supabase Pro + seven-day PITR, Clerk Pro monthly, Vercel Pro, low AWS usage, Resend Free, Sentry Developer |
| Early growth | **$178.69–$284.52** | Same fixed baseline; wider AWS egress/scan use; Resend Pro and Sentry Team only when triggered |
| Established small business | **$284.52–$530.64** | Modeled higher storage, requests, scans, direct S3 egress, Resend Pro, and Sentry Team; excludes unmodeled overage |

The dominant MVP cost is the accepted database recovery objective, not application traffic: Supabase's official single-project example is about **$130/month** for Pro, compute, and seven-day PITR after compute credit. Supabase Pro with daily backups alone is cheaper but does not meet the accepted RPO of at most one hour.

The model excludes tax, domain registration, payment-card conversion, customer-managed KMS keys, CDN, replication, Object Lock, AWS logging add-ons, extra environments/projects, and usage outside the stated bands. Those costs are usage-dependent or require a later approved decision.

## 3. Complexity summary

Version 1 uses six provider accounts:

| Provider | Responsibility | Initial financial posture | Failure isolation |
|---|---|---|---|
| Supabase | PostgreSQL system of record, audit, outbox, recovery | Paid before production | Core transaction outage |
| Clerk | Authentication and Manager MFA/recovery | Free development; Pro before production identity | Protected authentication fails closed |
| AWS | Versioned object storage and malware verdict | Usage-priced; low MVP cost | File workflows degrade; relational workflows can continue |
| Resend | Transactional business email | Free until documented volume/feature trigger | Durable email delivery is delayed |
| Vercel | Application runtime and job reconciliation | Local free; Pro before commercial/shared deployment | Storefront and application outage |
| Sentry | Error and tracing diagnostics | Free for one maintainer until quota/team trigger | Diagnostics degrade; business truth remains intact |

Six dashboards, billing systems, credentials, status pages, regional choices, data-processing relationships, and incident contacts are real overhead for one manager and one solo maintainer. However, the reviewed consolidations would either remove an accepted requirement or transfer disproportionate security/operations work to the maintainer:

- Supabase Auth does not currently provide the accepted recovery-code flow.
- Supabase Storage and Vercel Blob do not provide the proposed combination of object version recovery and managed malware scanning.
- Railway Pro has the same $20 minimum as Vercel Pro; a practical small VPS saves only a few dollars after backup while moving OS, TLS, deploy, monitoring, availability, and recovery duties in-house.
- Clerk identity email does not replace business transactional email, and platform logs do not replace production error monitoring or the append-only business audit.

The footprint is therefore acceptable only with staged activation, provider adapters, centralized credential/MFA inventory, spend alerts, monthly bill/quota review, and tested recovery/incident procedures.

## 4. Recommended staged adoption

| Provider/action | Adoption or upgrade trigger |
|---|---|
| Clerk Pro | Before production Manager MFA/backup-code enrollment or any real Customer production authentication |
| AWS S3 | When integrated file persistence begins; production zones before any real external upload |
| GuardDuty | Before the first non-team external file can become usable/reviewable, and always before production payment-proof review |
| Vercel Pro | Before the first commercial or shared-business Vercel deployment, after any bounded trial |
| Supabase Pro | Before production data |
| Supabase seven-day PITR | Before the first production transaction under the accepted RPO, unless another separately approved and restore-tested mechanism meets it |
| Resend Pro | Before exceeding 100 emails/day or 3,000/month, or when a required feature exceeds Free |
| Sentry Team | When more than one user, an unavailable integration/retention feature, or sustained Developer-tier quota requires it |
| CDN for public S3 media | When measured direct public-media egress approaches the aggregate 100 GB AWS allowance or performance evidence requires it |

## 5. ADR changes

Only `ADR_INDEX.md` was updated:

- **ADR-015:** retained as Proposed; added staged adoption, current minimum price, free-development posture, and exact production upgrade trigger.
- **ADR-016:** retained as Proposed; added staged S3 activation, mandatory pre-external-upload GuardDuty trigger, modeled Bahrain cost with a region caveat, and cost alarms.
- **ADR-021:** retained as Proposed; added local/trial posture, current Pro minimum, Hobby commercial-use restriction, and the first commercial/shared-deployment trigger.

No provider was replaced. No status was changed to Accepted. No other architecture document was changed.

## 6. Final verdict

**Architecture approved with provider changes.**

The changes are adoption and cost-control conditions, not an architecture redesign. All three provider ADRs can proceed to approval as staged recommendations. No additional provider review is required before database and API design, provided prices and provider terms are rechecked immediately before purchasing annual plans or launching production.

# Focused Provider Decision Review

**Project:** Project Atelier / بيتي بذوقي  
**Review date:** 2026-07-16  
**Pricing currency:** USD, before tax and payment-card currency conversion  
**Scope:** ADR-015, ADR-016, ADR-021, and their interaction with Supabase, Resend, and Sentry  
**Architecture:** Unchanged

## 1. Executive conclusion

The three provider recommendations remain technically sound, but all three should be adopted in stages:

- **ADR-015 — Clerk Pro:** accept with staged adoption. Clerk development instances are sufficient before launch; Pro becomes mandatory before the production Manager account uses TOTP MFA and backup codes.
- **ADR-016 — AWS S3 + GuardDuty:** accept with staged adoption. S3 can begin when integrated file testing begins. GuardDuty may be absent only from local or synthetic pre-production work and must be enabled before the first external customer upload is accepted.
- **ADR-021 — Vercel Pro:** accept with staged adoption. Local development costs nothing. Vercel Hobby is not eligible for this commercial application, so Pro is required before the first commercial Vercel deployment after any applicable trial.

Six provider accounts are not ideal for a solo-maintained, one-manager workshop, but the count is not arbitrary. Supabase Auth does not supply the accepted recovery-code behavior, and neither Supabase Storage nor Vercel Blob supplies the proposed versioned-recovery plus managed-malware-scan combination. Resend and Sentry can remain on free plans initially, so early production has three fixed paid commitments—Supabase, Clerk, and Vercel—plus low AWS usage.

The largest early-production cost is not traffic or provider count. It is the accepted transactional-data RPO of at most one hour. Supabase's current seven-day PITR example totals about **$130/month** for one production project. Using only the $25 Pro plan with daily backups would be cheaper, but would not satisfy that accepted RPO unless a separately designed and restore-tested hourly recovery mechanism replaced PITR.

## 2. Review method and price integrity

Context7 was used on 2026-07-16 to re-check current Clerk, Supabase, and Vercel capability documentation. Pricing was then checked against official provider pages or, for regional AWS units, the official AWS Price List API. No third-party price was used in a calculation.

Cost ranges below are models, not traffic forecasts. Every model states its assumed usage. Where a provider's price depends on region, compute shape, traffic shape, quotation, or unpublished add-on pricing, the value is marked usage-dependent or unavailable rather than guessed.

### 2.1 Pricing check ledger

| Provider/product | Official evidence checked | Date checked | Current price facts used |
|---|---|---:|---|
| Clerk | [Pricing](https://clerk.com/pricing), [2026 plan change](https://clerk.com/changelog/2026-02-05-new-plans-more-value), [supported MFA methods](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options) | 2026-07-16 | Hobby $0; Pro $25 monthly or $20/month billed annually; 50,000 MRU included per app; MFA and backup codes are Pro; $0.02/MRU from 50,001–100,000 |
| Supabase | [Pricing](https://supabase.com/pricing), [billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery), [Auth MFA](https://supabase.com/docs/reference/javascript/auth-mfa), [Storage backups](https://supabase.com/docs/guides/platform/backups), [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility) | 2026-07-16 | Free $0; Pro from $25; 7-day PITR about $100; official one-project PITR example totals $130 after compute credit; Pro includes 100,000 MAU, 100 GB Storage and 250 GB egress |
| Auth0 | [Pricing](https://auth0.com/pricing), [MFA recovery codes](https://auth0.com/docs/secure/multi-factor-authentication/configure-recovery-codes-for-mfa) | 2026-07-16 | Free to 25,000 MAU without Pro MFA; B2C Essentials $35/month for 500 MAU and includes Pro MFA; higher MAU tiers change price |
| Amazon Cognito | [Pricing](https://aws.amazon.com/cognito/pricing/), [TOTP MFA](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa-totp.html) | 2026-07-16 | New Essentials pools include first 10,000 direct/social MAU; current example rate is $0.015/MAU above; SMS and email delivery are separate AWS charges |
| AWS S3 Standard, Bahrain | [AWS Price List API](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/me-south-1/index.json) | 2026-07-16; offer published 2026-07-14 | $0.025/GB-month through 50 TB; $0.0055/1,000 PUT-class requests; $0.0044/10,000 GET-class requests |
| AWS data transfer, Bahrain | [AWS Price List API](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/me-south-1/index.json), [AWS transfer free tier](https://aws.amazon.com/about-aws/global-infrastructure/global-network/faqs/) | 2026-07-16; offer published 2026-06-25 | First 100 GB/month aggregate internet egress free; then $0.117/GB through first 10 TB in Bahrain |
| GuardDuty Malware Protection for S3, Bahrain | [AWS Price List API](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonGuardDuty/current/me-south-1/index.json), [GuardDuty pricing](https://aws.amazon.com/guardduty/pricing/) | 2026-07-16; offer published 2026-07-14 | First 1 GB and 1,000 objects/month free; then $0.114/GB and $0.000271/object in Bahrain |
| AWS KMS, optional | [KMS pricing](https://aws.amazon.com/kms/pricing/) | 2026-07-16 | Customer-managed key $1/month; first 20,000 eligible requests/month free; not included in the base model |
| Cloudflare R2 | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [malicious upload detection](https://developers.cloudflare.com/waf/detections/malicious-uploads/) | 2026-07-16 | Standard $0.015/GB-month, Class A $4.50/million, Class B $0.36/million, no egress charge; free monthly allowances; malware detection requires Enterprise plus a paid add-on whose price is not published |
| Vercel Blob | [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [public/private stores](https://vercel.com/docs/vercel-blob) | 2026-07-16 | On-demand: $0.023/GB-month, $0.40/million simple operations, $5/million advanced operations, $0.05/GB Blob transfer, plus applicable Vercel network usage |
| Vercel platform | [Pricing](https://vercel.com/pricing), [plans and log limits](https://vercel.com/docs/plans), [Pro plan](https://vercel.com/docs/plans/pro-plan), [Pro trial](https://vercel.com/docs/plans/pro-plan/trials), [Cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [fair use](https://vercel.com/docs/limits/fair-use-guidelines) | 2026-07-16 | Hobby $0 and non-commercial only; Pro $20/month for one deploying seat with $20 usage credit, 1 TB transfer and 10 million Edge Requests included; Pro Cron can run every minute |
| Railway | [Pricing](https://docs.railway.com/pricing), [Next.js guide](https://docs.railway.com/guides/nextjs), [Cron](https://docs.railway.com/cron-jobs) | 2026-07-16 | Free experimentation includes $1 resources; Hobby $5 minimum; Pro $20 minimum; RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB; Cron minimum interval five minutes |
| DigitalOcean VPS | [Droplet pricing](https://www.digitalocean.com/pricing/droplets), [backup pricing](https://www.digitalocean.com/products/backups) | 2026-07-16 | 1 GiB Droplet $6/month; 2 GiB Droplet $12/month; daily backup 30% of Droplet price, weekly 20% |
| Resend | [Pricing](https://resend.com/pricing), [quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [production access](https://resend.com/docs/knowledge-base/does-resend-require-production-approval) | 2026-07-16 | Free production: 3,000 emails/month and 100/day; Pro $20/month for 50,000 and no daily cap; paid overage $0.90/1,000 |
| Sentry | [Pricing](https://sentry.io/pricing/) | 2026-07-16 | Developer $0 for one user, 5,000 errors, 5 GB logs, 5 GB metrics, 5 million spans and 30-day lookback; Team starts at $26/month billed annually with default prepaid data |

Pricing pages can change. Re-check this ledger immediately before a subscription or annual commitment.

## 3. Cost model assumptions

These bands exist only to make usage pricing calculable. They are not product forecasts or approved traffic targets.

| Band | Modeled usage |
|---|---|
| Development / pre-launch | Local-first; no production data; optional 1–5 GB S3 test storage, up to 1,000 test uploads, up to 10,000 GET-class requests, up to 1 GB scanned, and 10 GB egress; provider free/development instances |
| MVP, very low traffic | Under 50,000 Clerk MRU; under 3,000 emails and 100/day; under 5,000 Sentry errors; 5–25 GB S3 including versions, 500–2,000 new objects, 5,000–100,000 GET-class requests, 5–25 GB scanned, and 20–100 GB direct AWS egress; Vercel within included usage |
| Early growth | Under 50,000 Clerk MRU; 0–50,000 emails; Developer or Team Sentry; 25–100 GB S3, 2,000–10,000 new objects, 100,000–1 million GET-class requests, 25–100 GB scanned, and 100–500 GB direct AWS egress; Vercel within included usage/credit |
| Established small business | Under 50,000 Clerk MRU and 50,000 Resend emails; Sentry Team modeled; 100–500 GB S3, 10,000–50,000 new objects, 1–10 million GET-class requests, 100–500 GB scanned, and 500 GB–2 TB direct AWS egress; Vercel remains within its listed included network allowances and credit |

The established band intentionally shows a direct-S3 egress stress case. A later approved CDN configuration could materially reduce it, but this review does not add or select a CDN.

### 3.1 Modeled monthly provider total

| Stage | Supabase | Clerk | AWS S3 + GuardDuty | Vercel | Resend | Sentry | Modeled total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Development / pre-launch | $0 | $0 | $0–$0.14 | $0 local | $0 | $0 | **$0–$0.14** |
| MVP, very low traffic | $130 | $25 monthly | $0.59–$3.69 | $20 | $0 | $0 | **$175.59–$178.69** |
| Early growth | $130 baseline | $25 | $3.69–$63.52 | $20 baseline | $0–$20 | $0–$26 | **$178.69–$284.52** |
| Established small business | $130 baseline | $25 | $63.52–$309.64 | $20 baseline | $20 | $26 | **$284.52–$530.64**, plus any Supabase/Vercel overage outside the modeled band |

With Clerk's annual commitment, subtract $5/month from the applicable totals. Taxes, domain registration, payment-card conversion, optional KMS keys, a CDN, extra staging paid projects, and usage outside the stated bands are excluded.

### 3.2 AWS model derivation

The AWS ranges use the dated Bahrain rates in the pricing ledger:

```text
S3 = stored GB × $0.025
   + PUT-class requests / 1,000 × $0.0055
   + GET-class requests / 10,000 × $0.0044

GuardDuty = max(scanned GB - 1, 0) × $0.114
            + max(scanned objects - 1,000, 0) × $0.000271

Direct egress = max(egress GB - 100, 0) × $0.117
```

Version history increases stored GB and therefore is already intended to be included in the modeled storage quantity. KMS, replication, Object Lock, inventories, CloudTrail data events, and CDN costs are not assumed.

## 4. ADR-015 — Clerk Pro

### 4.1 Why it fits Project Atelier

Project Atelier has an unusual but explicit split: Customers use email OTP, while the sole Manager uses password, TOTP MFA, and recovery codes. Clerk currently supplies all four capabilities, including backup codes, through one supported identity service. Its development instances expose Pro features without requiring a paid production subscription, which matches a long planning/build phase.

Keeping authorization in Atelier's PostgreSQL model limits the provider's role to identity and session assurance. Clerk Organizations, billing, subscriptions, social login, and B2B features are unnecessary and remain disabled/out of scope.

At expected workshop scale, the plan is a fixed authentication-security cost rather than a user-growth cost: Pro includes 50,000 monthly retained users per application. That threshold is far above the modeled early bands, but it is a pricing threshold, not an approved business forecast.

### 4.2 Required comparison

| Alternative | Fit and current minimum | Why it was not selected |
|---|---|---|
| Supabase Auth | Email OTP and TOTP MFA are available; TOTP is free on all projects and Auth usage is already bundled into Supabase Free/Pro. Supabase Pro includes 100,000 MAU. | Current official docs explicitly say recovery codes are not returned and recommend a backup TOTP factor. Supplying the accepted recovery-code behavior would require a custom security-sensitive recovery mechanism or changing the Product Owner decision. The consolidation saving is about the Clerk Pro fee but increases authentication responsibility. |
| Auth0 | Free supports passwordless auth to 25,000 MAU but not Pro MFA. B2C Essentials is $35/month for 500 MAU and includes Pro MFA, separate production/development environments, and Auth0 recovery codes. | It meets the feature requirement but costs more at the smallest paid tier, scales by MAU bands, and provides organization/enterprise features Atelier does not need. It does not reduce provider count compared with Clerk. |
| Amazon Cognito | Essentials currently includes the first 10,000 direct/social MAU and supports password, email OTP and TOTP. Above that, the listed Essentials example rate is $0.015/MAU; email/SMS delivery costs are separate. | Current official Cognito documentation reviewed does not expose a Clerk-style one-time MFA backup-code capability. Its identity flows, SES setup, IAM, hosted/custom UI, and recovery interactions are more operationally complex. It would consolidate identity into AWS but not satisfy the accepted recovery-code requirement without custom work. |
| Self-managed authentication | No provider subscription; maximum flow and data control. | There is no honest fixed price. Atelier would own password hashing, OTP generation/delivery, TOTP secrets, backup-code generation/rotation, sessions, revocation, abuse protection, breach response, security updates, and recovery. For a solo-maintained commercial application and one privileged Manager, the labor and security exposure outweigh $25/month. |

### 4.3 Architectural requirements versus conveniences

**Architectural requirements:** verified Customer email OTP; Manager password plus TOTP MFA and recovery codes; server validation of session assurance; stable external-subject mapping; local role/resource authorization; revocation and recovery; fail-closed behavior.

**Operational conveniences:** prebuilt components, dashboard user search, branding removal, custom session duration, impersonation, longer application-log retention, enterprise connection, and B2B Organizations. None of these justifies Pro for Atelier. MFA plus backup codes does.

### 4.4 Plan and staged use

| Stage | Cheapest supportable use |
|---|---|
| Local development | Clerk development instance, $0; Pro features are available for development testing |
| Staging | Development instance with synthetic identities, $0, provided it is not used as a real production tenant |
| MVP launch | **Pro required** before the production Manager relies on MFA/backup codes: $25 monthly or $20/month billed annually |
| Early production | Pro remains sufficient through 50,000 MRU; no active-user overage in the modeled bands |
| Growth trigger | Above 50,000 MRU: published graduated overage begins at $0.02/MRU/month; re-evaluate economics before crossing the threshold |

### 4.5 Hidden cost and operational footprint

- MRU overage begins only after 50,000, but the counting unit is retained users, not MAU.
- Email OTP deliverability, custom sender/domain configuration, templates, and abuse controls still require attention even when Clerk sends the code.
- Production support above the included tier, longer logs, enterprise SLA, and migration assistance cost more.
- Atelier must operate a reliable Clerk-subject-to-local-Customer/Manager mapping and signed webhooks.
- There are now two email systems: Clerk for identity messages and Resend for business notifications. Domain reputation and DNS ownership must be coordinated.

### 4.6 Lock-in, migration, and outage impact

Lock-in is high for credentials, sessions, enrolled TOTP factors, and backup codes. Clerk exposes user-data export, but a provider migration can force password reset, MFA re-enrollment, and recovery-code replacement. Local ownership and role data reduce domain migration work but do not remove identity migration impact.

A Clerk outage prevents new login and any protected request whose session cannot be verified. Existing business state remains intact in PostgreSQL. The application must fail closed and surface a service-unavailable response; it must never bypass MFA or elevate an unmapped identity.

### 4.7 Final recommendation and exact paid trigger

**Decision:** **Accept with staged adoption.**

Use free development instances for local and staging work. Upgrade the production Clerk instance to Pro **before creating or enabling the production Manager account with mandatory MFA and backup codes**, and before any real Customer production authentication. Annual billing should be selected only after the provider has passed staging and production-exit testing.

## 5. ADR-016 — AWS S3 + GuardDuty

### 5.1 Why it fits Project Atelier

Atelier accepts untrusted JPG, PNG, and PDF uploads, including sensitive bank-transfer proof. The same product also needs public catalog media, private messages/projects, restricted operational files, immutable historical references, and a private-file recovery process. S3 supplies mature access control, versioning, stable object versions, encryption options, Block Public Access, and an independent recovery location. GuardDuty supplies a managed event-driven malware verdict for newly uploaded S3 objects.

For low initial traffic, this security posture has no meaningful fixed platform fee. In Bahrain, GuardDuty's first 1 GB and 1,000 scanned objects per month are free; the modeled MVP AWS total is $0.59–$3.69/month before optional KMS.

### 5.2 Required comparison

| Alternative | Cost/capability | Why it was not selected |
|---|---|---|
| Supabase Storage | Already bundled: Free includes 1 GB; Pro includes 100 GB then $0.0213/GB; Pro includes 250 GB egress. Public/private buckets and access control are convenient. | Database backups do not contain Storage objects, and current S3 compatibility does not support S3 object versioning. No equivalent managed malware scanner is bundled. Meeting immutable version/recovery/scan requirements would add a separate backup and scan system, eroding the provider-count advantage. |
| Cloudflare R2 | Free allowances, $0.015/GB-month Standard storage, $4.50/million Class A, $0.36/million Class B, and no egress fee. Current R2 also has bucket locks. | This would replace AWS with Cloudflare rather than reduce provider count. Current malicious-upload detection is an Enterprise paid add-on with unpublished pricing, and the reviewed R2 workflow does not provide the same documented S3 version-history/recovery plus managed scan integration. R2 becomes attractive if public-media egress, not sensitive uploads, dominates later. |
| Vercel Blob | Same Vercel account; public/private stores; $0.023/GB-month and usage pricing; immutable unique names are supported. | No current native GuardDuty-equivalent scan was documented, no S3-style historical object recovery was established, and private downloads pass through Vercel Functions with additional transfer/runtime implications. It increases Vercel platform coupling and does not satisfy the sensitive-upload recovery posture by itself. |
| S3 without GuardDuty initially | Same storage/recovery controls with the scan service omitted; lowest integration effort during early development. | Acceptable only for synthetic/local files. File extension/MIME/signature checks do not establish that a PDF or image is malware-free. Since GuardDuty has no fixed plan fee and a small free tier, omitting it from real-customer production saves little while leaving the highest-risk upload control incomplete. |

### 5.3 Architectural requirements versus conveniences

**Architectural requirements:** public/private/sensitive separation; private by default; stable immutable object reference; no local ephemeral-disk authority; authorized short-lived access; upload validation and quarantine; a trustworthy clean/unsafe/pending decision before normal use; private-file recovery and database/object reconciliation.

**Operational conveniences:** AWS as the specific object provider, GuardDuty as the specific scanner, customer-managed KMS keys, Object Lock, replication, CloudFront, detailed inventories, and AWS-native dashboards. S3/GuardDuty is the recommended implementation, not a domain invariant.

### 5.4 Plan and staged use

| Stage | Cheapest supportable use |
|---|---|
| Local development | Local fixtures/emulator or disposable S3 test data; $0 provider requirement |
| Integrated staging | Usage-priced S3 with synthetic files; GuardDuty can be enabled and usually remains inside its free scan allowance |
| MVP launch | S3 versioning/separation plus GuardDuty required before first external Customer upload; no minimum paid plan, only usage |
| Early production | Same services; use AWS budgets/alerts and direct-egress monitoring |
| Growth trigger | Add/approve CDN strategy when public-media egress approaches the 100 GB aggregate AWS direct-egress allowance or measured latency requires it; review lifecycle/version cost when noncurrent versions materially increase stored GB |

### 5.5 Hidden cost and operational footprint

- Every noncurrent version consumes storage; no retention rule may be guessed while policy is open.
- Direct Bahrain egress above the first aggregate 100 GB is $0.117/GB in the current price list and becomes the dominant AWS cost in the growth models.
- GuardDuty charges both scanned GB and objects after the monthly free allowance.
- KMS adds $1/month per customer-managed key plus eligible request charges after its free allowance; it is not assumed yet.
- Replication, Object Lock, inventories, CloudTrail data events, event delivery, CDN, and recovery storage can add charges.
- IAM, bucket policies, event handling, scan-state reconciliation, budgets, and incident response add real solo-maintainer work.
- AWS account-root protection, billing alarms, region selection, and credential rotation are mandatory operational duties.

### 5.6 Lock-in, migration, and outage impact

Object bytes and an S3-compatible adapter are portable; IAM, KMS, GuardDuty event vocabulary/tags, Object Lock, and recovery procedures are AWS-specific. Migration requires copying every current and required historical version, verifying checksums/metadata, updating relational object references safely, and preserving retention/audit evidence.

An S3 regional outage blocks uploads and uncached media/private-file reads but need not block database-only workflows. A GuardDuty delay/outage keeps new files pending/quarantined; it must not treat them as clean. Historical business state remains available, and outbox/reconciliation work catches up after recovery.

### 5.7 Final recommendation and exact provider trigger

**Decision:** **Accept with staged adoption.**

Create production-grade S3 zones only when integrated file work begins. Enable and verify GuardDuty **before the first non-team external upload is accepted in staging or production and always before an uploaded payment proof can become reviewable**. Do not pay for KMS, replication, Object Lock, or a CDN until their policy/region/traffic trigger is approved.

## 6. ADR-021 — Vercel Pro

### 6.1 Why it fits Project Atelier

Atelier is one Next.js modular monolith maintained by one person. Vercel removes OS, TLS, reverse-proxy, process-manager, build-host, CDN, preview, and basic deployment-rollback operations. Its current Pro plan supplies commercial-use eligibility, one deploying seat, first-party Next.js behavior, per-minute Cron capability for durable-outbox reconciliation, and a usage credit.

The $20 plan fee is not justified by traffic. It is justified by commercial-use terms and reducing deployment operations. Hobby cannot legally/contractually serve this business application under Vercel's current fair-use rules.

### 6.2 Required comparison

| Alternative | Cost/capability | Why it was not selected |
|---|---|---|
| Vercel Hobby | $0, but restricted to non-commercial personal use; Cron once per day with up to ±59-minute precision; runtime logs retained one hour. | Project Atelier advertises and sells a service and is therefore commercial. Hobby is not a launch or early-production option regardless of low traffic. Daily reconciliation is also too weak for the current notification-job recommendation. |
| Railway | Official Next.js standalone deployment; Free experimentation, $5 Hobby minimum, or $20 Pro minimum; usage-priced CPU/RAM/egress; Cron every five minutes minimum. | A $5 Hobby deployment could be cheaper for a side project, but Railway describes Pro as the production/team tier and Pro has the same $20 minimum as Vercel. Atelier would own standalone/container behavior and lose first-party Next.js previews, routing/image/runtime integration. It remains a credible migration target, not a clear initial saving for production. |
| Small VPS | DigitalOcean lists 1 GiB at $6/month and 2 GiB at $12. Daily backup adds 30%, making a more realistic 2 GiB starting point $15.60/month before monitoring or labor. | Saving roughly $4.40/month versus Vercel Pro is not operationally realistic for a solo maintainer under 99.9% availability and four-hour RTO. The maintainer would own OS/security patches, TLS, firewall, reverse proxy, Node process, deployments, zero-downtime/rollback, cron, monitoring, capacity, and host recovery. A single VPS is also a larger failure domain. |

### 6.3 Architectural requirements versus conveniences

**Architectural requirements:** supported Node/Next runtime; HTTPS; environment and secret isolation; bounded durable-job invocation; deployable immutable artifact; observability; backup-aware migration/rollback; sufficient availability and recovery.

**Operational conveniences:** first-party Next.js optimizations, Preview URLs/comments, instant promotion/rollback, per-minute rather than five-minute reconciliation, image service, Vercel dashboard, faster builds, and included network. These conveniences are valuable for one maintainer but are not domain requirements.

### 6.4 Plan and staged use

| Stage | Cheapest supportable use |
|---|---|
| Local development | Local Node/Next runtime, $0; no hosted platform required |
| Short provider evaluation | Current Pro trial is 14 days with $20 credit; suitable for bounded compatibility testing |
| Shared commercial staging/preview | Pro is the safe minimum because Hobby is restricted to non-commercial personal deployments |
| MVP launch | **Pro required:** $20/month for one deploying seat; modeled traffic remains within included allowances/credit |
| Early production | Pro until measured usage, team, support, region, or SLA needs exceed it |
| Growth trigger | Pay overage when included allowances/credit are exceeded; reevaluate host if sustained Vercel usage is materially higher than a managed Node host plus the real labor cost of replacing previews, CDN, jobs, and operations |

### 6.5 Hidden cost and operational footprint

- The $20 credit is not a hard cap; on-demand usage applies after credit. New teams currently default to a $200 on-demand budget unless changed.
- Functions, data transfer, origin transfer, image operations, Blob, build resources, logs/drains, and add-ons can consume credit or create overage.
- Pro runtime-log retention is only one day in the current limits; Sentry/internal audit remains necessary for longer diagnostics/evidence.
- Cron invokes Functions and consumes normal function resources.
- Another deploying seat or enterprise/security feature adds cost.
- Cross-provider calls to Supabase, Clerk, and AWS add latency and can incur origin/egress costs depending on region.

### 6.6 Lock-in, migration, and outage impact

The application remains deployable as a Node Next.js standalone service, but Vercel-specific caching, image behavior, environment rules, Cron, deployment APIs, and observability require migration. Railway or a managed container host is feasible; a VPS demands a new operating model.

A Vercel outage makes the storefront and authenticated application unavailable even if Supabase and AWS are healthy. PostgreSQL and objects remain intact. No email or job should be considered lost because the outbox remains durable; dispatch resumes after the application/scheduler recovers. Vercel Pro does not provide the Enterprise 99.99% SLA, so the accepted application availability target is an engineering/measurement target rather than a contractual provider guarantee.

### 6.7 Final recommendation and exact paid trigger

**Decision:** **Accept with staged adoption.**

Develop locally at no cost. Use the bounded Pro trial for hosting compatibility if useful. Start Pro **before the first Vercel deployment used for Project Atelier's commercial development, shared business staging, advertising, payment-related flow, or production**. Configure a low deliberate spend limit and alerts before any public deployment.

## 7. Interaction of all six Version 1 providers

| Provider | Essential responsibility | Early plan/cost | Critical-path impact |
|---|---|---|---|
| Supabase | Relational system of record, transactions, audit/outbox | Pro + 7-day PITR model about $130 | Highest: core reads/writes unavailable during outage |
| Clerk | Authentication and Manager assurance/recovery | Pro $25 monthly / $20 annual effective | High: new/uncertain protected sessions fail closed |
| AWS | Versioned files and upload malware verdict | Usage, modeled $0.59–$3.69 at MVP | Medium-high: uploads/private files unavailable; DB-only workflows can continue |
| Resend | Business transactional email | Free to 3,000/month and 100/day | Low for transaction truth: outbox/in-app remain; email is delayed |
| Vercel | Application runtime, deployment, scheduled reconciliation | Pro $20 | Highest: customer/manager application unavailable |
| Sentry | Error/tracing diagnostics | Developer $0 for one maintainer | Low for business truth; diagnostics/alerting degrade |

### 7.1 Is six providers excessive?

For one manager and a home workshop, six dashboards, security settings, status pages, billing systems, DPAs, credential sets, regions, webhooks, alerts, and incident contacts are meaningful operational overhead. A solo maintainer must expect routine provider review and cannot rely on memory.

However, only three are synchronous core dependencies for normal protected work: Vercel, Supabase, and Clerk. AWS is synchronous for file/media actions. Resend and Sentry are failure-isolated by durable state and can use free plans. Financially, early production has three fixed paid plans, not six.

The obvious consolidations each remove an accepted or strongly justified capability:

- **Remove Clerk:** Supabase Auth saves $25/month but loses native recovery codes or introduces custom security work.
- **Remove AWS:** Supabase Storage reduces IAM/provider overhead but loses the proposed versioned object recovery and managed scan combination; Vercel Blob has the same scan/recovery gap.
- **Remove Resend:** another email mechanism is still required for the seven essential events; Clerk's identity email is not the business notification provider.
- **Remove Sentry:** possible before integrated staging, but production still needs actionable error/tracing evidence. Vercel's one-day Pro runtime logs and PostgreSQL Audit Events do not replace error monitoring.
- **Remove Vercel:** Railway Pro costs the same floor; a VPS saves little after backups and transfers substantial labor/risk to the solo maintainer.

The architecture therefore does not have an obviously redundant paid provider. It does have an operational-overhead problem, which staged activation, adapter boundaries, one owner checklist, cost alarms, and quarterly access/recovery review should control.

### 7.2 Minimum operational schedule

- One password-manager vault and MFA/recovery inventory for all provider owner accounts.
- Separate production and non-production credentials; no production data in previews.
- Monthly bill/quota/spend-alert review across all six providers.
- Monthly database restore and private-object reconciliation exercise as already accepted.
- Quarterly provider access, webhook, DNS, domain, backup, and recovery review.
- One status/incident runbook listing which customer functions fail for each provider.
- Annual pricing/ADR review, and an immediate review before any annual plan commitment or quota threshold.

## 8. Upgrade and provider-addition triggers

| Provider/action | Exact trigger |
|---|---|
| Clerk Pro | Before production Manager MFA/backup-code enrollment or any real production Customer authentication |
| Clerk MRU overage/economic review | Forecast or actual MRU approaches 50,000 in a billing month |
| AWS S3 | When integrated file persistence begins; production zones before any real external upload |
| GuardDuty | Before the first external/customer file can become available to Manager or Customer; mandatory before production payment proof |
| AWS KMS customer-managed key | Only after security/legal review approves key ownership and the recovery/rotation runbook; add $1/key/month plus request exposure |
| CDN for S3 public media | Measured public-media direct egress approaches 100 GB/month aggregate AWS allowance or latency/performance gates require it |
| Vercel Pro | Before the first commercial/shared-business Vercel deployment, after any bounded trial |
| Resend Pro | Forecast or actual delivery exceeds 100 emails in a day or 3,000 in a month, or a required feature exceeds Free; upgrade before the threshold, not after failed email |
| Sentry Team | More than one Sentry user, required third-party integrations/longer lookback, or sustained events exceed Developer quotas; reduce noise before buying volume |
| Supabase Pro | Before production data; Free pausing and backup limitations are not production-safe |
| Supabase 7-day PITR | Before first production transaction under the accepted RPO ≤ 1 hour, unless a separately approved/tested mechanism demonstrably meets the same RPO/RTO |

## 9. Final decision matrix

| ADR | Final recommendation | Rationale |
|---|---|---|
| ADR-015 — Clerk Pro | **Accept with staged adoption** | Exact accepted identity factors; development is free; Pro only when production MFA/backup codes are required |
| ADR-016 — AWS S3 + GuardDuty | **Accept with staged adoption** | Strongest fit for versioned sensitive-file recovery and managed scanning; usage cost is negligible at MVP; activate only when file integration starts |
| ADR-021 — Vercel Pro | **Accept with staged adoption** | Hobby is unavailable for commercial use; Railway Pro has the same floor; VPS saving is too small for the operational risk |

No provider replacement is supported by the current evidence. No architecture redesign is recommended.

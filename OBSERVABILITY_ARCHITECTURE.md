# Observability Architecture

**Status:** Approved 2026-07-16

## 1. Objectives

Observability must show whether customers can complete the core transaction, whether security and state invariants hold, whether durable work is progressing, and whether recovery targets are achievable. It must avoid turning telemetry into an ungoverned copy of sensitive business data.

Advanced product analytics is outside Version 1. The architecture collects operational and reliability signals, not behavioral profiling.

## 2. Signal model

| Signal | Purpose | Approved system |
|---|---|---|
| Structured logs | Explain discrete request/job/provider outcomes | Application logs through Vercel, with approved drain/retention if needed |
| Traces | Follow request → transaction → outbox → provider dependencies | OpenTelemetry instrumentation, exported to Sentry/approved backend |
| Metrics | SLOs, capacity, queue health, DB/storage/provider health | OTel/custom measurements plus Vercel, Supabase, AWS native metrics |
| Errors | Group exceptions, regressions, releases, affected journeys | Sentry Next.js SDK with source maps and PII scrubbing |
| Audit Events | Business/security evidence | Append-only PostgreSQL Audit module; never replaced by logs |
| Synthetic checks | Verify public and authenticated critical health | External checks using non-production-safe/synthetic accounts |

## 3. Correlation and context

Every inbound request and durable job receives a correlation identifier. Trace context propagates across internal module calls and approved provider calls. Outbox records retain originating correlation/event IDs so an asynchronous attempt can be joined to the business action.

Allowed context includes environment, release, module, operation, safe actor type, coarse resource type, outcome, latency, state transition name, and provider. Full email, name, address, message body, payment proof, quotation contents, cookie, token, presigned URL, raw request body, and secret are excluded.

High-cardinality customer/order identifiers are included only in an access-controlled, pseudonymous form where necessary for support and never used as metric dimensions.

## 4. Service-level indicators

The accepted targets in `QUALITY_GATES.md` are measured as follows:

- **Availability:** successful eligible requests over total eligible requests, excluding approved maintenance under a defined policy.
- **Error rate:** unexpected server errors and failed eligible operations over requests/operations; validation and intentional authorization denials are tracked separately.
- **API latency:** server duration at p50/p95/p99 separated by public read, authenticated read, mutation, and provider-dependent operation.
- **Core Web Vitals:** real-user p75 LCP, INP, and CLS by device class and locale, supplemented by lab budgets.
- **Durable work:** oldest pending age, queue depth, success/retry/dead-letter rate, lease expiry, and event-to-delivery latency.
- **Database recovery:** measured recovery point and restore completion during exercises.

The accepted Version 1 objectives are 99.9% monthly availability, under 0.5% unexpected error rate, and the latency/CWV thresholds documented in `QUALITY_GATES.md`. Unapproved exclusions, alert windows, and error-budget policy remain configuration decisions.

## 5. Critical journey telemetry

Low-cardinality events track success/failure and time through:

- sign-in and local identity mapping;
- project submission;
- quotation send and revision;
- quotation acceptance/order creation transaction;
- payment proof upload/scan/finalization;
- manual payment verification;
- production transition, including blocked pre-payment attempts;
- readiness and fulfilment completion;
- message send/attachment processing;
- essential notification creation and email handoff.

These signals do not record content or become an advanced analytics data set.

## 6. Alerts

Production alert classes include:

- availability/error-rate and latency burn;
- acceptance or payment-verification transaction failure spikes;
- any invariant breach signal, especially production without verified payment;
- database connection exhaustion, replication/backup failure, or storage pressure;
- oldest outbox/job age, dead-letter increase, repeated lease expiry;
- malware finding, scan backlog/failure, unexpected bucket-public-policy change;
- manager MFA/security changes and repeated authorization anomalies;
- provider webhook signature failure spikes;
- backup/reconciliation/restore drill failure.

Exact thresholds, paging hours, responders, and escalation times require an incident-response configuration and do not change the telemetry design.

## 7. Dashboards

Minimum operational views:

1. customer transaction health and core journey outcomes;
2. application SLO and Web Vitals by release/locale/device;
3. PostgreSQL health, slow operations, connection use, and backup/PITR state;
4. outbox/jobs and notification provider delivery;
5. file upload, scan, storage, and reconciliation health;
6. authentication/authorization security indicators;
7. deployment release comparison and rollback decision support.

## 8. Error handling

User responses contain a localized safe message and correlation/reference code. Internal errors use stable categories and retain causal chains server-side without revealing provider details. Expected domain rejections are typed outcomes, not noisy exceptions. Unexpected errors reach Sentry with scrubbed, allowlisted context.

Source maps are uploaded privately during CI and not publicly served. Environment and release markers support regression comparison.

## 9. Retention and access

Telemetry access follows least privilege and provider MFA. Development, staging, and production signals are separated. Exact log, trace, error, and audit retention values require approval; provider defaults are not silently treated as business retention policy. Export/drain decisions consider Vercel/Sentry plan retention and Saudi privacy/legal review.

## 10. Provider evaluation

### OpenTelemetry plus Sentry and native provider telemetry — final recommendation

- **Why it fits:** OpenTelemetry provides portable instrumentation; Sentry has current Next.js error/tracing integration; Vercel, Supabase, and AWS expose platform-specific runtime, database, backup, storage, and security signals.
- **Alternatives considered:** provider-native telemetry only, Datadog, Grafana Cloud, New Relic, and self-hosted OpenTelemetry/Grafana stacks.
- **Tradeoffs:** multiple consoles and signal correlation require discipline; Sentry is easier to operate than a self-hosted stack but adds a provider and SDK.
- **Risks:** PII leakage, duplicate instrumentation, sampling gaps, high-cardinality cost, alert fatigue, and losing audit evidence if logs are mistaken for audit.
- **Cost implications:** Sentry event/trace/replay quotas, Vercel retention/log-drain plan, provider metrics, and possible OTel backend/export charges. Session replay is not required for Version 1 and should remain disabled unless separately privacy-approved. Check current [Sentry pricing](https://sentry.io/pricing) and [Vercel logs](https://vercel.com/docs/functions/logs) before approval.
- **Lock-in implications:** low for OTel semantic instrumentation; moderate for Sentry issue workflows and provider-native dashboards.
- **Final recommendation:** OTel-instrumented application with Sentry for errors/traces and native Vercel/Supabase/AWS operational signals; Audit Events remain PostgreSQL-owned.
- **ADR status:** Accepted (ADR-010 and ADR-022).

Official integration reference: [Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/).

## 11. Readiness conditions

Before production, all critical journeys emit safe correlated signals; alert routes have owners; SLO queries are reproducible; sensitive-field scrubbing is tested; audit and logs are demonstrably separate; job/storage dashboards exist; and a deployment plus rollback exercise proves release markers and diagnostics.

# Notification Architecture

**Status:** Approved 2026-07-16  
**Version 1 channels:** In-app and transactional email

## 1. Scope

Notification architecture delivers essential customer information reliably without making email delivery part of the business transaction. Push notifications, marketing automation, advanced preference centers, and product analytics are outside Version 1.

The required customer events are:

1. Quote Ready
2. Quote Accepted
3. Payment Received
4. Payment Verified
5. Production Started
6. Ready
7. Delivered

The precise wording, recipients beyond the owning Customer, optional reminders, and timing values remain policy/configuration points.

## 2. Delivery model

```text
Business transaction
   |-- state/history/audit
   `-- outbox event (same PostgreSQL transaction)
             |
             v
      leased dispatcher
        |          |
        v          v
   in-app record  email adapter -> Resend
        |                         <- signed webhooks
        `---------- delivery diagnostics/status
```

An event is emitted only after the corresponding business fact is committed. The outbox intent is part of that same transaction. A provider failure cannot undo an accepted quotation, verified payment, or production update. It creates a visible retry/recovery condition.

## 3. Event contract

A notification event contains a stable event and correlation identity, business event type, occurred time, owning recipient identity, safe resource reference, locale/template context, and deduplication key. It does not contain a complete domain object, raw payment proof, presigned URL, credential, or arbitrary customer text.

Consumers load the current minimum data they are authorized to use or rely on an intentionally captured immutable notification snapshot. For historical/legal wording, the rendered template version and locale are recorded.

## 4. Transactional outbox and jobs

PostgreSQL stores outbox work atomically with business changes. Dispatchers claim records using leases so concurrent invocations do not duplicate ownership. Processing is at-least-once; every consumer is idempotent. Attempts, next eligible time, provider reference, safe failure code, and terminal/manual-recovery state are durable.

The application may make an opportunistic post-commit dispatch for low latency, but correctness depends on the durable queue. A Vercel Cron reconciliation trigger runs the dispatcher/reaper on an approved schedule. The recommended one-minute production reconciliation requires a Vercel plan that supports that frequency. Retry counts, backoff, lease length, and escalation timing remain operational configuration.

No required job uses process memory, `setTimeout`, or an unawaited request promise.

## 5. In-app notifications

The Notification module owns customer-visible in-app records, read state, and deep-link metadata. Creation is idempotent by recipient and business event. Reading a notification is not equivalent to viewing the protected resource: following a link performs normal resource authorization.

Unread counts and lists may use a relational projection. They are customer-private, dynamically rendered, and never shared-cached. Exact retention and whether read state can be cleared are unresolved policy points.

## 6. Email delivery

Resend is accessed only through an Email Provider port. The adapter sends a server-rendered Arabic or approved English transactional message, an idempotency key, and minimal recipient metadata. A stable internal delivery record remains canonical; provider status augments it.

Resend's documented idempotency window is finite, so durable internal idempotency must prevent late duplicate sends beyond that window. Webhook signatures and replay/idempotency checks are mandatory. Delivered/opened/clicked provider signals, if enabled, are diagnostic and privacy-reviewed; they do not change Order state.

Official references: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) and [webhooks](https://resend.com/docs/webhooks/introduction).

## 7. Template architecture

Templates are semantic, versioned, localized presentation assets. Each essential event has:

- approved Arabic subject/body and in-app message;
- safe variables with a strict schema;
- plaintext and accessible HTML email output;
- a validated application link rather than a direct private object URL;
- optional approved English variant;
- rendering tests for RTL, bidi data, escaping, missing variables, and common mail widths.

Customer or manager input is escaped. Payment-proof images/documents are not embedded in emails.

## 8. Failure and recovery

| Failure | Behavior |
|---|---|
| Dispatcher interruption | Lease expires; another invocation safely retries |
| Resend timeout/5xx/rate limit | Record safe failure; retry with bounded backoff |
| Permanent recipient rejection | Stop automatic retry when classified permanent; expose manager recovery status |
| Duplicate invocation/webhook | Idempotent no-op or merge into existing attempt status |
| Missing/invalid template | Do not send fallback internal data; alert and dead-letter |
| In-app creation failure | Retry independently while preserving original event |
| Webhook unavailable | Outbound acceptance remains recorded; reconcile when provider supports it |

The Product Owner must approve whether and how the Manager manually contacts a customer after terminal failure. Architecture exposes the condition without inventing the procedure.

## 9. Privacy and security

Recipient lookup is server-side and scoped to the owning transaction. Email content contains the minimum useful information and links back to the authenticated application for sensitive details. Logs exclude full addresses, bodies, tokens, and private URLs. Unsubscribe mechanics are not applied to mandatory transactional messages unless law/policy requires a specific treatment; marketing is outside scope.

## 10. Provider evaluation

### Resend — final recommendation

- **Why it fits:** straightforward transactional API, idempotency support, signed webhook model, Next.js-friendly integration, and provider delivery events.
- **Alternatives considered:** Amazon SES, Postmark, SendGrid, and Supabase email hooks/SMTP.
- **Tradeoffs:** simpler developer operation than SES but less infrastructure control; deliverability still requires verified domain/DNS and sender reputation work.
- **Risks:** provider outage/rate limits, finite idempotency window, bounce classification, webhook loss, and vendor retention/privacy settings.
- **Cost implications:** free/paid volume tiers and retention/features change over time; production budget must use current [Resend pricing](https://resend.com/pricing), plus domain/DNS operating cost.
- **Lock-in implications:** low-to-moderate because the adapter contract and internal templates/idempotency are provider-neutral; webhook/status vocabulary needs mapping.
- **Final recommendation:** Resend behind a provider adapter with PostgreSQL outbox authority.
- **ADR status:** Accepted (ADR-020).

### PostgreSQL outbox plus Vercel reconciliation — final recommendation

- **Why it fits:** atomic with relational business state, adequate for Version 1 volume, no second queue system, and recoverable under serverless execution.
- **Alternatives considered:** direct fire-and-forget calls, Supabase `pgmq`, Inngest, Trigger.dev, AWS SQS/Lambda, and a dedicated worker host.
- **Tradeoffs:** the team owns leasing, retry, dead-letter, and monitoring behavior; scheduled dispatch latency is not instant.
- **Risks:** table growth, stuck leases, duplicate execution, provider/API duration limits, and database contention if poorly designed.
- **Cost implications:** database storage/compute and Vercel scheduled/function invocations; Vercel Pro is expected for minute-level schedules. External job providers may become cheaper operationally at higher scale.
- **Lock-in implications:** low for the PostgreSQL outbox; moderate for the scheduler/runtime invocation shape.
- **Final recommendation:** transactional outbox with leased workers and Vercel Cron reconciliation; reevaluate only with measured load/operational evidence.
- **ADR status:** Accepted (ADR-006, ADR-008, ADR-019).

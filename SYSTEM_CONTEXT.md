# System Context

**Status:** Approved 2026-07-16  
**Scope:** Version 1

## 1. System of interest

The Atelier system is an Arabic-first storefront and transaction workspace for one home-based Saudi business. It lets customers discover configurable products, submit multi-item projects, receive and accept revised quotations, submit bank-transfer proof, follow production and fulfilment, and communicate with the manager. It lets the sole manager operate the catalog, CMS, quotes, payment verification, orders, messages, notifications, and audit history.

## 2. People and roles

| Actor | Goals | Trust boundary |
|---|---|---|
| Visitor | Browse published catalog and CMS content; begin registration | Unauthenticated internet user; public data only |
| Customer | Own account, projects, quotes, payments, orders, messages, files, notifications | Authenticated; access is restricted to resources owned by the mapped Customer identity |
| Manager | Operate the single business and review customer transactions | Authenticated with MFA; business authority does not grant infrastructure-root access |
| Product Owner / Operator | Approve policy and architecture decisions; manage deployments and provider configuration | Privileged operational role outside normal product flows |

There are no worker, reviewer, driver, showroom-employee, tenant-admin, or platform-admin accounts in Version 1.

## 3. Context diagram

```text
                       +-----------------------+
                       | Product Owner/Operator|
                       +-----------+-----------+
                                   |
                                   | deployment/configuration
                                   v
+---------+       HTTPS       +----+---------------------+
| Visitor |------------------>|                          |
+---------+                   |                          |
                              | Atelier Version 1        |
+----------+      HTTPS       | Modular Monolith         |
| Customer |<---------------->|                          |
+----------+                  |                          |
                              |                          |
+----------+      HTTPS       |                          |
| Manager  |<---------------->|                          |
+----------+                  +--+----+----+----+----+---+
                                 |    |    |    |    |
               identity/session |    |    |    |    | telemetry
                                 v    |    |    |    v
                              Clerk  |    |    |  Sentry/OTel
                         transactions|    |    |
                                     v    |    |
                              Supabase   |    |
                              PostgreSQL |    |
                                  files  |    | email
                                         v    v
                                      AWS S3  Resend
```

Vercel hosts the monolith and invokes its scheduled reconciliation entry point. DNS, browser platforms, and the customer's bank are environmental dependencies, not integrated transactional systems in Version 1. The system records proof of an external bank transfer; it does not initiate or confirm a transfer through a bank API.

## 4. External system contracts

| System | Data sent | Data received | Failure posture |
|---|---|---|---|
| Clerk | Email address, identity workflow data, manager MFA enrollment | Signed session/identity assertions and stable subject ID | Reject protected operations if identity cannot be verified; never fall back to client claims |
| Supabase PostgreSQL | Parameterized business transactions and queries | Authoritative relational state | Fail closed; no partial domain transition; alert on exhaustion or availability failure |
| AWS S3 | Object bytes, metadata tags, retention/security directives | Versioned objects and access results | Business metadata remains pending/quarantined; no file is treated as usable until durable upload and required scan state succeed |
| GuardDuty Malware Protection | Objects in designated upload zones | Scan result events/tags | Unknown, failed, or unsupported scan is not equivalent to clean; hold for retry or manual recovery |
| Resend | Recipient, template result, idempotency metadata | Delivery acceptance and webhook events | Persist and retry through the outbox; provider response is not the business transaction commit |
| Sentry / telemetry backends | Scrubbed errors, traces, measurements | Issue and alert state | Business flow continues where safe; telemetry failure is observable but not transaction authority |
| Vercel | Application artifact, runtime configuration, schedules | Runtime, preview/production deployments, logs | Use promotion/rollback runbooks; database migrations require an independent recovery plan |

## 5. Trust boundaries

1. **Internet to application:** all input is untrusted. HTTPS, validation, rate controls, CSRF/origin protections, and server authorization apply.
2. **Browser to identity provider:** Clerk manages credential and MFA flows. A valid session proves identity, not business permission.
3. **Application to database:** only server-side scoped credentials access business data. Browser database credentials are not part of the design.
4. **Application to storage:** dedicated server roles have zone-specific permissions. Customer uploads first enter quarantine/private paths.
5. **Provider webhooks to application:** signatures, timestamps where available, replay protection, and event idempotency are mandatory.
6. **Operator plane:** deployment, database-owner, storage-admin, Clerk, and monitoring access are separate from the Manager product role.

## 6. Information flows

### Public discovery

The Visitor receives only published Product, Category, Collection, CMS content, approved translation, and deliberately public media. Drafts and unpublished translations do not cross the public boundary.

### Customer transaction

The Customer session maps to one local Customer identity. The system authorizes ownership at every hop: project, submitted request, quotation, payment proof, order, fulfilment, messages, attachments, and notifications. Acceptance is a transactional command, not a client-side status update.

### Manager operation

The Manager has business-management capabilities defined by module policy. Sensitive reads and every state-changing action are audited. The role cannot bypass transition preconditions such as verified payment before production.

### File flow

Browser uploads use a short-lived, object-specific capability issued after authorization and metadata validation. The object remains unavailable to normal consumers while pending upload validation or malware scan. Publishing catalog media is a separate manager action that promotes an approved object/reference to the public delivery zone.

### Notification flow

The originating transaction creates durable notification/outbox intent. A worker creates in-app delivery state and calls the email adapter. Provider webhook events update delivery diagnostics but cannot rewrite the underlying business event.

## 7. Deployment environments

Local, staging, and production are isolated security and data boundaries. Preview deployments use non-production providers and synthetic data. Production customer or payment data must never be copied into preview environments. Each environment has separate database, identity instance, buckets or prefixes with independent credentials, email mode/domain, telemetry environment, and secrets.

## 8. Context-level assumptions and configuration points

- Saudi Arabia is the Version 1 operating country and SAR the initial currency configuration.
- The exact provider regions require approval against latency, legal, data-residency, and budget needs.
- The exact business address, future showroom details, delivery prices, policy wording, retention values, and notification timing remain configuration or business-policy decisions.
- Optional English content is served only where the publication workflow marks it approved. Arabic remains the required source and fallback.

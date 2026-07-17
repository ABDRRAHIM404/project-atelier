# Security Architecture

**Status:** Approved 2026-07-16  
**Security model:** Zero implicit trust across browser and provider boundaries

## 1. Security objectives

- Prevent unauthorized access across customers and between customer and manager functions.
- Enforce workflow invariants on the server, especially payment before production.
- Protect payment proofs, private messages, customer data, and restricted operational records.
- Preserve the authenticity and immutability of quotations, acceptances, order snapshots, and audit evidence.
- Limit provider compromise and credential exposure through separation and least privilege.
- Detect, contain, recover from, and audit security-relevant failures.

## 2. Data classification

| Classification | Examples | Baseline controls |
|---|---|---|
| Public | Published product/CMS content and deliberately public media | Publication approval, integrity controls, cache invalidation |
| Private | Customer profile, project, quotation, order, messages, delivery details | Authenticated owner/manager access, no shared caching, encrypted transit/storage |
| Sensitive | Bank-transfer proofs and associated verification evidence | Separate storage zone/credentials, short-lived access, narrow manager access, scan/quarantine, view audit |
| Restricted | Internal notes, audit events, secrets, operational recovery data | Manager/operator purpose-limited access, append-only or controlled mutation, no browser exposure unless required |

Unknown data defaults to Private. A business object being visible to its Customer does not make it Public.

## 3. Authentication and authorization separation

Clerk establishes identity and authentication strength. The application maps the verified external subject to a local Visitor/Customer/Manager actor and resolves status and permissions. Authorization is enforced in the application service and owning domain module for every operation.

The design does not trust:

- client-provided user or customer IDs;
- route names or hidden buttons;
- unsigned session data;
- identity-provider public metadata as the only manager-role authority;
- direct object keys as proof of access;
- a previously authorized request after the target state has changed.

## 4. Authorization model

Version 1 uses role plus relationship plus state:

- **Visitor:** published resources only.
- **Customer:** own mapped resources, only in allowed states and only customer-safe fields.
- **Manager:** explicit business operations across the one business, subject to MFA, transition preconditions, sensitive-purpose restrictions, and audit.
- **Operator:** provider/deployment control outside product sessions; not an application role exposed to ordinary flows.

Every protected operation follows: authenticate → map local actor → load target and ownership context → check role/relationship/state → validate command → execute transaction → audit. Denials disclose no cross-customer existence information.

## 5. Application security controls

### Input and output

- Validate shape, size, type, encoding, locale, identifiers, and domain constraints at each server boundary.
- Parameterize database access through the server-only data layer.
- Encode output according to HTML, URL, header, JSON, and email-template context.
- Sanitize deliberately supported rich text with an allowlist before persistence/publication and again as defense in depth at rendering.
- Do not render customer-controlled HTML, SVG, or executable media directly.

### Browser protections

- Secure, HttpOnly, SameSite session cookies under Clerk's supported configuration.
- Origin and CSRF protections for state-changing requests, including Next.js allowed-origin configuration where relevant.
- Content Security Policy introduced in report-only mode, then enforced; nonce/hash strategy chosen during UI architecture.
- HSTS, MIME sniffing protection, restrictive referrer policy, frame-ancestor denial except an explicitly approved integration, and permissions policy.
- No secrets, private file URLs, provider keys, or full sensitive objects in browser bundles or public source maps.

### Abuse controls

Rate and abuse controls are applied to OTP attempts, registration, login, public search, contact/message creation, file signing/finalization, acceptance, and provider webhooks. Exact rates are configuration decisions and are not invented here. Controls use identity, IP/risk signal, resource, and global limits without making IP address the sole identity control.

## 6. Workflow integrity controls

- Quotation sending freezes its revision; acceptance references the current sent revision.
- Acceptance and Order creation are one transaction and idempotent.
- Prices, currency, delivery charge, address, configurations, and terms used by an accepted Order come from server-owned quotation data.
- Proof upload does not equal payment verification.
- Only Manager verification creates the verified-payment fact.
- Every Production transition checks verified payment in the authoritative transaction.
- Order Item Snapshots never carry a Version 1 production lifecycle and cannot be edited.
- Fulfilment completion requires configured evidence and allowed prior state.
- Reversal or recovery behavior follows `STATE_MACHINES.md`; missing policy never authorizes an implicit reversal.

## 7. File security

All uploads are authorized before capability issuance, constrained by accepted type/size, stored under an application-generated key, and finalized only after server validation. Client filename and MIME type are metadata, not trust evidence. File signatures and safe decoding are checked where possible.

New customer uploads enter a quarantine or pending state. GuardDuty Malware Protection scans designated S3 upload zones. Clean status permits domain use; malicious results are isolated and alert operations; failed, unsupported, or absent scans remain unavailable pending retry or manual review. SVG/HTML/scriptable files are not accepted for payment proof. See `STORAGE_ARCHITECTURE.md`.

## 8. Secrets and cryptography

- Provider credentials live in environment-scoped secret stores, never source control, client bundles, logs, documents, or database configuration rows.
- Environments use separate keys and accounts/projects where feasible.
- Credentials are scoped per adapter and storage zone; no shared all-powerful application key.
- TLS is required in transit. Providers encrypt at rest; additional key-management controls are selected for sensitive S3 zones.
- Key rotation and emergency revocation have tested runbooks. Rotation intervals remain operational configuration unless mandated.
- Password and MFA secrets remain with Clerk; the application never receives or stores them.

## 9. Provider and webhook security

Inbound provider callbacks verify provider signatures using the raw request where required, enforce replay/timestamp safeguards, and deduplicate events. Webhook payloads are not trusted to authorize a business transition. Outbound provider calls use idempotency keys and minimum data. Provider failures and repeated signature failures alert operations.

## 10. Logging, privacy, and audit

Operational logs use structured event names, correlation IDs, coarse actor/resource IDs, and safe error codes. They exclude OTPs, cookies, tokens, credentials, full email bodies, bank proof content, presigned URLs, complete addresses, and uncontrolled request bodies. Sentry scrubbing and allowlisted context are configured before production data is sent.

Audit Events retain business evidence separately and append-only. Read access and export are controlled. Exact retention, data-subject procedures, legal notice wording, and payment-proof retention remain Product Owner/legal decisions represented as policy.

## 11. Threat model priorities

| Threat | Primary mitigation |
|---|---|
| Cross-customer object access / IDOR | Resource-level server authorization; opaque identifiers; ownership tests |
| Manager account takeover | Strong password, TOTP MFA, backup codes, rate controls, alerting, recovery runbook |
| Client price/state tampering | Server-owned configuration and state machines; transactional snapshots |
| Payment-proof malware | Type/size/signature validation, S3 quarantine, managed malware scan, no inline active content |
| Stored XSS in CMS/messages | Plain text by default, rich-text allowlist, output encoding, CSP |
| Webhook replay/forgery | Signature, time/replay check, event and business idempotency |
| Cache leakage | Public allowlist; private dynamic responses; no signed URL caching |
| Privileged database/storage misuse | Least privilege, provider MFA, separate operator plane, audit and alerting |
| Supply-chain compromise | Lockfile, dependency review/scanning, minimal packages, protected CI and provenance |
| Data loss/ransomware | PITR, independent encrypted backups, S3 versioning, restore drills, scoped delete rights |

## 12. Verification and release gates

Security tests include authorization matrices, cross-account negative tests, state-machine property/transition tests, upload abuse tests, webhook replay tests, secret scanning, dependency scanning, static analysis, browser security-header checks, and restore exercises. Critical or high exploitable issues block release. The exact vulnerability-response SLA is a proposed operational configuration requiring approval.

## 13. Security reviews still requiring approval

- Provider regions and Saudi legal/data-residency assessment.
- Retention and deletion obligations by data class.
- Business/legal wording for customer consent and policies.
- Incident contacts, severity response times, and breach procedures.
- Whether S3 Object Lock is legally/operationally required and for which classifications.
- Exact abuse thresholds and manager recovery procedure.

These do not change the core trust boundaries; they specialize configuration and operations.

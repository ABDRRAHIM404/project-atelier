# Authentication and Authorization Architecture

**Status:** Approved 2026-07-16  
**Recommended identity provider:** Clerk Pro

## 1. Requirements mapping

| Requirement | Architecture response |
|---|---|
| Customer email OTP | Clerk email-code authentication; verified provider subject mapped to local Customer |
| Manager strong password | Clerk password policy and breach/attempt protections, with application bootstrap restrictions |
| Manager MFA | Clerk TOTP second factor required for Manager access |
| Manager recovery codes | Clerk backup-code factor; recovery procedure is audited and tested |
| Server-side authorization | Local role, relationship, state, and resource checks on every protected operation |
| Single business | No organization/tenant abstraction; exactly one active Manager identity under controlled bootstrap policy |

## 2. Identity model

Clerk owns credentials, email verification, login challenges, MFA factors, backup codes, session issuance, and identity-provider recovery mechanics. The relational database owns the corresponding Customer or Manager business identity, account status, authorization role, ownership relationships, and audit linkage.

A stable external subject maps to one local actor. Email address is contact/login data and can change under verified provider workflow; it is not the relational primary key and is not used to authorize ownership. Provider metadata alone cannot elevate a Customer to Manager.

## 3. Authentication flows

### Customer

The customer enters an email address and completes a one-time code challenge through Clerk. On a verified first sign-in, a server-controlled provisioning flow idempotently creates or links the local Customer. The system prevents one provider subject from being silently linked to another Customer and logs identity-link recovery.

### Manager

The Manager signs in with a strong password and completes TOTP MFA. Manager routes and operations require an authentication assurance level that includes the second factor. Backup codes are generated and managed through Clerk's supported factor workflow. The exact secure handoff and recovery ceremony requires an operator runbook; recovery must not turn email access alone into silent Manager elevation.

### Session

The server validates the session using Clerk's official Next.js integration, resolves the local actor, and rejects revoked, unmapped, disabled, or insufficient-assurance identities. Sensitive actions may require recent authentication if approved as policy. Session duration and reauthentication windows are configuration decisions.

## 4. Manager bootstrap and lifecycle

Version 1 has one Manager. Bootstrap uses an operator-controlled allowlist or explicit one-time provisioning process that matches the verified Clerk subject and records an Audit Event. Public signup can never create a Manager. Adding, replacing, suspending, or recovering the sole Manager is an operator procedure with dual evidence where feasible; exact business ceremony remains to be approved.

The Manager product role is not equivalent to database owner, Vercel owner, AWS administrator, Clerk administrator, or Supabase organization owner. Those provider roles use separate human accounts with provider MFA.

## 5. Authorization enforcement

Authorization is a server-side function of:

```text
verified actor + local account status + role + resource relationship
+ resource lifecycle + requested action + authentication assurance
```

Customer reads and writes use server-derived Customer identity. Manager commands are action-specific and still evaluate lifecycle preconditions. File access additionally checks classification and owning business resource. Unauthorized and not-found responses avoid exposing another customer's resource existence.

Client middleware may redirect obvious unauthenticated requests, but it is not the final security boundary. Each Server Action, Route Handler, server-rendered private read, job, and file-signing operation calls the authoritative access layer.

## 6. Provider synchronization and webhooks

Provider user/session webhooks support lifecycle synchronization but do not grant Manager authority. Signatures, replay checks, idempotency, and out-of-order handling are mandatory. Protected requests may reconcile a missing non-privileged Customer mapping idempotently; Manager mapping is never auto-created from untrusted metadata.

Deleting or disabling an identity-provider user does not automatically erase business transaction history. It disables access and initiates the approved data lifecycle procedure.

## 7. Failure behavior

- If Clerk is unavailable or a session cannot be verified, protected operations fail closed.
- A database outage prevents local authorization and therefore protected access.
- A missing local mapping returns a controlled recovery/provisioning outcome, never a role default.
- MFA downgrade, recovery, factor replacement, repeated failed login, and Manager subject changes create security signals and Audit Events where provider data permits.
- No emergency bypass credential is embedded in the application.

## 8. Testing

Authentication and authorization verification covers:

- Customer OTP success, expiry, replay, rate-limit, and account-link cases;
- Manager password plus TOTP, backup code, insufficient-factor, recovery, and revocation cases;
- cross-customer read/write denial for every resource type;
- Manager allowed/denied action matrix by state;
- disabled/unmapped user behavior;
- webhook forgery, replay, duplication, and reordering;
- cache and signed-file access isolation;
- browser session security and logout/revocation.

## 9. Provider evaluation

### Clerk Pro — final recommendation

- **Why it fits:** current official capabilities cover email OTP, passwords, TOTP MFA, backup codes, server-side Next.js integration, and session assurance. Backup codes satisfy the accepted Manager recovery-code requirement that Supabase Auth does not directly provide.
- **Alternatives considered:** Supabase Auth, Auth0, AWS Cognito, and self-managed authentication.
- **Tradeoffs:** a second primary provider and local identity mapping are required; hosted/auth components may constrain UX unless custom flows are used.
- **Risks:** provider outage, identity-link errors, misconfigured factor requirements, and privileged metadata misuse. Local authorization and tested recovery reduce but do not eliminate them.
- **Cost implications:** production MFA is a paid feature; Clerk Pro follows the accepted staged-adoption trigger, while active-user/add-on costs require ongoing budget monitoring against current [Clerk pricing](https://clerk.com/pricing/).
- **Lock-in implications:** high for credential/session migration because password hashes, enrolled factors, and recovery state are provider-owned; local business authorization and stable mapping limit domain coupling.
- **Final recommendation:** Clerk Pro, custom Arabic-first flows as needed, local database authorization, no Clerk Organizations.
- **ADR status:** Accepted with staged adoption (ADR-015).

Official capability references: [authentication options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [email OTP](https://clerk.com/docs/guides/development/custom-flows/authentication/email-sms-otp), and [MFA](https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication).

## 10. Remaining policy and configuration points

Clerk Pro and its staged adoption are accepted. Exact session/reauthentication settings, Manager bootstrap/recovery procedure, operator ownership, account suspension/deletion policy, and Customer account-link support flow still require approval or implementation-time configuration as classified in `DECISION_WORKSHOP.md`. The server-side local authorization model is an accepted constraint.

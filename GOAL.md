# Current Project Goal

**Project:** Project Atelier / بيتي بذوقي
**Milestone:** Lean Version 1 release candidate and provider handoff
**Status:** Local implementation complete; provider-connected release pending
**Authorization:** `LEAN_V1_IMPLEMENTATION_PLAN.md`

## Objective

Deliver the smallest complete Arabic-first custom-furniture workflow without weakening ownership, immutable commercial history, private-file isolation, or the verified-payment production gate.

## Implemented scope

- Arabic RTL public showroom and published catalog search.
- Customer project drafts, items, immutable submission snapshots, and clarification messages.
- Manager quotation, customer acceptance, immutable accepted history, and Order creation.
- Bank-transfer submission metadata, explicit manual Manager verification/rejection, and audit history.
- Order-level production and delivery/pickup completion.
- Customer/Manager dashboards, in-app notifications, and Manager catalog draft creation/editing.
- Local demo runner, reviewed migrations, forced RLS, and full non-browser automated verification.

## Remaining release work

- Complete the account-connected tasks in `OWNER_PROVIDER_HANDOFF.md`.
- Connect private upload/finalize/scan/download capabilities and remove demo object-key entry from production UX.
- Configure real Clerk sign-in/session behavior and the designated Manager account.
- Configure external email delivery and production deployment.
- Run the critical Playwright journey in an environment with Playwright Chromium installed.

## Exit criteria

1. Provider handoff evidence is complete without secrets.
2. Private customer and payment files are uploaded through server-generated capabilities, scanned clean, and authorization-tested.
3. Production authentication and Manager MFA are verified.
4. Full static, PostgreSQL, browser, accessibility, security, and production-build checks pass.
5. No critical defect or unresolved production safety gate remains.

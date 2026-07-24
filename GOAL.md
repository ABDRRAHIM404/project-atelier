# Current Project Goal

**Project:** Project Atelier / بيتي بذوقي
**Milestone:** Lean Version 1 deployed stabilization
**Status:** Deployed to Vercel; issue correction and launch hardening in progress
**Authorization:** Product Owner decisions recorded in `PROJECT_KNOWLEDGE.md`

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

## Remaining launch work

- Complete the remaining provider-connected launch work.
- Add the approved malware-scanning and clean-file lifecycle before launch, or keep affected uploads disabled until an approved alternative exists.
- Replace the temporary Manager assurance treatment with the approved launch authentication posture.
- Define the financial, material, refund, and recovery consequences of cancellation after Payment Verification or Production starts.
- Verify external email delivery and the deployed Vercel environment configuration.
- Fix current stabilization defects and rerun the full release evidence suite against the deployed environment.

## Exit criteria

1. Provider handoff evidence is complete without secrets.
2. Private customer and payment files are uploaded through server-generated capabilities, scanned clean, and authorization-tested.
3. Production authentication and Manager MFA are verified.
4. Full static, PostgreSQL, browser, accessibility, security, and production-build checks pass.
5. No critical defect or unresolved production safety gate remains.

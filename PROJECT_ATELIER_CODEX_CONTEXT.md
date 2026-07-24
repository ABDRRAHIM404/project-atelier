# Project Atelier — Codex Fix Context

**Owner:** Abderrahim  
**Project:** Project Atelier / بيتي بذوقي  
**Role of this file:** Operational handoff after bug-fix batches. `PROJECT_KNOWLEDGE.md` remains the authoritative product source of truth.

## Working rules

- Use the latest verified local repository as the source of truth.
- Preserve unrelated user changes.
- Keep fixes focused and do not weaken RLS, authentication, audit history, or immutable commercial records.
- Sent quotation revisions remain immutable.
- Apply migrations forward only; never reset the live database.
- After each fix batch, record the root cause, changed files, live actions, and verification here.

## Current implemented decisions

- Arabic-first RTL furniture workflow with one business and one Manager role.
- No direct checkout. Both catalog and custom-design requests use quotation → acceptance/refusal → Order → fulfilment details → hosted online payment → production → delivery/pickup → completion.
- Production cannot start before a verified signed provider webhook records successful payment.
- Supabase/PostgreSQL is the system of record.
- Active uploads use Supabase Storage. Product images are public; custom-design files and delivery handoff proofs are private. Historical payment proofs remain private but have no active upload or review route.
- Clerk is the active identity provider. Sensitive Manager operations require the current internal `manager_mfa` assurance.
- Archiving sets `archived_at`; it does not cancel or delete records.

## Previous fixes

### Bugs 1–3 — Fixed

- **Bug 1:** Customer quotation refusal failed because the live database lacked `notifications.notify_managers_of_quotation_decline(uuid,uuid,text)`. Migration `20260724000100_restore_quotation_decline_notification.sql` restored it without mutating sent quotation revisions.
- **Bug 2:** Accepted-Order fulfilment information is attached to the accepted Order, opens immediately after acceptance, and does not persist across customer sections.
- **Bug 3:** Valid payment-proof submissions with fulfilment details and a transfer reference are accepted.

Baseline reported after Bug 1 restoration: 12 migrations and 65 PostgreSQL tests passing, with typecheck, lint, and production build passing.

## Online-payment transition — 2026-07-24

- Active bank-transfer UI and HTTP mutations were removed; historical rows, Storage objects, migrations, and audit history were preserved.
- Added provider-neutral Payment Attempts, Checkout Sessions, immutable Gateway Transactions, and durable signed provider-event processing.
- Added `POST /api/v1/orders/:orderId/checkout-sessions`, `GET /api/v1/orders/:orderId/payment-status`, and `POST /api/v1/webhooks/payments`.
- The provider runtime is intentionally unavailable. No fake provider can create a checkout or verify a Payment.
- A future reviewed adapter must verify the provider signature before the request receives the `provider_webhook` actor.
- PostgreSQL rechecks amount, currency, Order ID, merchant reference, transaction ID, attempt state, and event idempotency.
- Only a verified webhook actor can create a successful Gateway Transaction and set Payment and Order states to verified.
- The Customer sees a disabled `ادفع الآن` action with `قريباً`; the Manager has a read-only provider-neutral Payment view and no manual approval controls.
- Required server-only environment names are documented in `.env.example`; no credential values are committed.

### Verification and live configuration

- Forward migration `20260724000300_provider_neutral_online_payments.sql` was applied to the linked live Supabase project on 2026-07-24.
- Live verification confirmed the new tables, forced RLS policies, transition guards, webhook-only verification support, notification function, production gate, and preservation of historical Payment submissions and verifications.
- Vercel has `PAYMENT_PROVIDER_ENABLED=false` in Development, Preview, and Production. Provider identifiers and secrets remain unset.
- The latest existing Vercel production deployment was verified `READY`; this workspace change was not deployed during the implementation.
- Verification passed: 112 unit tests, 22 integration tests, 65 PostgreSQL tests, migration checks, boundaries, lint, typecheck, secret scan, focused Playwright workflow, and production build.

## Historical fix batch — Bugs 4, 5, and 6

This section records earlier stabilization work. Its Bug 4 proof-review behavior was subsequently superseded by the Online-payment transition above: the historical data remains, but the active proof upload, proof access, and Manager verification routes no longer exist.

### Bug 4 — Manager payment proof and transfer reference

**Root cause**

- Order detail returned only the proof filename and submission timestamp.
- No Manager-authorized endpoint generated a short-lived URL for the private proof object.
- The submitted transfer reference was not exposed in Manager Order detail.

**Behavior after fix**

- Manager Order detail displays the customer’s declared transfer reference.
- The private payment proof is shown as an image preview when applicable, or as a PDF card.
- Clicking the proof opens it through an MFA-protected endpoint that generates a 60-second Supabase signed URL.
- Customers cannot use the Manager proof-access service.

### Bug 5 — Manager Order details persisted across sections

**Root cause**

- Manager tab and saved-view changes updated the selected section but did not clear the opened Request/Order detail state.

**Behavior after fix**

- Changing a Manager top-level tab closes detail panels that do not belong to that tab.
- Changing the Manager Order view (`ACTIVE`, `CANCELLED`, or `HISTORY`) closes the opened Order.
- Changing the Manager Request view closes the opened Request.
- Any selected delivery-proof file is also cleared when the Order panel closes or changes.

### Bug 6 — Delivery proof required manual storage metadata

**Root cause**

- The completion form exposed internal fields for filename, MIME type, and private object key instead of uploading a file.

**Behavior after fix**

- Manager selects a JPG, PNG, or PDF directly from the device.
- Server validates the file type and 10 MB size limit.
- Server generates the private object key and uploads the file to the private `handoff-proofs` Supabase bucket.
- The existing fulfilment completion service records generated metadata and completes the Order.
- If the database action fails, the newly uploaded object is removed.

## Files changed in this batch

- `src/app/_components/workflow/manager-dashboard.tsx`
- `src/app/api/v1/manager/orders/[orderId]/complete/route.ts`
- `src/app/api/v1/manager/payment-submissions/[submissionId]/proof/route.ts`
- `src/app/globals.css`
- `src/lib/supabase-server.ts`
- `src/modules/orders/application/order-query-service.ts`
- `src/modules/payments/application/payment-service.ts`
- `src/platform/workflow/http.ts`
- `supabase/migrations/20260724000200_handoff_proofs_bucket.sql`
- `supabase/migrations/manifest.json`
- `tests/e2e/workflow.spec.ts`
- `tests/postgres/lean-core-workflow.test.ts`
- `tests/postgres/migrations.test.ts`
- `tests/unit/supabase-storage-paths.test.ts`
- `README.md`
- `PROJECT_KNOWLEDGE.md`

## Migration added

- ID: `20260724000200`
- File: `20260724000200_handoff_proofs_bucket.sql`
- SHA-256: `ab2e111e193fe4cd61b03972b7a944b1e3d8b2d5614d23ac7a973777289990a4`
- Effect: creates/updates a private `handoff-proofs` bucket with a 10 MB limit and JPG, PNG, and PDF MIME allowlist.

### Required live action

Apply `20260724000200_handoff_proofs_bucket.sql` to the linked Supabase database before testing delivery-proof upload in production. Do not reset the database.

## Verification performed in the fix workspace

- Migration manifest/checksums: **13 migrations verified**.
- Module boundary validation: **passed**.
- Syntax transpilation for all changed TypeScript/TSX files: **passed**.
- Full dependency-based test, lint, typecheck, and build commands were not runnable in the fix workspace because the required Node 24/npm 11 environment and package downloads were unavailable.

Run locally:

```bash
npm run migrations:check && npm run test:postgres && npm run typecheck && npm run lint && npm run build
```

## Next update template

```text
### Bug N — Title
Status: Fixed
Root cause:
Changed files:
Behavior after fix:
Database/live actions:
Verification:
```

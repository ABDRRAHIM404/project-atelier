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
- No direct checkout. Both catalog and custom-design requests use quotation → acceptance/refusal → Order → fulfilment details → bank transfer → manual payment verification → production → delivery/pickup → completion.
- Production cannot start before verified payment.
- Supabase/PostgreSQL is the system of record.
- Active uploads use Supabase Storage. Product images are public; custom-design files, payment proofs, and delivery handoff proofs are private.
- Clerk is the active identity provider. Sensitive Manager operations require the current internal `manager_mfa` assurance.
- Archiving sets `archived_at`; it does not cancel or delete records.

## Previous fixes

### Bugs 1–3 — Fixed

- **Bug 1:** Customer quotation refusal failed because the live database lacked `notifications.notify_managers_of_quotation_decline(uuid,uuid,text)`. Migration `20260724000100_restore_quotation_decline_notification.sql` restored it without mutating sent quotation revisions.
- **Bug 2:** Accepted-Order fulfilment information is attached to the accepted Order, opens immediately after acceptance, and does not persist across customer sections.
- **Bug 3:** Valid payment-proof submissions with fulfilment details and a transfer reference are accepted.

Baseline reported after Bug 1 restoration: 12 migrations and 65 PostgreSQL tests passing, with typecheck, lint, and production build passing.

## Fix batch — Bugs 4, 5, and 6

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

# Product Owner Provider and MCP Handoff

Complete these account-connected steps in development/preview first. Return only safe evidence; never paste secrets or full connection strings.

## 1. Supabase

- Create/select the authorized development project.
- Apply `supabase/migrations/manifest.json` in order.
- Confirm runtime/job/migration roles and forced RLS match the PostgreSQL tests.
- Configure `DATABASE_URL` as a server-only variable locally and in Vercel.
- Run `npm test` against an isolated non-production database.
- Do not expose owner/service/migration credentials to browser code.

Evidence: project name, environment, migration result, PostgreSQL test result, date.

## 2. Clerk

- Create the application and configure the approved customer sign-in method.
- Require MFA/higher assurance for the one designated Manager.
- Configure authorized parties and `/api/v1/webhooks/clerk`.
- Set `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `CLERK_AUTHORIZED_PARTIES` only in the correct environment.
- Connect the real sign-in UI/session flow to the existing server authentication adapter.
- Verify one customer and the designated Manager using non-production accounts.
- Keep `ALLOW_DEMO_AUTH=false` outside the local demo.

Evidence: application/environment name, customer authentication result, Manager MFA result, webhook result, date.

## 3. AWS S3 and GuardDuty

The repository contains the reviewed file lifecycle and S3 adapter, but the production workflow intentionally fails closed until this path is wired.

- Create private quarantine, private-customer, sensitive-payment, restricted-operations, and isolated public-media origins.
- Enable Block Public Access, versioning, encryption, lifecycle controls, least-privilege IAM, and approved CORS.
- Connect server-generated upload intent, direct upload, finalization, exact object-version/checksum inspection, GuardDuty scan event, status, and short-lived download capability.
- Replace the local/demo object-key fields in payment and handoff forms with the secure upload UI.
- Connect request-reference and message attachments through the same clean-file lifecycle.
- Prove malicious/pending files cannot be submitted, downloaded, published, or used as payment/handoff evidence.
- Set `PRIVATE_UPLOADS_READY=true` only after all checks pass.

Evidence: non-secret bucket/role identifiers, clean/malicious/pending test results, cross-customer denial result, date.

## 4. Catalog/CMS media publication

- Upload catalog/CMS source files only through the Manager media intent flow.
- Verify scan results and safe derivative creation.
- Publish only Arabic content with approved clean media.
- Confirm original uploads remain private and public delivery exposes only approved derivatives.
- Complete any desired CMS content editing surface; the current public informational copy remains repository-managed Arabic content.

Evidence: one draft-to-published product/content example, original-file privacy result, public derivative result, date.

## 5. Resend and notifications

- Verify the sending domain and configure server-only credentials.
- Connect durable notification intents to Arabic email templates.
- Test safe retry/failure behavior in development/preview.
- Keep in-app notifications as the source of truth when external delivery fails.

Evidence: template names, non-sensitive delivery result, retry result, date.

## 6. Vercel

- Connect the repository and use Node.js 24 with the committed lockfile.
- Configure `APP_ENV`, database, Clerk, AWS, Resend, and observability variables per environment.
- Confirm preview cannot access production data or credentials.
- Apply migrations before promoting application code that depends on them.
- Run the production build, full Playwright workflow, accessibility checks, secret scan, and smoke test before promotion.

Evidence: preview URL, build result, browser journey result, smoke result, date.

## 7. Final release evidence

Return:

- Supabase migration/PostgreSQL result.
- Customer and Manager Clerk result.
- Clean/malicious/private-file authorization result.
- Critical Playwright journey result.
- Vercel preview smoke result.
- Any remaining known defect or disabled feature.

Do not return private keys, passwords, signing secrets, session tokens, raw payment proof, customer data, or full provider payloads.

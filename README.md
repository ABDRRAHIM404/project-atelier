# Project Atelier / بيتي بذوقي

Arabic-first, RTL custom-furniture platform for one Saudi furniture business. Customers submit made-to-order projects, receive a manager quotation, accept it, submit bank-transfer proof, and track order-level production through delivery or pickup.

## Current delivery status

The repository is a **lean Version 1 local release candidate**. The complete commercial workflow is implemented and verified against PostgreSQL:

1. Arabic showroom and product search.
2. Customer multi-item project draft and immutable submission.
3. Customer–manager messaging.
4. Manager quotation and customer acceptance.
5. Order creation with immutable commercial snapshots.
6. Bank-transfer proof metadata and manual manager verification.
7. Verified-payment gate before production.
8. Order-level production stages.
9. Delivery/pickup proof metadata and completion.
10. Customer and manager dashboards, notifications, and manager catalog drafts.

Production-connected authentication, private file bytes, malware scanning, email delivery, and deployment remain disabled until the Product Owner completes `OWNER_PROVIDER_HANDOFF.md`.

## Run the local demo

Requirements: Node.js 24, npm 11, and Linux/macOS running as a normal non-root user.

```bash
npm ci
npm run demo
```

Open `http://127.0.0.1:3000`. The demo creates an isolated temporary PostgreSQL database, applies verified migrations, seeds six Arabic products, and enables the in-app Customer/Manager role switch. The temporary database is removed when the process stops.

## Standard development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Set `DATABASE_URL` and the Clerk variables before using protected APIs without demo mode. Never enable `ALLOW_DEMO_AUTH` in staging or production.

## Verification

```bash
npm run verify:static
npm test
npm run test:boundaries
npm run test:tooling
npm run migrations:check
npm run scan:secrets
APP_ENV=test npm run build
```

The browser workflow test is available after installing Playwright Chromium:

```bash
npx playwright install chromium
npm run test:e2e:workflow
```

## Important release gates

- No direct checkout exists.
- Production cannot begin before manual verified payment.
- Accepted quotation and order-item history is immutable.
- Customer records are protected by actor-scoped transactions and forced RLS.
- Private proof endpoints fail closed unless `PRIVATE_UPLOADS_READY=true`.
- Setting that flag is allowed only after the secure S3 upload/finalize/scan path is connected and verified.
- Demo seed/auth are blocked in staging and production.

## Project references

- `LEAN_V1_IMPLEMENTATION_PLAN.md` — active delivery plan.
- `LEAN_V1_DELIVERY_REPORT.md` — implemented evidence and remaining release blockers.
- `OWNER_PROVIDER_HANDOFF.md` — Supabase, Clerk, AWS, Vercel, Resend, and MCP work.
- `MASTER_PRD.md`, `STATE_MACHINES.md`, and `QUALITY_GATES.md` — authoritative product and quality contracts.

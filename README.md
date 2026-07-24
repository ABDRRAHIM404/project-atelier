# Project Atelier / بيتي بذوقي

Arabic-first, RTL custom-furniture platform for one Saudi furniture business. Customers submit made-to-order projects, receive a manager quotation, accept it, submit bank-transfer proof, and track order-level production through delivery or pickup.

## Current delivery status

The repository is a **lean Version 1 deployed stabilization build** available at [project-atelier-v1.vercel.app](https://project-atelier-v1.vercel.app). The complete commercial workflow is implemented and verified locally against PostgreSQL:

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

Clerk, Supabase Storage, and Vercel are connected in the current build. Malware scanning, final Manager authentication hardening, external email evidence, and the complete launch gate remain pending.

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
- Active uploads use Supabase Storage; malware scanning and GuardDuty are not implemented.
- Customer and payment uploads are not launch-ready until the approved scan, authorization, and clean-file lifecycle is verified.
- Demo seed/auth are blocked in staging and production.

## Project references

- `PROJECT_KNOWLEDGE.md` — authoritative product knowledge and Product Owner decisions.
- `GOAL.md` — current delivery objective and remaining launch work.
- `QUALITY_GATES.md` — mandatory quality and release requirements.
- `AGENTS.md` — repository working agreement.

# Lean V1 Fulfilment Update

**Date:** 2026-07-17

## Delivered

- Customer fulfilment details are required before payment-proof submission.
- Delivery collects phone, city, district, full address, optional map URL, and optional notes.
- Pickup collects phone and optional pickup notes.
- The fulfilment method remains the method accepted in the quotation; changing it requires a revised quotation so the accepted total cannot silently change.
- The manager order view displays the confirmed fulfilment details.
- Database enforcement prevents payment proof before fulfilment confirmation and prevents customers from changing protected fulfilment fields.
- Demo pages initialize their own customer/manager demo identity, fixing the initial 401 flow.
- The browser journey and PostgreSQL workflow test were updated for the new step.

## Verification completed in the packaging workspace

- Migration manifest and SHA-256 checks passed for all four migrations.
- Secret scan passed across 309 source/configuration files.
- Syntax transpilation passed for all nine changed TypeScript/TSX files.

## Verification required on the target machine

The packaging workspace has Node.js 22 rather than the project's required Node.js 24, so the complete dependency-backed build and test suite must be run on the target machine:

```bash
npm ci
npm run verify:static
npm test
npm run test:postgres
APP_ENV=test npm run build
npm run test:e2e:workflow
```

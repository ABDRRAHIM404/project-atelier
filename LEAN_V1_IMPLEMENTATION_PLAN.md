# Lean Version 1 Implementation Plan

Owner authorization date: 2026-07-16

## Assumptions

- The approved product rules, state transitions, authorization boundaries, immutable commercial history, Arabic-first RTL requirement, and manual payment verification remain non-negotiable.
- “Simplified” means reducing delivery ceremony, optional integrations, and speculative features. It does not mean weakening ownership, file isolation, auditability, or payment/production safeguards.
- External account work for Supabase, Clerk, S3/GuardDuty, Vercel, Resend, and related MCP actions is completed by the Product Owner from a separate handoff checklist.
- English, AI, advanced analytics, saved designs, reviews, favorites, advanced media, push notifications, workers, inventory, and multi-business support remain deferred.

## Delivery sequence

### L1 — Public discovery

Deliver the Arabic RTL showroom, published catalog browsing/search, product detail, basic media presentation, CMS content surfaces, and secure public/private file boundary.

Verify: static checks, Catalog/CMS/File unit and PostgreSQL suites, Arabic visitor Playwright journey, accessibility, build, and secret scan.

### L2 — Customer request

Deliver customer identity entry, multi-item project drafts, bounded product configuration, private attachments, immutable submission snapshots, and customer/manager clarification.

Verify: ownership and RLS tests, configuration and snapshot tests, attachment authorization tests, Arabic customer/manager journey, and build.

### L3 — Quotation and acceptance

Deliver manager quotation drafting/versioning, customer-visible lines, acceptance/rejection, delivery method/address agreement, and immutable accepted quotation history.

Verify: transition, concurrency, authorization, immutability, audit/outbox, and Arabic commercial journey tests.

### L4 — Payment and order creation

Deliver bank-transfer instructions, private payment-proof upload, manual manager verification/rejection, and order creation only after verified payment.

Verify: proof isolation, replay/idempotency, manual verification invariant, audit history, and payment-to-order journey tests.

### L5 — Production and fulfilment

Deliver order-level production stages, customer progress tracking, ready notification intent, delivery/pickup handoff proof, and completion.

Verify: allowed transitions, no pre-payment production, handoff-proof authorization, customer visibility, and end-to-end order journey.

### L6 — Manager operations and release

Deliver the minimum manager dashboard for catalog/content, requests, quotations, payments, orders, and production. Complete operational runbooks, provider handoff checklist, release configuration, and final quality gate.

Verify: full static/test/build/security suite, critical Playwright journeys, no known critical defects, and a clean production package.

## Working rules

- Implement one lean milestone at a time and keep each change traceable to its milestone.
- Reuse approved domain contracts and persistence foundations before adding code.
- Prefer the smallest complete vertical slice over broad partial scaffolding.
- Do not silently invent missing business policies. Keep policy-dependent actions disabled and list the decision needed.
- Record external provider/MCP steps in `OWNER_PROVIDER_HANDOFF.md`; never claim an external integration was verified when it was not.

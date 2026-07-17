# PROJECT ANTI-PATTERNS

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Active planning constraints  
**Purpose:** Prevent implementation convenience from overriding the documented business model

The following patterns are prohibited unless the product contract is deliberately revised and the affected decisions are recorded.

## Business and Lifecycle

- Treating “order as shown” as direct checkout.
- Requesting payment before Manager review and Customer agreement.
- Starting or implying production before successful manual Manager Payment Verification.
- Allowing UI code, AI, a payment-proof upload, or a background job to verify payment automatically.
- Rewriting accepted quotation history, Customer Acceptance evidence, Order Item Snapshots, or completed commercial history in place.
- Reading historical commercial meaning from mutable live Product/catalog records.
- Silently editing a submitted Customer Project instead of preserving the submitted snapshot and later clarification/revision history.
- Adding cancellation, refund, return, expiry, dispute, reversal, or delivery-failure transitions before their `DW-*` policy is approved.

## Authorization, Privacy, and Files

- Treating hidden buttons or client routes as authorization.
- Allowing Customers to access another Customer’s account, Project, quotation, Order, Messages, Notifications, or files.
- Making payment proof, reference images, message attachments, or other Customer uploads public by default.
- Using obscure object paths as the only private-file control.
- Selecting upload/storage behavior before classification, validation, scanning/quarantine, retention, deletion, and recovery policy is approved.
- Logging secrets or unnecessary sensitive file/content data in operational or Audit Events.

## Product Scope and Experience

- Pulling Version 1.1/later features into Version 1 without updating the approved release boundary.
- Treating 360° media as a Version 1 dependency.
- Building a generalized configuration/rules engine beyond the bounded source-backed Version 1 rule types.
- Hardcoding customer-visible text or adding Arabic RTL after LTR layouts are complete.
- Treating English as required or adding French to Version 1 without a Product Owner roadmap decision.
- Omitting loading, empty, error, permission-denied, or success states.

## Architecture and Integrations

- Selecting a framework/provider first and reshaping business rules around it.
- Introducing microservices, multi-tenancy, worker management, inventory, or generalized integration infrastructure in Version 1 without approved requirements.
- Calling external providers throughout business logic instead of maintaining an approved boundary.
- Making AI, analytics, push, or email availability authoritative for the core transaction.
- Using in-memory/fire-and-forget side effects for business-critical delivery without an approved durability strategy.
- Repeating a business transition to retry a failed notification.
- Treating operational logs as a substitute for approved business Audit Events.

## Quality and Delivery

- Treating “fast,” “accessible,” “secure,” “reliable,” or “mobile-first” as acceptance evidence without approved measurements.
- Declaring a feature Done while an applicable item in `QUALITY_GATES.md` is unmet.
- Waiving server authorization, verified-payment gating, accepted-history immutability, or private-file protection through a routine exception.
- Generating application architecture before an explicit Product Owner request or generating application code before architecture approval.
- Treating a `BP-*`, `CFG-*`, or `IMP-*` item as a pre-architecture blocker merely because its value or mechanism is not yet selected.

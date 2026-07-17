# Decision Form

Complete each item by accepting the recommendation, choosing an alternative, or writing a different answer. Recommendations are not preselected decisions.

## DW-001 — Project-to-Order Boundary

- **Decision ID:** DW-001
- **Question:** At what point does a customer project become an order?
- **Why it matters:** This determines when the customer and business are considered committed and how accepted but unpaid work is handled.
- **Recommended option:** Create the order when the customer accepts the current quotation; it then waits for verified payment before production.
- **Alternative options:** Create it when the request is submitted; create it only after payment is verified; keep one project record throughout.
- **My answer:** Create the Order when the customer accepts the quotation. Production cannot start until payment is manually verified.

## DW-002 — Submission, Quotation, and Acceptance Rules

- **Decision ID:** DW-002
- **Question:** What rules govern submitted requests, quotation revisions, customer changes, declines, expiry, and acceptance?
- **Why it matters:** Clear rules prevent silent changes and establish exactly what the customer agreed to.
- **Recommended option:** Lock submitted requests, number each quotation revision, allow acceptance only of the current revision, and record all changes or declines explicitly.
- **Alternative options:** Edit quotations in place; use unnumbered quotations; treat messages as agreement; allow quotations without expiry.
- **My answer:** Accept the recommended option exactly.

## DW-003 — Pricing and Payment Terms

- **Decision ID:** DW-003
- **Question:** What currency, tax, rounding, price breakdown, discount, and payment rules apply?
- **Why it matters:** These rules define the commercial agreement and what the customer must pay.
- **Recommended option:** Use MAD, distinguish estimates from final quotations, show meaningful price items and adjustments, apply consistent rounding, and confirm whether full bank transfer matches current business practice.
- **Alternative options:** Support multiple currencies; show only one total; allow deposits or staged payments; handle discounts informally.
- **My answer:** Default currency: SAR (configurable). Prices include a detailed breakdown. Taxes configurable. Full bank transfer only in Version 1. Future support for deposits.

## DW-004 — Payment-Proof Policy

- **Decision ID:** DW-004
- **Question:** What evidence is accepted for bank transfers, and how are replacements, errors, partial payments, overpayments, duplicates, or suspected fraud handled?
- **Why it matters:** Payment proof is sensitive and verified payment is required before production can begin.
- **Recommended option:** Accept common image and PDF formats within a clear size limit, retain the submission history, require manager review of exceptions, and define an approved retention period.
- **Alternative options:** Accept unrestricted files and overwrite replacements; validate automatically; make verification irreversible; retain forever or delete immediately.
- **My answer:** Accept JPG, PNG and PDF. Keep every submission. Manager manually verifies. Nothing is deleted automatically.

## DW-005 — Cancellation and After-Sales Policy

- **Decision ID:** DW-005
- **Question:** What rules apply to cancellations, refunds, returns, warranties, repairs, and disputes at each order stage?
- **Why it matters:** Custom furniture may require stage-specific policies, and these rules affect customer trust, cost, and legal obligations.
- **Recommended option:** Document the workshop's actual policy for every stage and obtain appropriate professional review before publishing it.
- **Alternative options:** Allow no cancellation or return after acceptance; use limited stage-based rights; decide case by case; offer broad cancellation and return rights.
- **My answer:** Manager-defined policy based on Saudi regulations. No assumptions. Keep it configurable.

## DW-006 — Production Lifecycle

- **Decision ID:** DW-006
- **Question:** Which production stages are official, and when may work be paused, corrected, reversed, or cancelled?
- **Why it matters:** The lifecycle must match how the workshop operates so customers receive accurate progress information.
- **Recommended option:** Use Not Started, Started, In Progress, Quality Inspection, and Ready, with documented rework returning to In Progress.
- **Alternative options:** Use only Started and Ready; rely on free-form updates; define a more detailed workflow; allow unrestricted status changes.
- **My answer:** Not Started
                     ↓
            Materials Preparation
                     ↓
                In Production
                     ↓
               Quality Inspection
                     ↓
                   Ready
                     ↓
             Delivered / Picked Up

If inspection fails:

Quality Inspection
        ↓
Back to In Production

## DW-007 — Pickup and Delivery Policy

- **Decision ID:** DW-007
- **Question:** What rules govern delivery areas, pricing, scheduling, addresses, pickup identity, handoff evidence, failed attempts, damage, refusal, partial handoff, and disputes?
- **Why it matters:** Pickup and delivery complete the transaction, but unsuccessful or disputed handoffs need clear treatment.
- **Recommended option:** Define service areas and quoted delivery prices, confirm fulfilment details before acceptance, schedule after the order is ready, and record successful handoff.
- **Alternative options:** Handle every case informally; offer pickup only; rely on a third party's rules; allow completion without handoff evidence.
- **My answer:** Delivery is the default. Pickup optional. Delivery price quoted before acceptance. Customer confirms address. Handoff proof required.

## DW-008 — Accounts and Manager Continuity

- **Decision ID:** DW-008
- **Question:** What customer identity checks, manager security, account recovery, account closure, and business-continuity rules are required?
- **Why it matters:** Accounts protect private customer records, while a single manager account can become both a security risk and an operational dependency.
- **Recommended option:** Collect only necessary customer details, verify a contact method, require strong manager protection and recovery, plan emergency continuity, and retain required commercial history after account closure.
- **Alternative options:** Use email and password without verification; use phone verification; use passwordless or social sign-in; omit enhanced manager protection.
- **My answer:** 
Customer

Email + OTP verification

Manager

Strong password
MFA
Recovery codes

## DW-009 — Data, Upload, and Retention Policy

- **Decision ID:** DW-009
- **Question:** Which information and files are public, private, payment-sensitive, or operationally restricted, and how long should each be retained?
- **Why it matters:** Customer files and payment evidence require different protections, publication rules, and deletion periods.
- **Recommended option:** Classify information into public, private customer, sensitive payment, and restricted operational groups; keep uploads private by default and define purpose-based retention and deletion rules.
- **Alternative options:** Apply one policy to everything; retain everything forever; delete everything immediately; accept files without safety review.
- **My answer:** 
Public:

Products
Portfolio

Private:

Customers
Orders

Sensitive:

Payment proof

Restricted:

Internal notes
Audit logs

Everything private by default.

## DW-010 — Messaging and Notifications

- **Decision ID:** DW-010
- **Question:** How should conversations relate to projects and orders, which notifications are essential, and what preferences may customers control?
- **Why it matters:** Messages may contain important commercial clarification, while excessive or missing notifications can damage the customer experience.
- **Recommended option:** Use one continuous conversation with optional project or order context, preserve important clarifications, always provide essential in-product notices, and email only critical events by default.
- **Alternative options:** Create separate conversations per order; use no business context; use email only; use in-product notices only; make every notification mandatory or optional.
- **My answer:** 
One continuous conversation linked to the project/order.

Notifications:

Quote ready
Quote accepted
Payment received
Payment verified
Production started
Ready
Delivered

Email + in-app.

WhatsApp later.

## DW-011 — Content, Translation, and Publication

- **Decision ID:** DW-011
- **Question:** What publication stages, translation requirements, fallback rules, correction rules, and retirement rules apply to catalog and website content?
- **Why it matters:** Arabic-first content must remain consistent across languages without exposing incomplete or misleading information.
- **Recommended option:** Use clear draft, published, hidden, and archived stages; require Arabic, French, and English for core and transactional content; require human approval; retire referenced content instead of deleting it.
- **Alternative options:** Publish Arabic first with broad fallback; block all publication until every language is complete; edit published content directly; permanently delete retired content.
- **My answer:** 
This one must change.

Instead of:

Arabic + French + English

I'd answer:

Arabic required. English optional. French removed from Version 1. Human approval for translations.

## DW-012 — Quality Targets

- **Decision ID:** DW-012
- **Question:** Which proposed accessibility, performance, browser support, availability, backup, and recovery targets should become the Version 1 standard?
- **Why it matters:** Measurable targets are needed to judge whether the product is ready to launch and operate reliably.
- **Recommended option:** Approve the current proposed targets in `QUALITY_GATES.md` as the Version 1 baseline, with later revisions based on evidence.
- **Alternative options:** Adopt stricter targets; approve the baseline with selected relaxations; use qualitative goals only; defer target approval.
- **My answer:** 
Accept the recommendation.

No changes.

## DW-013 — Brand and Design System

- **Decision ID:** DW-013
- **Question:** What palette, Arabic and Latin typography, spacing, component style, motion, and illustration direction should define the brand?
- **Why it matters:** Shared visual rules create a consistent, accessible, and recognisable customer experience across languages and devices.
- **Recommended option:** Use an accessible warm-neutral palette, paired Arabic and Latin typography, consistent spacing and components, restrained motion, and an RTL-first responsive approach.
- **Alternative options:** Lightly brand an existing visual system; commission a fully custom system; style each page independently.
- **My answer:** 
Accept the recommendation.

One extra sentence:

The design system should reflect premium Saudi interior brands: warm neutrals, elegant typography, generous spacing, and restrained motion.

## DW-014 — Product and Business Success Measures

- **Decision ID:** DW-014
- **Question:** Which outcomes will define launch success, and how will each be measured?
- **Why it matters:** Technical quality alone does not show whether the product reduces customer uncertainty or manager workload.
- **Recommended option:** Track request completion, response and review times, quotation acceptance, production estimate adherence, completed orders, clarification volume, and manager backlog; set targets after establishing a baseline.
- **Alternative options:** Define no launch metrics; introduce broad analytics immediately; measure revenue only; rely only on customer and manager interviews.
- **My answer:** 
I would add:

Average quotation preparation time
Customer satisfaction
On-time delivery rate
Order completion rate
Production delay rate
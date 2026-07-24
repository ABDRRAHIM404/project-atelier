# QUALITY GATES

**Project:** Project Atelier / بيتي بذوقي  
**Status:** Global Definition of Done and Version 1 measurable targets Accepted  
**Applies to:** Every feature, fix, content workflow, and release  
**Source material:** `PROJECT_KNOWLEDGE.md` and the Product Owner decision record

---

## 1. Purpose

This document converts the project's quality principles into a global Definition of Done and measurable release gates. It does not approve unresolved business policy or select an application stack.

The global Definition of Done is Accepted under `DR-015`. The Product Owner accepted the current numeric thresholds and exception/measurement governance through `DW-012` on 2026-07-16. The language-specific gates incorporate the more specific `DW-011` decision: Arabic is required, English is optional, and French is outside Version 1.

---

## 2. Status Legend

| Status | Meaning |
|---|---|
| Proposed | Recommended target; approval is still required |
| Accepted | Approved and mandatory |
| Exception | A time-limited written exception has been approved |

All Version 1 targets below are **Accepted**. The Version 1.1 360° activation details remain governed separately by `DW-024`.

---

## 3. Accepted Measurable Quality Targets

### 3.1 Accessibility

| ID | Accepted target | Measurement |
|---|---|---|
| Q-A11Y-001 | Conform to WCAG 2.2 Level AA across all Version 1 customer and manager workflows | Manual and automated conformance review against Level A and AA success criteria |
| Q-A11Y-002 | Zero known critical accessibility violations at merge and release | Automated accessibility scan on relevant pages plus triage |
| Q-A11Y-003 | Zero known unresolved WCAG 2.2 A/AA failures at release | Manual keyboard, focus, screen-reader, zoom/reflow, form, error, contrast, and authentication review |
| Q-A11Y-004 | Every interactive control is keyboard operable with visible, unobscured focus | Automated where possible plus manual workflow testing |
| Q-A11Y-005 | Meaningful images have appropriate text alternatives; decorative images are ignored by assistive technology | Content and accessibility audit |

Reference: [W3C WCAG 2.2 overview](https://www.w3.org/WAI/standards-guidelines/wcag/). WCAG 2.2 is a stable W3C Recommendation with Level A, AA, and AAA success criteria.

### 3.2 Core Web Vitals

Core customer-facing routes should meet the following “good” thresholds at the 75th percentile, measured separately for mobile and desktop field data when sufficient traffic exists:

| ID | Metric | Accepted target |
|---|---|---:|
| Q-WEB-001 | Largest Contentful Paint (LCP) | ≤ 2.5 seconds |
| Q-WEB-002 | Interaction to Next Paint (INP) | ≤ 200 milliseconds |
| Q-WEB-003 | Cumulative Layout Shift (CLS) | ≤ 0.1 |

Before sufficient field data exists, equivalent lab checks must run on representative core routes under a documented mobile profile. Reference: [web.dev Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds).

### 3.3 Mobile Performance Budgets

These budgets apply to the first view of core public routes on a simulated mid-tier mobile device and constrained mobile network. The repeatable test hardware/network profile must be documented before evidence is accepted.

| ID | Resource or outcome | Accepted budget |
|---|---|---:|
| Q-PERF-001 | Initial route JavaScript, compressed | ≤ 200 KiB |
| Q-PERF-002 | Initial route CSS, compressed | ≤ 75 KiB |
| Q-PERF-003 | Initial non-media transferred resources | ≤ 500 KiB |
| Q-PERF-004 | Total initial transferred page weight, including optimized above-fold media | ≤ 1.5 MiB |
| Q-PERF-005 | Lighthouse mobile performance score on core public routes | ≥ 90 in the approved repeatable CI profile |
| Q-PERF-006 | New third-party script | Requires explicit performance, privacy, and failure-impact review |

Performance budgets must be measured as trends as well as pass/fail values. A feature may not conceal a regression by changing the test route or measurement profile.

### 3.4 API Response Targets

Targets apply to server processing time under the approved normal-load test profile. Upload transfer time, asynchronous jobs, and unavailable third-party providers must be measured separately.

| ID | Request class | Accepted target |
|---|---|---:|
| Q-API-001 | Cached/simple reads | p95 ≤ 250 ms |
| Q-API-002 | Standard transactional reads | p95 ≤ 400 ms |
| Q-API-003 | Standard state-changing operations | p95 ≤ 800 ms |
| Q-API-004 | Core API server errors | < 0.5% of requests per rolling 30 days |
| Q-API-005 | Timeout behavior | Explicit timeout, safe retry policy, and user-visible recovery state for every external dependency |

The load profile, dataset size, geographic measurement point, and excluded operations must be documented before evidence is accepted; they may not be chosen to conceal a failed target.

### 3.5 Image and 360° Media Budgets

| ID | Asset | Accepted budget or rule |
|---|---|---|
| Q-MED-001 | Catalog thumbnail | ≤ 80 KiB per delivered variant |
| Q-MED-002 | Product gallery image | ≤ 300 KiB per delivered responsive variant |
| Q-MED-003 | Homepage/product hero image | ≤ 400 KiB for the largest initially loaded responsive variant |
| Q-MED-004 | Original uploads | Never served directly when an optimized derivative is available |
| Q-MED-005 | Image delivery | Responsive dimensions, modern supported format, lazy loading below the fold, explicit dimensions, and suitable fallback |
| Q-MED-006 | 360° poster/initial preview | ≤ 250 KiB |
| Q-MED-007 | 360° assets required before interaction | ≤ 1 MiB |
| Q-MED-008 | Complete 360° asset set | ≤ 12 MiB per product, loaded progressively and only on user intent |
| Q-MED-009 | 360° Version 1.1 activation gate | Representative assets must meet the approved workflow, quality, accessibility fallback, and budgets before 360° media can be activated; it is already deferred from Version 1 under `DR-013` |

The exact 360° frame count, dimensions, format, capture process, fallback, and storage lifecycle require `DW-024` before Version 1.1 activation.

### 3.6 RTL and Localization Acceptance

| ID | Accepted target | Measurement |
|---|---|---|
| Q-L10N-001 | 100% of Version 1 customer-facing and Manager UI keys exist in Arabic before release; any English experience included in the release must also have complete keys for its published scope | Automated key-completeness check |
| Q-L10N-002 | Arabic is the default locale and every Version 1 route renders correctly in RTL | Automated route sweep and manual workflow review |
| Q-L10N-003 | No unintended horizontal page overflow at any supported viewport in Arabic or in any included English experience | Automated and visual responsive checks |
| Q-L10N-004 | No raw translation key, missing-string placeholder, or unintended fallback language is visible | Automated scan plus manual acceptance |
| Q-L10N-005 | Dates, numbers, currency, dimensions, validation, errors, notifications, and email use the active locale's approved formatting/content | Unit, integration, and end-to-end tests |
| Q-L10N-006 | Critical workflows pass in Arabic; the same workflows pass in English whenever English is included in the release | Playwright coverage for the approved core-transaction matrix |
| Q-L10N-007 | Content cannot be published where the approved locale-completeness rule is not met | CMS validation after locale policy approval |

### 3.7 Supported Browser and Device Matrix

| Surface | Accepted support policy |
|---|---|
| Desktop Chrome | Latest two stable major versions |
| Desktop Edge | Latest two stable major versions |
| Desktop Firefox | Latest two stable major versions |
| macOS Safari | Current and previous major version |
| iOS Safari | Current and previous major iOS version |
| Android Chrome | Latest two stable major versions |
| Mobile widths | 360 px, 390 px, and 412 px representative viewports |
| Tablet widths | 768 px and 1024 px representative viewports |
| Desktop widths | 1280 px and 1440 px representative viewports |
| Input methods | Touch, keyboard, mouse/pointer, and assistive-technology paths where applicable |

Internet Explorer is not supported. The physical-device list and operating-system versions must be reviewed at least quarterly and before a major release.

### 3.8 Reliability, Error Rate, and Availability

| ID | Accepted target |
|---|---|
| Q-REL-001 | Core customer and manager workflows: ≥ 99.9% monthly availability, excluding approved maintenance windows |
| Q-REL-002 | Core API server-error rate: < 0.5% over a rolling 30-day window |
| Q-REL-003 | Unhandled client-side error sessions: < 0.5% over a rolling 30-day window |
| Q-REL-004 | Zero known data-loss defects or authorization bypasses at release |
| Q-REL-005 | AI, analytics, email, or push failure must not corrupt or block the authoritative core transaction |
| Q-REL-006 | Every externally delivered side effect has an idempotency/retry strategy and observable outcome |

The core-workflow list, maintenance windows, measurement source, and incident exclusions must be documented before availability evidence is accepted.

### 3.9 Backup and Recovery

| ID | Objective | Accepted target |
|---|---|---|
| Q-DR-001 | Production transactional data Recovery Point Objective (RPO) | ≤ 1 hour |
| Q-DR-002 | Core-service Recovery Time Objective (RTO) | ≤ 4 hours |
| Q-DR-003 | Private file metadata and file recovery | Covered by a documented backup/versioning and reconciliation process |
| Q-DR-004 | Restore test | At least monthly and before major production migration |
| Q-DR-005 | Backup failure | Alerted and triaged within the approved operational response window |
| Q-DR-006 | Recovery evidence | Every exercise records time, data point restored, discrepancies, owner, and remediation |

Backup retention duration, storage provider, geographic-copy policy, and operational response window remain to be defined through the residual `DW-009` policy and architecture-phase `DW-016`. The RPO, RTO, and restore cadence above are Accepted.

---

## 4. Global Definition of Done — Accepted

A feature is not Done until every applicable item below is satisfied with evidence. “Not applicable” requires a written reason in the feature record or change description.

### 4.1 Business and Functional Completion

- [ ] Business requirements and acceptance criteria are satisfied.
- [ ] The implementation matches the approved domain model and state-machine rules.
- [ ] No unresolved business policy was silently converted into application behavior.
- [ ] Loading, empty, error, permission-denied, and success states are included.
- [ ] Audit and notification side effects required by the approved workflow are included.

### 4.2 Authorization, Security, and Privacy

- [ ] Server-side authorization is verified for allowed and denied actors.
- [ ] Cross-customer access attempts are tested where private customer data is involved.
- [ ] Security and privacy review is complete where applicable.
- [ ] Sensitive data, files, logs, telemetry, and error messages follow the approved classification and retention rules.
- [ ] File upload/download behavior is validated where applicable.
- [ ] No secret or private data appears in source, client bundles, console output, logs, test artifacts, or documentation.

### 4.3 Static and Automated Quality

- [ ] Type checking passes.
- [ ] Linting passes.
- [ ] Formatting and repository validation pass where configured.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Relevant Playwright tests pass.
- [ ] Production build passes.
- [ ] No unexpected browser console errors or unhandled rejections occur in tested workflows.

### 4.4 Localization and Responsive Experience

- [ ] Arabic RTL is verified.
- [ ] English is verified when English is included in the release.
- [ ] Mobile is verified across the approved representative matrix.
- [ ] Desktop is verified across the approved representative matrix.
- [ ] Text expansion, bidirectional content, numbers, currency, dimensions, and validation states are checked where relevant.

### 4.5 Accessibility and Performance

- [ ] Automated accessibility checks pass with no critical violations.
- [ ] Relevant manual accessibility checks are complete.
- [ ] Keyboard and focus behavior are verified.
- [ ] Performance budgets are respected.
- [ ] Relevant Core Web Vitals or repeatable lab checks do not regress beyond the approved threshold.
- [ ] Media assets meet the approved image/360° budget and fallback requirements.

### 4.6 Documentation and Operations

- [ ] Product, domain, state-machine, ADR, security, operations, and user documentation are updated where affected.
- [ ] New configuration, environment variables, migrations, background jobs, alerts, and rollback steps are documented.
- [ ] Monitoring and audit evidence required for the feature is observable.
- [ ] Feature flags or staged rollout controls are documented where used.
- [ ] The feature has a safe rollback or recovery path appropriate to its risk.

---

## 5. Gate Levels

### 5.1 Feature Gate

Applies before a feature can be declared complete. The Global Definition of Done is the minimum gate.

### 5.2 Merge Gate

Requires all automated checks, relevant review, no unresolved critical defects, and evidence that authorization and business invariants are preserved.

### 5.3 Release Gate

Requires:

- All included features meet the Definition of Done.
- No open critical or high-severity security defect.
- No critical accessibility violation.
- Approved browser/language/mobile matrix passes.
- Core transaction passes end to end.
- Production build, migration, rollback, backup, and restore evidence is current.
- Error monitoring, availability monitoring, audit history, and incident paths are operational.

---

## 6. Exceptions

A quality-gate exception must record:

- Requirement ID.
- Scope and affected users.
- Business reason.
- Risk and compensating control.
- Approver.
- Expiry date.
- Remediation owner and due date.

Security authorization, payment-verification gating, accepted-quotation immutability, and historical order-snapshot immutability are not eligible for routine exceptions.

---

## 7. Approval Register

| Decision group | Current status | Approval needed |
|---|---|---|
| WCAG 2.2 AA and zero-critical target | Accepted | Product Owner, `DW-012`, 2026-07-16 |
| Core Web Vitals targets | Accepted | Product Owner, `DW-012`, 2026-07-16 |
| Mobile/API/media budgets | Accepted | Product Owner, `DW-012`, 2026-07-16 |
| RTL/localization criteria | Accepted with `DW-011` language scope | Product Owner, `DW-011`/`DW-012`, 2026-07-16 |
| Browser/device matrix | Accepted | Product Owner, `DW-012`, 2026-07-16 |
| Availability/error targets | Accepted | Product Owner, `DW-012`, 2026-07-16 |
| Backup RPO/RTO and restore cadence | Accepted | Product Owner, `DW-012`, 2026-07-16 |

All Version 1 groups above were accepted through `DW-012`; 360° activation specifics additionally require `DW-024`. The Definition of Done remains Accepted under `DR-015`.

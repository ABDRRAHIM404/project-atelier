# Localization Architecture

**Status:** Approved 2026-07-16  
**Primary locale:** Arabic, RTL  
**Optional Version 1 locale:** English  
**Outside Version 1:** French

## 1. Principles

- Arabic is the required source experience, default locale, fallback content, and release gate.
- The layout is designed RTL-first; RTL is not a mirrored afterthought.
- English is exposed only for surfaces whose required translations are approved and published.
- French is not shipped, translated, routed, or used as a Version 1 acceptance target.
- Customer-entered text retains its original language and direction metadata; it is not automatically translated.
- Machine-generated or AI translation cannot be published without the accepted human approval workflow.

## 2. Locale layers

Localization has three distinct sources:

1. **Application messages:** navigation, labels, validation, workflow states, accessibility names, transactional email scaffolding, and error messages. These are version-controlled, typed message catalogs.
2. **Managed business content:** CMS pages, catalog descriptions, collections, policy wording, and other manager-owned content. These use the `Translation` domain lifecycle and publication controls.
3. **Immutable transaction content:** sent quotation wording, accepted item descriptions, configuration labels, prices, terms, fulfilment details, and notification facts needed to interpret history. These are snapshotted in the language/context used for the transaction and are not retroactively changed by later translations.

## 3. Approved implementation

Use `next-intl` with Next.js App Router. It supports server rendering, ICU message formatting, locale routing/configuration, and typed message workflows without forcing localization into client-only code.

Application message keys are semantic and stable; they do not embed source-language sentences as identifiers. Arabic catalog is complete by policy. English catalog completeness is checked in CI for the optional surfaces selected for release. Missing optional English business content falls back to Arabic or makes that English content unavailable according to an explicit publication rule; the UI must never display an accidental key or silently publish a draft.

Official reference: [next-intl documentation](https://next-intl.dev/docs).

## 4. Routing and locale selection

The canonical public and authenticated routing strategy must expose locale explicitly enough for stable links and correct metadata. Arabic is the root/default experience. Locale resolution may consider an explicit route, authenticated preference, and browser preference in that order, but it must not override an explicit customer selection.

The exact URL shape is an implementation ADR detail to approve before route/API design. Regardless of shape:

- links preserve locale intentionally;
- unsupported or French locale requests do not create a partial French experience;
- authentication callbacks restore a validated internal destination and locale;
- public localized pages have correct canonical and alternate metadata only when that locale is actually published.

## 5. RTL system

The document `lang` and `dir` are set at the server-rendered root. Layout uses CSS logical properties (`inline-start`, `inline-end`, logical margins/padding/borders), direction-aware icons, and direction-neutral component contracts. Text alignment follows content direction rather than hard-coded left/right.

Bidirectional content—emails, URLs, phone numbers, order references, currency values, filenames, and Latin product codes—uses isolation (`bdi` or equivalent) and explicit direction where necessary. Numbers are localized for presentation without changing canonical stored values. Visual sequence is tested rather than assuming all flex/grid orders should reverse.

## 6. Formatting

Dates, times, numbers, lists, and currency use standards-based internationalization with explicit locale, currency, and time zone. SAR is the initial configured default; each monetary value retains its currency code. The system must not infer currency from locale or translate identifiers.

Arabic customer-visible state labels are presentation translations, not persisted workflow state strings. Search normalization is separate from display text and preserves original content.

## 7. CMS and translation publication

Arabic CMS/catalog content follows the accepted draft/review/publish lifecycle. An English Translation relates to a specific source content version and has its own draft/review/publication state. If the Arabic source changes after English approval, the system marks the translation stale or otherwise prevents it from representing itself as an approved translation of the new source; exact manager workflow follows `STATE_MACHINES.md`.

Publishing and unpublishing are server-authorized Manager actions with validation, Audit Event, cache invalidation, and search-projection update. Previous transaction snapshots remain unchanged.

## 8. Notifications and email

Every essential event has an approved Arabic in-app and email template before release. Optional English templates are versioned separately and used only for customers with an English preference when complete. Provider payloads are rendered server-side; raw translation keys or private objects are never passed to Resend as template authority.

Business/legal wording remains a Product Owner decision. Template version and locale are recorded with the delivery attempt so later wording changes do not obscure what was sent.

## 9. Accessibility and quality checks

Localization acceptance includes:

- Arabic primary journeys and all component states at mobile and desktop sizes;
- no clipped/overlapping text under Arabic expansion and browser zoom;
- correct focus order and reading order in RTL;
- appropriate accessible names and validation announcements in Arabic;
- bidirectional samples for email, codes, currency, dates, and file names;
- optional English journeys only where declared supported;
- automated missing-key, invalid ICU-message, and catalog-consistency checks;
- human language and visual review; automation alone cannot approve translation quality.

These checks supplement, not replace, `QUALITY_GATES.md` and WCAG 2.2 AA.

## 10. Provider/library evaluation

- **Why it fits:** `next-intl` is designed for current Next.js App Router and supports server components, ICU messages, locale formatting, and type-safe workflows.
- **Alternatives considered:** built-in `Intl` plus custom routing/catalog code, `react-i18next`, and Lingui.
- **Tradeoffs:** introduces library conventions and build/runtime integration; managed CMS translations still require domain logic outside the library.
- **Risks:** accidental client catalog bloat, missing Arabic messages, stale English content, caching the wrong locale, and incorrect bidi handling.
- **Cost implications:** open-source library cost is zero; human Arabic/English content review and localization QA are continuing operating costs.
- **Lock-in implications:** low-to-moderate; ICU-style messages and Web `Intl` are portable, while routing/hooks need migration.
- **Final recommendation:** `next-intl`, server-first catalogs, Arabic source/fallback, English gated by approved completeness.
- **ADR status:** Accepted (ADR-018).

## 11. Configuration points

English enablement by surface, customer locale preference behavior, translation staleness workflow details, legal wording, business time zone, URL locale shape, and locale-specific search ranking remain approved configuration or implementation decisions. French cannot be enabled by configuration in Version 1 without an explicit scope decision.

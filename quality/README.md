# Quality Evidence

This directory defines the P0 quality-evidence boundary. Generated run evidence belongs under
`quality/evidence/runs/` and is intentionally excluded from source control.

`npm run quality:p0` runs every P0 check in gate order. It stops on the first failure, preserves that
non-zero result, marks later checks as not run, and writes machine-readable JSON plus a Markdown
summary. The JSON format is versioned by `quality-evidence.schema.json`; its exception object requires
an owner, approver, expiry, reason, and compensating controls and cannot waive prohibited invariants.

## Browser baseline

The automated P0 suite covers Chromium, Firefox, and WebKit with the accepted representative widths:
360 px, 390 px, 412 px, 768 px, 1024 px, 1280 px, and 1440 px. These engine projects provide early
cross-browser protection; they do not replace the physical Chrome, Edge, Safari, iOS, and Android
release matrix required by `QUALITY_GATES.md` in P8.

Every project verifies the Arabic document, RTL direction, responsive overflow, and absence of console
or unhandled page failures. The canonical Chromium desktop project additionally verifies keyboard focus
and runs the WCAG 2.2 A/AA axe rules against the same production-rendered page. Mandatory checks do not
retry; flakiness remains visible as a gate failure.

## Performance profile

Lighthouse runs three times against the production build and uses Lighthouse's mobile simulated
throttling profile. The gate applies Q-WEB-001, Q-WEB-003, and Q-PERF-001 through Q-PERF-005.
Lighthouse does not provide the required field INP evidence for Q-WEB-002, so no unapproved lab proxy
is invented; interaction and field evidence remains a later release-gate obligation.

## Privacy and retention

- Tests use only the repository's synthetic foundation page; production Customer or Manager data is
  prohibited.
- Browser screenshots, HTML/JUnit output, coverage, and Lighthouse reports may be retained by CI only
  as private build artifacts. Trace/video capture is deferred until it can be enabled without making
  the unsupported Mint fallback browsers unstable.
- Source control never stores generated run evidence. The CI repository's configured artifact
  retention policy is authoritative; a retention value is not invented in code while the applicable
  operational retention decision remains open.
- Anyone reviewing or sharing evidence must first check it for secrets, personal data, private file
  content, access tokens, provider payloads, and unredacted URLs.
- A failed or flaky mandatory check remains a failure. An exception requires the owner, reason,
  compensating evidence, approval, and expiry fields defined by TST-003.

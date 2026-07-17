# Project Atelier Agent Working Agreement

These instructions apply to the entire repository.

## Product Owner Delivery Authorization — 2026-07-16

The Product Owner authorized `LEAN_V1_IMPLEMENTATION_PLAN.md` as the active delivery sequence. The detailed approved architecture and phase documents remain authoritative references for business rules, security boundaries, state machines, data contracts, and quality evidence. Work may proceed through the lean milestones without stopping for a separate approval after every historical phase, but no non-negotiable invariant or relevant verification may be skipped.

## Current Phase

The Product Owner authorized the lean Version 1 sequence and requested a finished local package. The repository is now at the release-candidate/provider-handoff boundary. Read first:

1. `GOAL.md`
2. `LEAN_V1_IMPLEMENTATION_PLAN.md`
3. `LEAN_V1_DELIVERY_REPORT.md`
4. `OWNER_PROVIDER_HANDOFF.md`
5. `MASTER_PRD.md`
6. `STATE_MACHINES.md`
7. `AUTHORIZATION_MODEL.md`
8. `STORAGE_ARCHITECTURE.md`
9. `QUALITY_GATES.md`
10. `ANTI_PATTERNS.md`

## Active Gate

- Preserve the complete lean commercial workflow and all non-negotiable invariants.
- Make only release-blocking fixes, provider wiring, evidence updates, and explicitly requested Version 1 work.
- External customer uploads stay disabled until the approved private upload, finalization, malware-scan, and authorization path is configured and verified.
- Do not enable demo authentication or demo seed in staging/production.
- Do not claim provider, browser, deployment, malware-scan, or email verification without direct evidence.
- Run the affected static, PostgreSQL, migration, security, browser, and production-build checks before declaring release readiness.
- Deferred Version 1.1 scope remains deferred.

## Non-Negotiable Product Rules

- No direct checkout; every purchase path uses Manager review and quotation.
- Production never begins before successful manual Manager Payment Verification.
- Accepted quotation history and historical Order Item Snapshots are immutable.
- Customers access only their own private records and files.
- Customer uploads are private unless intentionally published by the Manager.
- Arabic RTL is required; English is optional; French is outside Version 1.
- AI is optional, deferred, and never a business decision-maker.
- Version 1 scope must not absorb deferred features without an approved roadmap change.

## Documentation Rule

`DECISION_WORKSHOP.md` is the canonical register. No true Architecture Blocker remains; `BP-*`, `CFG-*`, and `IMP-*` items remain required at their documented gates. `QUALITY_GATES.md` contains the mandatory Definition of Done. `PROJECT_AUDIT.md` and `PLANNING_UPDATE_REPORT.md` are point-in-time historical reports and must not be rewritten as if their original observations occurred after later planning updates.

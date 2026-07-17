# Version 1 Module Source Boundaries

Each directory is an approved business capability inside the modular monolith. A module owns its domain rules, application operations, ports, persistence implementation, and public contract. Only its root `index.ts` may become a cross-module import surface.

Implementation layers are created only when their authorized phase needs them:

- `domain/` — pure domain state, values, and policies;
- `application/` — actor-scoped commands, queries, and coordinators;
- `ports/` — provider-neutral persistence and external capability contracts;
- `infrastructure/` — database and provider adapters; and
- `presentation/` — module-specific presentation adapters where needed.

Rules enforced by `scripts/check-boundaries.mjs`:

- domain, application, ports, and shared code cannot import Next.js or provider SDKs;
- shared code cannot depend on business modules, the app router, or infrastructure;
- a module may not import another module's internal layer;
- the App Router may consume only a module's public root contract; and
- module public surfaces cannot expose infrastructure or presentation implementations.

No module behavior is implemented during P0.

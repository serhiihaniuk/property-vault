# Property Vault App Architecture

**Status:** Approved target architecture  
**Last updated:** 2026-04-18  
**Audience:** Serhii, Codex, and future agents working on the app stack

This document describes the approved target architecture for the deployable app
and the supporting repo structure. It is intentionally forward-looking: current
implementation details may lag behind it. For current vault/runtime status, use
`IMPLEMENTATION_PLAN.md`.

## 1. Purpose

Property Vault remains a local-first system for one property, but the repo now
also grows a serious, deployable app. The goal is to keep:

- canonical evidence local and inspectable,
- one database technology and one schema owner,
- clear package boundaries that AI agents can follow,
- an app architecture that works locally, in Docker, and later on DigitalOcean.

## 2. Core Principles

1. Canonical truth lives in local `vault/` files.
2. Postgres is the one database technology for the app/index layer.
3. Drizzle owns schema and migrations.
4. Better Auth owns authentication and session primitives.
5. REST + OpenAPI is the transport contract.
6. No Server Actions.
7. No direct database access in React components.
8. Business logic lives outside transport and UI layers.
9. Minimal FSD is used for boundary clarity and AI ergonomics.
10. The system must support both consultant mode and develop mode.

## 3. Operating Modes

### 3.1 Consultant mode

Use this mode when answering factual questions about the property.

- Read canonical files, records, notes, and local derived facts first.
- Cite local sources.
- Never invent financial numbers.
- Treat the deployed app as secondary to evidence.

### 3.2 Develop mode

Use this mode when building the app.

- Work against the approved architecture in this document.
- Use Postgres, Drizzle, Better Auth, REST/OpenAPI, and the app package split.
- Read `APP_IMPLEMENTATION_PLAN.md` and the assigned task file before coding.

Agents should explicitly know which mode they are in.

## 4. System Shape

```text
vault/ files (canonical, local)
    -> packages/vault
    -> packages/sync
Postgres (single DB, Drizzle-managed)
    -> packages/db
    -> packages/auth
    -> packages/application
REST + OpenAPI
    -> apps/web route handlers
Next.js UI
    -> apps/web minimal FSD
```

The app does not read local files directly. The app reads structured data from
Postgres. Consultant workflows may still read canonical files directly.

## 5. Package Boundaries

### `packages/vault`

Owns canonical local vault behavior:

- file layout helpers,
- record/note/source lookup,
- local evidence access,
- consultant-mode support code.

This package is the repo-side interface to canonical files.

### `packages/db`

Owns:

- Drizzle schema,
- Postgres client setup,
- migrations,
- repositories and query adapters.

No UI or route logic belongs here.

### `packages/auth`

Owns:

- Better Auth setup,
- session helpers,
- permission helpers,
- auth integration with Postgres/Drizzle.

The rest of the app should use auth helpers, not Better Auth internals.

### `packages/contracts`

Owns:

- Zod DTOs,
- REST request/response contracts,
- OpenAPI generation,
- generated client inputs/types.

This package defines transport contracts, not business logic.

### `packages/application`

Owns:

- dashboard use cases,
- document/provenance use cases,
- reconciliation logic,
- anomaly flows,
- access/invite workflows,
- sync freshness/status logic.

This package is transport-agnostic. It should work whether called by route
handlers, scripts, or future background jobs.

### `packages/sync`

Owns:

- ingest from canonical local vault into Postgres,
- rebuild logic for derived data,
- idempotent upserts,
- provenance-safe synchronization.

This package bridges canonical files and the database.

### `apps/web`

Owns:

- Next.js App Router shell,
- route handlers implementing REST,
- auth-protected UI,
- minimal FSD pages/widgets/features/entities/shared layers.

### `tools/`

Owns thin CLI entrypoints only. It should delegate to packages instead of
owning long-term application logic.

## 6. Database Design

Use one Postgres database with separate schemas:

- `vault`
- `auth`
- `app`

### `vault` schema

Derived, rebuildable data sourced from canonical files:

- documents,
- sources,
- extracted records,
- financial rows,
- important dates,
- anomalies,
- search/index tables.

### `auth` schema

Better Auth tables:

- users,
- sessions,
- accounts,
- verification and invite support.

### `app` schema

Non-rebuildable app-owned state only:

- sync metadata,
- review flags,
- preferences,
- access-management support if needed.

Rules:

- canonical files are still the source of truth,
- the `vault` schema must be rebuildable,
- `auth` and `app` state must survive rebuilds,
- do not mix rebuildable ingest data with app-owned mutable state.

## 7. Data Ownership and Flow

### Canonical flow

1. Evidence arrives in local files.
2. `packages/vault` and `packages/sync` read and normalize it.
3. Postgres receives derived structured data.
4. The app reads from Postgres only.

### Rebuild flow

Rebuilding means:

- clearing and restoring the derived `vault` schema from canonical files,
- preserving `auth` and `app` schemas.

### Provenance rule

Every app-facing financial/document view should be traceable back to its local
source record or document hash, even if the raw file itself remains local-only.

## 8. API Architecture

The transport contract is REST + OpenAPI.

Rules:

- use Next.js route handlers,
- keep route handlers thin,
- validate with Zod contracts,
- call application services,
- map outputs to contract DTOs,
- generate an OpenAPI spec and typed client.

Route handlers must not:

- contain business logic,
- contain raw SQL,
- access React UI state,
- perform direct component-facing database orchestration.

## 9. UI Architecture

Use Next.js App Router with minimal FSD.

### Allowed patterns

- Server Components for composition, auth shell, and prefetch where useful.
- Client Components for interactive widgets and mutations.
- React Query for selective interactive data flows and mutations.

### Explicitly not used

- Server Actions
- direct DB reads in components
- ad hoc transport bypasses

### Minimal FSD shape

```text
apps/web/
  app/
    (auth)/
    (app)/
    layout.tsx
    providers.tsx
  src/
    shared/
      ui/
      api/
      auth/
      config/
      lib/
    entities/
      document/
      financial-line/
      settlement/
      anomaly/
      user/
    features/
      sign-in/
      invite-user/
      period-switcher/
      document-search/
      evidence-panel/
    widgets/
      dashboard-summary/
      monthly-breakdown/
      anomaly-feed/
      document-detail/
      yearly-reconciliation/
    pages/
      dashboard/
      documents/
      financials/
      settings/
```

Keep it light. The point is predictable ownership, not ceremony.

## 10. Auth Model

Use Better Auth with these defaults:

- private app,
- invite-only access,
- email/password sign-in,
- no public sign-up,
- no social auth in v1.

Initial roles:

- `owner`
- `viewer`
- `editor` only when editing workflows become real

All app routes are private by default.

## 11. Testing and Verification

The app must be implementable while Serhii is away. Testing is part of the
architecture, not cleanup.

Adopt:

- Vitest for package-level unit and integration tests,
- React Testing Library where UI logic needs it,
- Playwright for end-to-end flows,
- OpenAPI generation checks,
- existing typecheck/lint/build gates.

The detailed task-level testing rules live in `APP_IMPLEMENTATION_PLAN.md`.

## 12. AI Operability

For app work, agents should read:

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. `APP_IMPLEMENTATION_PLAN.md`
5. assigned task file

Key rule:

- `ARCHITECTURE.md` is the durable reference,
- `APP_IMPLEMENTATION_PLAN.md` is the execution backlog,
- task files are the local coordination surface.

## 13. Current Non-Goals

These are intentionally out of scope for the first app implementation wave:

- remote raw-file storage,
- public SaaS onboarding,
- multi-property support,
- microservice decomposition,
- direct DB access from UI components,
- server action workflows.

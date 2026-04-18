# Property Vault App Implementation Plan

**Status:** Active  
**Last updated:** 2026-04-18  
**Scope:** App architecture, package foundations, web shell, first vertical
slices, and supporting test/reporting workflow

This file is the detailed execution backlog for the app. It is not the place
for current vault runtime counts or extraction history. Use
`IMPLEMENTATION_PLAN.md` for that.

## 1. Rules of Use

- `ARCHITECTURE.md` is the durable architecture reference.
- This file is the execution backlog and coordination reference.
- `main` is the integration branch.
- Each worker agent should work in its own git worktree on its own branch.
- Only the coordinator edits:
  - `ARCHITECTURE.md`
  - this file
  - shared architectural decisions
- The reviewer agent may:
  - review worker results,
  - make bounded fixes in the worker worktree or a dedicated reviewer worktree,
  - merge approved task branches back into `main`.
- Worker agents edit:
  - owned code files
  - their own task file under `docs/implementation/tasks/`

## 2. Status Model

Use these task states:

- `todo`
- `claimed`
- `in_progress`
- `blocked`
- `done`

Meaning:

- `claimed` = reserved but not executing yet
- `in_progress` = approved for execution and actively being worked
- `blocked` = needs dependency or boundary decision
- `done` = verified and committed

## 3. Spawned-Agent Workflow

Expected workflow:

1. `pick task`
   - read startup docs
   - find the first ready task
   - mark it `claimed`
   - report task choice and next step

2. `do`
   - re-read the task file
   - mark it `in_progress`
   - report the recommended model/effort and verification gate
   - wait for `start`

3. `start`
   - work in the assigned worktree/branch only
   - implement only inside the declared write scope
   - run the required verification
   - update the task file
   - commit with task ID in the subject

4. reviewer pass
   - review the worker branch in isolation
   - make bounded fixes if needed
   - run the required review verification
   - merge back to `main` only after the task is `done`

`start` and `do` are intentionally separate so Serhii can choose model/cost
before the task actually runs.

## 4. Worktree and Branch Workflow

Use this workflow for parallel agent execution:

1. `main` is the integration branch and should stay mergeable.
2. Create one worktree per worker agent.
3. Give each worktree its own branch, usually named with the task ID.
4. The worker agent edits and commits only inside its own worktree.
5. The reviewer agent checks the worker result, fixes small issues if needed,
   and merges the task branch back into `main`.

Recommended branch shape:

- `codex/T10-package-vault`
- `codex/T11-package-db`
- `codex/T30-dashboard`

Recommended worktree shape:

- main checkout: coordination only
- sibling worktrees per active task/agent

Example local commands:

```powershell
git worktree add ..\dabrowskiego-T10 -b codex/T10-package-vault
git worktree add ..\dabrowskiego-T11 -b codex/T11-package-db
git worktree list
```

After the task is reviewed and merged:

```powershell
git worktree remove ..\dabrowskiego-T10
git branch -d codex/T10-package-vault
```

Important rules:

- never let two worker agents share one worktree,
- never let workers commit directly on `main`,
- coordinator stays mostly in the main checkout,
- reviewer merges only after verification and task-file update.

## 5. Model Selection

Use only these recommendations in task files:

- `gpt-5.4-mini / medium`
- `gpt-5.4 / xhigh`

### Prefer `gpt-5.4-mini / medium` for

- repetitive scaffolding,
- doc/task-file updates,
- thin route handler wiring,
- generated-client plumbing,
- UI composition on stable contracts,
- straightforward tests and fixtures.

### Prefer `gpt-5.4 / xhigh` for

- Drizzle schema design,
- Better Auth integration,
- package boundary changes,
- sync/rebuild logic,
- OpenAPI contract design,
- application-layer use cases,
- cross-package refactors,
- difficult integration failures.

## 6. Verification Gates

- `light`
  - `npm run typecheck`
  - targeted tests

- `standard`
  - `npm run typecheck`
  - `npm run lint`
  - targeted unit/integration tests

- `strong`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - targeted integration tests
  - relevant Playwright flow when UI/API surface changes

- `release`
  - full suite
  - build
  - Playwright smoke
  - browser verification

## 7. Standard Scripts

The app implementation should add and maintain these scripts:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:contracts`

## 8. Parallelization Rules

Parallel work is allowed only when:

- dependencies are already `done`,
- write scopes are disjoint,
- shared interfaces are already fixed,
- no other claimed task owns the same area.

If a task must change shared architecture, schema ownership, or auth/session
contracts, it must stop and report `blocked`.

## 8. Task Waves

### Wave 0 — Docs and protocol

| ID | Title | Status | Dependencies | Write scope | Model | Parallel group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T00` | Write `ARCHITECTURE.md` | `done` | none | root docs | `gpt-5.4 / xhigh` | `docs-core` | `standard` | architecture doc exists and matches approved direction |
| `T01` | Write `APP_IMPLEMENTATION_PLAN.md` | `done` | `T00` | root docs | `gpt-5.4 / xhigh` | `docs-core` | `standard` | detailed task backlog exists with model/gate data |
| `T02` | Write `docs/implementation/AGENT_PROTOCOL.md` | `done` | `T00`, `T01` | `docs/implementation/**` | `gpt-5.4-mini / medium` | `docs-core` | `light` | protocol file exists and supports `pick task` -> `do` -> `start` |
| `T03` | Create initial task handoff files | `done` | `T01`, `T02` | `docs/implementation/tasks/**` | `gpt-5.4-mini / medium` | `docs-core` | `light` | one task file exists for each planned task |
| `T04` | Update startup docs and doc links | `done` | `T00`, `T01`, `T02` | `README.md`, `AGENTS.md` | `gpt-5.4-mini / medium` | `docs-core` | `standard` | startup docs point to new architecture and protocol docs |

### Wave 1 — Core packages

| ID | Title | Status | Dependencies | Write scope | Model | Parallel group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T10` | Create `packages/vault` | `todo` | `T00`-`T04` | `packages/vault/**`, thin CLI call sites | `gpt-5.4 / xhigh` | `core-a` | `strong` | canonical vault helpers live in package and tools can call them |
| `T11` | Create `packages/db` with Drizzle and Postgres | `todo` | `T00`-`T04` | `packages/db/**`, root workspace config as needed | `gpt-5.4 / xhigh` | `core-a` | `strong` | Drizzle schema, client, and migrations exist for Postgres |
| `T12` | Create `packages/auth` with Better Auth | `todo` | `T11` | `packages/auth/**`, workspace config as needed | `gpt-5.4 / xhigh` | `core-b` | `strong` | Better Auth setup exists behind package helpers |
| `T13` | Create `packages/contracts` with Zod + OpenAPI generation | `todo` | `T11` | `packages/contracts/**`, workspace config as needed | `gpt-5.4 / xhigh` | `core-b` | `strong` | shared request/response contracts and OpenAPI generation exist |
| `T14` | Create `packages/application` | `todo` | `T11`, `T13` | `packages/application/**` | `gpt-5.4 / xhigh` | `core-c` | `strong` | use cases exist outside transport and UI |
| `T15` | Create `packages/sync` | `todo` | `T10`, `T11` | `packages/sync/**`, thin CLI call sites | `gpt-5.4 / xhigh` | `core-c` | `strong` | canonical-to-Postgres sync layer exists and is idempotent |
| `T16` | Add local Docker bootstrap | `todo` | `T11`, `T12` | root dev config, docker files, docs | `gpt-5.4-mini / medium` | `core-d` | `standard` | local Postgres + app boot flow is documented and runnable |

### Wave 2 — Web shell

| ID | Title | Status | Dependencies | Write scope | Model | Parallel group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T20` | Refactor `apps/web` into minimal FSD | `todo` | `T11`-`T16` | `apps/web/app/**`, `apps/web/src/**` | `gpt-5.4-mini / medium` | `web-shell` | `strong` | web app has stable minimal FSD layout and compiles |
| `T21` | Add app providers and API client | `todo` | `T12`, `T13`, `T20` | `apps/web/src/shared/**`, provider wiring | `gpt-5.4-mini / medium` | `web-shell` | `standard` | auth/query/theme/API client providers are wired |
| `T22` | Add thin REST route handler structure | `todo` | `T13`, `T14`, `T20` | `apps/web/app/api/**` and transport adapters | `gpt-5.4-mini / medium` | `web-shell` | `strong` | route handlers validate, delegate, and return contract DTOs |
| `T23` | Add contract/client generation flow | `todo` | `T13`, `T22` | contracts generation config and web client wiring | `gpt-5.4-mini / medium` | `web-shell` | `standard` | OpenAPI generation and typed client flow are working |

### Wave 3 — First vertical slices

| ID | Title | Status | Dependencies | Write scope | Model | Parallel group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T30` | Dashboard summary + month breakdown | `todo` | `T21`-`T23` | dashboard contracts, application, routes, widgets | `gpt-5.4 / xhigh` | `slice-dashboard` | `strong` | dashboard renders real month summary and category breakdown |
| `T31` | Documents list/detail + provenance | `todo` | `T21`-`T23` | documents contracts, application, routes, widgets | `gpt-5.4 / xhigh` | `slice-documents` | `strong` | document flows show detail plus provenance/source trace |
| `T32` | Year reconciliation + anomalies | `todo` | `T21`-`T23` | reconciliation/anomaly contracts, application, routes, widgets | `gpt-5.4 / xhigh` | `slice-financials` | `strong` | yearly review and anomalies flow render from real data |
| `T33` | Access/invite flows | `todo` | `T12`, `T21`-`T23` | auth/access routes, application, widgets | `gpt-5.4 / xhigh` | `slice-access` | `strong` | invite-only access flow works end to end |

### Wave 4 — Hardening

| ID | Title | Status | Dependencies | Write scope | Model | Parallel group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T40` | Import-boundary lint rules | `todo` | `T20` | lint config and slice boundary rules | `gpt-5.4-mini / medium` | `hardening-a` | `standard` | forbidden cross-slice imports fail lint |
| `T41` | Sync freshness and status surfaces | `todo` | `T15`, `T30`-`T32` | application, contracts, widgets for freshness/status | `gpt-5.4 / xhigh` | `hardening-b` | `strong` | UI exposes last sync/freshness clearly |
| `T42` | Error, empty, and loading states | `todo` | `T30`-`T33` | slice UI states only | `gpt-5.4-mini / medium` | `hardening-c` | `standard` | primary screens have consistent non-happy-path states |
| `T43` | Dev/bootstrap scripts | `todo` | `T16`, `T20`-`T23` | root scripts, docs, local setup helpers | `gpt-5.4-mini / medium` | `hardening-d` | `standard` | repo bootstrap and local run flows are simple and documented |
| `T44` | Final documentation cleanup | `todo` | `T40`-`T43` | root/package docs only | `gpt-5.4-mini / medium` | `hardening-e` | `light` | architecture, package docs, and task docs reflect reality |

## 9. Reviewer Workflow

The reviewer agent is optional but recommended.

### Reviewer responsibilities

- verify the worker stayed inside the write scope,
- check contract and boundary discipline,
- run the required verification gate,
- make small bounded fixes if needed,
- update the task file with review notes,
- merge the task branch back into `main`.

### Reviewer limits

The reviewer should not silently redesign shared architecture during review.
If review exposes a bigger architectural problem, the reviewer marks the task
`blocked` and reports it to the coordinator instead of freelancing a redesign.

### Recommended reviewer model

Use a stronger model for the reviewer when the task is:

- schema-heavy,
- auth-heavy,
- cross-package,
- UI plus API plus contract at once.

Typical reviewer default:

- `gpt-5.4 / xhigh`

## 10. Worker Reporting Requirements

Each worker task file must include:

- `Status`
- `Owner`
- `Recommended execution model`
- `Dependencies`
- `Write scope`
- `Files changed`
- `Contracts changed`
- `Tests run`
- `Next handoff note`

Every task commit must include the task ID, for example:

- `T30 Add dashboard summary routes and application service`
- `T31 Add document detail contracts and provenance widget`

The reviewer should also append a short review note before merge:

- `Review result`
- `Reviewer`
- `Review tests run`
- `Merge status`

## 11. Test Strategy

### Unit/package tests

Use Vitest for:

- `packages/vault`
- `packages/db`
- `packages/auth`
- `packages/contracts`
- `packages/application`
- `packages/sync`

Focus on normalization, repositories, sync idempotency, auth/session helpers,
contracts, and business rules.

### Contract tests

Verify:

- OpenAPI generation succeeds,
- generated client matches declared routes,
- request/response validation stays aligned.

### Integration tests

Use local Postgres fixtures for:

- ingest/sync correctness,
- dashboard correctness,
- document detail/provenance correctness,
- reconciliation correctness,
- auth/invite behavior.

### End-to-end tests

Use Playwright for:

- sign in,
- dashboard load,
- period switch,
- document detail,
- yearly reconciliation,
- invite/access screens.

### Browser verification

For major UI tasks:

- boot the dev server,
- run a browser verification pass,
- check runtime/console errors,
- verify the changed flow visually.

## 12. Autonomous Stop Rules

An agent may continue without Serhii only if:

- dependencies are satisfied,
- write scope is clear,
- required tests pass,
- no shared boundary changed.

An agent must stop and mark `blocked` if:

- shared package boundaries must change,
- a DB schema change affects another claimed task,
- auth/session behavior changes outside the owned scope,
- contract changes break parallel work,
- tests reveal an architectural contradiction rather than a local bug.

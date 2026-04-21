# Property Vault App Implementation Plan

**Status:** Active  
**Last updated:** 2026-04-21  
**Scope:** App architecture, package foundations, web shell, redesign system,
first vertical slices, and supporting test/reporting workflow

This file is the detailed execution backlog for the app. It is not the place
for extraction history or ad hoc notes.

## 1. Rules of Use

- `ARCHITECTURE.md` is the durable architecture reference.
- This file is the execution backlog and coordination reference.
- `master` is the integration branch.
- Each worker agent should work on one task branch at a time.
- Agents manage branch creation and checkout themselves; Serhii should not need
  to do manual branch management during normal flow.
- Only the coordinator edits:
  - `ARCHITECTURE.md`
  - this file
  - shared architectural decisions
- The reviewer agent may:
  - review worker results,
  - make bounded fixes on the task branch,
  - mark reviewed work `merge ready` or `blocked`.
- Worker agents edit:
  - owned code files
  - their own task file under `docs/implementation/tasks/`
- Coordinator may update the table statuses in this file for at-a-glance queue
  visibility on `master`.
- Coordinator also records final review decisions and merges reviewed work back
  into `master`.
- Foundational package tasks may also touch minimal root metadata when needed
  to make the new package trackable and installable, such as `.gitignore`,
  `package-lock.json`, and workspace-level package-manager metadata.
- For future multi-schema database work, keep explicit `CREATE SCHEMA IF NOT
  EXISTS` bootstrap statements in migrations instead of assuming the generator
  will emit them for blank databases.
- Private-data ignore rules must stay root-anchored such as `/vault/`,
  `/index/`, and `/reports/` so nested workspace paths are not ignored.

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

## 3. Branch Workflow

Expected workflow:

1. `pick task`
   - read startup docs
   - find the first ready task
   - mark it `claimed`
   - report task choice and next step

2. `do`
   - re-read the task file
   - create or switch to the task branch
   - mark it `in_progress`
   - report the recommended model/effort and verification gate
   - wait for `start`

3. `start`
   - work in the assigned task branch only
   - implement only inside the declared write scope
   - run the required verification
   - update the task file
   - commit with task ID in the subject

4. reviewer pass
   - review the finished task branch in isolation
   - make bounded fixes if needed
   - run the required review verification
   - validate coordinator-facing notes
   - declare `merge ready` or `blocked`

5. coordinator final pass
   - read reviewer output and coordinator notes
   - decide which follow-up actions are taken or ignored
   - merge the reviewed task branch back to `master` when ready
   - update backlog/docs if future work changes

`start` and `do` are intentionally separate so Serhii can choose model/cost
before the task actually runs.

## 4. Sequential Branch Workflow

Use this workflow for sequential branch execution:

1. `master` is the integration branch and should stay mergeable.
2. The active role creates or switches to one task branch, usually named with
   the task ID.
3. The worker agent edits and commits only on that task branch.
4. The reviewer agent checks that same task branch, fixes small issues if
   needed, and hands a `merge ready` or `blocked` result to coordinator.
5. The coordinator records final decisions and merges that reviewed task branch
   back into `master`.

Recommended branch shape:

- `codex/T10-package-vault`
- `codex/T11-package-db`
- `codex/T30-dashboard`

If the Codex UI creates a different but still task-identifiable
branch slug, use the actual checked-out branch as the source of truth in task
handoffs and task files.

Example local commands:

```powershell
git switch -c codex/T10-package-vault
git switch master
git merge --ff-only codex/T10-package-vault
```

After the task is reviewed and merged:

```powershell
git branch -d codex/T10-package-vault
```

Important rules:

- never let two unfinished task branches run at once,
- never let workers commit directly on `master`,
- coordinator stays mostly in the `master` checkout,
- reviewer verifies the same task branch and hands off,
- coordinator merges after reviewer verification and final decision logging.

### Review target rule

The default review target is the finished task branch itself.

Use this unless the protocol is deliberately changed later.

Coordinator should:

- read the worker branch from the task file,
- hand reviewer that exact task branch,
- merge that reviewed task branch back into `master`.

### Queue visibility from `master`

Worker task-file edits are branch-local while the task is in progress.

That means:

- the copy of `docs/implementation/tasks/Txx-*.md` visible on `master` may lag,
- the task branch copy is the live execution view,
- coordinator should switch back to `master` before picking more work,
- branch checkout is handled by the active role, not by Serhii,
- this backlog table may be updated by coordinator so the queue stays readable
  from `master`,
- do not start another task while one task branch is still awaiting review or
  merge.

### Dependency note for branch-only flow

Branch switches usually reuse the same local dependency install.

If you ever create a fresh checkout manually:

- run a real local install there, usually `npm install`,
- do not symlink or junction `node_modules` from another checkout,
- treat shared `node_modules` links as unsupported because Next.js/Turbopack
  may reject paths that point outside the checkout root.

## 5. Model Selection

Task files should store the best default model/effort pair for that task, not a
fake forced choice. Agents may recommend a different pairing at execution time
if the repo state or task shape has changed.

Common valid recommendations include:

- `gpt-5.4-mini / low`
- `gpt-5.4-mini / medium`
- `gpt-5.4 / medium`
- `gpt-5.4 / high`
- `gpt-5.4 / xhigh`

### Prefer `gpt-5.4-mini / low` for

- doc-only cleanup,
- rote task-file updates,
- simple metadata/status maintenance.

### Prefer `gpt-5.4-mini / medium` for

- repetitive scaffolding,
- doc/task-file updates,
- thin route handler wiring,
- generated-client plumbing,
- UI composition on stable contracts,
- straightforward tests and fixtures.

### Prefer `gpt-5.4 / medium` for

- bounded feature work on already-stable interfaces,
- route/application wiring with limited cross-package risk,
- focused UI/API slices that are more than scaffolding but not architecture work.

### Prefer `gpt-5.4 / high` for

- vertical slices that cross contracts, application logic, and UI,
- reviewer passes on non-trivial tasks,
- cross-package work where the boundaries are known but the implementation is substantial.

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
  - for foundational package tasks, add a package-local workspace verification
    such as `npm run --workspace @dabrowskiego/vault typecheck` when available

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

## 8. Sequential Execution Rules

This workflow is intentionally one task at a time.

- Do not start a new implementation task while another task branch is still
  active.
- Only return to `pick task` after the current task branch is merged or
  intentionally abandoned.
- If a task must change shared architecture, schema ownership, or auth/session
  contracts, it must stop and report `blocked`.

## 9. Task Waves

### Wave 0 - Docs and protocol

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T00` | Write `ARCHITECTURE.md` | `done` | none | root docs | `gpt-5.4 / xhigh` | `docs-core` | `standard` | architecture doc exists and matches approved direction |
| `T01` | Write `APP_IMPLEMENTATION_PLAN.md` | `done` | `T00` | root docs | `gpt-5.4 / high` | `docs-core` | `standard` | detailed task backlog exists with model/gate data |
| `T02` | Write `docs/implementation/AGENT_PROTOCOL.md` | `done` | `T00`, `T01` | `docs/implementation/**` | `gpt-5.4-mini / low` | `docs-core` | `light` | protocol file exists and supports `pick task` -> `do` -> `start` |
| `T03` | Create initial task handoff files | `done` | `T01`, `T02` | `docs/implementation/tasks/**` | `gpt-5.4-mini / low` | `docs-core` | `light` | one task file exists for each planned task |
| `T04` | Update startup docs and doc links | `done` | `T00`, `T01`, `T02` | `README.md`, `AGENTS.md` | `gpt-5.4-mini / low` | `docs-core` | `standard` | startup docs point to new architecture and protocol docs |

### Wave 1 - Core packages

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T10` | Create `packages/vault` | `done` | `T00`-`T04` | `packages/vault/**`, thin CLI call sites | `gpt-5.4 / xhigh` | `core-a` | `strong` | canonical vault helpers live in package and tools can call them |
| `T11` | Create `packages/db` with Drizzle and Postgres | `done` | `T00`-`T04` | `packages/db/**`, root workspace config as needed | `gpt-5.4 / xhigh` | `core-a` | `strong` | Drizzle schema, client, and migrations exist for Postgres |
| `T12` | Create `packages/auth` with Better Auth | `done` | `T11` | `packages/auth/**`, workspace config as needed | `gpt-5.4 / xhigh` | `core-b` | `strong` | Better Auth setup exists behind package helpers |
| `T13` | Create `packages/contracts` with Zod + OpenAPI generation | `done` | `T11` | `packages/contracts/**`, workspace config as needed | `gpt-5.4 / xhigh` | `core-b` | `strong` | shared request/response contracts and OpenAPI generation exist |
| `T14` | Create `packages/application` | `done` | `T11`, `T13` | `packages/application/**` | `gpt-5.4 / xhigh` | `core-c` | `strong` | use cases exist outside transport and UI |
| `T15` | Create `packages/sync` | `done` | `T10`, `T11` | `packages/sync/**`, thin CLI call sites | `gpt-5.4 / xhigh` | `core-c` | `strong` | canonical-to-Postgres sync layer exists and is idempotent |
| `T16` | Add local Docker bootstrap | `done` | `T11`, `T12` | root dev config, docker files, docs | `gpt-5.4-mini / medium` | `core-d` | `standard` | local Postgres + app boot flow is documented and runnable |

### Wave 2 - Web shell

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T20` | Refactor `apps/web` into minimal FSD | `done` | `T11`-`T16` | `apps/web/app/**`, `apps/web/src/**` | `gpt-5.4-mini / medium` | `web-shell` | `strong` | web app has stable minimal FSD layout and compiles |
| `T21` | Add app providers and API client | `done` | `T12`, `T13`, `T20` | `apps/web/src/shared/**`, provider wiring | `gpt-5.4-mini / medium` | `web-shell` | `standard` | auth/query/theme/API client providers are wired |
| `T22` | Add thin REST route handler structure | `done` | `T13`, `T14`, `T20` | `apps/web/app/api/**` and transport adapters | `gpt-5.4 / medium` | `web-shell` | `strong` | route handlers validate, delegate, and return contract DTOs |
| `T23` | Add contract/client generation flow | `done` | `T13`, `T22` | contracts generation config and web client wiring | `gpt-5.4-mini / medium` | `web-shell` | `standard` | OpenAPI generation and typed client flow are working |

### Wave 3 - First vertical slices

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T30` | Dashboard summary + month breakdown | `done` | `T21`-`T23` | dashboard contracts, application, routes, widgets | `gpt-5.4 / high` | `slice-dashboard` | `strong` | dashboard renders real month summary and category breakdown |
| `T31` | Documents list/detail + provenance | `done` | `T21`-`T23` | documents contracts, application, routes, widgets | `gpt-5.4 / high` | `slice-documents` | `strong` | document flows show detail plus provenance/source trace |
| `T34` | Effective charge schedule carry-forward | `done` | `T15`, `T21`-`T23`, `T30` | sync/application/contracts/dashboard surfaces for effective monthly schedules | `gpt-5.4 / xhigh` | `slice-financials` | `strong` | monthly charge schedules remain effective until replaced, dashboard/history expose carried-forward months with provenance, and reconciliation can consume an effective month-by-month schedule model |
| `T32` | Year reconciliation + anomalies | `done` | `T21`-`T23`, `T34` | reconciliation/anomaly contracts, application, routes, widgets | `gpt-5.4 / high` | `slice-financials` | `strong` | yearly review and anomalies render from real data using the effective carried-forward month-by-month charge schedule model |

### Wave 3.5 - UI redesign system

For redesign tasks in this wave, use `docs/implementation/UI_REDESIGN_SPEC.md`
first, then `docs/design/property-vault-mvp/property-vault-reference.png`, and
consult `docs/design/property-vault-mvp/Property Vault.html` only when layout
or micro-detail intent remains ambiguous.

`T37` remains the historical redesign pass that landed on `master`, but
`T45` and `T46` are now the authoritative path for exact v0 dashboard
integration. Do not resume `T38` or `T39` until `T46` is complete.

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T35` | Codify the redesign handoff in repo docs | `done` | `T30`, `T31`, `T32`, `T34` | `docs/design/**`, `docs/implementation/UI_REDESIGN_SPEC.md`, doc references only | `gpt-5.4-mini / medium` | `redesign-a` | `light` | redesign references/spec are in-repo and startup guidance points UI agents at them |
| `T36` | Establish design tokens and shared UI primitives | `done` | `T35` | `apps/web/app/globals.css`, `apps/web/src/shared/ui/**`, shared visual helpers, `apps/web/components.json` if needed | `gpt-5.4 / high` | `redesign-b` | `strong` | semantic tokens, surface system, typography rhythm, badges, metric/value display, dense cards, and shared visual states are centralized |
| `T37` | Redesign dashboard to the finance-first MVP | `done` | `T30`, `T34`, `T36` | dashboard views and widgets only | `gpt-5.4 / high` | `redesign-c` | `strong` | dashboard presents snapshot-first current state, balance/ledger, category drill-down cards, trend, anomalies, and recent evidence in the new system |
| `T45` | Refactor v0 dashboard into `apps/web` architecture | `done` | `T35`, `T36` | dashboard route/view, dashboard-local components, dashboard-local mock data wiring, page shell integration | `gpt-5.4 / xhigh` | `redesign-dash-a` | `strong` | live dashboard route renders the exact v0 page shell and dashboard composition with mocked data inside `apps/web` structure and conventions |
| `T46` | Wire live dashboard data into v0 dashboard | `done` | `T30`, `T32`, `T34`, `T45` | dashboard query wiring, dashboard view-model adapters, minimal dashboard-only compatibility helpers | `gpt-5.4 / xhigh` | `redesign-dash-b` | `strong` | the `T45` dashboard render is preserved while powered by real contracts, carried-forward months, provenance, anomalies, and reconciliation data |
| `T38` | Redesign documents and document detail | `done` | `T31`, `T36`, `T46` | document list/detail views and widgets only | `gpt-5.4 / high` | `redesign-d` | `strong` | document surfaces are dense, readable, provenance-forward, and visually aligned with the v0-integrated dashboard shell |
| `T39` | Redesign reconciliation and anomaly surfaces | `done` | `T32`, `T36`, `T46` | yearly reconciliation and anomaly UI only | `gpt-5.4 / high` | `redesign-e` | `strong` | yearly review and anomalies feel like part of the same product, with shared states and no bespoke styling drift after the v0 dashboard integration lands |

### Wave 4 - Access

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T33` | Access/invite flows | `done` | `T12`, `T21`, `T22`, `T23`, `T36` | auth/access routes, application, widgets | `gpt-5.4 / xhigh` | `slice-access` | `strong` | invite-only access flow works end to end, access/auth screens use the redesign token/primitives system, and auth UI does not invent a parallel visual language |

### Wave 5 - Hardening

| ID | Title | Status | Dependencies | Write scope | Model | Wave group | Gate | Completion signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T40` | Import-boundary lint rules | `done` | `T20`, `T36` | lint config and boundary rules only | `gpt-5.4-mini / medium` | `hardening-a` | `standard` | forbidden imports fail lint with useful messages, including redesign-related UI boundary rules |
| `T41` | Sync freshness and status surfaces | `done` | `T15`, `T39`, `T46` | application, contracts, and UI surfaces for sync status only | `gpt-5.4 / high` | `hardening-b` | `strong` | app clearly shows last sync/freshness state inside the v0-integrated redesigned finance surfaces with tested behavior |
| `T42` | Error, empty, and loading states | `done` | `T33`, `T38`, `T39`, `T46` | slice UI states only | `gpt-5.4-mini / medium` | `hardening-c` | `standard` | primary redesigned screens handle loading, empty, and error states consistently after the v0 dashboard integration path lands |
| `T47` | Remove orphaned pre-v0 reconciliation/anomaly widgets | `done` | `T39`, `T46` | legacy reconciliation/anomaly widget files and stale references only | `gpt-5.4-mini / medium` | `hardening-c2` | `standard` | only one authoritative reconciliation/anomaly UI path remains, with no orphaned pre-v0 widgets or mojibake-laden leftovers confusing future work |
| `T48` | Fix live dashboard copy and encoding drift | `claimed` | `T46`, `T47` | live dashboard copy/formatting sources only | `gpt-5.4-mini / medium` | `hardening-c3` | `standard` | live dashboard status/copy no longer shows mojibake or corrupted punctuation, without redesigning the dashboard shell |
| `T43` | Dev/bootstrap scripts | `todo` | `T16`, `T20`-`T23` | root scripts, docs, local setup helpers | `gpt-5.4-mini / low` | `hardening-d` | `standard` | repo bootstrap and local run flows are simple and documented |
| `T44` | Final documentation cleanup | `todo` | `T33`, `T35`-`T43`, `T45`, `T46`, `T47`, `T48` | root/package docs only | `gpt-5.4-mini / low` | `hardening-e` | `light` | architecture, package docs, redesign guidance, and task docs reflect reality |

## 10. Reviewer Workflow

The reviewer agent is optional but recommended.

### Reviewer responsibilities

- verify the worker stayed inside the write scope,
- check contract and boundary discipline,
- check whether implementation-level architectural choices are acceptable and
  aligned with `ARCHITECTURE.md`,
- run the required verification gate,
- make small bounded fixes if needed,
- update the task file with review notes,
- leave an `Architecture note` when the implementation made a meaningful local
  design choice,
- validate coordinator-facing notes,
- declare the task `merge ready` or `blocked`.

### Reviewer limits

The reviewer should not silently redesign shared architecture during review.
If review exposes a bigger architectural problem, the reviewer marks the task
`blocked` and reports it to the coordinator instead of freelancing a redesign.

## 11. Coordinator Finalization

After reviewer verification, coordinator does the final high-context pass.

Coordinator responsibilities:

- read reviewer notes and `Coordinator notes`,
- decide whether future tasks or docs need to change,
- promote accepted future follow-ups into the relevant task file or this plan,
- record `Coordinator final review`,
- record `Actions taken`,
- record `Actions ignored`,
- merge reviewed work back into `master` when ready.

### Meaning of `Actions taken`

Use `Actions taken` only for concrete changes that were actually made, for
example:

- merged the reviewed branch,
- updated a future dependent task file,
- changed task ordering or status,
- updated docs or architecture guidance,
- created a new follow-up task.

Do not use `Actions taken` for merely recording or preserving a note.

If a completed-task observation matters later, carry it forward into the
dependent task file or this plan and record that promotion as the action taken.

### Recommended reviewer model

Use a stronger model for the reviewer when the task is:

- schema-heavy,
- auth-heavy,
- cross-package,
- UI plus API plus contract at once.

Typical reviewer default:

- `gpt-5.4 / high`

Escalate reviewer effort to `gpt-5.4 / xhigh` for schema, auth, sync, or
shared-boundary tasks.

## 12. Worker Reporting Requirements

Each worker task file must include:

- `Status`
- `Owner`
- `Recommended execution model`
- `Dependencies`
- `Write scope`
- `Worker branch`
- `Files changed`
- `Contracts changed`
- `Tests run`
- `Coordinator notes`
- `Next handoff note`

Every task commit must include the task ID, for example:

- `T30 Add dashboard summary routes and application service`
- `T31 Add document detail contracts and provenance widget`

The reviewer should also append a short review note before merge:

- `Review result`
- `Reviewer`
- `Review tests run`
- `Merge status`
- `Architecture note`
- `Coordinator notes review`

Coordinator should append a final disposition note:

- `Coordinator final review`
- `Actions taken`
- `Actions ignored`

## 13. Test Strategy

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

## 14. Autonomous Stop Rules

An agent may continue without Serhii only if:

- dependencies are satisfied,
- write scope is clear,
- required tests pass,
- no shared boundary changed.

An agent must stop and mark `blocked` if:

- shared package boundaries must change,
- a DB schema change affects another claimed task,
- auth/session behavior changes outside the owned scope,
- contract changes spill outside the declared task scope,
- tests reveal an architectural contradiction rather than a local bug.

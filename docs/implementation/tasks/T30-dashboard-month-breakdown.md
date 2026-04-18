# T30 — Dashboard summary + month breakdown

- Status: `todo`
- Owner: `unassigned`
- Goal: Deliver the first dashboard slice with month summary and category breakdown.
- Dependencies: `T21`, `T22`, `T23`
- Write scope: dashboard contracts, application services, routes, widgets
- Recommended execution model: `gpt-5.4 / high`
- Wave group: `slice-dashboard`
- Required verification: `strong`
- Completion signal: dashboard renders real month summary and normalized breakdown data.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T22`: before this first DB-backed route slice ships, expose a server-safe `@dabrowskiego/db` runtime entrypoint or subpath export so Next route/runtime code can consume DB helpers without pulling migrations into the app bundle.
  - Why it matters: importing the current root DB package barrel from web runtime code pulls `packages/db/src/migrations.ts`, which breaks Turbopack because the migrations path is filesystem-only.
  - Expected outcome: `T30` should use a runtime-safe DB import path and avoid bundling migrations into web route execution.
- Next handoff note: keep dashboard slice isolated from documents/reconciliation slices



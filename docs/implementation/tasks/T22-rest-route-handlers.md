# T22 — Add thin REST route handler structure

- Status: `todo`
- Owner: `unassigned`
- Goal: Implement REST endpoints with thin Next.js route handlers.
- Dependencies: `T13`, `T14`, `T20`
- Write scope: `apps/web/app/api/**`, transport adapters only
- Recommended execution model: `gpt-5.4-mini / medium`
- Parallel group: `web-shell`
- Required verification: `strong`
- Completion signal: route handlers validate, delegate, and return contract DTOs without owning business logic.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Next handoff note: no DB access in handlers; call application services only


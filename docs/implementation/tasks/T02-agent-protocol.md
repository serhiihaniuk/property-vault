# T02 — Write `docs/implementation/AGENT_PROTOCOL.md`

- Status: `done`
- Owner: `coordinator`
- Goal: Create the short execution protocol for spawned agents.
- Dependencies: `T00`, `T01`
- Write scope: `docs/implementation/AGENT_PROTOCOL.md`
- Recommended execution model: `gpt-5.4-mini / low`
- Wave group: `docs-core`
- Required verification: `light`
- Completion signal: protocol supports `pick task` -> `do` -> `start`.
- Files changed:
  - `docs/implementation/AGENT_PROTOCOL.md`
- Contracts changed: none
- Tests run:
  - `npm run typecheck`
  - `npm test`
  - `npm run vault -- validate --strict --json`
- Next handoff note: none


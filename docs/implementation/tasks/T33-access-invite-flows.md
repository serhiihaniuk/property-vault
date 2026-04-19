# T33 — Access/invite flows

- Status: `todo`
- Owner: `unassigned`
- Goal: Deliver private invite-only access flows.
- Dependencies: `T12`, `T21`, `T22`, `T23`, `T36`
- Write scope: auth/access routes, application helpers, widgets
- Recommended execution model: `gpt-5.4 / xhigh`
- Wave group: `slice-access`
- Required verification: `strong`
- Completion signal: invite flow and access management work end to end with real Postgres-backed auth coverage for credential and invite paths, use the redesign token/primitives system, and do not invent a parallel visual language.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T12`: add real Postgres-backed auth integration coverage for credential and invite flows.
  - Why it matters: `pg-mem` does not cover the Better Auth `pg` driver `getTypeParser` path used by deeper credential queries such as `signInEmail`.
  - Expected outcome: `T33` verification should not rely only on `pg-mem` for the auth paths it introduces.
- Next handoff note: keep auth internals behind `packages/auth`



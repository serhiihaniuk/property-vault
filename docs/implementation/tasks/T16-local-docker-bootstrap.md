# T16 — Add local Docker bootstrap

- Status: `todo`
- Owner: `unassigned`
- Goal: Make local Postgres + app startup reproducible.
- Dependencies: `T11`, `T12`
- Write scope: Docker/local bootstrap files and docs only
- Recommended execution model: `gpt-5.4-mini / medium`
- Wave group: `core-d`
- Required verification: `standard`
- Completion signal: local developer can boot the app stack with documented commands.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T11`: local bootstrap should exercise migrations
    against a blank Postgres database and catch missing explicit schema
    bootstrap statements.
  - Expected outcome: documented startup from empty local Postgres proves the
    multi-schema migration path really works.
- Next handoff note: keep setup boring and explicit; no hidden magic



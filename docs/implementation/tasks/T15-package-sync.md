# T15 — Create `packages/sync`

- Status: `todo`
- Owner: `unassigned`
- Goal: Add canonical-vault to Postgres sync and rebuild logic.
- Dependencies: `T10`, `T11`
- Write scope: `packages/sync/**`, thin CLI integrations only
- Recommended execution model: `gpt-5.4 / xhigh`
- Wave group: `core-c`
- Required verification: `strong`
- Completion signal: sync/rebuild logic is idempotent and lives in a dedicated package.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T11`: if this task introduces new schemas or
    migrations, preserve explicit `CREATE SCHEMA IF NOT EXISTS` bootstrap
    statements for blank-database setup.
  - Why it matters: Drizzle Kit did not emit schema creation automatically for
    the earlier multi-schema database package.
- Next handoff note: preserve provenance and keep canonical file ownership in `packages/vault`



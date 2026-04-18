# T15 — Create `packages/sync`

- Status: `done`
- Owner: `Codex implementer on codex/T15-package-sync`
- Goal: Add canonical-vault to Postgres sync and rebuild logic.
- Dependencies: `T10`, `T11`
- Write scope: `packages/sync/**`, thin CLI integrations only
- Worker branch: `codex/T15-package-sync`
- Recommended execution model: `gpt-5.4 / xhigh`
- Wave group: `core-c`
- Required verification: `strong`
- Completion signal: sync/rebuild logic is idempotent and lives in a dedicated package.
- Files changed:
  - `docs/implementation/tasks/T15-package-sync.md`
  - `package-lock.json`
  - `package.json`
  - `packages/sync/package.json`
  - `packages/sync/tsconfig.json`
  - `packages/sync/src/canonical.ts`
  - `packages/sync/src/index.ts`
  - `packages/sync/src/sync.test.ts`
  - `packages/sync/src/sync.ts`
  - `tools/cli.ts`
- Contracts changed: none in `packages/contracts`
- Tests run:
  - `npm run --workspace @dabrowskiego/sync typecheck`
  - `npm run --workspace @dabrowskiego/sync test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Coordinator notes:
  - Carry-forward from `T11`: if this task introduces new schemas or
    migrations, preserve explicit `CREATE SCHEMA IF NOT EXISTS` bootstrap
    statements for blank-database setup.
  - Why it matters: Drizzle Kit did not emit schema creation automatically for
    the earlier multi-schema database package.
  - Observation: sync freshness/status now persists to `app.sync_state`, while
    append-only run history still uses `vault.sync_runs` because that table was
    already present in the shared DB package.
  - Why it matters: future freshness/status UI work may want one canonical
    operational metadata location instead of split status/history tables.
  - Suggested follow-up: coordinator should decide during `T41` or a future DB
    cleanup whether `vault.sync_runs` stays as historical audit data or should
    move into `app`.
  - Urgency: `later`
- Next handoff note: start a reviewer chat on `codex/T15-package-sync` and say `reviewer T15 branch codex/T15-package-sync`



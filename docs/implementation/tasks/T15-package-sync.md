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
- Review result: `merge ready`
- Reviewer: `Codex reviewer on codex/T15-package-sync`
- Review tests run:
  - `npm run --workspace @dabrowskiego/sync test`
  - `npm run --workspace @dabrowskiego/sync typecheck`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Merge status: `merge ready`
- Architecture note: keeping current run status in `app.sync_state` and
  append-only history in `vault.sync_runs` is acceptable and aligned with the
  rebuildable-vs-app-owned split in `ARCHITECTURE.md`; the coordinator note for
  future `T41` cleanup is valid but non-blocking.
- Coordinator notes review: the carry-forward note about possible future sync
  metadata consolidation is valid and should stay as a later follow-up, not a
  blocker for `T15`.
- Next handoff note: return to the coordinator chat on `master` and say `merge latest reviewed task`



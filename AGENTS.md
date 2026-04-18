# Codex Guide

Read this file first in every new Codex session for this repo.

## Startup

1. Read `DESIGN.md`.
2. For app architecture or UI work, read `ARCHITECTURE.md`.
3. For app implementation work, read `docs/implementation/AGENT_PROTOCOL.md`
   and `APP_IMPLEMENTATION_PLAN.md`.
4. Read `IMPLEMENTATION_PLAN.md` only when current vault/runtime state matters.
5. Run `npm run vault -- context` once that command exists.
6. Use local records, notes, SQLite, or cited source files before answering
   factual questions.

## Operating Rules

- Canonical data lives in `vault/`.
- Derived data lives in `index/` and `reports/`.
- Mutate vault data through `tools/vault.ts` or CLI wrappers.
- Treat `index/vault.db` as rebuildable cache.
- Cite local sources when answering questions.
- Never invent financial numbers.
- Never copy raw passwords into records, notes, reports, logs, commits, or
  answers.
- Store money as integer grosz in `amount_minor`.
- Keep Gmail access readonly.

## Useful Commands

```text
npm run vault -- setup
npm run vault -- context
npm run vault -- validate
npm run vault -- reindex
npm run vault -- register-document <path>
npm run vault -- search <query>
npm run vault -- sql --select "<SQL>"
npm run gmail -- sync
npm run vault -- detect-anomalies
npm run vault -- write-inbox
```

These commands are implemented progressively according to
`IMPLEMENTATION_PLAN.md`.

## App Work

For app work, use this read order:

1. `DESIGN.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. `APP_IMPLEMENTATION_PLAN.md`
5. assigned task file under `docs/implementation/tasks/`
6. `IMPLEMENTATION_PLAN.md` only if current vault/runtime context matters

Treat `ARCHITECTURE.md` as the durable target architecture and
`APP_IMPLEMENTATION_PLAN.md` as the app build backlog.

## Private Data

Do not commit:

- `vault/`
- `index/`
- `reports/`
- Gmail OAuth credentials or tokens
- raw downloaded documents
- generated reports containing private data

If a document contains visible portal credentials, mention only that credentials
are present and record a redacted sensitive finding.

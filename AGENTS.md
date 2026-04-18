# Codex Guide

Read this file first in every new Codex session for this repo.

## Startup

1. Read `DESIGN.md`.
2. Read `IMPLEMENTATION_PLAN.md` if the task involves implementation.
3. Run `npm run vault -- context` once that command exists.
4. Use local records, notes, SQLite, or cited source files before answering
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

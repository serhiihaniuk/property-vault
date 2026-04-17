# Codex Guide

Read this file first in every new Codex session for this repo.

## Startup

1. Read `DESIGN.md`.
2. Read `IMPLEMENTATION_PLAN.md` if the task involves implementation.
3. Run `pnpm vault context` once that command exists.
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
pnpm vault setup
pnpm vault context
pnpm vault validate
pnpm vault reindex
pnpm vault register-document <path>
pnpm vault search <query>
pnpm vault sql --select "<SQL>"
pnpm gmail sync
pnpm vault detect-anomalies
pnpm vault write-inbox
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

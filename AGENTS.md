# Codex Guide

Read this file first in every new Codex session for this repo.

## App Goal

Build a serious small SaaS for one property owner:

- private and invite-only,
- local-first evidence stays in `vault/`,
- deployable app runs on Next.js + Postgres + Drizzle + Better Auth,
- REST + OpenAPI is the contract,
- minimal FSD keeps the UI predictable for humans and AI agents,
- no Server Actions,
- no direct DB reads in components.

The app should answer questions like:

- what changed this month,
- what should be paid,
- how yearly reconciliation looks,
- which documents support a given financial fact,
- which anomalies or open items need attention.

## Current Start State

The repo currently has:

- local property evidence under `vault/`,
- local supporting derived data under `index/` and `reports/`,
- working vault tooling for context, search, validation, reindex, Gmail sync,
  anomaly detection, and inbox writing,
- an approved target architecture in `ARCHITECTURE.md`,
- a detailed app backlog in `APP_IMPLEMENTATION_PLAN.md`,
- an agent workflow in `docs/implementation/AGENT_PROTOCOL.md`,
- initial documentation/protocol tasks complete (`T00`-`T04`),
- real app implementation still starting from `T10` onward.

## Startup

1. Read `ARCHITECTURE.md`.
2. Read `docs/implementation/AGENT_PROTOCOL.md`.
3. Read `docs/implementation/WORKTREE_GUIDE.md` when using parallel agents.
4. Read `APP_IMPLEMENTATION_PLAN.md`.
5. Read the assigned task file under `docs/implementation/tasks/` if doing app
   implementation.
6. Run `npm run vault -- context` when local vault/runtime context matters.
7. Use local records, notes, SQLite, or cited source files before answering
   factual questions.

## Operating Rules

- Canonical data lives in `vault/`.
- Supporting derived data lives in `index/` and `reports/`.
- Cite local sources when answering questions.
- Never invent financial numbers.
- Never copy raw passwords into records, notes, reports, logs, commits, or
  answers.
- Store money as integer grosz in `amount_minor`.
- Keep Gmail access readonly.
- For new app work, follow package boundaries and rules from `ARCHITECTURE.md`
  and `APP_IMPLEMENTATION_PLAN.md`.

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

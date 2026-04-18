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

- a **legacy vault POC** under `tools/`, `vault/`, and `index/`,
- an approved target architecture in `ARCHITECTURE.md`,
- a detailed app backlog in `APP_IMPLEMENTATION_PLAN.md`,
- an agent workflow in `docs/implementation/AGENT_PROTOCOL.md`,
- initial documentation/protocol tasks complete (`T00`-`T04`),
- real app implementation still starting from `T10` onward.

Important:

- `DESIGN.md` and `IMPLEMENTATION_PLAN.md` are **legacy POC context**, not the
  source of truth for the app architecture.
- Use them only when a task explicitly deals with the old vault pipeline or a
  migration from that pipeline.

## Startup

1. Read `ARCHITECTURE.md`.
2. Read `docs/implementation/AGENT_PROTOCOL.md`.
3. Read `APP_IMPLEMENTATION_PLAN.md`.
4. Read the assigned task file under `docs/implementation/tasks/` if doing app
   implementation.
5. Read `DESIGN.md` and `IMPLEMENTATION_PLAN.md` only if the task explicitly
   touches the legacy vault POC or migration context.
6. Run `npm run vault -- context` only when legacy vault/runtime context matters.
7. Use local records, notes, SQLite, or cited source files before answering
   factual questions.

## Operating Rules

- Canonical data lives in `vault/`.
- Legacy derived data lives in `index/` and `reports/`.
- Mutate old vault data through `tools/vault.ts` or CLI wrappers only when
  working on the legacy POC.
- Cite local sources when answering questions.
- Never invent financial numbers.
- Never copy raw passwords into records, notes, reports, logs, commits, or
  answers.
- Store money as integer grosz in `amount_minor`.
- Keep Gmail access readonly.
- Do not extend the legacy SQLite-first POC for new app features unless the
  task explicitly says to migrate or reuse that logic.

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

1. `ARCHITECTURE.md`
2. `docs/implementation/AGENT_PROTOCOL.md`
3. `APP_IMPLEMENTATION_PLAN.md`
4. assigned task file under `docs/implementation/tasks/`
5. legacy POC docs only if the task says so

Treat `ARCHITECTURE.md` as the durable target architecture and
`APP_IMPLEMENTATION_PLAN.md` as the app build backlog.

Treat `DESIGN.md` and `IMPLEMENTATION_PLAN.md` as historical/migration context,
not startup docs for app implementation.

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

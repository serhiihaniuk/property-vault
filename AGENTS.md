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
- repo-native redesign references under `docs/design/property-vault-mvp/` and
  a production UI target in `docs/implementation/UI_REDESIGN_SPEC.md`,
  both kept as durable background references rather than universal default
  authorities for every redesign task,
- implemented app packages under `packages/` for vault, db, auth, contracts,
  application, and sync,
- a live web app under `apps/web/` covering the finance dashboard, documents,
  reconciliation/anomalies, access flows, and sync status,
- backlog state should be taken from the current queue in
  `APP_IMPLEMENTATION_PLAN.md` rather than assuming early-wave tasks are still
  pending,
- `docs/implementation/WORKTREE_GUIDE.md` is now only a short compatibility
  note, not part of the default startup read path.

## Startup

1. Read `ARCHITECTURE.md`.
2. Read `docs/implementation/AGENT_PROTOCOL.md`.
3. If the first user message starts with a role shortcut, read the matching
   role file:
   - `coordinator` -> `docs/implementation/roles/COORDINATOR.md`
   - `implementer` or `implementator` -> `docs/implementation/roles/IMPLEMENTER.md`
   - `reviewer` -> `docs/implementation/roles/REVIEWER.md`
4. If doing coordination or queue planning, read:
   - `APP_IMPLEMENTATION_PLAN.md`
5. If implementing or reviewing one task, read the assigned task file under
   `docs/implementation/tasks/` next.
6. Treat the assigned task file as the execution contract.
   - task-local instructions beat generic redesign defaults
   - the task file should name its own `Primary authorities`,
     `Secondary context`, and `Not authoritative` references
7. Read only the exact linked docs listed under the task file's
   `Primary authorities` and `Secondary context`.
8. Run `npm run vault -- context` when local vault/runtime context matters.
9. Use local records, notes, SQLite, or cited source files before answering
   factual questions.

## Role Shortcuts

If a new chat starts with one of these role keywords, optionally followed by a
task ID or short task title:

- `coordinator`
- `implementer`
- `implementator`
- `reviewer`

Examples:

- `coordinator`
- `implementator T10 package vault`
- `reviewer T10`

then immediately switch into that role by reading the matching role file and
reply briefly with:

- what this role does,
- what you expect from Serhii next,
- the next valid command or prompt shape.

Keep that reply short and operational. Do not require Serhii to restate the
whole workflow.

## Human Handoff Rule

When a role-based task or subtask finishes, always end with a short human
handoff when Serhii needs to do something next.

That handoff should say:

- whether anything is needed from Serhii,
- the exact next action,
- the shortest valid command or click flow.

Examples:

- `What I need from you: start a new worker chat with first message "implementator T10 package vault", then say "do". Branch setup is agent-managed.`
- `What I need from you: start a reviewer chat and say "reviewer T10". Branch setup is agent-managed.`
- `What I need from you: say "merge latest reviewed task".`
- `What I need from you: set model to gpt-5.4 / high and say "start".`

If nothing is needed, say that clearly:

- `What I need from you: nothing right now.`

## Operating Rules

- Canonical data lives in `vault/`.
- Supporting derived data lives in `index/` and `reports/`.
- Repo ignore rules for private local data should stay root-anchored, for
  example `/vault/`, `/index/`, and `/reports/`, so planned package names such
  as `packages/vault/**` are not ignored by accident.
- Cite local sources when answering questions.
- Never invent financial numbers.
- Never copy raw passwords into records, notes, reports, logs, commits, or
  answers.
- Store money as integer grosz in `amount_minor`.
- Keep Gmail access readonly.
- For new app work, follow package boundaries and rules from `ARCHITECTURE.md`
  and `APP_IMPLEMENTATION_PLAN.md`.
- For task execution, the assigned task file is the first source of truth.
  Generic redesign or UI docs are durable background references only unless the
  task file explicitly makes them authoritative.
- This repo currently uses branches only, not parallel worktrees.
- Agents manage branch creation and checkout themselves; Serhii should not need
  to manually switch branches during normal task flow.
- When a task is active on its task branch, the task-file copy on that branch
  is authoritative until it is merged back into `master`.
- Finish or merge the current task branch before starting another
  implementation task.
- Non-blocking design observations from workers should be recorded for the
  coordinator to review later; coordinator decides whether future tasks change.

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

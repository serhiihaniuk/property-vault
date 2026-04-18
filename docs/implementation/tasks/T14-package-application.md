# T14 — Create `packages/application`

- Status: `done`
- Owner: `coordinator`
- Goal: Add a transport-agnostic use-case layer.
- Dependencies: `T11`, `T13`
- Write scope: `packages/application/**`
- Worker branch: `codex/T14-package-application`
- Recommended execution model: `gpt-5.4 / xhigh`
- Wave group: `core-c`
- Required verification: `strong`
- Completion signal: application services exist outside UI and route handlers.
- Files changed:
  - `docs/implementation/tasks/T14-package-application.md`
  - `package-lock.json`
  - `package.json`
  - `packages/application/package.json`
  - `packages/application/tsconfig.json`
  - `packages/application/src/application.test.ts`
  - `packages/application/src/application.ts`
  - `packages/application/src/context.ts`
  - `packages/application/src/health.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/shared.ts`
  - `packages/application/src/system.ts`
- Contracts changed:
  - none in `packages/contracts`
  - application services now return DTOs validated against the existing system/shared contract schemas
- Tests run:
  - `npm run --workspace @dabrowskiego/application typecheck`
  - `npm run --workspace @dabrowskiego/application test`
  - `npm run --workspace @dabrowskiego/application build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Coordinator notes: none yet
- Next handoff note: start a reviewer chat on branch `codex/T14-package-application` and say `reviewer T14`



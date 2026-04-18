# App Agent Protocol

Use this file for app work. Keep it short, follow it exactly, and update only
your owned task file.

## Read Order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. `APP_IMPLEMENTATION_PLAN.md`
5. `docs/implementation/WORKTREE_GUIDE.md`
6. assigned or selected task file under `docs/implementation/tasks/`

## Worktree Rule

- `main` is the integration branch.
- Each worker agent should work in its own worktree and its own task branch.
- Workers do not commit directly to `main`.
- Reviewer checks and merges worker branches back into `main`.

## Command Workflow

### `pick task`

Do this when asked to pick work.

1. Read the files above.
2. Scan task files.
3. Select the first task that is:
   - `todo`
   - dependency-complete
   - not overlapping with another claimed write scope
4. Update that task file to `claimed`.
5. Reply with:
   - chosen task ID/title,
   - why it is ready,
   - branch/worktree expectation,
   - write scope,
   - required verification,
   - next command: `do`

Do not implement yet.

### `do`

Do this when asked to prepare execution.

1. Re-read the selected task file.
2. Change status to `in_progress`.
3. Reply with:
   - status set to `in_progress`,
   - worktree/branch reminder,
   - recommended model/effort pair,
   - optional cheaper fallback when it would still be acceptable,
   - short reason,
   - required tests,
   - next command: `start`

Do not implement yet.

### `start`

Do this when asked to execute.

1. Re-read the task file.
2. Work only inside the assigned worktree and branch.
3. Implement only inside the declared write scope.
4. Run the required verification gate.
5. Update the task file with:
   - files changed,
   - contracts changed,
   - tests run,
   - status,
   - next handoff note
6. Commit with the task ID in the subject.
7. Hand off to the reviewer instead of merging yourself.

## Status Rules

- `todo` = not reserved
- `claimed` = reserved, not yet executing
- `in_progress` = approved and being worked
- `blocked` = cannot continue safely
- `done` = verified and committed

## Ownership Rules

Only the coordinator edits:

- `ARCHITECTURE.md`
- `APP_IMPLEMENTATION_PLAN.md`
- shared architectural decisions

Workers edit:

- owned code files
- their own task file

Reviewer may edit:

- the worker branch being reviewed,
- the worker task file,
- merge-related metadata after verification

## Parallel Work

Parallel work is allowed only when:

- dependencies are already `done`,
- write scopes are disjoint,
- shared interfaces are fixed.

If a task must change shared boundaries or shared contracts, stop and mark it
`blocked`.

## Reviewer Flow

1. Read the worker task file and branch/worktree context.
2. Review the worker result in isolation.
3. Make small bounded fixes if needed.
4. Run the required review verification.
5. Update the task file with:
   - `Review result`
   - `Reviewer`
   - `Review tests run`
   - `Merge status`
6. Merge back into `main` only if the task is truly ready.

If review exposes an architectural conflict, mark the task `blocked` and report
it to the coordinator instead of redesigning it during review.

## Required Task File Fields

Every task file must keep these fields current:

- `Status`
- `Owner`
- `Recommended execution model`
- `Dependencies`
- `Write scope`
- `Files changed`
- `Contracts changed`
- `Tests run`
- `Next handoff note`

## Commit Format

Use the task ID in the subject:

- `T30 Add dashboard summary routes and application service`
- `T31 Add document detail contracts and provenance widget`

## Model Recommendation Rule

Do not force model choices into only two buckets.

When reporting the recommended execution model:

- choose the actual best-fit model and effort for the task,
- use any valid pairing available in the current Codex UI,
- examples include:
  - `gpt-5.4-mini / low`
  - `gpt-5.4-mini / medium`
  - `gpt-5.4 / medium`
  - `gpt-5.4 / high`
  - `gpt-5.4 / xhigh`
- include a cheaper fallback only when the task can safely tolerate it.

Task-file recommendations are defaults, not hard limits. If the real situation
has changed, say so briefly and recommend a better pairing before execution.

## Stop Conditions

Stop and mark `blocked` if:

- a dependency is not really done,
- write scope is no longer isolated,
- schema/auth/contracts need shared changes outside your task,
- required tests fail in a way that points to architectural conflict.

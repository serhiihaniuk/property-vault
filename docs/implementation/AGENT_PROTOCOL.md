# App Agent Protocol

Use this file for app work. Keep it short, follow it exactly, and update only
your owned task file.

## Read Order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. `APP_IMPLEMENTATION_PLAN.md`
5. assigned or selected task file under `docs/implementation/tasks/`

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
   - recommended model:
     - `gpt-5.4-mini / medium`, or
     - `gpt-5.4 / xhigh`
   - short reason,
   - required tests,
   - next command: `start`

Do not implement yet.

### `start`

Do this when asked to execute.

1. Re-read the task file.
2. Implement only inside the declared write scope.
3. Run the required verification gate.
4. Update the task file with:
   - files changed,
   - contracts changed,
   - tests run,
   - status,
   - next handoff note
5. Commit with the task ID in the subject.

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

## Parallel Work

Parallel work is allowed only when:

- dependencies are already `done`,
- write scopes are disjoint,
- shared interfaces are fixed.

If a task must change shared boundaries or shared contracts, stop and mark it
`blocked`.

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

## Stop Conditions

Stop and mark `blocked` if:

- a dependency is not really done,
- write scope is no longer isolated,
- schema/auth/contracts need shared changes outside your task,
- required tests fail in a way that points to architectural conflict.

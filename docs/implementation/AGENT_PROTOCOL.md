# App Agent Protocol

Use this file for app work. Keep it short, follow it exactly, and update only
your owned task file.

## Read Order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. matching role file under `docs/implementation/roles/` when the chat starts
   as `coordinator`, `implementer`/`implementator`, or `reviewer`
5. `APP_IMPLEMENTATION_PLAN.md`
6. `docs/implementation/WORKTREE_GUIDE.md`
7. assigned or selected task file under `docs/implementation/tasks/`

## Role Entry Shortcut

If the first user message in a new chat starts with one of these role
keywords, optionally followed by a task ID or task title:

- `coordinator`
- `implementer`
- `implementator`
- `reviewer`

then:

1. read the matching role file,
2. adopt that role immediately,
3. reply with a short operational message only:
   - what this role does,
   - what you expect from Serhii next,
   - the next valid command shape.

Do not ask Serhii to paste the workflow again.

Examples:

- `coordinator`
- `implementator T10 package vault`
- `reviewer T10`
- `reviewer T10 branch codex/T10-package-vault`

## Chat Naming Rule

Name chats by task, not by role alone.

Preferred pattern:

- coordinator chat: stable queue name such as `Coordinator queue`
- worker chat: `T22 route handlers`
- reviewer chat: `Review T22`

Avoid vague names like:

- `worker`
- `spawn worker`
- `next task`

If the chat is for a worker or reviewer, include the task ID in the first user
message whenever possible. In the Codex UI, that first message typically drives
the chat name, for example:

- `implementator T22 route handlers`
- `reviewer T22`

Branch names should follow the same task-first idea, for example:

- `codex/T22-rest-route-handlers`
- `codex/T30-dashboard`

If the Codex UI creates a different but still task-identifiable
branch slug, use the actual checked-out branch as the source of truth in task
handoffs and task files.

## Human Handoff Rule

Whenever a role completes a meaningful step, end with a short human handoff.

That handoff must say:

- whether Serhii needs to do anything,
- the exact next action,
- the shortest valid command, click flow, or reply.

Examples:

- `What I need from you: start a new worker chat with first message "implementator T10 package vault", then say "do". Branch setup is agent-managed.`
- `What I need from you: start a reviewer chat and say "reviewer T10". Branch setup is agent-managed.`
- `What I need from you: say "merge latest reviewed task".`
- `What I need from you: choose gpt-5.4 / high, then say "start".`
- `What I need from you: nothing right now.`

Do not finish with an ambiguous status-only message when a human action is
actually required.

## Branch Rule

- `main` is the integration branch.
- Use one active task branch at a time.
- Workers and reviewers use the same task branch sequentially.
- Agents manage branch creation and checkout themselves.
- Workers do not commit directly to `main`.
- Do not start a new task until the current task branch is merged or
  intentionally abandoned.

## Branch Visibility Rule

Task-file edits happen on the active task branch first.

That means:

- `main` may still show `todo` or `claimed` while the live task branch already
  says `in_progress` or `done`,
- the active task branch is authoritative for that task until merge,
- before picking more work, the coordinator should switch back to `main` and
  make sure no other task branch is still mid-flight.

## Reviewer Target Rule

Reviewer must use the finished task branch as the source of truth.

That means:

- `reviewer T10` is only sufficient when the reviewer chat is already attached
  to the finished task branch,
- if the reviewer chat opens on `main`, the reviewer should switch to the exact
  task branch first,
- reviewer should not treat the `main` copy of the task file as authoritative
  for a finished task result.

## Command Workflow

### `pick task`

Do this when asked to pick work.

1. Read the files above.
2. Confirm you are on `main` and no older task branch is still awaiting review
   or merge.
3. Scan task files.
4. Select the first task that is:
   - `todo`
   - dependency-complete
   - not blocked by another unfinished task
   - not overlapping with another claimed write scope
5. Update that task file to `claimed`.
6. Reply with:
   - chosen task ID/title,
   - why it is ready,
   - worker chat first message plus branch expectation,
   - write scope,
   - required verification,
   - next command: `do`

Do not implement yet.

### `do`

Do this when asked to prepare execution.

1. Re-read the selected task file.
2. Ensure the expected task branch exists and switch the checkout to it.
3. Change status to `in_progress`.
4. Reply with:
   - status set to `in_progress`,
   - note that the branch is now active and this live status stays there until
     merge,
   - exact branch in use,
   - recommended model/effort pair,
   - optional cheaper fallback when it would still be acceptable,
   - short reason,
   - required tests,
   - next command: `start`

Do not implement yet.

### `start`

Do this when asked to execute.

1. Re-read the task file.
2. Work only inside the assigned task branch.
3. Implement only inside the declared write scope.
4. If the task is the first bootstrap of a new workspace package, root metadata
   needed to make it trackable and installable is allowed, including
   `.gitignore`, `package-lock.json`, and package-manager metadata.
5. Run the required verification gate.
6. Update the task file with:
   - worker branch,
   - files changed,
   - contracts changed,
   - tests run,
   - status,
   - next handoff note telling Serhii to start a reviewer chat and say
     `reviewer Txx`
7. Commit with the task ID in the subject.
8. Hand off directly to reviewer on the same task branch instead of merging
   yourself.

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
- final task-level action dispositions after review

Workers edit:

- owned code files
- their own task file

Reviewer may edit:

- the task branch,
- the worker task file,
- merge-related metadata after verification

## Coordinator Notes Rule

Use `Coordinator notes` in the task file for non-blocking findings that may
reshape future work.

Use this when a worker or reviewer notices:

- a design flaw that does not block the current task,
- a missing future dependency,
- a better future task split,
- a risk the coordinator should factor into later planning.

These notes are for backlog shaping, not live permission to expand scope.

When writing one, keep it short:

- `Observation`
- `Why it matters`
- `Suggested follow-up`
- `Urgency`: `later`, `soon`, or `blocking`

If the issue truly blocks safe progress now, mark the task `blocked` instead of
leaving only a note.

## Sequential Execution Rule

- One task branch at a time.
- Do not start a new task until the current task branch is reviewed and merged
  or explicitly abandoned.
- If a task must change shared boundaries or shared contracts beyond its write
  scope, stop and mark it `blocked`.

## Reviewer Flow

1. Read the worker task file and branch context.
   - prefer an explicit branch target when provided,
   - otherwise verify that the reviewer chat is already attached to the
     finished task branch before trusting the local task file
2. Review the worker result in isolation.
   - check whether any meaningful implementation-level architectural choices
     stay consistent with `ARCHITECTURE.md`, package boundaries, and task
     intent
3. Make small bounded fixes if needed.
4. Run the required review verification.
5. Update the task file with:
   - `Review result`
   - `Reviewer`
   - `Review tests run`
   - `Merge status`
   - `Architecture note`
   - `Coordinator notes review`
6. Hand off a `merge ready` or `blocked` result to the coordinator.

If review exposes an architectural conflict, mark the task `blocked` and report
it to the coordinator instead of redesigning it during review.

## Coordinator Finalization Flow

1. Read the reviewed task result and any coordinator notes.
2. Decide whether each observation changes future tasks, ordering, docs, or
   architecture decisions.
3. If an accepted observation matters for future work, promote it into the
   relevant future task file or `APP_IMPLEMENTATION_PLAN.md` instead of relying
   on memory or the old completed task file alone.
4. Merge only when the reviewer result is truly `merge ready`.
5. Update the task file with:
   - `Coordinator final review`
   - `Actions taken`
   - `Actions ignored`
6. Update `APP_IMPLEMENTATION_PLAN.md` or related docs when the coordinator
   decision changes future work.

## Actions Disposition Rule

- `Actions taken` means concrete changes actually made now, such as:
  - merging the reviewed branch,
  - updating a dependent future task file,
  - changing backlog status, ordering, or dependencies,
  - updating shared docs or architecture guidance,
  - creating a new follow-up task.
- `Actions ignored` means reviewed observations that were consciously not
  applied now.
- Writing or preserving a note by itself does not count as an action taken.
- If a note is important enough to matter later, promote it into the future
  task or plan and then record that promotion under `Actions taken`.

## Required Task File Fields

Every task file must keep these fields current:

- `Status`
- `Owner`
- `Recommended execution model`
- `Dependencies`
- `Write scope`
- `Worker branch`
- `Files changed`
- `Contracts changed`
- `Tests run`
- `Coordinator notes`
- `Review result`
- `Reviewer`
- `Review tests run`
- `Merge status`
- `Architecture note`
- `Coordinator notes review`
- `Coordinator final review`
- `Actions taken`
- `Actions ignored`
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

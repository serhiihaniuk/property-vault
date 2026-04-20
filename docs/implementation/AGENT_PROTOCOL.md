# App Agent Protocol

Use this file for app work. Keep it short, follow it exactly, and update only
your owned task file.

## Read Order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. matching role file under `docs/implementation/roles/` when the chat starts
   as `coordinator`, `implementer`/`implementator`, or `reviewer`
5. if coordinating or planning the queue:
   - `APP_IMPLEMENTATION_PLAN.md`
   - `docs/implementation/WORKTREE_GUIDE.md`
6. if implementing or reviewing a task:
   - assigned task file under `docs/implementation/tasks/`
   - only the exact docs listed under that task file's `Primary authorities`
     and `Secondary context`

## Authority Hierarchy

For execution and review, use this authority order:

1. assigned task file
2. task-linked `Primary authorities`
3. task-linked `Secondary context`
4. matching role file
5. `docs/implementation/AGENT_PROTOCOL.md`
6. general repo docs

Hard rules:

- task-specific overrides beat generic redesign defaults
- if a task file declares `Not authoritative`, those references must not be
  used as fallback, tie-breaker, or reinterpretation guidance
- generic docs must never force a worker or reviewer to reinterpret a
  task-local exception

## Task Execution Contract Rule

The assigned task file is the execution contract.

That means a fresh implementer or reviewer should be able to execute the task
from:

- the task file
- the task-linked authorities it names
- the role file for workflow behavior

Workers and reviewers should not need coordinator chat memory to reconstruct
intent.

If the task file is missing critical execution context or its authority stack
is contradictory, stop and mark the task `blocked` instead of guessing from
generic docs.

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

## UI Redesign Baseline

Generic redesign guidance is durable background context, not an automatic
override.

Default meaning:

- `docs/implementation/UI_PLAYBOOK.md` = structural UI/FSD/shared-ui rules
- `docs/implementation/UI_REDESIGN_SPEC.md` = general redesign direction
- `docs/design/property-vault-mvp/*` = supporting redesign references

For redesign or transplant tasks, the task file must explicitly declare which
of those are:

- `Primary authorities`
- `Secondary context`
- `Not authoritative`

Reviewer should block redesign work that:

- copies prototype HTML/CSS directly into the app,
- introduces page-local tokens instead of shared semantic tokens,
- drifts away from declared task authorities,
- loses the task's stated information hierarchy or fidelity goal.

## Branch Rule

- `master` is the integration branch.
- Use one active task branch at a time.
- Workers and reviewers use the same task branch sequentially.
- Agents manage branch creation and checkout themselves.
- Workers do not commit directly to `master`.
- Do not start a new task until the current task branch is merged or
  intentionally abandoned.

## Branch Visibility Rule

Task-file edits happen on the active task branch first.

That means:

- `master` may still show `todo` or `claimed` while the live task branch already
  says `in_progress` or `done`,
- the active task branch is authoritative for that task until merge,
- before picking more work, the coordinator should switch back to `master` and
  make sure no other task branch is still mid-flight.

## Reviewer Target Rule

Reviewer must use the finished task branch as the source of truth.

That means:

- `reviewer T10` is only sufficient when the reviewer chat is already attached
  to the finished task branch,
- if the reviewer chat opens on `master`, the reviewer should switch to the exact
  task branch first,
- reviewer should not treat the `master` copy of the task file as authoritative
  for a finished task result.

## Command Workflow

### `pick task`

Do this when asked to pick work.

1. Read the files above.
2. Confirm you are on `master` and no older task branch is still awaiting review
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
2. Confirm the task passes the readiness checklist:
   - a fresh implementer can execute from the task file alone
   - authority order is explicit
   - non-goals are explicit
   - known traps are explicit
   - review focus is task-specific
   - expected ownership/FSD shape is explicit where relevant
   - generic docs do not contradict the task-local brief
3. If any readiness item is missing, fix the task file before handoff instead
   of sending the worker into execution.
4. Ensure the expected task branch exists and switch the checkout to it.
5. Change status to `in_progress`.
6. Reply with:
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
4. Follow the task file's authority order exactly. Do not fill intent gaps from
   generic redesign docs when the task file already defines the source of
   truth.
5. If the task is the first bootstrap of a new workspace package, root metadata
   needed to make it trackable and installable is allowed, including
   `.gitignore`, `package-lock.json`, and package-manager metadata.
6. Run the required verification gate.
7. Update the task file with:
   - worker branch,
   - files changed,
   - contracts changed,
   - tests run,
   - status,
   - next handoff note telling Serhii to start a reviewer chat and say
     `reviewer Txx`
8. Commit with the task ID in the subject.
9. Hand off directly to reviewer on the same task branch instead of merging
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

## Run/Support Boundary

When Serhii asks an agent to run the documented local app flow for testing or
support, the agent may execute operational steps such as:

- copying local env files,
- starting Docker services,
- running migrations,
- syncing local data,
- starting the dev server.

This does not authorize silent repo fixes.

If the documented run flow succeeds:

- report success and the reachable local URL,
- mention any local-only files or processes that were created.

If the documented run flow fails because the repo or docs are broken:

- stop at the first failure point,
- report the exact command or stage that failed,
- do not start debugging, patching code, or patching docs unless Serhii
  explicitly asks to fix the issue.

If the failure reveals a real future-work gap, coordinator should promote that
finding into the relevant future task file or shared docs instead of relying on
chat memory alone.

## Reviewer Flow

1. Read the worker task file and branch context.
   - prefer an explicit branch target when provided,
   - otherwise verify that the reviewer chat is already attached to the
     finished task branch before trusting the local task file
   - review against the task file first, then the task-linked authorities
2. Review the worker result in isolation.
   - check whether any meaningful implementation-level architectural choices
     stay consistent with `ARCHITECTURE.md`, package boundaries, and task
     intent
   - check whether the implementer actually followed the declared authority
     stack and did not substitute generic docs for task-local instructions
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

## Coordinator Readiness Gate

Before sending a worker into `do`, coordinator owns task readiness.

Coordinator must make sure the task file is decision-complete enough that:

- a fresh implementer can execute from artifacts alone
- the authority stack is explicit
- non-goals and known traps are explicit
- expected ownership boundaries are explicit where they matter
- review focus is explicit enough for a fresh reviewer

If the task is missing that information, coordinator must patch the task file
before execution starts.

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
- `Task type`
- `Recommended execution model`
- `Dependencies`
- `Write scope`
- `Success criteria`
- `Primary authorities`
- `Secondary context`
- `Not authoritative`
- `Must do`
- `Must not do`
- `Expected ownership shape`
- `Non-goals`
- `Known traps`
- `Review focus`
- `Implementation outline`
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

## Suggested Task Header Shape

For non-trivial tasks, the top of the task file should read like a compact
execution brief, not only a status ledger.

Preferred order near the top:

1. goal and task type
2. dependencies, scope, model, and gate
3. success criteria
4. `Primary authorities`
5. `Secondary context`
6. `Not authoritative`
7. `Must do`
8. `Must not do`
9. `Expected ownership shape`
10. `Non-goals`
11. `Known traps`
12. `Review focus`
13. `Implementation outline`

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

# App Agent Protocol

Use this file for app work. Keep it short, follow it exactly, and let the
assigned task file carry task-local intent.

## Read Order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/implementation/AGENT_PROTOCOL.md`
4. the matching role file when the chat starts as `coordinator`,
   `implementer`/`implementator`, or `reviewer`
5. if coordinating or planning the queue:
   - `APP_IMPLEMENTATION_PLAN.md`
6. if implementing or reviewing a task:
   - the assigned task file
   - only the docs listed under that task file's `Primary authorities` and
     `Secondary context`

## Authority Hierarchy

For execution and review, use this order:

1. assigned task file
2. task-linked `Primary authorities`
3. task-linked `Secondary context`
4. matching role file
5. this protocol
6. general repo docs

Hard rules:

- task-specific overrides beat generic redesign defaults
- `Not authoritative` references must not be used as fallback, tie-breaker, or
  reinterpretation guidance
- generic docs must never force a worker or reviewer to reinterpret a
  task-local exception

## Task Contract Rule

The assigned task file is the execution contract.

A fresh implementer or reviewer should be able to execute from:

- the task file
- the task-linked authorities it names
- the role file for workflow behavior

If the task file is missing critical execution context or its authority stack
is contradictory, stop and mark the task `blocked` instead of guessing from
generic docs.

## Human Handoff Rule

Whenever a meaningful step finishes, end with:

- whether Serhii needs to do anything
- the exact next action
- the shortest valid command, click flow, or reply

Always use the explicit format:

- `What I need from you: ...`

If nothing is needed:

- `What I need from you: nothing right now.`

## Branch Model

- `master` is the integration branch
- use one active task branch at a time
- workers and reviewers use the same task branch sequentially
- agents manage branch creation and checkout themselves
- workers do not commit directly to `master`

Default sequence:

1. coordinator works on `master`
2. implementer creates or switches to `codex/Txx-...`
3. implementer commits on that task branch
4. reviewer checks that same task branch
5. coordinator switches back to `master` and merges the reviewed task branch

Branch-local task-file edits are authoritative while the task is active. The
`master` copy may lag until merge.

## Command Workflow

### `pick task`

Use this when choosing work.

1. confirm you are on `master`
2. read the plan and queue state
3. select the first task that is:
   - `todo`
   - dependency-complete
   - not blocked by another unfinished task
   - not overlapping with another claimed write scope
4. mark it `claimed`
5. reply with:
   - task ID/title
   - why it is ready
   - worker chat first message and branch expectation
   - write scope
   - verification gate
   - next command: `do`

Do not implement yet.

### `do`

Use this when preparing execution.

1. re-read the task file
2. make sure the task passes the readiness gate:
   - a fresh implementer can execute from the task file alone
   - authority order is explicit
   - non-goals are explicit
   - known traps are explicit
   - review focus is task-specific
   - expected ownership/FSD shape is explicit where relevant
   - generic docs do not contradict the task-local brief
3. if needed, patch the task file before handoff
4. create or switch to the task branch
5. change status to `in_progress`
6. reply with:
   - exact branch in use
   - recommended model/effort pair
   - optional cheaper fallback when safe
   - required tests
   - next command: `start`

Do not implement yet.

### `start`

Use this when executing.

1. re-read the task file
2. work only inside the assigned task branch
3. implement only inside the declared write scope
4. follow the task file's authority order exactly
5. run the required verification gate
6. update the task file with branch, file/test metadata, and the handoff note
7. commit with the task ID in the subject
8. hand off to review on the same branch

## Status Model

- `todo` = not reserved
- `claimed` = reserved, not yet executing
- `in_progress` = approved and actively being worked
- `blocked` = cannot continue safely
- `done` = verified and committed

## Ownership Rules

Only the coordinator edits:

- `ARCHITECTURE.md`
- `APP_IMPLEMENTATION_PLAN.md`
- shared architectural decisions
- final task-level action dispositions after review

Workers edit:

- owned code or docs inside scope
- their own task file

Reviewer may edit:

- the active task branch
- the worker task file
- bounded fixes required for review

## Run/Support Boundary

If Serhii asks an agent to run the documented local app flow for testing or
support, the agent may do operational steps such as:

- env setup
- Docker startup
- migrations
- sync
- starting the dev server

This does not authorize silent repo fixes.

If the documented flow fails because the repo or docs are broken:

- stop at the first real failure point
- report the exact command or stage that failed
- do not start debugging or patching unless Serhii explicitly asks to fix it

## Reviewer Flow

1. read the task file first and treat it as the review contract
2. switch to the finished task branch if needed
3. review against the task file first, then the task-linked authorities
4. check:
   - scope discipline
   - required verification
   - obvious regressions
   - whether meaningful implementation choices stayed aligned with
     `ARCHITECTURE.md` and task scope
   - whether the implementer followed the declared authority stack
5. make small bounded fixes when helpful
6. rerun the required review verification
7. update the task file with:
   - `Review result`
   - `Reviewer`
   - `Review tests run`
   - `Merge status`
   - `Architecture note`
   - `Coordinator notes review`
8. return `merge ready` or `blocked`

If the result looks plausible under generic docs but violates the task file,
block it.

## Coordinator Rules

Coordinator owns task readiness before execution starts.

Before sending a worker into `do`, make sure the task file already contains:

- clear goal and success criteria
- explicit authority order
- task-local overrides when they beat generic docs
- non-goals and known traps
- expected ownership shape where structure matters
- task-specific review focus

If any of that is missing, fix the task file first.

After review, coordinator:

1. reads reviewer output and coordinator notes
2. decides which follow-ups change future tasks, ordering, docs, or
   architecture
3. promotes accepted follow-ups into the future task or plan instead of
   relying on memory alone
4. merges only when the task is truly `merge ready`
5. updates the task file with:
   - `Coordinator final review`
   - `Actions taken`
   - `Actions ignored`

## Actions Disposition Rule

- `Actions taken` means concrete repo or backlog changes actually made now
- `Actions ignored` means reviewed observations consciously not applied now
- preserving a note by itself does not count as an action taken

## Required Task File Fields

Keep these fields current:

- `Status`
- `Owner`
- `Task type`
- `Dependencies`
- `Write scope`
- `Recommended execution model`
- `Required verification`
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

## Commit Format

Use the task ID in the subject, for example:

- `T30 Add dashboard summary routes and application service`
- `T44 Final documentation cleanup`

## Model Rule

Task-file recommendations are defaults, not hard limits. Recommend the best-fit
model/effort pair for the real task shape at execution time.

## Stop Conditions

Stop and mark `blocked` if:

- a dependency is not really done
- write scope is no longer isolated
- schema, auth, or contract changes spill outside task scope
- required tests fail in a way that points to an architectural conflict

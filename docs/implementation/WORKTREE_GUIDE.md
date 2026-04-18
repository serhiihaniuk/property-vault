# Branch Workflow Guide

This repo currently uses plain git branches and one shared checkout.

We are not using parallel worktrees as the default workflow.

Agents manage branch creation and checkout themselves.
Serhii does not need to manually switch branches during the normal flow.

## Why branches only

The branch-only flow is simpler in the current Codex UI:

- no duplicate checkouts to keep in sync,
- no branch-already-used worktree errors,
- no reviewer handoff confusion across multiple folders,
- one clear path from implementation to review to merge.

If parallel execution becomes necessary later, update the protocol first
instead of improvising a worktree setup mid-task.

## Mental model

Think in three phases, not three checkouts:

1. `main` for coordination and merge
2. one task branch for implementation
3. that same task branch for review

Only one task branch should be active at a time.

## Recommended flow

### 1. Keep `main` for coordination

Use `main` for:

- reading plans,
- picking tasks,
- recording final coordinator decisions,
- merging reviewed work.

Before coordinator actions such as `pick task` or `merge latest reviewed task`,
the coordinator should switch the checkout back to `main`.

### 2. Let the active role create or switch to one task branch

For implementation, the implementer should create or switch to a task branch
such as:

```powershell
git switch -c codex/T10-package-vault
git switch -c codex/T11-package-db
git switch -c codex/T30-dashboard
```

If the branch already exists, switch to it instead:

```powershell
git switch codex/T10-package-vault
```

Use task IDs in branch names so chats, task files, and commits stay aligned.

### 3. Implement on the task branch

The implementer should:

- work only on the task branch,
- update only the owned task file,
- commit on that same task branch,
- never merge directly into `main`.

Because this is the same checkout, branch switches usually reuse the existing
`node_modules`.

If this checkout is fresh or missing dependencies:

- run a real local install here, usually `npm install`,
- do not symlink or junction `node_modules` from another checkout.

### 4. Review on the same task branch

Recommended flow:

1. coordinator picks the task on `main`
2. implementer creates or switches to `codex/Txx-...`
3. implementer finishes and commits on `codex/Txx-...`
4. reviewer opens for that task and switches to the same branch if needed
5. reviewer makes bounded fixes if needed
6. reviewer reruns verification
7. reviewer returns `merge ready` or `blocked`
8. coordinator switches back to `main` and merges the reviewed task branch

No dedicated review worktree is required in the default flow.

### 5. Merge back and clean up

After review succeeds:

```powershell
git switch main
git merge --ff-only codex/T10-package-vault
git branch -d codex/T10-package-vault
```

If reviewer made fixes on the task branch, merge that same branch.

## Branch visibility from `main`

Task-file edits made on a task branch do not automatically appear on `main`
until merge.

So when coordinating from `main`:

- the task branch copy is the live source of truth,
- `main` may still show stale task status,
- branch switching is handled by the active role, not by Serhii,
- do not pick another task while one task branch is still active and unmerged.

## Rules

- one active task branch at a time
- no direct worker commits to `main`
- reviewer verifies the same task branch
- coordinator merges after final review
- if review reveals architecture drift, stop and report instead of patching
  blindly

## Good branch names

Use task IDs in branch names:

- `codex/T10-package-vault`
- `codex/T11-package-db`
- `codex/T20-web-fsd`
- `codex/T30-dashboard`

If the Codex UI creates a slightly different but still task-identifiable branch
slug, use the actual checked-out branch in task-file handoffs.

## Good chat names

Use task IDs in chat names too. In the Codex UI, the first message usually
drives the chat name.

Good examples:

- `Coordinator queue`
- first message: `implementator T10 package vault`
- `T10 package vault`
- first message: `reviewer T10 branch codex/T10-package-vault`
- `Review T10`
- `T22 route handlers`

Avoid generic names like:

- `worker`
- `spawn worker`
- `reviewer`
- `next task`

The rule of thumb is simple:

- coordinator chat may stay generic,
- worker and reviewer chats should be task-first.

Good pairings:

- chat: `T22 route handlers`
- branch: `codex/T22-rest-route-handlers`

- chat: `Review T22`
- branch reviewed: `codex/T22-rest-route-handlers`

## One-task-at-a-time rule

Do not start another implementation task while the current task branch is:

- still being coded,
- waiting for review,
- blocked and not yet resolved,
- reviewed but not yet merged or abandoned.

This workflow is intentionally sequential.

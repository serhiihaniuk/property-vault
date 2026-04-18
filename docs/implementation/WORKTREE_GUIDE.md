# Worktree Guide

This repo uses git worktrees to let multiple agents work in parallel without
sharing the same checkout.

## Why use worktrees

Without worktrees, parallel agents all edit the same working directory and step
on each other.

With worktrees:

- `main` stays clean as the integration line,
- each worker gets a separate checkout,
- each worker gets its own branch,
- a reviewer can verify completed work before coordinator merges it back into
  `main`.

## Mental model

Think of a worktree as another folder pointing at the same git repository.

You still have one repo history, but you can have multiple working folders at
once:

- one for coordination on `main`,
- one for `T10`,
- one for `T11`,
- one for `T30`,
- and so on.

Each worktree should have its own branch.

## Recommended flow

### 1. Keep the main checkout for coordination

Use the original repo folder for:

- reading plans,
- assigning tasks,
- checking status,
- merging reviewed work.

Avoid doing worker implementation directly on `main`.

### 2. Create one worktree per worker task

If you are using the Codex app button instead of manual git commands:

1. keep the coordinator chat on `main`,
2. start a fresh worker chat with a first message like
   `implementator T10 package vault`,
3. use the Codex worktree button to create or attach the task worktree.

That first message matters because the Codex UI uses it to name the chat.

If you are creating worktrees manually, use commands like:

Example:

```powershell
git worktree add ..\dabrowskiego-T10 -b codex/T10-package-vault
git worktree add ..\dabrowskiego-T11 -b codex/T11-package-db
git worktree add ..\dabrowskiego-T30 -b codex/T30-dashboard
```

This creates sibling folders:

- `..\dabrowskiego-T10`
- `..\dabrowskiego-T11`
- `..\dabrowskiego-T30`

Each folder is an isolated checkout for one agent.

Fresh worktrees are not dependency-ready by default.

Before verification in a worker worktree:

- run a real local install there, usually `npm install`,
- do not symlink or junction `node_modules` from another checkout,
- assume shared `node_modules` links are unsupported for Next.js/Turbopack
  work because they may point outside the worktree root.

### 3. Tell the worker agent which worktree it owns

A worker agent should:

- work only in its assigned worktree,
- update only its assigned task file,
- commit only on its assigned branch,
- never merge to `main` directly.

### 3a. Know where live task status lives

Task-file updates made inside a worker worktree do not automatically appear in
the `main` checkout.

So when coordinating from `main`:

- use `git worktree list` to see active workers,
- inspect the task file inside the active worker worktree if you need live
  status,
- do not assume the copy on `main` is current during execution.

### 4. Use a reviewer agent

Recommended flow:

1. worker picks task
2. worker does task in its worktree
3. worker commits task branch
4. coordinator prepares a dedicated review branch/worktree from the finished
   worker branch when needed
5. reviewer opens on that prepared review branch/worktree or is given an
   explicit `review branch ...` target
6. reviewer makes small fixes if needed
7. reviewer runs verification
8. reviewer hands `merge ready` or `blocked` back to coordinator
9. coordinator records final decisions and merges into `main`

This is a good setup because:

- workers move faster,
- reviewer has stronger model budget,
- `main` stays cleaner,
- you get a consistent quality gate while you are away.

### 4a. Pass work to reviewer cleanly

When the worker finishes:

- return to coordinator first,
- include the exact finished worker branch in the handoff text,
- let coordinator prepare a dedicated review branch/worktree when needed,
- then open the reviewer chat on that prepared review target.

Do not rely on the `main` task-file copy for finished worker status.

### 4b. Create a dedicated review worktree when needed

The Codex UI handoff flow creates a new branch from the current checkout. It
does not reliably express "create a reviewer branch from that finished worker
branch instead."

When that matters, coordinator should use a manual git worktree command such
as:

```powershell
git worktree add ..\dabrowskiego-review-T10 -b codex/review-t10 codex/T10-package-vault
```

Then point the reviewer chat at that prepared review worktree.

### 5. Merge back and clean up

After review and merge:

```powershell
git worktree remove ..\dabrowskiego-T10
git branch -d codex/T10-package-vault
```

## Rules

- one worker agent per worktree
- one main integration checkout
- no direct worker commits to `main`
- reviewer verifies and hands off
- coordinator merges after final review
- if review reveals architecture drift, stop and report instead of patching
  blindly

## Good branch names

When naming branches manually, use task IDs in branch names:

- `codex/T10-package-vault`
- `codex/T11-package-db`
- `codex/T20-web-fsd`
- `codex/T30-dashboard`
- `codex/review-t10`

This keeps task files, commits, and branches aligned.

If the Codex worktree button creates a slightly different branch slug, that is
fine as long as the task identity stays clear. Use the actual checked-out
branch in task-file handoffs.

## Good chat names

Use task IDs in chat names too. In the Codex UI, the first message usually
drives the chat name.

Good examples:

- `Coordinator queue`
- first message: `implementator T10 package vault`
- `T10 package vault`
- first message: `reviewer T10`
- review branch: `codex/review-t10`
- `T22 route handlers`
- `Review T22`

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

## When not to parallelize

Do not run tasks in parallel when they change:

- shared schema ownership,
- shared contracts,
- auth foundations,
- package boundaries.

Those should stay sequential and coordinated from the main checkout.

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
- a reviewer can verify and merge completed work back into `main`.

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

### 3. Tell the worker agent which worktree it owns

A worker agent should:

- work only in its assigned worktree,
- update only its assigned task file,
- commit only on its assigned branch,
- never merge to `main` directly.

### 4. Use a reviewer agent

Recommended flow:

1. worker picks task
2. worker does task in its worktree
3. worker commits task branch
4. reviewer checks that branch
5. reviewer makes small fixes if needed
6. reviewer runs verification
7. reviewer merges into `main`

This is a good setup because:

- workers move faster,
- reviewer has stronger model budget,
- `main` stays cleaner,
- you get a consistent quality gate while you are away.

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
- reviewer merges only after verification
- if review reveals architecture drift, stop and report instead of patching
  blindly

## Good branch names

Use task IDs in branch names:

- `codex/T10-package-vault`
- `codex/T11-package-db`
- `codex/T20-web-fsd`
- `codex/T30-dashboard`

This keeps task files, commits, and branches aligned.

## Good chat names

Use task IDs in chat names too.

Good examples:

- `Coordinator queue`
- `T10 package vault`
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

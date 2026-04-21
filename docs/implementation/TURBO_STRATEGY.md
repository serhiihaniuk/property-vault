# Turbo Strategy

This repo uses Turborepo to coordinate **workspace graph execution**, not to
replace the boring local bootstrap path.

## What Turbo owns

Turbo owns workspace-level tasks:

- `typecheck`
- `lint`
- `test`
- `build`
- filtered runs such as `--filter=@dabrowskiego/web`
- local task caching
- future CI-ready affected runs

The dependency graph comes from workspace manifests. If a workspace imports an
internal package, that dependency must be declared in its `package.json`.

## What Turbo does not own

Turbo does not own infrastructure bootstrap in this repo.

Keep these outside Turbo:

- root `.env` loading
- Docker Postgres startup
- Drizzle migrations
- vault sync bootstrap
- root `tools/` execution model
- package compilation into `dist/`

The root `npm run dev` flow stays boring on purpose:

1. bootstrap env and Postgres
2. migrate
3. sync canonical vault data
4. hand the web dev task to Turbo

## Source-workspace model

Internal packages stay as TypeScript source workspaces.

That means:

- no new `dist/` folders,
- no fake package build pipeline just to satisfy Turbo,
- `build` remains meaningful mainly for the real app artifact in `apps/web`,
- verification tasks (`typecheck`, `lint`, `test`, `openapi:check`) carry most
  of the package-level workload.

Internal package dependencies currently follow the repo's explicit version
style such as `0.1.0`.

Do not switch this repo to `workspace:*` specifiers unless local npm support is
verified first. This Turbo pass intentionally kept the repo-native manifest
style because the local environment rejected `workspace:*` with
`EUNSUPPORTEDPROTOCOL`.

## Command surface

Preferred root commands:

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:workspace`
- `npm run test:tools`
- `npm run build`
- `npm run check`

Meanings:

- `dev` = root bootstrap, then Turbo-driven workspace dev
- `typecheck` = root tools typecheck plus Turbo-owned workspace typecheck
- `lint` = Turbo-owned workspace lint
- `test:workspace` = Turbo-owned workspace tests
- `test:tools` = explicit root tool tests
- `test` = composed workspace tests plus tool tests
- `build` = Turbo-owned app build path
- `check` = repo verification meta-command for local and future CI reuse

## Task semantics

Use one task name for one meaning:

- `build` = real artifact-producing build
- `typecheck` = explicit static verification
- `lint` = real lint task, not a placeholder
- `test` = real workspace-level test task
- `openapi:check` = generated-contract freshness check

Avoid package-local `build` scripts that only proxy `typecheck`.

## Filtered runs

Use filtered Turbo runs when the target is a real consumer surface, especially
the app:

```powershell
npx turbo run build --filter=@dabrowskiego/web
npx turbo run typecheck --filter=@dabrowskiego/web
```

These filtered runs should still pull in the real upstream workspace graph
through declared internal dependencies.

## Cache and CI-ready posture

This repo is currently **local-first and CI-ready**:

- local Turbo cache should work now,
- root scripts should already map cleanly to future CI steps,
- affected-run usage should be possible later without changing task ownership,
- remote cache is intentionally deferred until CI/service wiring exists.

CI-ready here means:

- no manual root prebuild compensation is required,
- workspace graph truth lives in manifests,
- Turbo dry runs show the real dependency edges,
- future CI can adopt Turbo commands and `--affected` without redesigning the repo.

Typical future CI commands should look like:

```powershell
npx turbo run typecheck lint test --affected
npx turbo run build --filter=@dabrowskiego/web --affected
```

# Local Docker Bootstrap

This flow keeps local app startup boring and explicit:

- one Postgres container,
- one root `.env`,
- a root `npm run dev` entrypoint that loads the root `.env` for the web
  process,
- Drizzle migrations against a blank database,
- the existing Next.js app shell on `http://localhost:3000`.

## Prerequisites

- Docker Desktop is running.
- Node.js `22.6+` and `npm` are installed.
- Workspace dependencies are already installed with `npm install`.

## 1. Create the local env file

Copy the committed example file and then replace the placeholder auth secret:

```powershell
Copy-Item .env.example .env
```

Important values in `.env`:

- `DATABASE_URL` points Drizzle and the future app server at local Postgres.
- `BETTER_AUTH_SECRET` is required by `@dabrowskiego/auth`.
- `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` are set for local web work at `http://localhost:3000`.
- `npm run dev` reads this root `.env` before it starts the web workspace, so
  local web startup no longer depends on an ignored `apps/web/.env.local`.

## 2. Start Postgres in Docker

```powershell
npm run docker:db:up
```

The command waits for the Postgres healthcheck to report ready before it
returns, so the next migration step can run immediately after startup.

Useful companion commands:

```powershell
npm run docker:db:logs
npm run docker:db:down
npm run docker:db:reset
```

- `docker:db:down` stops the container but preserves the named volume.
- `docker:db:reset` removes the volume so the next boot is a truly blank database.

## 3. Prove migrations work on a blank database

Run this whenever you want to verify the local bootstrap path from scratch:

```powershell
npm run docker:db:reset
npm run docker:db:up
npm run db:migrate
```

This exercises the generated Drizzle SQL against an empty containerized
Postgres database and catches missing schema bootstrap statements such as
`CREATE SCHEMA IF NOT EXISTS`.

## 4. Start the web app from the root scripts

```powershell
npm run dev
```

Open `http://localhost:3000`.

This root entrypoint now does two explicit things before the Next.js dev server
comes up:

- it loads the root `.env` into the web process environment,
- it lets the existing `apps/web` `predev` hook rerun `npm run db:migrate`.

If the required web env vars are missing, `npm run dev` now fails fast with a
repo-owned message instead of depending on hidden local setup knowledge.

## 5. Load real local property data when live verification matters

The web app reads Postgres, not `vault/` files directly. After migrations, load
the local derived data when you want meaningful dashboard/document verification:

```powershell
npm run vault -- sync --rebuild
```

Use plain `npm run vault -- sync` on incremental runs when you do not need to
rebuild the derived `vault` schema from scratch.

## 6. Shut everything down

When you are done:

```powershell
npm run docker:db:down
```

# Local Docker Bootstrap

This flow keeps local app startup boring and explicit:

- one Postgres container,
- one root `.env`,
- a root `npm run dev` entrypoint that loads the root `.env`, starts Docker
  Postgres, runs migrations, syncs canonical vault data, and then starts the
  web process,
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

## 2. Start the full local stack

```powershell
npm run dev
```

The root `dev` script now runs the local prerequisites in this order:

- loads the root `.env`,
- validates `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`,
- starts Docker Postgres with `docker compose up -d --wait postgres`,
- applies Drizzle migrations,
- runs `npm run vault -- sync`,
- starts the Turbo-owned workspace dev task for `@dabrowskiego/web`.

If Docker Desktop is not running, Docker is not installed, or a required env
var is missing, the command stops at the real failure point and prints that
error instead of relying on hidden local setup knowledge.

Open `http://localhost:3000` after the web server is ready.

Useful companion commands:

```powershell
npm run docker:db:logs
npm run docker:db:down
npm run docker:db:reset
```

- `docker:db:down` stops the container but preserves the named volume.
- `docker:db:reset` removes the volume so the next boot is a truly blank database.

Workspace verification commands such as `npm run typecheck`, `npm run lint`,
`npm run test`, and `npm run build` are Turbo-owned and are described in
`docs/implementation/TURBO_STRATEGY.md`.

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

## 4. Shut everything down

When you are done:

```powershell
npm run docker:db:down
```

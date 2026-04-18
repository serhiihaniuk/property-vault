# Local Docker Bootstrap

This flow keeps local app startup boring and explicit:

- one Postgres container,
- one root `.env`,
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

## 4. Start the web app

```powershell
npm run dev
```

Open `http://localhost:3000`.

At the current implementation stage, the web app is still the early shell, but
using the same `.env` now keeps later auth and data tasks on the same local
Postgres setup.

## 5. Shut everything down

When you are done:

```powershell
npm run docker:db:down
```

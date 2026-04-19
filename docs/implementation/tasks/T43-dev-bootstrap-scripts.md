# T43 — Dev/bootstrap scripts

- Status: `todo`
- Owner: `unassigned`
- Goal: Make local developer bootstrap and run flows simple.
- Dependencies: `T16`, `T20`, `T21`, `T22`, `T23`
- Write scope: root scripts, docs, and local setup helpers
- Recommended execution model: `gpt-5.4-mini / low`
- Wave group: `hardening-d`
- Required verification: `standard`
- Completion signal: local bootstrap/run commands are documented and reproducible from clean `master`, including the web app env-loading path.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Observation: the current root `.env` alone was not sufficient for local web startup in the Turbo/Next dev flow; the live web process needed `apps/web/.env.local` or an equivalent explicit env-loading strategy before dashboard API routes could see `DATABASE_URL`.
  - Why it matters: the documented bootstrap path could look successful through Docker, migrations, and sync while the web app still failed at runtime with missing DB env in route execution.
  - Suggested follow-up: T43 should make the local run path boring and explicit from `master`, either by standardizing app-local env files or by adding a root startup script that exports env to the web process.
  - Urgency: `soon`
- Next handoff note: prefer boring explicit scripts over clever wrappers



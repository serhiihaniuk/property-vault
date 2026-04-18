# T16 — Add local Docker bootstrap

- Status: `done`
- Owner: `coordinator`
- Goal: Make local Postgres + app startup reproducible.
- Dependencies: `T11`, `T12`
- Write scope: Docker/local bootstrap files and docs only
- Worker branch: `codex/T16-local-docker-bootstrap`
- Recommended execution model: `gpt-5.4-mini / medium`
- Wave group: `core-d`
- Required verification: `standard`
- Completion signal: local developer can boot the app stack with documented commands.
- Files changed:
  - `.env.example`
  - `docker-compose.yml`
  - `README.md`
  - `docs/local-docker-bootstrap.md`
  - `docs/implementation/tasks/T16-local-docker-bootstrap.md`
  - `package.json`
- Contracts changed: none in `packages/contracts`
- Tests run:
  - `docker compose version`
  - `docker compose config`
  - `npm run docker:db:reset`
  - `npm run docker:db:up`
  - `npm run db:migrate`
  - `docker compose exec -T postgres psql -U postgres -d dabrowskiego -c "select schema_name from information_schema.schemata where schema_name in ('app', 'auth', 'vault') order by schema_name;"`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run docker:db:down`
- Coordinator notes:
  - Carry-forward from `T11`: local bootstrap should exercise migrations
    against a blank Postgres database and catch missing explicit schema
    bootstrap statements.
  - Expected outcome: documented startup from empty local Postgres proves the
    multi-schema migration path really works.
- Next handoff note: start a reviewer chat on `codex/T16-local-docker-bootstrap` and say `reviewer T16 branch codex/T16-local-docker-bootstrap`



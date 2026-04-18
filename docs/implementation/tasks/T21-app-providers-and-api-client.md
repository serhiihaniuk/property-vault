# T21 — Add app providers and API client

- Status: `done`
- Owner: `Codex implementer`
- Goal: Wire auth, theme, query, and API-client providers into the web app.
- Dependencies: `T12`, `T13`, `T20`
- Write scope: `apps/web/src/shared/**`, provider setup only
- Worker branch: `codex/T21-app-providers-and-api-client`
- Recommended execution model: `gpt-5.4-mini / medium`
- Wave group: `web-shell`
- Required verification: `standard`
- Completion signal: providers are wired and app shell can consume the API client cleanly.
- Files changed:
  - `apps/web/app/layout.tsx`
  - `apps/web/app/providers.tsx`
  - `apps/web/package.json`
  - `apps/web/src/shared/api/api-client-provider.tsx`
  - `apps/web/src/shared/api/client.test.ts`
  - `apps/web/src/shared/api/client.ts`
  - `apps/web/src/shared/api/query-client.ts`
  - `apps/web/src/shared/auth/auth-client-provider.tsx`
  - `apps/web/src/shared/auth/client.ts`
  - `apps/web/src/shared/config/public-env.test.ts`
  - `apps/web/src/shared/config/public-env.ts`
  - `apps/web/src/shared/providers/app-providers.tsx`
  - `apps/web/tsconfig.json`
  - `docs/implementation/tasks/T21-app-providers-and-api-client.md`
  - `package-lock.json`
- Contracts changed: none in `packages/contracts`
- Tests run:
  - `npm run typecheck`
  - `npm run lint`
  - `node --experimental-strip-types --test apps/web/src/shared/config/public-env.test.ts apps/web/src/shared/api/client.test.ts`
  - `npm run --workspace @dabrowskiego/web build`
- Next handoff note: start a reviewer chat on this branch and say `reviewer T21 branch codex/T21-app-providers-and-api-client`.



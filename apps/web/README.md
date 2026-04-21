# Web Workspace

This workspace contains the deployed Next.js App Router application for
Property Vault.

For product work here, also read:

- `ARCHITECTURE.md`
- `docs/implementation/UI_PLAYBOOK.md`

## Current shape

- `app/` owns routing, layouts, and providers
- `src/views/` owns route-level screens
- `src/widgets/` owns screen sections
- `src/features/` owns bounded interactions
- `src/entities/` owns stable domain nouns
- `src/shared/` owns cross-app UI, hooks, auth, API, config, and helpers

## Shared UI and shadcn

- shadcn config lives in `components.json`
- shared primitives live in `src/shared/ui`
- aliases such as `ui`, `components`, `lib`, and `hooks` resolve into
  `src/shared/**`
- add new primitives in `src/shared/ui` and keep them compatible with the
  token system in `app/globals.css`

Example import:

```tsx
import { Button } from "@/src/shared/ui/button";
```

# Branch Workflow Guide

The filename is historical. This file is now a short compatibility note, not a
second full protocol.

The live workflow is branch-only:

- `master` is the integration branch
- one task branch is active at a time
- implementer and reviewer use that same task branch sequentially
- coordinator switches back to `master` for queue actions and merges

Canonical branch/workflow rules now live in:

- `docs/implementation/AGENT_PROTOCOL.md`
- `APP_IMPLEMENTATION_PLAN.md`

Read this file only when you want the short branch-only mental model. It is no
longer required in the default startup path.

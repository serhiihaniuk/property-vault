# Property Vault

Property Vault is a local-first knowledge base for one property. It stores
documents, emails, AI extraction records, notes, and reports in a layout that
Codex can operate safely.

Canonical data belongs under `vault/`. Derived data belongs under `index/` and
`reports/`. The derived folders can be rebuilt from canonical files and should
not be committed.

## Current Status

The design and implementation plan are ready. v1 implementation starts with the
local vault core, then PDF rendering, record schemas, manual extraction, Gmail
import, reports, anomalies, and backup verification.

## Requirements

- Node.js 22.6 or newer
- npm
- Windows PowerShell for the initial local workflow

## Planned Commands

```text
npm install
npm run vault -- setup
npm run vault -- validate
npm run vault -- reindex
npm run vault -- register-document "zawiad po zebraniu.pdf"
npm run vault -- search <query>
npm run gmail -- auth
npm run gmail -- sync
```

Some commands are placeholders until the implementation phases add the matching
TypeScript files.

## Privacy

This repo will contain private property data once ingestion starts. Do not
commit `vault/`, `index/`, `reports/`, OAuth credentials, Gmail tokens, or raw
documents. Do not copy raw passwords into records, notes, reports, logs, or
answers.

## Key Documents

- `DESIGN.md` contains the system design and data model.
- `ARCHITECTURE.md` contains the approved app/system architecture.
- `APP_IMPLEMENTATION_PLAN.md` contains the detailed app build backlog.
- `IMPLEMENTATION_PLAN.md` contains the phased build plan.
- `AGENTS.md` is the startup guide for future Codex sessions.

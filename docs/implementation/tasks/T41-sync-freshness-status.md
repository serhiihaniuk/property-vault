# T41 — Sync freshness and status surfaces

- Status: `todo`
- Owner: `unassigned`
- Goal: Surface data freshness and sync status in the app.
- Dependencies: `T15`, `T30`, `T31`, `T32`
- Write scope: application, contracts, and UI surfaces for sync status only
- Recommended execution model: `gpt-5.4 / high`
- Wave group: `hardening-b`
- Required verification: `strong`
- Completion signal: app clearly shows last sync/freshness state with tested behavior.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T15`: sync freshness/status currently lives in `app.sync_state`, while append-only run history still lives in `vault.sync_runs`.
  - Why it matters: this task should decide whether the split remains the intended long-term boundary for operational status versus audit history, or whether sync metadata should be consolidated before the UI and application surfaces harden around it.
  - Expected outcome: `T41` should either keep the split explicitly and build on it, or migrate toward one canonical operational metadata location with the contract/application/UI surfaces updated consistently.
- Next handoff note: keep freshness logic distinct from business-domain slices



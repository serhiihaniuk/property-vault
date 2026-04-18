# Property Vault: Compact Implementation Plan

**Status:** In progress  
**Last updated:** 2026-04-18 10:22 Europe/Warsaw  
**Workspace:** `C:\Users\Serge\Desktop\dabrowskiego`

This file is intentionally compact. Historical detail lives in git history and
`DESIGN.md`; keep this file as a current handoff/checklist only.

## Current State

- Tooling: npm, Node >= 22.6, TypeScript strict check available via
  `npm run typecheck`.
- Core vault: init/register/validate/reindex/sql/search/context/list-work,
  records, notes, FTS, Gmail import, PDF inspect/render, backup verify, inbox
  report, anomaly detection.
- Current counts from `npm run vault -- context --json`:
  - documents: 32
  - records: 30
  - emails: 30
  - open anomalies: 30
  - extraction work: 0
  - Gmail messages seen total: 97
- `npm run vault -- reindex --json` restores 32 documents, 193 source
  observations, 30 emails, 60 email attachments, 2 asset tags, 30 records,
  30 notes, and 30 open anomalies.
- Non-record logo PNGs are tracked in ignored `vault/document-tags.json` as
  `asset_logo`, so documents > records is expected: 32 documents = 30 records +
  2 logo assets.
- Full Locator Gmail backfill has run. Gmail token is private under
  `C:\Users\Serge\.config\dabrowskiego\`.

## Guardrails

- Never commit `vault/`, `index/`, `reports/`, `node_modules/`, credentials,
  tokens, or extracted private source files.
- Commit after each completed task.
- Keep canonical records normalized enough for UI/query use; preserve human
  source wording in `category_original`.
- Use `apply_patch` for manual edits.
- Verify code changes with:

```powershell
npm run typecheck
npm test
npm run vault -- validate --strict --json
```

## Financial Model

Working assumption from Serhii: regular scheduled monthly charges are paid on
time unless evidence says otherwise.

For 2025, monthly schedule verification found:

- scheduled monthly charges: 5,160.33 PLN
- shared-property advances from monthly schedule: 1,536.93 PLN
- 2025 shared-property settlement also shows advances: 1,536.93 PLN
- shared-property result: 25.75 PLN due
- H1 media settlement: 75.39 PLN overpayment
- H2/annual media settlement: 754.66 PLN underpayment
- net 2025 settlement burden assuming regular monthly payments: 705.02 PLN due
- estimated 2025 economic cost: 5,865.35 PLN

Payment proof still needs bank transactions, dashboard account history, or an
admin ledger. The current assumption is not proof of actual payment.

## Financial Category Contract

Dashboard-facing records should use stable keys. Category normalization now runs
during `put-record` and when canonical records are read for `reindex`.

Monthly charge card keys:

- `shared_property_advance`
- `cold_water_and_sewage`
- `hot_water_heating`
- `central_heating_energy`
- `ordered_heating_power`
- `renovation_investment_fund`
- `municipal_waste`
- `e_kartoteka_access`

Settlement/ledger groups:

- `media_settlement_*`
- `shared_property_*`
- `late_payment_interest`
- `owner_ledger`

Normalization handles known aliases and source-label variants, including Polish
order changes such as `woda ciepla`, `ciepla woda`, and `podgrzanie wody`.

## Recent Commits

- `1937574` Note financial category normalization.
- `4b417ac` Normalize financial row categories.
- `9bdcc58` Fix TypeScript check errors.
- `0db190f` Harden reindex restore coverage.
- `33646e0` Mark broader backfill queue complete.

Use `git log --oneline` for older extraction history.

## Next Work

1. Add a dashboard JSON command/API contract for one month, using current
   `monthly_charges` records and normalized `financial_rows`.
2. Add a yearly reconciliation JSON command for 2025-style summaries:
   scheduled charges, settlements, assumed paid status, net extra due, and
   source hashes.
3. Implement financial anomaly rules:
   `FEE_DELTA_LARGE`, `MISSING_PERIOD`, category added/removed, settlement
   mismatch, interest charged, account underpayment.
4. Add fixture records for `media_settlement`, `interest_note`, and
   `account_statement`.
5. Confirm voting outcomes for pending resolutions from 2025/2026 meeting
   notices and DACH BUD ballot.
6. Add restore workflow and backup-warning gates on top of hardened `reindex`.
7. Later: build a Next.js UI over dashboard/reconciliation JSON or read-only
   SQLite helpers.

## Start Commands

```powershell
npm run vault -- context --json
npm run vault -- list-work --kind extraction --json
npm run vault -- list-work --kind anomaly --json
git status --short
```

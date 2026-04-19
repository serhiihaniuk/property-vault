# T32 — Year reconciliation + anomalies

- Status: `todo`
- Owner: `unassigned`
- Goal: Deliver yearly review and anomaly surfaces for the first financial slice.
- Dependencies: `T21`, `T22`, `T23`, `T34`
- Write scope: reconciliation/anomaly contracts, application services, routes, widgets
- Worker branch: `codex/T32-financials`
- Recommended execution model: `gpt-5.4 / high`
- Wave group: `slice-financials`
- Required verification: `strong`
- Completion signal: yearly reconciliation and anomalies render from real data using the effective carried-forward month-by-month charge schedule model and pass targeted tests.
- Files changed: none yet
- Contracts changed: none yet
- Tests run: none yet
- Coordinator notes:
  - Carry-forward from `T34`: yearly reconciliation must compare actuals against the effective month-by-month schedule in force for each month, not only against months that had an explicit charge-change document.
  - Why it matters: months between charge updates still have a valid schedule, and the yearly story will be wrong if those inherited months disappear from the comparison baseline.
  - Expected outcome: reconciliation uses the carried-forward effective schedule timeline while preserving provenance back to the source schedule document active for each month.
  - Carry-forward from `T34`: decide explicitly whether reconciliation stays year-to-date/current-month or introduces a projection horizon for months beyond the latest sync runtime month.
  - Why it matters: `T34` deliberately expands schedules through the current sync month only, so any forward-looking horizon after that point should be a product decision, not an accidental assumption.
- Next handoff note: preserve consistent financial category, effective schedule, and provenance handling



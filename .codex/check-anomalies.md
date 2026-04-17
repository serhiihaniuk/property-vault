# Check Anomalies

## When to run

Run after new documents are imported, records are extracted, or before writing
the user inbox report.

## Inputs

- Rebuilt or current SQLite index.
- Current records, financial rows, dates, resolutions, and sensitive findings.

## Steps

1. Run deterministic anomaly detection.
2. Avoid duplicate open anomalies.
3. Review warnings for source-backed explanations.
4. Do not acknowledge or resolve anomalies unless the user explicitly asks.

## Outputs

- Open anomalies in the derived index.
- Inputs for `reports/inbox.md`.

## Failure modes

- Missing records.
- Hash drift.
- Corrupt source observations.
- Sensitive credentials detected.

## Examples

```text
npm run vault -- detect-anomalies
npm run vault -- list-work --kind anomaly
```

# Write Inbox

## When to run

Run after sync, extraction, and anomaly detection when something changed or
needs the user's attention.

## Inputs

- Current vault context.
- New documents.
- Pending extraction work.
- Open anomalies.
- Pending votes.
- Upcoming deadlines.
- Questions for the user.

## Steps

1. Build a concise private report.
2. Include safe local citations.
3. Redact sensitive values.
4. Archive previous report snapshots when implemented.
5. Write `reports/inbox.md` through the vault library.

## Outputs

- `reports/inbox.md`.

## Failure modes

- Report would expose raw credentials.
- Required index tables are missing.
- No meaningful changes since the last report.

## Examples

```text
pnpm vault write-inbox
```

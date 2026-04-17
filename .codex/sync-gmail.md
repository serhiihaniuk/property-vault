# Sync Gmail

## When to run

Run after Gmail OAuth is configured and the local vault core is stable.

## Inputs

- Gmail readonly OAuth credentials outside the repo.
- Known Locator senders from `vault/state.json`.
- Optional backfill date.

## Steps

1. Use the direct Gmail REST client.
2. Query messages from known Locator senders with the configured lookback.
3. Store message metadata and body through the vault library.
4. Fetch raw attachment bytes and register them through the vault library.
5. Continue on per-message or per-attachment failures.
6. Record failures for anomaly detection.

## Outputs

- Canonical email files under `vault/emails/`.
- Canonical documents under `vault/documents/`.
- Source observations in `vault/sources.jsonl`.

## Failure modes

- OAuth missing or revoked.
- Gmail rate limit.
- Attachment fetch failure.
- MIME type mismatch.
- Duplicate message or duplicate attachment.

## Examples

```text
pnpm gmail sync
pnpm gmail sync --backfill-from 2023-01-01
```

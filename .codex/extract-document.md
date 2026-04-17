# Extract Document

## When to run

Run when `npm run vault -- list-work --kind extraction` reports documents with missing,
failed, or outdated records.

## Inputs

- Document hash.
- Rendered page images or extracted text.
- `tools/schemas/record.v1.json`.
- Email context, if available.

## Steps

1. Skip known non-document assets.
2. Inspect available text and rendered pages.
3. Produce a record matching the current JSON Schema.
4. Redact sensitive credentials.
5. Validate the record.
6. Store the record and note through vault commands.
7. Reindex or search to verify the document is discoverable.

## Outputs

- `vault/records/<hash>.json`.
- `vault/notes/<hash>.md`.
- Indexed search rows.

## Failure modes

- Page rendering missing.
- Low-confidence extraction.
- Schema validation failure.
- Sensitive data appears in raw form.

## Examples

```text
npm run vault -- validate-record tmp/record.json
npm run vault -- put-record <hash> tmp/record.json
npm run vault -- put-note <hash> tmp/note.md
```

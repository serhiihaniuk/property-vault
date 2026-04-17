# Answer Question

## When to run

Run when the user asks about documents, payments, charges, resolutions,
deadlines, anomalies, or property history.

## Inputs

- User question.
- `pnpm vault context`.
- Search results, SQL results, records, notes, and source files.

## Steps

1. Classify the question as financial, timeline, document lookup, or qualitative.
2. Use SQL or structured records first for financial facts.
3. Use search, notes, and source files for qualitative questions.
4. Cite local paths or hashes.
5. State uncertainty when records are missing or conflicting.

## Outputs

- A concise answer with citations to local sources.

## Failure modes

- Missing extraction records.
- Conflicting source data.
- Question requires a document that has not been imported.
- Question asks for raw credentials or unsafe private disclosure.

## Examples

```text
pnpm vault search "uchwala"
pnpm vault sql --select "select * from financial_rows limit 10"
```

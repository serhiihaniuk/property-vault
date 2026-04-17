# Property Vault: Implementation Plan

**Status:** In progress
**Based on:** `DESIGN.md` draft v3
**Last updated:** 2026-04-17 17:50 Europe/Warsaw
**Owner:** Serhii

---

## 0. Implementation Progress

Legend:

- `[x]` implemented and tested in code.
- `[~]` partially implemented or implemented but not yet exercised against real
  user data.
- `[ ]` not implemented yet.

### Phase Status

| Phase | Name | Status | Notes |
| --- | --- | --- | --- |
| 0 | Project baseline | [x] | npm-based baseline, docs, ignores, runbooks, and scripts exist. |
| 1 | Vault core | [x] | Init, register, validate, reindex, SQL, records, notes, search, context, and extraction work listing exist. |
| 2 | PDF rendering | [~] | PDF inspection/rendering exist, generated tests pass, and a real Gmail-imported PDF rendered; the named sample PDF was not present. |
| 3 | Record schema | [~] | Schema, JSON Schema export, and basic tests exist; broader fixture families and total validations remain. |
| 4 | Manual extraction loop | [~] | 5 real records are stored; broader backfill leaves 25 documents in the extraction queue. Fixture families for media_settlement, interest_note, account_statement still missing. |
| 5 | Gmail import | [x] | OAuth, Locator listing, and a full historical backfill have run. |
| 6 | Reports and anomalies | [~] | Inbox report and initial anomaly rules exist; financial comparison anomaly rules remain. |
| 7 | Hardening | [~] | Backup create/verify exists and `validate --strict` passes after real import; restore workflow and backup-warning gates remain. |

### Latest Completed Commits

- `80006f6` Mark Gmail backfill complete in plan.
- `41f090e` Soften payment deadline anomaly wording.
- `a7d0e39` Fix email attachment storage to match design spec.
- `f8addd2` Update implementation plan: extraction queue cleared.
- `7a019b6` Add tag-document command and extract 3 Gmail documents.
- `fc17110` Add extraction handoff checkpoint.
- `f59f0d2` Mark real Gmail sync progress.
- `256a7a5` Add vault backup verification.
- `61299ba` Add inbox report generation.
- `ea8398e` Add vault context and extraction work listing.
- `e253122` Add record and note indexing.
- `a59724c` Add deterministic anomaly detection.
- `ff61206` Add Gmail sync importer.
- `384cf63` Switch project tooling to npm.

### Remaining High-Value Work

- Continue broader-backfill extraction queue; 25 documents remain after
  extracting `60bde281...`.
- Add fixture records for media settlements, interest notes, and account
  statements (monthly charges now covered by `732269...`).
- Implement remaining financial anomaly rules (FEE_DELTA, MISSING_PERIOD, etc.).
- Confirm voting outcomes for 6 pending uchwały from the March 2026 meeting notice.

### Current Handoff Checkpoint

Updated 2026-04-17 after payment-anomaly fix and one broader-backfill extraction.

#### Vault state

- Gmail authorization complete. Token at
  `C:\Users\Serge\.config\dabrowskiego\gmail-token.json`.
- Verified backup at
  `C:\Users\Serge\Desktop\dabrowskiego-backups\vault-2026-04-17.zip`.
- Full Locator backfill has run: 30 emails in the vault, 65 messages seen total,
  and 32 canonical documents.
- `npm run vault -- validate --strict --json` → `ok: true, errors: []`.
- `reports/inbox.md` up to date; 36 open anomalies.
- Current records: 5.
- Current extraction queue: 25 documents.
- New broader-backfill extraction completed this step:
  `60bde281...` blank municipal waste-fee declaration form (`service_notice`,
  `ok`).

#### Documents (6 total)

| Hash (prefix) | MIME | Type | Status |
| --- | --- | --- | --- |
| `6e9efc28...` | PDF | `shared_property_settlement` | `needs_review` |
| `732269777...` | PDF | `monthly_charges` | `ok` – opłaty kwiecień 2026, 537,75 zł, sum verified |
| `dce27d56...` | PDF | `service_notice` | `ok` – mycie garażu kwiecień 2026 |
| `0a50303e...` | PDF | `meeting_notice` | `needs_review` – 6 uchwał `pending_vote` |
| `f2dd30eb...` | PNG | — | tagged `asset_logo` |
| `80a272dc...` | PNG | — | tagged `asset_logo` (duplicate) |

#### Code changes this session

- Added `tagDocument()` to `tools/vault.ts` and `tag-document <hash> <tag>`
  to `tools/cli.ts` for marking non-document assets.
- Fixed `tools/gmail-sync.ts`: attachment bytes now go only to
  `vault/documents/<hash>.<ext>`. The importer previously also wrote
  duplicate raw files under `vault/emails/<id>/attachments/<file>`.
  New flow: bytes → `index/tmp/<id>-<n>.bin` → `registerDocument` → delete
  temp. `storeEmail` now writes `vault/emails/<id>/attachments.json` (JSON
  array of attachment metadata pointers) instead.
- Migrated existing 5 email dirs: generated `attachments.json` from SQLite
  and deleted the stale `attachments/` subdirectories.

#### Open items

- `PAYMENT_DEADLINE_UNCONFIRMED` - 2025 shared-property settlement result has
  a past payment date, but payment/booked status is unknown.
- `EXTRACTION_MISSING` - 25 documents from the broader Gmail backfill still
  need extraction or asset classification.

- `RESOLUTION_PENDING_VOTE` – 6 uchwały from 2026-03 meeting, voting started
  2026-03-21. Outcomes unknown; confirm with Serhii and update records.
- Fixture records for `media_settlement`, `interest_note`, `account_statement`
  still missing.
- Remaining financial anomaly rules (`FEE_DELTA`, `MISSING_PERIOD`, etc.)
  not yet implemented.

#### Pick up with

```powershell
npm run vault -- context --json
npm run vault -- list-work --kind extraction --json
npm run vault -- list-work --kind anomaly --json
```

Important: do not commit `vault/`, `index/`, or `reports/` contents.

---

## 1. Implementation Goal

Build v1 of the Property Vault as a Codex-operated local knowledge base.

The first implementation should make the repo usable for:

- manually registering local PDFs,
- rendering scanned PDFs into page images,
- storing AI extraction records and notes,
- rebuilding a SQLite index from canonical files,
- searching and answering questions with citations,
- syncing Locator Gmail messages through direct Gmail REST,
- producing `reports/inbox.md` for the user and future Codex automations.

The implementation must stay local-first and Node.js/TypeScript-only.

---

## 2. Phase Overview

| Phase | Name | Result |
| --- | --- | --- |
| 0 | Project baseline | Repo has package/scripts, ignores, docs, and folder creation. |
| 1 | Vault core | Documents, emails, records, notes, state, and SQLite index work. |
| 2 | PDF rendering | Scanned PDFs render to page images for Codex/vision extraction. |
| 3 | Record schema | Zod schema and JSON Schema are implemented and tested. |
| 4 | Manual extraction loop | Local sample documents can be registered, extracted, and searched. |
| 5 | Gmail import | Direct Gmail REST sync saves raw attachments despite MIME quirks. |
| 6 | Reports and anomalies | Inbox report and deterministic anomaly detection work. |
| 7 | Hardening | Tests, backup verification, validation, and runbooks are complete. |

Phases should be implemented in order. Later phases may add code, but they
should not rewrite earlier interfaces unless a test proves the interface is
wrong.

---

## 3. Phase 0: Project Baseline

### Files to create

- `package.json`
- `.gitignore`
- `README.md`
- `AGENT.md`
- `.codex/sync-gmail.md`
- `.codex/extract-document.md`
- `.codex/answer-question.md`
- `.codex/check-anomalies.md`
- `.codex/write-inbox.md`
- `tools/cli.ts`

### Work

- Create `package.json` from `DESIGN.md`.
- Add scripts:
  - `npm run vault -- ...`
  - `npm run gmail -- ...`
  - `npm run setup`
  - `npm run validate`
  - `npm run reindex`
  - `npm test`
- Add `.gitignore`:

```gitignore
vault/
index/
reports/
node_modules/
.lock
.env
```

- Add `AGENT.md` with instructions for new Codex chats:
  - read `DESIGN.md`,
  - run `npm run vault -- context`,
  - never copy raw passwords,
  - cite local sources,
  - use CLI wrappers for mutations.
- Add placeholder runbooks with the fixed sections from `DESIGN.md`.

### Acceptance

- [x] `npm install` succeeds.
- [x] `npm run vault -- --help` prints available command groups.
- [x] `npm run setup` can be wired later but the script exists.
- [x] Private folders are ignored by Git.

---

## 4. Phase 1: Vault Core

### Files to create

- `tools/vault.ts`
- `tools/db.ts`
- `tools/paths.ts`
- `tools/hash.ts`
- `tools/state.ts`
- `tools/types.ts`
- `tools/vault.test.ts`

### Work

Implement the canonical vault operations.

Core APIs:

```ts
vault.init(): Promise<void>;
vault.reindex(): Promise<void>;
vault.validate(): Promise<ValidationReport>;
vault.registerDocument(input: RegisterDocumentInput): Promise<RegisterDocumentResult>;
vault.registerEmail(input: RegisterEmailInput): Promise<{ isNew: boolean; path: string }>;
vault.putRecord(hash: string, record: VaultRecord): Promise<void>;
vault.putNote(hash: string, markdown: string): Promise<void>;
vault.putReport(name: string, markdown: string): Promise<void>;
vault.search(opts: SearchOptions): Promise<SearchResult[]>;
vault.sql<T>(query: string, params?: unknown[]): Promise<T[]>;
```

Canonical file writes:

- Documents go to `vault/documents/<sha256>.<ext>`.
- Email metadata goes to `vault/emails/<gmail-id>/`.
- Records go to `vault/records/<hash>.json`.
- Notes go to `vault/notes/<hash>.md`.
- Source observations append to `vault/sources.jsonl`.
- Mutable state writes atomically to `vault/state.json`.

SQLite tables:

- `documents`
- `document_sources`
- `emails`
- `email_attachments`
- `records`
- `financial_rows`
- `important_dates`
- `resolutions`
- `anomalies`
- `sync_runs`
- `fts_records`

Important behavior:

- `registerDocument` is idempotent by SHA-256.
- MIME is sniffed from bytes with `file-type`.
- `sources.jsonl` never receives duplicate source observations.
- `vault.sql` rejects non-`SELECT` statements.
- `reindex` drops and rebuilds `index/vault.db` from canonical files.

### CLI commands

Implement:

```text
npm run vault -- setup
npm run vault -- validate
npm run vault -- reindex
npm run vault -- register-document <path>
npm run vault -- put-record <hash> <record-json-path>
npm run vault -- put-note <hash> <note-md-path>
npm run vault -- search <query>
npm run vault -- sql --select "<SQL>"
npm run vault -- context
```

### Tests

- Same file registered twice creates one document.
- Same bytes with different filenames create one document and two sources.
- `reindex` rebuilds an equivalent DB.
- `vault.sql` rejects writes.
- `validate` detects missing canonical files.

### Acceptance

- [x] `npm run vault -- setup` creates `vault/`, `index/`, and `reports/`.
- [ ] `npm run vault -- register-document "zawiad po zebraniu.pdf"` stores one hashed PDF.
  The file was not present when attempted.
- [x] Re-running registration is a no-op except for safe source observation logic.
- [x] `npm run vault -- reindex` succeeds.

---

## 5. Phase 2: PDF Rendering

### Files to create

- `tools/pdf.ts`
- `tools/pdf.test.ts`

### Work

Implement scanned-first PDF handling.

Core APIs:

```ts
inspectPdf(pathOrBytes): Promise<{
  pageCount: number;
  textPreview: string;
  hasTextLayer: boolean;
  needsVision: boolean;
}>;

renderPdfPages(hash: string): Promise<Array<{
  page: number;
  path: string;
}>>;
```

Rules:

- Try embedded text first.
- If extracted text is blank or too short, mark `needsVision = true`.
- Render pages to `index/renders/<hash>/page-001.png`.
- Render output is derived and can be deleted/rebuilt.
- Do not store rendered page images in Git.

Implementation decision:

- Use `pdf-parse` v2 APIs for text inspection and page rendering.
- If `pdf-parse` rendering is insufficient on Windows, introduce a second Node
  wrapper behind the same `tools/pdf.ts` API. Do not change caller behavior.

### CLI commands

```text
npm run vault -- inspect-pdf <hash-or-path>
npm run vault -- render-pdf <hash>
```

### Tests

- Scanned `zawiad po zebraniu.pdf` reports `needsVision = true`.
- Rendering creates one PNG per page.
- Re-rendering is idempotent and overwrites only derived render files.

### Acceptance

- [ ] The existing `zawiad po zebraniu.pdf` renders to page images under
  `index/renders/<hash>/`.
  The file was not present when attempted.
- [x] A real Gmail-imported one-page PDF renders to page images under
  `index/renders/<hash>/`.
- [x] `npm run vault -- context` can report that a registered document needs extraction.

---

## 6. Phase 3: Record Schema

### Files to create

- `tools/schemas/record.ts`
- `tools/schemas/anomaly.ts`
- `tools/schemas/export-json-schema.ts`
- `tools/schemas/record.v1.json`
- `tools/schemas/record.test.ts`

### Work

Implement the v1 schema from `DESIGN.md`.

Document types:

- `monthly_charges`
- `media_settlement`
- `shared_property_settlement`
- `interest_note`
- `account_statement`
- `resolution`
- `meeting_notice`
- `service_notice`
- `correspondence`
- `other`

Required substructures:

- `Money`
- `Period`
- `ReferenceNumbers`
- `FinancialRow`
- `MeterReading`
- `LedgerEntry`
- `InterestEntry`
- `ImportantDate`
- `Resolution`
- `SensitiveFinding`
- `RecordSchema`

Validation helpers:

- Monthly charge sum equals stated total when stated total exists.
- Media settlement final total matches row differences.
- Interest note total matches interest rows.
- Account statement final balance matches ledger summary.
- Raw visible passwords are rejected outside `sensitive_findings` and must be
  redacted.

### CLI commands

```text
npm run vault -- export-schema
npm run vault -- validate-record <record-json-path>
```

### Tests

Create fixture records for:

- `meeting_notice`
- `media_settlement`
- `interest_note`
- `account_statement`
- `monthly_charges`

Each fixture must pass `RecordSchema.parse`.

Create malformed variants that fail:

- money as float,
- bad date format,
- raw password copied into summary,
- missing document type,
- mismatched total.

### Acceptance

- [x] `tools/schemas/record.v1.json` is generated from Zod.
- [~] `npm run vault -- validate-record <fixture>` succeeds for valid fixtures.
  A meeting notice fixture exists; broader fixture families remain.
- [~] Invalid fixture tests fail predictably with useful Zod issues.
  Basic invalid cases exist; total mismatch fixtures remain.

---

## 7. Phase 4: Manual Extraction Loop

### Files to create

- `.codex/extract-document.md`
- `tests/fixtures/records/*.json`
- `tests/fixtures/notes/*.md`

### Work

Implement the first complete Codex-operated extraction loop.

Flow:

1. Register a document.
2. Render pages if needed.
3. Codex reads page images.
4. Codex writes extraction JSON to a temp file.
5. Run `npm run vault -- validate-record`.
6. Run `npm run vault -- put-record`.
7. Run `npm run vault -- put-note`.
8. Reindex/search.

First target:

- `zawiad po zebraniu.pdf`
- expected document type: `meeting_notice`
- expected status: `needs_review` or `ok`, depending on extraction confidence.

Next sample families from screenshots:

- media settlement for I half of 2025,
- media settlement for II half of 2025,
- interest note,
- account statement.

Sensitive data rule:

- If a document contains portal credentials, the note should say credentials are
  present but must not repeat the raw password.
- Record should include `sensitive_findings` with redacted value.
- Anomaly detection should later emit `SECRET_VISIBLE`.

### Acceptance

- [x] At least one real Gmail-imported PDF has:
  - stored document,
  - rendered pages,
  - valid record,
  - Markdown note,
  - searchable FTS entry,
  - local source citation.
  Completed for
  `6e9efc283330689c599876f81ffeb1b561943d861a426bb1794808bc905ce22c`.

---

## 8. Phase 5: Gmail Import

### Files to create

- `tools/gmail-auth.ts`
- `tools/gmail.ts`
- `tools/gmail-cli.ts`
- `tools/gmail.test.ts`

### Work

Implement direct Gmail REST import.

OAuth:

- Read credentials from `~/.config/dabrowskiego/credentials.json`.
- Cache token at `~/.config/dabrowskiego/gmail-token.json`.
- Use Gmail readonly scope only.
- Do not store tokens in repo.

Gmail APIs:

```ts
listMessages(opts): Promise<Array<{ id: string; threadId: string }>>;
getMessage(gmailId): Promise<GmailMessageWithAttachments>;
fetchAttachmentBytes(gmailId, attachmentId): Promise<Buffer>;
```

Sync logic:

- Query known Locator senders.
- Use `high_watermark_date - 14 days`.
- Deduplicate by Gmail id.
- Deduplicate documents by SHA-256.
- Fetch raw attachment bytes regardless of declared MIME.
- Sniff actual type locally.
- Store email body and metadata.
- Continue on per-attachment failure and emit anomaly later.

### CLI commands

```text
npm run gmail -- auth
npm run gmail -- sync
npm run gmail -- sync --backfill-from 2023-01-01
npm run gmail -- list-locator --max 20
```

### Tests

- Unit-test MIME tree traversal with fixture Gmail payloads.
- Test base64url decoding of attachment data.
- Test sync idempotency with mocked Gmail responses.
- Test lookback query generation.

### Acceptance

- [x] OAuth completes.
- [x] Locator messages can be listed.
- [ ] A real accounting PDF declared as `application/octet-stream` is saved as a
  local PDF after byte sniffing.
  A first real sync imported PDFs and images from Locator; an
  `application/octet-stream` real-world sample has not yet been confirmed.
- [x] Re-running sync does not duplicate emails or documents in mocked sync tests.

---

## 9. Phase 6: Reports and Anomalies

### Files to create

- `tools/anomalies.ts`
- `tools/reports.ts`
- `.codex/check-anomalies.md`
- `.codex/write-inbox.md`
- `tools/anomalies.test.ts`
- `tools/reports.test.ts`

### Work

Implement deterministic anomaly rules:

- `FEE_DELTA`
- `FEE_DELTA_LARGE`
- `MISSING_PERIOD`
- `NEW_CATEGORY`
- `REMOVED_CATEGORY`
- `SETTLEMENT_NONZERO`
- `MEDIA_SETTLEMENT_NONZERO`
- `INTEREST_CHARGED`
- `ACCOUNT_UNDERPAYMENT`
- `TOTAL_MISMATCH`
- `RESOLUTION_PENDING_VOTE`
- `EXTRACTION_MISSING`
- `EXTRACTION_FAILED`
- `LOW_CONFIDENCE`
- `OCR_PENDING`
- `ORPHAN_RECORD`
- `UNEXPECTED_SENDER`
- `DEADLINE_APPROACHING`
- `DEADLINE_MISSED`
- `SCHEMA_OUTDATED`
- `HASH_DRIFT`
- `GMAIL_ATTACHMENT_FETCH_FAILED`
- `SECRET_VISIBLE`

Implement `reports/inbox.md` generation.

Report contents:

- new documents,
- extraction work pending,
- open anomalies,
- pending votes,
- upcoming deadlines,
- questions for user,
- latest financial changes,
- safe citations to local hashes/paths.

Privacy:

- `reports/` is ignored by Git.
- Reports must not contain raw passwords.

### CLI commands

```text
npm run vault -- detect-anomalies
npm run vault -- list-work --kind anomaly
npm run vault -- write-inbox
```

### Tests

- Each anomaly rule has one positive and one negative fixture.
- `SECRET_VISIBLE` triggers on sensitive findings.
- Report generation redacts sensitive values.
- Report generation is deterministic for the same DB state.

### Acceptance

- [x] `npm run vault -- detect-anomalies` creates idempotent anomalies.
- [x] `npm run vault -- write-inbox` creates `reports/inbox.md`.
- [x] Re-running both commands does not create duplicate anomalies.

---

## 10. Phase 7: Hardening

### Files to create

- `tools/backup.ts`
- `tools/backup.test.ts`
- `tests/fixtures/`

### Work

Backup:

- Create `vault-YYYY-MM-DD.zip`.
- Include `manifest.json`.
- Manifest contains path, size, SHA-256, and timestamp for each canonical file.
- Verify archive by reading it back and checking hashes.
- Add restore/reindex verification path.

Validation:

- Detect missing canonical files.
- Detect orphan records.
- Detect corrupt `sources.jsonl`.
- Detect files whose content hash does not match path.
- Warn if `reports/` or `vault/` are not ignored by Git.
- Warn before Gmail backfill if no verified backup has been configured.

### CLI commands

```text
npm run vault -- backup --dest <path>
npm run vault -- backup --verify <zip>
npm run vault -- validate --strict
```

### Tests

- Backup manifest hashes are correct.
- Backup verification fails on tampered archive.
- `validate --strict` catches Git ignore mistakes.

### Acceptance

- [x] A verified backup can be created.
- [x] `npm run vault -- validate --strict` passes on a clean repo.
- [ ] Full v1 checklist in `DESIGN.md` passes.

---

## 11. Automation Readiness

The implementation must support future Codex app automations.

Automation command sequence:

```text
npm run gmail -- sync
npm run vault -- list-work --kind extraction
npm run vault -- detect-anomalies
npm run vault -- write-inbox
npm run vault -- context
```

Automation rules:

- Notify only when something changed or needs attention.
- Do not send email.
- Do not vote.
- Do not acknowledge or resolve anomalies.
- Do not access e-kartoteka.
- Do not expose raw passwords.
- End with `reports/inbox.md` updated and a short user-facing summary.

New chat readiness:

- `AGENT.md` tells Codex how to start.
- `npm run vault -- context` gives property identity, latest state, open anomalies,
  and next useful files.
- Search and SQL commands expose local context without requiring prior chat
  history.

---

## 12. Definition of Done for v1

v1 is done when:

- [x] `npm install` works on the target machine.
- [x] `npm run vault -- setup` initializes the repo.
- [ ] The local sample PDF can be registered by hash.
- [ ] The sample scanned PDF renders to page images.
- [x] At least one valid record and note are stored.
  Completed for one real Gmail-imported property PDF; more documents remain.
- [~] Record fixtures exist for:
  - `meeting_notice`
  - `media_settlement`
  - `interest_note`
  - `account_statement`
  - `monthly_charges`
  Meeting notice coverage exists; the other fixture families remain.
- [x] `npm run gmail -- auth` works.
- [x] `npm run gmail -- sync --backfill-from <date>` imports Locator messages and raw
  attachments.
- [x] `application/octet-stream` PDFs are saved correctly after byte sniffing.
  Implemented and tested with real Locator messages.
- [x] `npm run vault -- reindex` rebuilds SQLite from canonical files.
- [x] `npm run vault -- search` returns cited results.
- [x] `npm run vault -- detect-anomalies` is idempotent.
- [x] `npm run vault -- write-inbox` creates a private report.
- [x] `npm run vault -- backup --verify <zip>` verifies a backup.
- [x] `npm test` passes.

---

## 13. Implementation Order for the First Coding Session

Start here:

1. [x] Create `package.json`, `.gitignore`, and base docs.
2. [x] Implement `tools/paths.ts`, `tools/hash.ts`, and `tools/state.ts`.
3. [x] Implement `vault.init`.
4. [x] Implement SQLite schema creation.
5. [x] Implement `registerDocument`.
6. [x] Implement `reindex`.
7. [x] Implement `validate`.
8. [x] Add CLI wrappers for setup/register/reindex/validate.
9. [ ] Register `zawiad po zebraniu.pdf`.
   The file was not present when attempted.
10. [x] Add tests for idempotent registration.

Do not start Gmail OAuth until local file registration and reindex are stable.

---

## 14. Notes for Codex Implementers

- Prefer small modules with explicit APIs.
- Do not let CLI commands duplicate library logic.
- Keep all paths relative to discovered repo root.
- Never write into `vault/` outside `tools/vault.ts`.
- Never commit private generated data.
- Do not copy raw passwords from source documents into notes, records, logs, or
  final answers.
- When a decision is not in this plan, check `DESIGN.md` first.

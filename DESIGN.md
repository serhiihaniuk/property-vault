# Property Vault: System Design

**Status:** Draft v3, ready for v1 kickoff
**Last updated:** 2026-04-17
**Owner:** Serhii
**Audience:** Serhii, Codex, and future Codex automations operating on this repo.

---

## 1. Overview

The Property Vault is a local-first knowledge base for documents, emails, and
financial records related to one property. It is designed to be operated by a
human and by Codex with equal ease.

Canonical data is stored as plain files on disk. SQLite is derived and can be
rebuilt. A small Node.js/TypeScript library is the single interface for
mutating the vault.

This is not an autonomous app. It is a structured substrate on which Codex
runbooks operate.

### 1.1 Problem

Financial and administrative correspondence arrives from:

- `ksiegowosc4@locator.wroclaw.pl`
- `administrator4@locator.wroclaw.pl`

The documents currently live mostly in Gmail. The goal is to make them local,
durable, searchable, and understandable.

The system should provide:

- Local copies of every document.
- Structured financial data extracted from PDFs.
- Natural-language Q&A with citations to local files.
- Detection of unusual changes, missing periods, pending votes, and deadlines.
- A substrate future Codex automations can extend without refactoring.

### 1.2 Success Criteria

1. Deleting `index/` followed by one rebuild command reproduces the full index.
2. Importing the same Gmail message twice creates no duplicate documents.
3. Every Codex answer can be traced to a local source file.
4. Schema changes are handled by re-extracting document records.
5. Adding a document type changes a runbook/schema example, not the whole app.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Local-first storage and querying.
- Durable plain-file canonical layout.
- Idempotent ingestion.
- AI-ergonomic APIs for Codex.
- Human-readable `reports/inbox.md`.
- Extensible document types and anomaly rules.

### 2.2 Non-Goals for v1

- No web UI.
- No scheduled autonomous sync.
- No bank/payment reconciliation.
- No multi-property support.
- No mobile app.
- No custom encryption beyond OS and backup choices.

---

## 3. Design Principles

1. Files are canonical. SQLite is a cache.
2. Content hash is identity.
3. Deterministic code owns structure; AI owns judgment.
4. Source history is append-only where possible.
5. Idempotency is a correctness property.
6. One interface serves Codex, CLI tools, and future UI code.
7. Schema evolution happens by re-extraction.

---

## 4. System Architecture

```text
                +---------------------------------------------+
                |                  YOU                        |
                |  ask questions, read reports/inbox.md       |
                +---------------------------------------------+
                            |                  ^
                            v                  |
                +---------------------------------------------+
                |                 CODEX                       |
                |  runbooks: sync, extract, answer, check     |
                +---------------------------------------------+
                    |             |              |
                    v             v              v
            +---------------+  +-----------+  +-------------+
            |   vault       |  |  gmail    |  |  ocr        |
            |   library     |  |  library  |  |  library    |
            |  tools/       |  |  tools/   |  |  tools/     |
            |  vault.ts     |  |  gmail.ts |  |  ocr.ts     |
            +---------------+  +-----------+  +-------------+
                    |              |                |
                    v              v                v
            +---------------+  +-----------+  +-------------+
            |    vault/     |  |  Gmail    |  |  Tesseract  |
            |    index/     |  |  REST API |  |  native     |
            |    reports/   |  |  OAuth    |  |             |
            +---------------+  +-----------+  +-------------+
```

Key invariants:

- Data only flows into `vault/` through `tools/vault.ts`.
- `index/vault.db` is never written by hand.
- Codex calls library functions instead of writing important files directly.
- Gmail bytes are fetched through direct REST API with OAuth.

---

## 5. Technology Stack

Everything deterministic is Node.js and TypeScript. The project avoids build
complexity.

### 5.1 Runtime

- Node.js 22.6+.
- TypeScript syntax stripped at runtime with `--experimental-strip-types`.
- No bundler, no `ts-node`, no server framework in v1.
- `npm` as the package manager.

### 5.2 Core Dependencies

| Package | Role |
| --- | --- |
| `better-sqlite3` | SQLite driver with FTS5 support. |
| `zod` | Schema validation for AI output. |
| `zod-to-json-schema` | Export schemas for Codex prompts. |
| `write-file-atomic` | Atomic file writes. |
| `proper-lockfile` | Single-writer lock. |
| `pino` | Structured logs. |
| `consola` | Human-friendly CLI output. |
| `file-type` | MIME sniffing from bytes. |
| `date-fns` | Date parsing and formatting. |

### 5.3 Gmail Stack

| Package | Role |
| --- | --- |
| `googleapis` | Official Gmail REST client. |
| `google-auth-library` | OAuth2 and token refresh. |
| `open` | Open browser for one-time consent. |

Gmail access is direct REST with OAuth. Locator accounting PDFs can be declared
as `application/octet-stream`, so the importer must fetch raw bytes and sniff
type locally.

### 5.4 PDF and OCR Stack

| Package | Role |
| --- | --- |
| `pdf-parse` | Page count, text-layer check, PDF page rendering. |

v1 decision: PDFs are treated as scanned-first. Node performs deterministic
inspection and rendering; Codex/vision performs the primary reading and
extraction. Native Tesseract can be added later as an optional fallback for
cheap searchable text, but it is not a required blocker for understanding
documents.

PDF processing rules:

1. Try text-layer extraction.
2. If text is missing or too thin, render pages to PNG under `index/renders/`.
3. Codex reads the rendered page images and produces validated JSON.
4. Optional OCR text may be stored under `index/ocr/` as a search cache.

### 5.5 AI Stack

The vault code does not call AI providers directly in v1. It defines schemas,
accepts validated JSON, stores notes, and indexes data. Codex performs
extraction and Q&A by reading local files and calling the library.

Optional v1.1 semantic search:

- `sqlite-vec` for vector storage.
- Local multilingual embeddings if practical.

### 5.6 Testing Stack

- `node:test`
- `node:assert`

No Jest or Vitest in v1.

### 5.7 Initial `package.json`

```json
{
  "name": "dabrowskiego",
  "type": "module",
  "engines": {
    "node": ">=22.6.0"
  },
  "scripts": {
    "setup": "node --experimental-strip-types tools/cli.ts setup",
    "auth": "node --experimental-strip-types tools/gmail-auth.ts",
    "vault": "node --experimental-strip-types tools/cli.ts",
    "gmail": "node --experimental-strip-types tools/gmail-cli.ts",
    "reindex": "node --experimental-strip-types tools/cli.ts reindex",
    "validate": "node --experimental-strip-types tools/cli.ts validate",
    "test": "node --test --experimental-strip-types tools/**/*.test.ts"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "zod": "^3",
    "zod-to-json-schema": "^3",
    "pdf-parse": "^2",
    "file-type": "^22.0.1",
    "googleapis": "^144",
    "google-auth-library": "^9",
    "open": "^10",
    "pino": "^9",
    "consola": "^3",
    "write-file-atomic": "^5",
    "proper-lockfile": "^4",
    "date-fns": "^4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/better-sqlite3": "^7",
    "@types/write-file-atomic": "^4",
    "@types/proper-lockfile": "^4"
  }
}
```

---

## 6. Directory Layout

```text
dabrowskiego/
|
|-- vault/                        # Canonical. Back this up.
|   |
|   |-- documents/                # Content-addressed binaries
|   |   `-- <sha256>.<ext>
|   |
|   |-- ocr/                      # OCR sidecars for scanned PDFs
|   |   `-- <sha256>.txt
|   |
|   |-- emails/
|   |   `-- <gmail-id>/
|   |       |-- meta.json
|   |       |-- body.txt
|   |       `-- attachments.json
|   |
|   |-- records/                  # AI-produced structured JSON
|   |   `-- <sha256>.json
|   |
|   |-- notes/                    # AI-produced Markdown summaries
|   |   `-- <sha256>.md
|   |
|   |-- sources.jsonl             # Append-only source observations
|   `-- state.json                # Sync cursors and schema versions
|
|-- index/                        # Derived. Safe to delete.
|   |-- vault.db
|   |-- renders/
|   |   `-- <sha256>/
|   |       `-- page-001.png
|   `-- ocr/
|       `-- <sha256>.txt
|
|-- reports/                      # Private derived output. Ignored by Git.
|   |-- inbox.md                  # Main human-facing status page
|   `-- archive/
|
|-- tools/
|   |-- vault.ts
|   |-- gmail.ts
|   |-- gmail-auth.ts
|   |-- ocr.ts
|   |-- cli.ts
|   `-- schemas/
|       |-- record.ts
|       |-- record.v1.json
|       `-- anomaly.ts
|
|-- .codex/
|   |-- sync-gmail.md
|   |-- extract-document.md
|   |-- answer-question.md
|   |-- check-anomalies.md
|   `-- write-inbox.md
|
|-- AGENT.md
|-- README.md
|-- DESIGN.md
|-- package.json
`-- .gitignore
```

Auth credentials live outside the repo:

```text
~/.config/dabrowskiego/
|-- credentials.json
`-- gmail-token.json
```

On Windows this resolves to:

```text
C:\Users\Serge\.config\dabrowskiego\
```

### 6.1 Path Conventions

- Code discovers the repo root or uses `VAULT_ROOT`.
- No hardcoded absolute paths inside source files.
- Hashes are lowercase hex, 64 characters.
- File extension is determined by byte sniffing, not declared Gmail MIME.

---

## 7. Data Model

### 7.1 Canonical Files

| File | Owner | Mutability |
| --- | --- | --- |
| `vault/documents/<hash>.<ext>` | Ingestion | Immutable |
| `vault/emails/<id>/*` | Ingestion | Idempotent write |
| `vault/records/<hash>.json` | AI extraction | Versioned rewrite |
| `vault/notes/<hash>.md` | AI extraction | Versioned rewrite |
| `vault/sources.jsonl` | Ingestion | Append-only |
| `vault/state.json` | Library | Mutable, atomic |
| `index/renders/<hash>/*` | PDF renderer | Derived, rebuildable |
| `index/ocr/<hash>.txt` | OCR pipeline | Derived, rebuildable |

### 7.2 SQLite Tables

SQLite is derived and can be rebuilt from `vault/`.

Core tables:

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

Amounts are stored as integer grosz in `amount_minor`. No floats for money.

`fts_records` uses FTS5 with:

```sql
tokenize='unicode61 remove_diacritics 2'
```

This allows searching Polish text with or without diacritics.

### 7.3 Table Details

`documents`:

- `hash` primary key
- `mime`
- `size_bytes`
- `ingested_at`
- `page_count`
- `has_text_layer`
- `needs_ocr`
- `ocr_status`
- `document_date`
- `asset_tag`

`document_sources`:

- `hash`
- `source_kind`
- `source_ref` as JSON
- `seen_at`
- `original_filename`
- unique by `(hash, source_kind, source_ref)`

`emails`:

- `gmail_id` primary key
- message/thread/header fields
- sender, recipients, subject, dates, labels
- local body path

`records`:

- one row per document extraction
- points to the JSON record on disk
- tracks schema and extractor versions

`financial_rows`, `important_dates`, and `resolutions` are replaced for a
document whenever a validated record is written.

---

## 8. File Formats and Record Schema

### 8.1 `vault/sources.jsonl`

Append-only source observations, one JSON object per line:

```jsonl
{"hash":"ab3f...c91","seen_at":"2026-04-17T10:22:00Z","source":{"kind":"gmail_attachment","gmail_id":"18c4a...","attachment_index":0,"original_filename":"Zawiadomienie o oplatach 2026.04.pdf","mime":"application/pdf","size":184392}}
{"hash":"ab3f...c91","seen_at":"2026-04-18T09:00:00Z","source":{"kind":"manual_drop","path":"C:/Users/Serge/Downloads/nal_04.pdf","original_filename":"nal_04.pdf"}}
```

### 8.2 `vault/state.json`

```json
{
  "schema_version": 1,
  "extractor_version_current": "2026.04-a",
  "record_schema_version_current": 1,
  "last_gmail_sync": {
    "at": null,
    "high_watermark_date": null,
    "lookback_days": 14,
    "messages_seen_total": 0
  },
  "known_senders": [
    "ksiegowosc4@locator.wroclaw.pl",
    "administrator4@locator.wroclaw.pl"
  ]
}
```

### 8.3 Record Schema

The Zod schema in `tools/schemas/record.ts` is the source of truth. Codex reads
the generated JSON Schema and must produce matching extraction JSON.

The schema is intentionally broad enough for the document families seen so far:
monthly charge notices, media settlements, annual settlements, interest notes,
account statements, resolutions, meeting notices, service notices, and general
correspondence.

```ts
import { z } from 'zod';

export const DocumentType = z.enum([
  'monthly_charges',
  'media_settlement',
  'shared_property_settlement',
  'interest_note',
  'account_statement',
  'resolution',
  'meeting_notice',
  'service_notice',
  'correspondence',
  'other',
]);

export const Money = z.object({
  amount_minor: z.number().int(),
  currency: z.literal('PLN'),
});

export const Period = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('month'), value: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({ kind: z.literal('year'), value: z.string().regex(/^\d{4}$/) }),
  z.object({
    kind: z.literal('range'),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ kind: z.literal('none') }),
]);

export const ReferenceNumbers = z.object({
  document_ref: z.string().nullable(),
  property_code: z.string().nullable(),      // e.g. 63713
  unit_code: z.string().nullable(),          // e.g. 05-003-003-009
  bank_account: z.string().nullable(),
  source_document_numbers: z.array(z.string()).default([]),
});

export const FinancialRow = z.object({
  row_type: z.enum([
    'charge',
    'settlement',
    'payment',
    'credit',
    'debit',
    'interest',
    'balance',
  ]),
  category: z.string(),                      // canonical snake_case
  category_original: z.string(),             // original Polish label
  category_group: z.string().nullable(),
  period: Period,
  money: Money,
  quantity: z.object({
    value: z.number(),
    unit: z.string(),                        // m2, m3, GJ, os, lok, dni
  }).nullable(),
  unit_price_minor: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
  source_page: z.number().int().nullable(),
  note: z.string().nullable(),
});

export const MeterReading = z.object({
  meter_kind: z.enum(['cold_water', 'hot_water', 'heat_energy', 'other']),
  meter_number: z.string().nullable(),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reading_value: z.number(),
  usage_value: z.number().nullable(),
  unit: z.string(),
  source_page: z.number().int().nullable(),
});

export const LedgerEntry = z.object({
  operation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  document_number: z.string().nullable(),
  obligation: Money.nullable(),
  payment: Money.nullable(),
  balance_after: Money.nullable(),
  comment: z.string().nullable(),
  source_page: z.number().int().nullable(),
});

export const InterestEntry = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  obligation: Money,
  obligation_document: z.string().nullable(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  payment: Money.nullable(),
  payment_document: z.string().nullable(),
  days_late: z.number().int(),
  interest_rate_percent: z.number(),
  interest: Money,
  source_page: z.number().int().nullable(),
});

export const ImportantDate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string(),
  kind: z.enum(['deadline', 'meeting', 'vote', 'effective_from', 'booking', 'other']),
});

export const Resolution = z.object({
  number: z.string(),
  subject: z.string(),
  outcome: z.enum(['passed', 'pending_vote', 'rejected', 'unknown']),
  voting_method: z.string().nullable(),
  money_limit: Money.nullable(),
  note: z.string().nullable(),
});

export const SensitiveFinding = z.object({
  kind: z.enum(['password', 'login', 'email', 'bank_account', 'personal_data']),
  label: z.string(),
  value_redacted: z.string(),                // never store raw passwords here
  source_page: z.number().int().nullable(),
});

export const RecordSchema = z.object({
  schema_version: z.literal(1),
  extractor_version: z.string(),
  extracted_at: z.string().datetime(),
  extracted_by: z.string(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['ok', 'needs_review', 'failed']),
  language: z.literal('pl'),

  document_type: DocumentType,
  document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  period: Period,

  title: z.string(),
  summary_plain: z.string(),
  key_facts: z.array(z.object({ label: z.string(), value: z.string() })),

  financial_rows: z.array(FinancialRow).default([]),
  meter_readings: z.array(MeterReading).default([]),
  ledger_entries: z.array(LedgerEntry).default([]),
  interest_entries: z.array(InterestEntry).default([]),
  important_dates: z.array(ImportantDate).default([]),
  resolutions: z.array(Resolution).default([]),

  reference_numbers: ReferenceNumbers,
  sensitive_findings: z.array(SensitiveFinding).default([]),

  mentions: z.object({
    people: z.array(z.string()).default([]),
    addresses: z.array(z.string()).default([]),
    emails: z.array(z.string()).default([]),
    phones: z.array(z.string()).default([]),
    reference_numbers: z.array(z.string()).default([]),
  }),

  questions_for_user: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
```

Validation rules:

- Money is always integer grosz in `amount_minor`.
- Positive `amount_minor` means a positive amount shown in the document; semantic
  meaning comes from `row_type`.
- Monthly charge totals must match the stated total.
- Media settlement totals must match the stated final nadplata/niedoplata.
- Interest note totals must match the stated total interest.
- Account statement final balance must match the final visible balance.
- Raw passwords are never stored in records, notes, reports, or logs. Store only
  `sensitive_findings[].value_redacted`.

---

## 9. Document Type Catalog

### 9.1 `meeting_notice`

Examples:

- `Zawiadomienie po zebraniu`
- post-meeting packet with voting card

Extract:

- letter date
- meeting date
- `L. dz.` reference
- all resolutions and voting method
- return instructions and deadlines if present

For the real document currently in the folder, `zawiad po zebraniu.pdf`,
extraction should identify:

- document date: `2026-03-19`
- meeting date: `2026-02-24`
- reference: `L. dz. 381/2026`
- voting method: individual vote collection
- resolutions about 2025 financial approval, administrator discharge, 2026
  economic plan, renovation works, surplus transfer, and work around garbage
  shelter/bike stands/plantings.

### 9.2 `monthly_charges`

Examples:

- `Zawiadomienie o oplatach`
- `naliczenia 04.2026`

Extract:

- effective month
- total monthly amount
- due day
- bank account
- unit code
- unit/address code
- every charge row

Canonical monthly charge categories:

| Category | Group |
| --- | --- |
| `zaliczka_czesc_wspolna` | `utrzymanie_nieruchomosci_wspolnej` |
| `woda_i_scieki` | `media` |
| `podgrzanie_wody` | `media` |
| `energia_cieplna_co` | `media` |
| `zamowiona_moc_cieplna` | `media` |
| `wywoz_odpadow_komunalnych` | `media` |
| `uslugi_e_kartoteki` | `oplaty_indywidualne` |
| `fundusz_remontowo_inwestycyjny` | `fundusze` |

Validation:

- Sum of charge rows must equal the stated total.
- If not, status becomes `needs_review` and a warning is added.

### 9.3 `shared_property_settlement`

Examples:

- annual shared-property cost settlement
- `Rozliczenie kosztow zarzadu nieruchomoscia wspolna`

Extract:

- settlement year
- actual costs
- advances
- surplus/shortfall
- payment deadline
- bank account if present

### 9.4 `media_settlement`

Individual utility settlement for water, hot water, heating, or similar.
Examples:

- `Zawiadomienie o rozliczeniu mediow`
- `ROZLICZENIE WODY I SCIEKOW ORAZ OPLAT INDYWIDUALNYCH ZA I POLROCZE`
- `ROZLICZENIE WODY I SCIEKOW, POZOSTALYCH OPLAT INDYWIDUALNYCH ZA II POLROCZE`

Extract:

- document date
- settlement period
- bank account
- property code and unit code
- meter readings for hot water, cold water, and heat energy
- consumption rows by tariff
- settlement rows with zaliczka, koszt, difference, and nadplata/niedoplata
- stated final result
- booking date and payment deadline if present

Validation:

- Sum settlement differences and compare to the final stated nadplata or
  niedoplata.
- Preserve whether each line is labeled `Nadplata` or `Niedoplata`.
- Store meter readings separately from financial rows so Q&A can answer both
  "how much did it cost?" and "how much did I use?".

### 9.5 `resolution`

Standalone resolution body. Extract resolution number, subject, outcome,
monetary limits, voting method, and any execution delegation.

### 9.6 `service_notice`

Announcements such as water/heat interruptions or repairs. Extract affected
service, dates, hours, location, and action needed.

### 9.7 `correspondence`

General letters or replies. Extract summary, dates, people, addresses, and open
questions.

### 9.8 `other`

Fallback. Always mark `needs_review`.

### 9.9 `interest_note`

Examples:

- `Nota odsetkowa`
- analysis of late payments for a period

Extract:

- note date
- analysis period
- bank account
- payment deadline text
- every overdue obligation row
- every payment row
- days late
- interest rate
- interest amount
- stated total interest

Validation:

- Sum `interest_entries[].interest.amount_minor` and compare to stated total.
- Link source invoice/document numbers when visible, for example `FAK 1/5/2024`
  and payment documents such as `WPKO 103/5/2024`.

### 9.10 `account_statement`

Examples:

- `Kartoteka ksiegowa`
- owner account statement for a year or partial year

Extract:

- period covered
- monthly obligations, payments, balances, and monthly differences
- detailed ledger entries with operation date, due date, document number,
  obligation, payment, and comment
- final balance and whether it is underpayment or overpayment
- visible portal login as sensitive data if present
- visible password as a redacted sensitive finding only

Validation:

- Final detailed balance must match the visible summary total.
- If a password is visible, do not copy the raw value into notes, records,
  reports, logs, or chat answers.

---

## 10. Vault Library API

All mutating operations go through `tools/vault.ts`.

### 10.1 Lifecycle

```ts
vault.init(): Promise<void>;
vault.reindex(): Promise<void>;
vault.validate(): Promise<ValidationReport>;
vault.backup(opts: { dest: string }): Promise<void>;
```

### 10.2 Ingestion

```ts
vault.registerDocument(input: RegisterDocumentInput): Promise<RegisterDocumentResult>;
vault.registerEmail(input: RegisterEmailInput): Promise<{ isNew: boolean; path: string }>;
vault.recordManualSource(hash: string, source: Source): Promise<void>;
```

`registerDocument`:

1. Computes SHA-256.
2. Sniffs MIME from bytes.
3. Writes `vault/documents/<hash>.<ext>` only if absent.
4. Detects page count and text layer.
5. Sets OCR flags.
6. Appends to `sources.jsonl`.
7. Upserts SQLite rows.

### 10.3 AI Writes

```ts
vault.putRecord(hash: string, record: VaultRecord): Promise<void>;
vault.putNote(hash: string, markdown: string): Promise<void>;
vault.putReport(name: string, markdown: string): Promise<void>;
```

`putRecord` validates with Zod, writes JSON, updates SQLite, and refreshes FTS
rows atomically.

### 10.4 Reads

```ts
vault.getDocument(hash: string): Promise<DocumentBlob | null>;
vault.getOcrText(hash: string): Promise<string | null>;
vault.getRecord(hash: string): Promise<VaultRecord | null>;
vault.getNote(hash: string): Promise<string | null>;
vault.getEmail(gmailId: string): Promise<EmailWithAttachments | null>;
vault.listDocumentsNeedingExtraction(opts: { maxSchemaVersion: number; limit?: number }): Promise<DocumentWorkItem[]>;
vault.search(opts: SearchOptions): Promise<SearchResult[]>;
vault.sql<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
```

`vault.sql` is read-only and rejects non-`SELECT` statements.

### 10.5 CLI Wrappers

Codex automations primarily operate through shell commands, so every important
library mutation has a command-shaped wrapper. The CLI is thin; it calls
`tools/vault.ts` and `tools/gmail.ts`.

Required v1 commands:

```text
npm run vault -- setup
npm run vault -- validate
npm run vault -- reindex
npm run vault -- backup --dest <path>
npm run vault -- register-document <path> [--source manual_drop]
npm run vault -- put-record <hash> <record-json-path>
npm run vault -- put-note <hash> <note-md-path>
npm run vault -- list-work --kind extraction|ocr|anomaly
npm run vault -- search <query>
npm run vault -- sql --select "<SQL>"
npm run vault -- detect-anomalies
npm run vault -- write-inbox
npm run gmail -- auth
npm run gmail -- sync [--backfill-from YYYY-MM-DD]
```

Automation rule: scheduled Codex runs should end by opening or updating
`reports/inbox.md` only when new documents, failures, anomalies, deadlines, or
questions for the user exist.

### 10.6 Errors

Errors are typed:

```ts
export class VaultError extends Error {
  constructor(
    public code:
      | 'E_INVALID_INPUT'
      | 'E_SCHEMA_VALIDATION'
      | 'E_HASH_COLLISION'
      | 'E_IO'
      | 'E_CORRUPT_STATE'
      | 'E_NOT_FOUND',
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
```

---

## 11. Gmail Integration

Gmail access uses direct REST with OAuth, not MCP. The current connector can see
attachment metadata but may refuse accounting PDFs declared as
`application/octet-stream`. Direct REST avoids that by fetching raw attachment
bytes.

### 11.1 OAuth Setup

One-time setup:

1. Create a Google Cloud project.
2. Enable Gmail API.
3. Configure OAuth consent screen as External.
4. Add scope `https://www.googleapis.com/auth/gmail.readonly`.
5. Add the Gmail address as a test user.
6. Create a Desktop OAuth client.
7. Save downloaded JSON as:
   `C:\Users\Serge\.config\dabrowskiego\credentials.json`.
8. Run `npm run auth`.

The token is cached at:

```text
C:\Users\Serge\.config\dabrowskiego\gmail-token.json
```

### 11.2 Gmail Client Surface

```ts
listMessages(opts: {
  query: string;
  maxResults?: number;
}): Promise<Array<{ id: string; threadId: string }>>;

getMessage(gmailId: string): Promise<GmailMessageWithAttachments>;

fetchAttachmentBytes(
  gmailId: string,
  attachmentId: string,
): Promise<Buffer>;
```

### 11.3 Locator Query

```text
from:(ksiegowosc4@locator.wroclaw.pl OR administrator4@locator.wroclaw.pl) after:YYYY/MM/DD
```

Sync never trusts the date cursor as exact. The importer always uses a 14-day
lookback from the last high-watermark date and relies on stored Gmail ids plus
content hashes for idempotency. This prevents missing late-arriving messages or
messages near a time-zone boundary.

---

## 12. Ingestion Pipeline

### 12.1 Gmail Sync

Manual v1 run:

1. Get Gmail high-watermark date from state.
2. Begin sync run.
3. Query from `high_watermark_date - 14 days`, or from a chosen backfill date.
4. For each message, fetch metadata/body/attachments.
5. For each attachment, fetch raw bytes and register document.
6. Register email and attachment links.
7. Update high-watermark to the newest message date successfully seen.
8. Finish sync run.

Repeated footer images are deduped by hash and later tagged as `asset_footer`.

### 12.2 Manual Drop

Manual files are registered through `registerDocument` with source kind
`manual_drop`. If the same file already exists from Gmail, only a source
observation is added.

### 12.3 Idempotency Matrix

| Scenario | Outcome |
| --- | --- |
| Same Gmail attachment re-synced | No duplicate binary |
| Same content in different Gmail messages | One document, multiple sources |
| Same Gmail message re-synced | Email upsert, attachment no-op |
| Manual file later imported by Gmail | One document, multiple sources |
| Edited file with different bytes | New hash |

---

## 13. Extraction Pipeline

### 13.1 Trigger

Codex calls:

```ts
vault.listDocumentsNeedingExtraction({ maxSchemaVersion: current });
```

This returns documents with no record, outdated record schema, failed
extraction eligible for retry, or missing OCR.

### 13.2 Procedure

1. Skip `asset_footer`.
2. Load text layer if available.
3. If no text layer, render pages to `index/renders/<hash>/page-###.png`.
4. Load email context if present.
5. Codex reads schema and document type examples.
6. Codex produces JSON record and Markdown note.
7. `vault.putRecord(hash, record)` validates and indexes.
8. `vault.putNote(hash, note)` stores human-readable summary.
9. If credentials or passwords are visible, record only redacted sensitive
   findings and avoid copying the raw secret to notes or reports.

### 13.3 OCR

OCR sidecars use page markers:

```text
=== page 1 ===
...
=== page 2 ===
...
```

For scanned Locator PDFs, the primary path is rendering each page to image and
asking Codex/vision to read it. OCR text is optional search cache and may be
lower quality than the vision extraction.

### 13.4 Schema Evolution

When schema changes:

1. Update Zod schema.
2. Bump schema version.
3. Regenerate JSON Schema.
4. Update extraction runbook.
5. Re-run extraction backlog.
6. Reindex SQLite if needed.

---

## 14. Anomaly Detection

Detection is deterministic. AI can explain anomalies but should not be the
source of truth for detection.

### 14.1 v1 Rules

| ID | Severity | Trigger |
| --- | --- | --- |
| `FEE_DELTA` | warning | Monthly category delta vs prior month greater than 5 percent |
| `FEE_DELTA_LARGE` | alert | Delta greater than 15 percent |
| `MISSING_PERIOD` | warning | Missing monthly charge record |
| `NEW_CATEGORY` | notice | Never-seen financial category |
| `REMOVED_CATEGORY` | notice | Recurring category absent for 2 months |
| `SETTLEMENT_NONZERO` | notice | Annual settlement has credit/debit |
| `MEDIA_SETTLEMENT_NONZERO` | notice | Media settlement has nadplata/niedoplata |
| `INTEREST_CHARGED` | warning | Interest note contains interest due |
| `ACCOUNT_UNDERPAYMENT` | warning | Account statement ends in underpayment |
| `TOTAL_MISMATCH` | warning | Charge rows do not sum to stated total |
| `RESOLUTION_PENDING_VOTE` | notice | Pending vote older than 30 days |
| `EXTRACTION_MISSING` | warning | Registered document has no record after 24h |
| `EXTRACTION_FAILED` | warning | Extraction status failed |
| `LOW_CONFIDENCE` | notice | Record confidence below 0.7 |
| `OCR_PENDING` | info | OCR needed but missing |
| `ORPHAN_RECORD` | warning | Record exists but document missing |
| `UNEXPECTED_SENDER` | notice | New sender at locator domain |
| `DEADLINE_APPROACHING` | warning | Deadline within 7 days |
| `DEADLINE_MISSED` | alert | Deadline passed and unacknowledged |
| `SCHEMA_OUTDATED` | info | Record schema is old |
| `HASH_DRIFT` | alert | File bytes no longer match path hash |
| `GMAIL_ATTACHMENT_FETCH_FAILED` | warning | Gmail attachment fetch failed |
| `SECRET_VISIBLE` | alert | A document contains visible login/password data |

### 14.2 Idempotency

Anomalies are unique by:

```text
(rule_id, subject_hash, payload_signature)
```

Re-running detection must not duplicate open anomalies.

---

## 15. Q&A Workflow

Codex answers questions by using structured data first, then notes/text search.

New Codex chats should start with:

1. Read `AGENT.md`.
2. Run `npm run vault -- context`.
3. Use `npm run vault -- search` or read cited records/notes before answering.

For a financial aggregate:

1. Classify category and period.
2. Query `financial_rows`.
3. Cite contributing records.
4. If rows are missing, say so.

For qualitative questions:

1. Run `vault.search`.
2. Read notes/records/source PDFs as needed.
3. Answer with sources.

Guardrails:

- Never invent numbers.
- If sources conflict, present the conflict.
- Amounts are displayed to 2 decimals.
- Sources include local paths or hashes.

---

## 16. Codex Runbooks

Each runbook lives in `.codex/` and uses this structure:

```markdown
# Runbook Name

## When to run
## Inputs
## Steps
## Outputs
## Failure modes
## Examples
```

v1 runbooks:

1. `sync-gmail.md`
2. `extract-document.md`
3. `check-anomalies.md`
4. `write-inbox.md`
5. `answer-question.md`

`AGENT.md` is the entry point Codex reads first.

Automation behavior:

- A scheduled Codex automation may run sync, extraction, anomaly detection, and
  inbox writing.
- It should notify the user only when something changed or needs attention.
- It should not send email, vote, acknowledge anomalies, delete files, or access
  e-kartoteka unless the user explicitly asks in that run.
- Its output should be `reports/inbox.md` plus a short user-facing summary.

---

## 17. State Management

### 17.1 State File

`vault/state.json` is written atomically.

### 17.2 Sync Cursors

The Gmail high-watermark lives in `state.json.last_gmail_sync`. Every sync uses
the configured lookback window and dedupes by Gmail id. Full resync is done by
setting `last_gmail_sync.high_watermark_date` to `null`.

### 17.3 Schema Versions

- `schema_version`: vault layout version.
- `record_schema_version_current`: extraction record version.

### 17.4 Concurrency

v1 assumes one writer. `proper-lockfile` holds `vault/.lock` during mutating
runs. Stale locks older than 1 hour are released with a warning.

---

## 18. Error Handling

### 18.1 Principles

- Errors are typed.
- Partial progress is kept.
- Failed items are retried next run.
- Every caught error appears in `sync_runs.summary` or anomalies.

### 18.2 Failure Modes

| Failure | Behavior |
| --- | --- |
| Gmail rate limit | Backoff, then anomaly |
| Attachment fetch fails | Continue others, anomaly |
| OAuth token revoked | Clear message, rerun auth |
| Hash collision | Refuse overwrite |
| OCR fails | Mark failed, anomaly |
| Zod validation fails twice | Record failed extraction |
| SQLite corruption | Abort writes, suggest reindex |
| Missing document file | Raise orphan anomaly |
| Corrupt `sources.jsonl` | Refuse write, require inspection |

### 18.3 Recovery

- `vault.validate()` finds inconsistencies.
- `vault.reindex()` rebuilds SQLite from canonical files.
- `vault.backup()` creates a dated archive of canonical vault data.

---

## 19. Testing Strategy

### 19.1 Unit Tests

- Hash stability.
- Zod schema accepts canonical examples.
- Zod rejects malformed records.
- Anomaly rules against fixtures.
- OCR wrapper mocked for control-flow tests.

### 19.2 Integration Tests

- `init -> registerDocument -> registerEmail -> putRecord -> query`.
- Idempotency of each write.
- Reindex determinism.

### 19.3 Golden Tests

Keep one real fixture per document type. Expected records are stored as JSON.
Regenerate only intentionally when schema changes.

### 19.4 Chaos Tests

- Delete `index/`, run read, ensure reindex works.
- Corrupt a document byte, expect `HASH_DRIFT`.
- Kill process mid-sync, rerun, expect no duplicates.

---

## 20. Operational Concerns

### 20.1 Repository Location

Default:

```text
C:\Users\Serge\Desktop\dabrowskiego
```

Before full backfill, confirm whether Desktop is OneDrive-synced. The vault may
contain address, bank account, and fee history. If that is not acceptable, move
the repo to a non-synced folder such as:

```text
C:\Repos\dabrowskiego
```

### 20.2 Git

Track code and design, not private data.

`.gitignore`:

```gitignore
vault/
index/
reports/
node_modules/
.lock
.env
```

Tracked:

- `tools/`
- `.codex/`
- schemas
- `AGENT.md`
- `README.md`
- `DESIGN.md`
- `package.json`
- `package-lock.json`

If a public/example report is needed, track `reports.example.md` with fake data
instead of tracking `reports/inbox.md`.

### 20.3 Backup

v1 backup strategy:

- monthly manual backup using `vault.backup({ dest })`
- output name: `vault-YYYY-MM-DD.zip`
- destination: external drive or encrypted cloud folder
- backup manifest: `manifest.json` containing every canonical file path, size,
  SHA-256, and creation timestamp
- verification: after writing the archive, read it back and validate every hash
- restore drill: `npm run vault -- backup --verify <zip>` must confirm the archive can
  rebuild `index/vault.db`

Do not include Gmail tokens in unencrypted backups.

Before the first Gmail backfill, `npm run gmail -- sync --backfill-from ...` should
warn if no verified backup location has been configured. The user may override
for the first run, but the warning should be loud.

### 20.4 Auth Files

| File | Purpose | Location |
| --- | --- | --- |
| `credentials.json` | Google OAuth desktop client | `~/.config/dabrowskiego/` |
| `gmail-token.json` | Cached OAuth refresh/access token | `~/.config/dabrowskiego/` |

Never commit these files.

### 20.5 Privacy

The vault will contain:

- property address
- personal name/address details
- bank account numbers
- monthly charges
- settlement history
- voting/meeting records
- e-kartoteka portal login/password if a document contains it

Therefore:

- do not commit `vault/`
- do not commit `reports/`
- do not paste full documents into public chats
- keep backups private
- prefer local extraction and local search
- use AI only when intentionally processing a document
- never copy raw passwords into records, notes, reports, logs, or answers

### 20.6 Reports

`reports/inbox.md` is the only file the user is expected to read regularly. It
should include:

- new documents since last report
- extraction failures
- open anomalies
- pending votes
- upcoming deadlines
- questions for user

Archive snapshots go to `reports/archive/`.

---

## 21. Security Model

### 21.1 Threats

| Threat | Mitigation |
| --- | --- |
| Accidental Git commit of private docs | `.gitignore`, validate warning |
| Gmail token leak | Token stored outside repo, readonly scope |
| Corrupt derived DB | Rebuild from `vault/` |
| Corrupt canonical file | Hash validation and backup |
| AI hallucinated data | Zod validation, SQL-first answers, source citations |
| Duplicate imports | Content hashing and unique constraints |
| Raw password copied into summaries | Redacted sensitive findings, `SECRET_VISIBLE` anomaly |

### 21.2 Gmail Scope

Use only:

```text
https://www.googleapis.com/auth/gmail.readonly
```

No send, delete, archive, or modify scopes in v1.

### 21.3 Revocation

If access should be removed:

1. Visit `https://myaccount.google.com/permissions`.
2. Remove Property Vault access.
3. Delete local `gmail-token.json`.

---

## 22. Implementation Plan

### Phase 1: Skeleton

- Create `package.json`, `.gitignore`, `README.md`, `AGENT.md`.
- Create folder setup command.
- Create `vault.init`, `vault.validate`, and `vault.reindex`.
- Create initial SQLite schema.
- Create CLI wrappers for every v1 library function Codex needs.
- Create `AGENT.md` with "read this first" instructions for new Codex chats.

### Phase 2: Manual Document Flow

- Register local PDFs by hash.
- Detect text layer and page count.
- Render scanned PDFs to images under `index/renders/`.
- Store one record and one note for `zawiad po zebraniu.pdf`.
- Extract one media settlement, one interest note, and one account statement
  from sample screenshots/PDFs as schema validation fixtures.

### Phase 3: Gmail Import

- Implement OAuth setup.
- Implement Gmail list/get/fetch attachment bytes.
- Import the two Locator sender histories.
- Confirm accounting PDFs declared as `application/octet-stream` are saved.

### Phase 4: Extraction

- Add Zod record schema.
- Add JSON Schema export.
- Add extraction runbook.
- Extract initial document types:
  - meeting notice
  - monthly charges
  - shared property settlement
  - service notice

### Phase 5: Reports and Q&A

- Build `reports/inbox.md`.
- Build `npm run vault -- context` to print the current property summary, recent
  documents, open anomalies, and where to look next.
- Implement `vault.search`.
- Add SQL-first Q&A runbook.
- Add anomaly detection rules.

### Phase 6: Hardening

- Add tests.
- Add backup command.
- Add validation warnings for private-data risks.
- Add golden fixtures.

---

## 23. Initial Backlog

Known current source material:

- 29 Gmail messages from the two Locator addresses discovered on 2026-04-17.
- One local PDF currently present:
  - `zawiad po zebraniu.pdf`
- Representative screenshots supplied by the user for schema design:
  - media settlement, first half of 2025
  - media settlement, second half of 2025 and heat/hot-water settlement
  - interest note for late payments
  - account statement / owner ledger
  - meeting notice and voting packet

First real extraction target:

- `zawiad po zebraniu.pdf`
- expected type: `meeting_notice`
- expected status: `needs_review` until all resolutions are fully extracted and
  checked.

Important follow-up:

- obtain a real accounting PDF such as `Zawiadomienie o oplatach 2026.04.pdf`
  through manual download or Gmail REST importer, then validate monthly charge
  extraction.
- do not restate raw portal credentials from screenshots; mark them as sensitive
  findings only.

---

## 24. Acceptance Checklist for v1

- [ ] `npm install` works.
- [ ] `npm run setup` creates folder layout and DB.
- [ ] Registering the same file twice is idempotent.
- [ ] `zawiad po zebraniu.pdf` is registered by hash.
- [ ] Scanned PDF pages can be rendered/OCRed.
- [ ] A valid `meeting_notice` record can be stored.
- [ ] Valid records can be stored for `media_settlement`, `interest_note`, and
      `account_statement`.
- [ ] Visible passwords are redacted and produce `SECRET_VISIBLE`.
- [ ] CLI commands exist for setup, register, put-record, put-note, search,
      list-work, detect-anomalies, write-inbox, and Gmail sync.
- [ ] `npm run reindex` rebuilds SQLite.
- [ ] `npm run validate` reports no structural errors.
- [ ] Gmail OAuth completes.
- [ ] Gmail importer saves accounting PDFs despite `application/octet-stream`.
- [ ] Gmail sync uses 14-day lookback and Gmail-id dedupe.
- [ ] `reports/inbox.md` can be generated.
- [ ] `reports/` is ignored by Git.
- [ ] Backup archive includes a manifest and verifies hashes.
- [ ] At least one Q&A answer cites a local source.

---

## 25. Open Decisions

These are deliberately deferred:

1. Whether to move the repo off Desktop if Desktop is OneDrive-synced.
2. Whether future semantic search should use local or provider embeddings.
3. Whether a future web app is read-only or can acknowledge/resolve anomalies.
4. Whether bank/payment reconciliation becomes v1.1 or v2.
5. Whether e-kartoteka portal access should ever be automated. Default is no.

Defaults:

- Keep v1 manual and Codex-operated.
- Prefer local files and SQLite over services.
- Prefer direct Gmail REST over connector attachment parsing.
- Prefer rendered-page Codex/vision extraction for scanned PDFs.
- Prefer deterministic scripts for storage/indexing and Codex for
  interpretation.

---

## 26. Glossary

- **Canonical**: data that must be backed up and can rebuild derived state.
- **Derived**: cache/index/report output that can be regenerated.
- **Record**: structured AI extraction JSON for a document.
- **Note**: Markdown summary for human and AI reading.
- **Source observation**: one sighting of a document, such as a Gmail attachment
  or manual drop.
- **Hash identity**: SHA-256 bytes determine whether a document is new.
- **Runbook**: written Codex procedure for repeatable AI operation.

---

## 27. Final Design Decision

The Property Vault is a Codex-operated local knowledge base, not a traditional
app. Node.js provides stable rails: files, hashes, SQLite, validation, imports,
and reports. Codex provides judgment: reading scanned Polish documents,
extracting meaning, comparing context, and answering questions.

This split should remain stable as the project grows.

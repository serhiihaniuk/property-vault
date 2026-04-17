import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';

export const CURRENT_DB_SCHEMA_VERSION = 1;

export type VaultDatabase = Database.Database;

export async function openVaultDatabase(root = resolveRepoRoot()): Promise<VaultDatabase> {
  const paths = getVaultPaths(root);
  await mkdir(path.dirname(paths.databasePath), { recursive: true });

  const db = new Database(paths.databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  return db;
}

export async function initializeDatabase(root = resolveRepoRoot()): Promise<void> {
  const db = await openVaultDatabase(root);

  try {
    initializeSchema(db);
  } finally {
    db.close();
  }
}

export function initializeSchema(db: VaultDatabase): void {
  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${CURRENT_DB_SCHEMA_VERSION}`);
}

export function getDatabaseSchemaVersion(db: VaultDatabase): number {
  const row = db.pragma('user_version', { simple: true });
  return Number(row);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  hash TEXT PRIMARY KEY CHECK (length(hash) = 64),
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  ingested_at TEXT NOT NULL,
  page_count INTEGER,
  has_text_layer INTEGER NOT NULL DEFAULT 0 CHECK (has_text_layer IN (0, 1)),
  needs_ocr INTEGER NOT NULL DEFAULT 0 CHECK (needs_ocr IN (0, 1)),
  ocr_status TEXT NOT NULL DEFAULT 'not_needed',
  document_date TEXT,
  asset_tag TEXT,
  local_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_sources (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  original_filename TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (hash) REFERENCES documents(hash) ON DELETE CASCADE,
  UNIQUE (hash, source_kind, source_ref)
);

CREATE TABLE IF NOT EXISTS emails (
  gmail_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  history_id TEXT,
  internal_date TEXT,
  sent_at TEXT,
  received_at TEXT,
  sender TEXT,
  recipients TEXT NOT NULL DEFAULT '[]',
  subject TEXT,
  labels TEXT NOT NULL DEFAULT '[]',
  body_path TEXT NOT NULL,
  raw_headers TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id INTEGER PRIMARY KEY,
  gmail_id TEXT NOT NULL,
  attachment_index INTEGER NOT NULL,
  attachment_id TEXT,
  filename TEXT,
  declared_mime TEXT,
  sniffed_mime TEXT,
  size_bytes INTEGER,
  hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (gmail_id) REFERENCES emails(gmail_id) ON DELETE CASCADE,
  FOREIGN KEY (hash) REFERENCES documents(hash) ON DELETE SET NULL,
  UNIQUE (gmail_id, attachment_index)
);

CREATE TABLE IF NOT EXISTS records (
  hash TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  extractor_version TEXT NOT NULL,
  extracted_at TEXT NOT NULL,
  extracted_by TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  document_type TEXT NOT NULL,
  document_date TEXT,
  period_kind TEXT NOT NULL,
  period_value TEXT,
  period_start TEXT,
  period_end TEXT,
  title TEXT NOT NULL,
  summary_plain TEXT NOT NULL,
  record_path TEXT NOT NULL,
  note_path TEXT,
  record_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (hash) REFERENCES documents(hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS financial_rows (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  row_type TEXT NOT NULL,
  category TEXT NOT NULL,
  category_original TEXT NOT NULL,
  category_group TEXT,
  period_kind TEXT NOT NULL,
  period_value TEXT,
  period_start TEXT,
  period_end TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  quantity_value REAL,
  quantity_unit TEXT,
  unit_price_minor INTEGER,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_page INTEGER,
  note TEXT,
  FOREIGN KEY (hash) REFERENCES records(hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS important_dates (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  FOREIGN KEY (hash) REFERENCES records(hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resolutions (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  number TEXT NOT NULL,
  subject TEXT NOT NULL,
  outcome TEXT NOT NULL,
  voting_method TEXT,
  money_limit_amount_minor INTEGER,
  money_limit_currency TEXT,
  note TEXT,
  FOREIGN KEY (hash) REFERENCES records(hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  subject_hash TEXT,
  payload_signature TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (rule_id, subject_hash, payload_signature)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_records USING fts5(
  hash UNINDEXED,
  title,
  summary_plain,
  key_facts,
  note,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE INDEX IF NOT EXISTS idx_document_sources_hash
  ON document_sources(hash);

CREATE INDEX IF NOT EXISTS idx_email_attachments_gmail_id
  ON email_attachments(gmail_id);

CREATE INDEX IF NOT EXISTS idx_email_attachments_hash
  ON email_attachments(hash);

CREATE INDEX IF NOT EXISTS idx_records_document_type
  ON records(document_type);

CREATE INDEX IF NOT EXISTS idx_financial_rows_hash
  ON financial_rows(hash);

CREATE INDEX IF NOT EXISTS idx_financial_rows_category_period
  ON financial_rows(category, period_kind, period_value, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_important_dates_date
  ON important_dates(date);

CREATE INDEX IF NOT EXISTS idx_resolutions_outcome
  ON resolutions(outcome);

CREATE INDEX IF NOT EXISTS idx_anomalies_status
  ON anomalies(status);
`;

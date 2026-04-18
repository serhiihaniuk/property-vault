import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const vault = pgSchema('vault');

const timestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const vaultDocuments = vault.table(
  'documents',
  {
    hash: text('hash').primaryKey(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'string' }).notNull(),
    pageCount: integer('page_count'),
    hasTextLayer: boolean('has_text_layer').notNull().default(false),
    needsOcr: boolean('needs_ocr').notNull().default(false),
    ocrStatus: text('ocr_status').notNull().default('not_needed'),
    documentDate: date('document_date', { mode: 'string' }),
    assetTag: text('asset_tag'),
    localPath: text('local_path').notNull(),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    index('vault_documents_asset_tag_idx').on(table.assetTag),
    index('vault_documents_document_date_idx').on(table.documentDate),
  ],
);

export const vaultDocumentSources = vault.table(
  'document_sources',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash')
      .notNull()
      .references(() => vaultDocuments.hash, { onDelete: 'cascade' }),
    sourceKind: text('source_kind').notNull(),
    sourceRef: text('source_ref').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true, mode: 'string' }).notNull(),
    originalFilename: text('original_filename'),
    createdAt: timestampColumn('created_at'),
  },
  (table) => [
    index('vault_document_sources_hash_idx').on(table.hash),
    uniqueIndex('vault_document_sources_unique').on(
      table.hash,
      table.sourceKind,
      table.sourceRef,
    ),
  ],
);

export const vaultEmails = vault.table(
  'emails',
  {
    gmailId: text('gmail_id').primaryKey(),
    threadId: text('thread_id').notNull(),
    historyId: text('history_id'),
    internalDate: timestamp('internal_date', { withTimezone: true, mode: 'string' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }),
    sender: text('sender'),
    recipients: jsonb('recipients').notNull().default(sql`'[]'::jsonb`),
    subject: text('subject'),
    labels: jsonb('labels').notNull().default(sql`'[]'::jsonb`),
    bodyPath: text('body_path').notNull(),
    rawHeaders: jsonb('raw_headers').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    index('vault_emails_thread_id_idx').on(table.threadId),
    index('vault_emails_received_at_idx').on(table.receivedAt),
  ],
);

export const vaultEmailAttachments = vault.table(
  'email_attachments',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gmailId: text('gmail_id')
      .notNull()
      .references(() => vaultEmails.gmailId, { onDelete: 'cascade' }),
    attachmentIndex: integer('attachment_index').notNull(),
    attachmentId: text('attachment_id'),
    filename: text('filename'),
    declaredMime: text('declared_mime'),
    sniffedMime: text('sniffed_mime'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    hash: text('hash').references(() => vaultDocuments.hash, { onDelete: 'set null' }),
    createdAt: timestampColumn('created_at'),
  },
  (table) => [
    index('vault_email_attachments_gmail_id_idx').on(table.gmailId),
    index('vault_email_attachments_hash_idx').on(table.hash),
    uniqueIndex('vault_email_attachments_unique').on(table.gmailId, table.attachmentIndex),
  ],
);

export const vaultRecords = vault.table(
  'records',
  {
    hash: text('hash')
      .primaryKey()
      .references(() => vaultDocuments.hash, { onDelete: 'cascade' }),
    schemaVersion: integer('schema_version').notNull(),
    extractorVersion: text('extractor_version').notNull(),
    extractedAt: timestamp('extracted_at', { withTimezone: true, mode: 'string' }).notNull(),
    extractedBy: text('extracted_by').notNull(),
    status: text('status').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    documentType: text('document_type').notNull(),
    documentDate: date('document_date', { mode: 'string' }),
    periodKind: text('period_kind').notNull(),
    periodValue: text('period_value'),
    periodStart: date('period_start', { mode: 'string' }),
    periodEnd: date('period_end', { mode: 'string' }),
    title: text('title').notNull(),
    summaryPlain: text('summary_plain').notNull(),
    recordPath: text('record_path').notNull(),
    notePath: text('note_path'),
    recordJson: jsonb('record_json').notNull(),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    index('vault_records_document_type_idx').on(table.documentType),
    index('vault_records_period_idx').on(
      table.periodKind,
      table.periodValue,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const vaultFinancialRows = vault.table(
  'financial_rows',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash')
      .notNull()
      .references(() => vaultRecords.hash, { onDelete: 'cascade' }),
    rowType: text('row_type').notNull(),
    category: text('category').notNull(),
    categoryOriginal: text('category_original').notNull(),
    categoryGroup: text('category_group'),
    periodKind: text('period_kind').notNull(),
    periodValue: text('period_value'),
    periodStart: date('period_start', { mode: 'string' }),
    periodEnd: date('period_end', { mode: 'string' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('PLN'),
    quantityValue: doublePrecision('quantity_value'),
    quantityUnit: text('quantity_unit'),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }),
    confidence: doublePrecision('confidence').notNull(),
    sourcePage: integer('source_page'),
    note: text('note'),
  },
  (table) => [
    index('vault_financial_rows_hash_idx').on(table.hash),
    index('vault_financial_rows_category_period_idx').on(
      table.category,
      table.periodKind,
      table.periodValue,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const vaultImportantDates = vault.table(
  'important_dates',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash')
      .notNull()
      .references(() => vaultRecords.hash, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    label: text('label').notNull(),
    kind: text('kind').notNull(),
  },
  (table) => [index('vault_important_dates_date_idx').on(table.date)],
);

export const vaultResolutions = vault.table(
  'resolutions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hash: text('hash')
      .notNull()
      .references(() => vaultRecords.hash, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    subject: text('subject').notNull(),
    outcome: text('outcome').notNull(),
    votingMethod: text('voting_method'),
    moneyLimitAmountMinor: bigint('money_limit_amount_minor', { mode: 'number' }),
    moneyLimitCurrency: text('money_limit_currency'),
    note: text('note'),
  },
  (table) => [index('vault_resolutions_outcome_idx').on(table.outcome)],
);

export const vaultAnomalies = vault.table(
  'anomalies',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ruleId: text('rule_id').notNull(),
    severity: text('severity').notNull(),
    subjectHash: text('subject_hash'),
    payloadSignature: text('payload_signature').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    status: text('status').notNull().default('open'),
    detectedAt: timestamp('detected_at', { withTimezone: true, mode: 'string' }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    uniqueIndex('vault_anomalies_unique').on(
      table.ruleId,
      table.subjectHash,
      table.payloadSignature,
    ),
    index('vault_anomalies_status_idx').on(table.status),
  ],
);

export const vaultSyncRuns = vault.table(
  'sync_runs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kind: text('kind').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    status: text('status').notNull(),
    summaryJson: jsonb('summary_json').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [index('vault_sync_runs_kind_status_idx').on(table.kind, table.status)],
);

export const vaultRecordSearch = vault.table(
  'record_search',
  {
    recordHash: text('record_hash')
      .primaryKey()
      .references(() => vaultRecords.hash, { onDelete: 'cascade' }),
    title: text('title'),
    summaryPlain: text('summary_plain'),
    keyFacts: text('key_facts'),
    note: text('note'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [index('vault_record_search_updated_at_idx').on(table.updatedAt)],
);

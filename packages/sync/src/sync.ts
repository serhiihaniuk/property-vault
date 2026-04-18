import {
  appSyncState,
  closeDatabase,
  createDatabase,
  vaultAnomalies,
  vaultDocumentSources,
  vaultDocuments,
  vaultEmailAttachments,
  vaultEmails,
  vaultFinancialRows,
  vaultImportantDates,
  vaultRecords,
  vaultRecordSearch,
  vaultResolutions,
  vaultSyncRuns,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { resolveRepoRoot, sha256Text, type VaultRecord } from '@dabrowskiego/vault';
import {
  readCanonicalVaultSnapshot,
  type CanonicalDocument,
  type CanonicalRecordEntry,
  type CanonicalVaultSnapshot,
} from './canonical.ts';

const DEFAULT_SYNC_STATE_KEY = 'canonical_vault';
const DEFAULT_SYNC_RUN_KIND = 'canonical_vault';

type SyncDatabase = Pick<
  PropertyVaultDatabase,
  'delete' | 'execute' | 'insert' | 'select' | 'update'
>;

export interface VaultSyncOptions {
  connectionString?: string;
  db?: PropertyVaultDatabase;
  now?: () => Date;
  root?: string;
  syncRunKind?: string;
  syncStateKey?: string;
}

export interface VaultSyncResult {
  mode: 'rebuild' | 'sync';
  runRef: string;
  startedAt: string;
  finishedAt: string;
  snapshotHash: string;
  syncRunKind: string;
  syncStateKey: string;
  summary: VaultSyncSummary;
}

export interface VaultSyncSummary {
  status: 'ok';
  snapshot: CanonicalVaultSnapshot['counts'];
  operations: {
    anomaliesCleared: number;
    documentsDeleted: number;
    documentsUpserted: number;
    emailAttachmentsRebuilt: number;
    emailsRebuilt: number;
    financialRowsRebuilt: number;
    importantDatesRebuilt: number;
    recordSearchRebuilt: number;
    recordsRebuilt: number;
    resolutionsRebuilt: number;
    sourcesRebuilt: number;
  };
}

export async function syncVaultToDatabase(
  options: VaultSyncOptions = {},
): Promise<VaultSyncResult> {
  return runVaultSync('sync', options);
}

export async function rebuildVaultSchema(
  options: VaultSyncOptions = {},
): Promise<VaultSyncResult> {
  return runVaultSync('rebuild', options);
}

async function runVaultSync(
  mode: 'rebuild' | 'sync',
  options: VaultSyncOptions,
): Promise<VaultSyncResult> {
  const root = options.root ?? resolveRepoRoot();
  const snapshot = await readCanonicalVaultSnapshot(root);
  const snapshotHash = hashSnapshot(snapshot);
  const startedAt = (options.now ?? (() => new Date()))().toISOString();
  const syncStateKey = options.syncStateKey ?? DEFAULT_SYNC_STATE_KEY;
  const syncRunKind = options.syncRunKind ?? DEFAULT_SYNC_RUN_KIND;

  return withDatabase(options, async (db) => {
    let syncStateMarkedRunning = false;
    let syncRunCreated = false;

    try {
      await setSyncStateRunning(db, {
        snapshot,
        snapshotHash,
        startedAt,
        syncStateKey,
      });
      syncStateMarkedRunning = true;

      const runRef = await createSyncRun(db, {
        mode,
        snapshot,
        snapshotHash,
        startedAt,
        syncRunKind,
      });
      syncRunCreated = true;
      const summary = await db.transaction(async (tx) => {
        let anomaliesCleared = 0;

        if (mode === 'rebuild') {
          anomaliesCleared = (await tx
            .select({ id: vaultAnomalies.id })
            .from(vaultAnomalies)).length;
          await clearVaultDerivedTables(tx);
        }

        return applySnapshot(tx, snapshot, mode, anomaliesCleared);
      });
      const finishedAt = (options.now ?? (() => new Date()))().toISOString();
      const result: VaultSyncResult = {
        mode,
        runRef,
        startedAt,
        finishedAt,
        snapshotHash,
        syncRunKind,
        syncStateKey,
        summary,
      };

      await finishSyncRun(
        db,
        {
          startedAt,
          syncRunKind,
        },
        'ok',
        result.summary,
        finishedAt,
      );
      await setSyncStateSucceeded(db, syncStateKey, snapshotHash, result.summary, {
        finishedAt,
        startedAt,
      });

      return result;
    } catch (error) {
      const finishedAt = (options.now ?? (() => new Date()))().toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (syncRunCreated) {
        await finishSyncRun(
          db,
          {
            startedAt,
            syncRunKind,
          },
          'failed',
          {
            error: errorMessage,
            mode,
            snapshot: snapshot.counts,
            snapshotHash,
          },
          finishedAt,
        );
      }
      if (syncStateMarkedRunning) {
        await setSyncStateFailed(db, syncStateKey, snapshotHash, {
          errorMessage,
          finishedAt,
          startedAt,
        });
      }

      throw error;
    }
  });
}

async function applySnapshot(
  db: SyncDatabase,
  snapshot: CanonicalVaultSnapshot,
  mode: 'rebuild' | 'sync',
  anomaliesCleared: number,
): Promise<VaultSyncSummary> {
  const existingDocumentRows = await db
    .select({ hash: vaultDocuments.hash })
    .from(vaultDocuments);
  const snapshotDocumentHashes = new Set(snapshot.documents.map((document) => document.hash));
  const deletedDocumentHashes = existingDocumentRows
    .map((row) => row.hash)
    .filter((hash) => !snapshotDocumentHashes.has(hash));

  for (const document of snapshot.documents) {
    await upsertDocument(db, document);
  }

  await rebuildSourceObservations(db, snapshot);
  await rebuildEmails(db, snapshot);
  await rebuildRecords(db, snapshot);
  await pruneMissingDocuments(db, snapshot.documents);

  return {
    status: 'ok',
    snapshot: snapshot.counts,
    operations: {
      anomaliesCleared,
      documentsDeleted: deletedDocumentHashes.length,
      documentsUpserted: snapshot.documents.length,
      emailAttachmentsRebuilt: snapshot.counts.emailAttachments,
      emailsRebuilt: snapshot.counts.emails,
      financialRowsRebuilt: snapshot.counts.financialRows,
      importantDatesRebuilt: snapshot.counts.importantDates,
      recordSearchRebuilt: snapshot.counts.records,
      recordsRebuilt: snapshot.counts.records,
      resolutionsRebuilt: snapshot.counts.resolutions,
      sourcesRebuilt: snapshot.counts.sourceObservations,
    },
  };
}

async function upsertDocument(db: SyncDatabase, document: CanonicalDocument): Promise<void> {
  await db
    .insert(vaultDocuments)
    .values({
      assetTag: document.assetTag,
      documentDate: document.documentDate,
      hash: document.hash,
      hasTextLayer: document.hasTextLayer,
      ingestedAt: document.ingestedAt,
      localPath: document.localPath,
      mime: document.mime,
      needsOcr: document.needsOcr,
      ocrStatus: document.ocrStatus,
      pageCount: document.pageCount,
      sizeBytes: document.sizeBytes,
      updatedAt: document.ingestedAt,
    })
    .onConflictDoUpdate({
      target: vaultDocuments.hash,
      set: {
        assetTag: document.assetTag,
        documentDate: document.documentDate,
        hasTextLayer: document.hasTextLayer,
        ingestedAt: document.ingestedAt,
        localPath: document.localPath,
        mime: document.mime,
        needsOcr: document.needsOcr,
        ocrStatus: document.ocrStatus,
        pageCount: document.pageCount,
        sizeBytes: document.sizeBytes,
        updatedAt: document.ingestedAt,
      },
    });
}

async function rebuildSourceObservations(
  db: SyncDatabase,
  snapshot: CanonicalVaultSnapshot,
): Promise<void> {
  await db.delete(vaultDocumentSources);

  if (snapshot.sourceObservations.length === 0) {
    return;
  }

  await db.insert(vaultDocumentSources).values(
    snapshot.sourceObservations.map((observation) => ({
      hash: observation.hash,
      originalFilename: observation.originalFilename,
      seenAt: observation.seenAt,
      sourceKind: observation.sourceKind,
      sourceRef: stableStringify(observation.sourceRef),
    })),
  );
}

async function rebuildEmails(
  db: SyncDatabase,
  snapshot: CanonicalVaultSnapshot,
): Promise<void> {
  await db.delete(vaultEmailAttachments);
  await db.delete(vaultEmails);

  if (snapshot.emails.length === 0) {
    return;
  }

  for (const email of snapshot.emails) {
    await db.insert(vaultEmails).values({
      bodyPath: email.bodyPath,
      gmailId: email.gmailId,
      historyId: email.historyId,
      internalDate: email.internalDate,
      labels: email.labels,
      rawHeaders: email.rawHeaders,
      receivedAt: email.receivedAt,
      recipients: email.recipients,
      sender: email.sender,
      sentAt: email.sentAt,
      subject: email.subject,
      threadId: email.threadId,
    });

    if (email.attachments.length === 0) {
      continue;
    }

    await db.insert(vaultEmailAttachments).values(
      email.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        attachmentIndex: attachment.attachmentIndex,
        declaredMime: attachment.declaredMime,
        filename: attachment.filename,
        gmailId: email.gmailId,
        hash: attachment.hash,
        sizeBytes: attachment.sizeBytes,
        sniffedMime: attachment.sniffedMime,
      })),
    );
  }
}

async function rebuildRecords(
  db: SyncDatabase,
  snapshot: CanonicalVaultSnapshot,
): Promise<void> {
  await db.delete(vaultRecordSearch);
  await db.delete(vaultFinancialRows);
  await db.delete(vaultImportantDates);
  await db.delete(vaultResolutions);
  await db.delete(vaultRecords);

  if (snapshot.records.length === 0) {
    return;
  }

  for (const entry of snapshot.records) {
    await insertRecordBundle(db, entry, snapshot.notes.get(entry.hash) ?? null);
  }
}

async function insertRecordBundle(
  db: SyncDatabase,
  entry: CanonicalRecordEntry,
  note: CanonicalVaultSnapshot['notes'] extends Map<string, infer T> ? T | null : never,
): Promise<void> {
  const { hash, record, recordPath } = entry;
  const period = periodColumns(record.period);

  await db.insert(vaultRecords).values({
    confidence: record.confidence,
    documentDate: record.document_date,
    documentType: record.document_type,
    extractedAt: record.extracted_at,
    extractedBy: record.extracted_by,
    extractorVersion: record.extractor_version,
    hash,
    notePath: note?.relativePath ?? null,
    periodEnd: period.periodEnd,
    periodKind: period.periodKind,
    periodStart: period.periodStart,
    periodValue: period.periodValue,
    recordJson: record,
    recordPath,
    schemaVersion: record.schema_version,
    status: record.status,
    summaryPlain: record.summary_plain,
    title: record.title,
    updatedAt: record.extracted_at,
  });

  if (record.financial_rows.length > 0) {
    await db.insert(vaultFinancialRows).values(
      record.financial_rows.map((row) => {
        const rowPeriod = periodColumns(row.period);

        return {
          amountMinor: row.money.amount_minor,
          category: row.category,
          categoryGroup: row.category_group,
          categoryOriginal: row.category_original,
          confidence: row.confidence,
          currency: row.money.currency,
          hash,
          note: row.note,
          periodEnd: rowPeriod.periodEnd,
          periodKind: rowPeriod.periodKind,
          periodStart: rowPeriod.periodStart,
          periodValue: rowPeriod.periodValue,
          quantityUnit: row.quantity?.unit ?? null,
          quantityValue: row.quantity?.value ?? null,
          rowType: row.row_type,
          sourcePage: row.source_page,
          unitPriceMinor: row.unit_price_minor,
        };
      }),
    );
  }

  if (record.important_dates.length > 0) {
    await db.insert(vaultImportantDates).values(
      record.important_dates.map((item) => ({
        date: item.date,
        hash,
        kind: item.kind,
        label: item.label,
      })),
    );
  }

  if (record.resolutions.length > 0) {
    await db.insert(vaultResolutions).values(
      record.resolutions.map((item) => ({
        hash,
        moneyLimitAmountMinor: item.money_limit?.amount_minor ?? null,
        moneyLimitCurrency: item.money_limit?.currency ?? null,
        note: item.note,
        number: item.number,
        outcome: item.outcome,
        subject: item.subject,
        votingMethod: item.voting_method,
      })),
    );
  }

  await db.insert(vaultRecordSearch).values({
    keyFacts: formatKeyFacts(record),
    note: note?.markdown ?? '',
    recordHash: hash,
    summaryPlain: record.summary_plain,
    title: record.title,
    updatedAt: record.extracted_at,
  });
}

async function pruneMissingDocuments(
  db: SyncDatabase,
  documents: readonly CanonicalDocument[],
): Promise<void> {
  const hashes = documents.map((document) => document.hash);

  if (hashes.length === 0) {
    await db.delete(vaultDocuments);
    return;
  }

  await db.delete(vaultDocuments).where(notInArray(vaultDocuments.hash, hashes));
}

async function clearVaultDerivedTables(db: SyncDatabase): Promise<void> {
  await db.delete(vaultRecordSearch);
  await db.delete(vaultFinancialRows);
  await db.delete(vaultImportantDates);
  await db.delete(vaultResolutions);
  await db.delete(vaultRecords);
  await db.delete(vaultEmailAttachments);
  await db.delete(vaultEmails);
  await db.delete(vaultDocumentSources);
  await db.delete(vaultAnomalies);
  await db.delete(vaultDocuments);
}

async function createSyncRun(
  db: PropertyVaultDatabase,
  input: {
    mode: 'rebuild' | 'sync';
    snapshot: CanonicalVaultSnapshot;
    snapshotHash: string;
    startedAt: string;
    syncRunKind: string;
  },
): Promise<string> {
  await db.insert(vaultSyncRuns).values({
    kind: input.syncRunKind,
    startedAt: input.startedAt,
    status: 'running',
    summaryJson: {
      mode: input.mode,
      snapshot: input.snapshot.counts,
      snapshotHash: input.snapshotHash,
    },
  });

  return `${input.syncRunKind}:${input.startedAt}`;
}

async function finishSyncRun(
  db: PropertyVaultDatabase,
  identity: {
    startedAt: string;
    syncRunKind: string;
  },
  status: 'failed' | 'ok',
  summary: unknown,
  finishedAt: string,
): Promise<void> {
  await db
    .update(vaultSyncRuns)
    .set({
      finishedAt,
      status,
      summaryJson: summary,
    })
    .where(
      and(
        eq(vaultSyncRuns.kind, identity.syncRunKind),
        eq(vaultSyncRuns.startedAt, identity.startedAt),
        isNull(vaultSyncRuns.finishedAt),
      ),
    );
}

async function setSyncStateRunning(
  db: PropertyVaultDatabase,
  input: {
    snapshot: CanonicalVaultSnapshot;
    snapshotHash: string;
    startedAt: string;
    syncStateKey: string;
  },
): Promise<void> {
  await db
    .insert(appSyncState)
    .values({
      cursorJson: {
        snapshotHash: input.snapshotHash,
      },
      key: input.syncStateKey,
      lastError: null,
      lastStartedAt: input.startedAt,
      status: 'running',
      summaryJson: {
        phase: 'started',
        snapshot: input.snapshot.counts,
      },
      updatedAt: input.startedAt,
    })
    .onConflictDoUpdate({
      target: appSyncState.key,
      set: {
        cursorJson: {
          snapshotHash: input.snapshotHash,
        },
        lastError: null,
        lastStartedAt: input.startedAt,
        status: 'running',
        summaryJson: {
          phase: 'started',
          snapshot: input.snapshot.counts,
        },
        updatedAt: input.startedAt,
      },
    });
}

async function setSyncStateSucceeded(
  db: PropertyVaultDatabase,
  syncStateKey: string,
  snapshotHash: string,
  summary: VaultSyncSummary,
  timestamps: {
    finishedAt: string;
    startedAt: string;
  },
): Promise<void> {
  await db
    .insert(appSyncState)
    .values({
      cursorJson: {
        snapshotHash,
      },
      key: syncStateKey,
      lastError: null,
      lastFinishedAt: timestamps.finishedAt,
      lastStartedAt: timestamps.startedAt,
      lastSuccessAt: timestamps.finishedAt,
      status: 'idle',
      summaryJson: summary,
      updatedAt: timestamps.finishedAt,
    })
    .onConflictDoUpdate({
      target: appSyncState.key,
      set: {
        cursorJson: {
          snapshotHash,
        },
        lastError: null,
        lastFinishedAt: timestamps.finishedAt,
        lastStartedAt: timestamps.startedAt,
        lastSuccessAt: timestamps.finishedAt,
        status: 'idle',
        summaryJson: summary,
        updatedAt: timestamps.finishedAt,
      },
    });
}

async function setSyncStateFailed(
  db: PropertyVaultDatabase,
  syncStateKey: string,
  snapshotHash: string,
  input: {
    errorMessage: string;
    finishedAt: string;
    startedAt: string;
  },
): Promise<void> {
  await db
    .insert(appSyncState)
    .values({
      cursorJson: {
        snapshotHash,
      },
      key: syncStateKey,
      lastError: input.errorMessage,
      lastFinishedAt: input.finishedAt,
      lastStartedAt: input.startedAt,
      status: 'error',
      summaryJson: {
        error: input.errorMessage,
      },
      updatedAt: input.finishedAt,
    })
    .onConflictDoUpdate({
      target: appSyncState.key,
      set: {
        cursorJson: {
          snapshotHash,
        },
        lastError: input.errorMessage,
        lastFinishedAt: input.finishedAt,
        lastStartedAt: input.startedAt,
        status: 'error',
        summaryJson: {
          error: input.errorMessage,
        },
        updatedAt: input.finishedAt,
      },
    });
}

function formatKeyFacts(record: VaultRecord): string {
  return [
    ...record.key_facts.map((fact) => `${fact.label}: ${fact.value}`),
    ...record.questions_for_user,
    ...record.warnings,
  ].join('\n');
}

function periodColumns(period: VaultRecord['period']): {
  periodKind: string;
  periodValue: string | null;
  periodStart: string | null;
  periodEnd: string | null;
} {
  if (period.kind === 'month' || period.kind === 'year') {
    return {
      periodKind: period.kind,
      periodValue: period.value,
      periodStart: null,
      periodEnd: null,
    };
  }

  if (period.kind === 'range') {
    return {
      periodKind: period.kind,
      periodValue: null,
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  return {
    periodKind: period.kind,
    periodValue: null,
    periodStart: null,
    periodEnd: null,
  };
}

function hashSnapshot(snapshot: CanonicalVaultSnapshot): string {
  return sha256Text(
    stableStringify({
      documentTags: [...snapshot.documentTags.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
      documents: snapshot.documents.map((document) => ({
        assetTag: document.assetTag,
        documentDate: document.documentDate,
        hash: document.hash,
        localPath: document.localPath,
        mime: document.mime,
        sizeBytes: document.sizeBytes,
      })),
      emails: snapshot.emails.map((email) => ({
        attachments: email.attachments,
        bodyPath: email.bodyPath,
        gmailId: email.gmailId,
        historyId: email.historyId,
      })),
      notes: [...snapshot.notes.values()]
        .sort((left, right) => left.hash.localeCompare(right.hash))
        .map((note) => ({
          hash: note.hash,
          markdownHash: sha256Text(note.markdown),
          relativePath: note.relativePath,
        })),
      records: snapshot.records.map((entry) => ({
        hash: entry.hash,
        recordHash: sha256Text(stableStringify(entry.record)),
        recordPath: entry.recordPath,
      })),
      sourceObservations: snapshot.sourceObservations.map((observation) => ({
        hash: observation.hash,
        originalFilename: observation.originalFilename,
        seenAt: observation.seenAt,
        sourceKind: observation.sourceKind,
        sourceRef: observation.sourceRef,
      })),
    }),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }

  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function withDatabase<T>(
  options: VaultSyncOptions,
  run: (db: PropertyVaultDatabase) => Promise<T>,
): Promise<T> {
  if (options.db) {
    return run(options.db);
  }

  const handle = createDatabase({
    connectionString: options.connectionString,
  });

  try {
    return await run(handle.db);
  } finally {
    await closeDatabase(handle);
  }
}

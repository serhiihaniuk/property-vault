import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import {
  CURRENT_DB_SCHEMA_VERSION,
  getDatabaseSchemaVersion,
  initializeDatabase,
  openVaultDatabase,
} from './db.ts';
import { normalizeVaultRecordFinancialCategories } from './financial-categories.ts';
import { isSha256Hex, normalizeSha256, sha256Buffer } from './hash.ts';
import { inspectPdf } from './pdf.ts';
import { getVaultPaths, resolveRepoRoot, type VaultPaths } from './paths.ts';
import { parseVaultRecord, type VaultRecord } from './schemas/record.ts';
import { createDefaultState, readState, writeState } from './state.ts';

export type InitResult = {
  root: string;
  createdDirectories: string[];
  createdFiles: string[];
};

export type DocumentSourceInput = {
  kind?: string;
  ref?: Record<string, unknown>;
  originalFilename?: string;
  seenAt?: string;
};

export type RegisterDocumentInput = {
  path: string;
  source?: DocumentSourceInput;
};

export type RegisterDocumentResult = {
  hash: string;
  mime: string;
  extension: string;
  sizeBytes: number;
  path: string;
  relativePath: string;
  isNewDocument: boolean;
  isNewSource: boolean;
};

export type PutRecordResult = {
  hash: string;
  path: string;
  relativePath: string;
  documentType: VaultRecord['document_type'];
  title: string;
};

export type PutNoteResult = {
  hash: string;
  path: string;
  relativePath: string;
};

export type ReindexResult = {
  root: string;
  documentsIndexed: number;
  sourcesIndexed: number;
  sourcesSkipped: number;
  emailsIndexed: number;
  emailAttachmentsIndexed: number;
  documentTagsIndexed: number;
  recordsIndexed: number;
  notesIndexed: number;
  anomaliesOpen: number;
};

export type SearchOptions = {
  query: string;
  limit?: number;
};

export type SearchResult = {
  hash: string;
  title: string;
  documentType: string;
  status: string;
  confidence: number;
  snippet: string;
  recordPath: string;
  notePath: string | null;
};

export type ExtractionWorkItem = {
  hash: string;
  mime: string;
  localPath: string;
  pageCount: number | null;
  needsOcr: boolean;
  ocrStatus: string;
  sourceKinds: string[];
};

export type VaultContext = {
  root: string;
  generatedAt: string;
  counts: {
    documents: number;
    records: number;
    emails: number;
    openAnomalies: number;
    extractionWork: number;
  };
  lastGmailSync: {
    at: string | null;
    highWatermarkDate: string | null;
    lookbackDays: number;
    messagesSeenTotal: number;
  };
  latestDocuments: Array<{
    hash: string;
    mime: string;
    localPath: string;
    ingestedAt: string;
    pageCount: number | null;
    needsOcr: boolean;
  }>;
  latestRecords: Array<{
    hash: string;
    title: string;
    documentType: string;
    status: string;
    confidence: number;
    recordPath: string;
    notePath: string | null;
  }>;
  extractionWork: ExtractionWorkItem[];
};

export type ValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
};

export type ValidationReport = {
  ok: boolean;
  root: string;
  checkedAt: string;
  strict: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  counts: {
    canonicalDocuments: number;
    sourceObservations: number;
    dbDocuments: number | null;
    dbSources: number | null;
  };
};

export type ValidationOptions = {
  strict?: boolean;
};

type SourceObservation = {
  hash: string;
  seen_at: string;
  source: {
    kind: string;
    [key: string]: unknown;
  };
};

type CanonicalRecord = {
  hash: string;
  record: VaultRecord;
};

type CanonicalNote = {
  relativePath: string;
  markdown: string;
};

type CanonicalEmail = {
  gmailId: string;
  threadId: string;
  historyId: string | null;
  internalDate: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  sender: string | null;
  recipients: string;
  subject: string | null;
  bodyPath: string;
  rawHeaders: string;
  attachments: CanonicalEmailAttachment[];
};

type CanonicalEmailAttachment = {
  gmailId: string;
  attachmentIndex: number;
  attachmentId: string | null;
  filename: string | null;
  declaredMime: string | null;
  sniffedMime: string | null;
  sizeBytes: number | null;
  hash: string | null;
};

export async function init(root = resolveRepoRoot()): Promise<InitResult> {
  const paths = getVaultPaths(root);
  const result = await ensureFileLayout(paths, root);

  await initializeDatabase(root);

  return {
    root: paths.root,
    createdDirectories: result.createdDirectories,
    createdFiles: result.createdFiles,
  };
}

export async function validate(
  root = resolveRepoRoot(),
  options: ValidationOptions = {},
): Promise<ValidationReport> {
  const paths = getVaultPaths(root);
  const strict = options.strict === true;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let canonicalDocuments: DocumentIndexRow[] = [];
  let sourceObservations: SourceObservation[] = [];
  let dbDocuments: DbDocumentRow[] | null = null;
  let dbSources: DbSourceRow[] | null = null;

  const issue = (item: ValidationIssue): void => {
    if (item.severity === 'error') {
      errors.push(item);
    } else {
      warnings.push(item);
    }
  };

  for (const directory of directoriesForInit(paths)) {
    if (!(await pathExists(directory))) {
      issue({
        severity: 'error',
        code: 'MISSING_DIRECTORY',
        message: `Required directory is missing: ${directory}`,
        path: directory,
      });
    }
  }

  if (strict) {
    await validateStrictGitIgnore(paths, issue);
  }

  if (!(await pathExists(paths.sourcesJsonl))) {
    issue({
      severity: 'error',
      code: 'MISSING_SOURCES_JSONL',
      message: `Missing source observation log: ${paths.sourcesJsonl}`,
      path: paths.sourcesJsonl,
    });
  } else {
    try {
      sourceObservations = await readSourceObservations(paths.sourcesJsonl);
      validateSourceObservations(sourceObservations, issue);
    } catch (error) {
      issue({
        severity: 'error',
        code: 'CORRUPT_SOURCES_JSONL',
        message: errorMessage(error),
        path: paths.sourcesJsonl,
      });
    }
  }

  if (!(await pathExists(paths.stateJson))) {
    issue({
      severity: 'error',
      code: 'MISSING_STATE',
      message: `Missing vault state: ${paths.stateJson}`,
      path: paths.stateJson,
    });
  } else {
    try {
      await readState(root);
    } catch (error) {
      issue({
        severity: 'error',
        code: 'CORRUPT_STATE',
        message: errorMessage(error),
        path: paths.stateJson,
      });
    }
  }

  if (await pathExists(paths.documentsDir)) {
    try {
      canonicalDocuments = await readCanonicalDocuments(paths);
    } catch (error) {
      issue({
        severity: 'error',
        code: errorMessage(error).includes('HASH_DRIFT')
          ? 'HASH_DRIFT'
          : 'INVALID_CANONICAL_DOCUMENT',
        message: errorMessage(error),
        path: paths.documentsDir,
      });
    }
  }

  const canonicalHashes = new Set(canonicalDocuments.map((document) => document.hash));

  for (const observation of sourceObservations) {
    if (!canonicalHashes.has(observation.hash)) {
      issue({
        severity: 'warning',
        code: 'SOURCE_WITHOUT_DOCUMENT',
        message: `Source observation references missing document hash ${observation.hash}`,
        path: paths.sourcesJsonl,
      });
    }
  }

  if (!(await pathExists(paths.databasePath))) {
    issue({
      severity: 'warning',
      code: 'MISSING_DATABASE',
      message: `Derived SQLite database is missing: ${paths.databasePath}`,
      path: paths.databasePath,
    });
  } else {
    const db = await openVaultDatabase(root);

    try {
      const integrity = db.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') {
        issue({
          severity: 'error',
          code: 'SQLITE_INTEGRITY',
          message: `SQLite integrity_check returned: ${String(integrity)}`,
          path: paths.databasePath,
        });
      }

      const schemaVersion = getDatabaseSchemaVersion(db);
      if (schemaVersion !== CURRENT_DB_SCHEMA_VERSION) {
        issue({
          severity: 'warning',
          code: 'DB_SCHEMA_VERSION',
          message: `SQLite schema version is ${schemaVersion}, expected ${CURRENT_DB_SCHEMA_VERSION}`,
          path: paths.databasePath,
        });
      }

      dbDocuments = db.prepare(`
        SELECT hash, local_path AS localPath, size_bytes AS sizeBytes
        FROM documents
        ORDER BY hash
      `).all() as DbDocumentRow[];
      dbSources = db.prepare(`
        SELECT hash, source_kind AS sourceKind, source_ref AS sourceRef
        FROM document_sources
        ORDER BY hash, source_kind, source_ref
      `).all() as DbSourceRow[];

      validateDbAgainstCanonical(paths, canonicalDocuments, dbDocuments, dbSources, issue);
    } catch (error) {
      issue({
        severity: 'error',
        code: 'SQLITE_READ_FAILED',
        message: errorMessage(error),
        path: paths.databasePath,
      });
    } finally {
      db.close();
    }
  }

  return {
    ok: errors.length === 0,
    root: paths.root,
    checkedAt: new Date().toISOString(),
    strict,
    errors,
    warnings,
    counts: {
      canonicalDocuments: canonicalDocuments.length,
      sourceObservations: sourceObservations.length,
      dbDocuments: dbDocuments?.length ?? null,
      dbSources: dbSources?.length ?? null,
    },
  };
}

export async function sql<T = unknown>(
  query: string,
  params: unknown[] = [],
  root = resolveRepoRoot(),
): Promise<T[]> {
  assertReadOnlySelectQuery(query);

  const db = await openVaultDatabase(root);

  try {
    return db.prepare(query).all(...params) as T[];
  } finally {
    db.close();
  }
}

export async function search(
  options: SearchOptions,
  root = resolveRepoRoot(),
): Promise<SearchResult[]> {
  const query = options.query.trim();

  if (query === '') {
    return [];
  }

  const db = await openVaultDatabase(root);

  try {
    return db.prepare(`
      SELECT
        records.hash,
        records.title,
        records.document_type AS documentType,
        records.status,
        records.confidence,
        snippet(fts_records, 2, '[', ']', ' ... ', 12) AS snippet,
        records.record_path AS recordPath,
        records.note_path AS notePath
      FROM fts_records
      JOIN records ON records.hash = fts_records.hash
      WHERE fts_records MATCH @query
      ORDER BY bm25(fts_records), records.document_date DESC, records.hash
      LIMIT @limit
    `).all({
      query: ftsQuery(query),
      limit: Math.max(1, Math.min(options.limit ?? 20, 100)),
    }) as SearchResult[];
  } finally {
    db.close();
  }
}

export async function listExtractionWork(
  root = resolveRepoRoot(),
  limit = 50,
): Promise<ExtractionWorkItem[]> {
  await init(root);

  const db = await openVaultDatabase(root);

  try {
    const rows = db.prepare(`
      SELECT
        documents.hash,
        documents.mime,
        documents.local_path AS localPath,
        documents.page_count AS pageCount,
        documents.needs_ocr AS needsOcr,
        documents.ocr_status AS ocrStatus,
        group_concat(DISTINCT document_sources.source_kind) AS sourceKinds
      FROM documents
      LEFT JOIN records ON records.hash = documents.hash
      LEFT JOIN document_sources ON document_sources.hash = documents.hash
      WHERE records.hash IS NULL
        AND documents.asset_tag IS NULL
      GROUP BY documents.hash
      ORDER BY documents.ingested_at DESC, documents.hash
      LIMIT @limit
    `).all({
      limit: Math.max(1, Math.min(limit, 500)),
    }) as Array<{
      hash: string;
      mime: string;
      localPath: string;
      pageCount: number | null;
      needsOcr: number;
      ocrStatus: string;
      sourceKinds: string | null;
    }>;

    return rows.map((row) => ({
      hash: row.hash,
      mime: row.mime,
      localPath: row.localPath,
      pageCount: row.pageCount,
      needsOcr: row.needsOcr === 1,
      ocrStatus: row.ocrStatus,
      sourceKinds: row.sourceKinds?.split(',').filter((value) => value !== '') ?? [],
    }));
  } finally {
    db.close();
  }
}

export async function context(root = resolveRepoRoot()): Promise<VaultContext> {
  await init(root);

  const state = await readState(root);
  const db = await openVaultDatabase(root);

  try {
    const counts = db.prepare(`
      SELECT
        (SELECT count(*) FROM documents) AS documents,
        (SELECT count(*) FROM records) AS records,
        (SELECT count(*) FROM emails) AS emails,
        (SELECT count(*) FROM anomalies WHERE status = 'open') AS openAnomalies,
        (
          SELECT count(*)
          FROM documents
          LEFT JOIN records ON records.hash = documents.hash
          WHERE records.hash IS NULL
            AND documents.asset_tag IS NULL
        ) AS extractionWork
    `).get() as {
      documents: number;
      records: number;
      emails: number;
      openAnomalies: number;
      extractionWork: number;
    };
    const latestDocuments = db.prepare(`
      SELECT
        hash,
        mime,
        local_path AS localPath,
        ingested_at AS ingestedAt,
        page_count AS pageCount,
        needs_ocr AS needsOcr
      FROM documents
      ORDER BY ingested_at DESC, hash
      LIMIT 5
    `).all() as Array<{
      hash: string;
      mime: string;
      localPath: string;
      ingestedAt: string;
      pageCount: number | null;
      needsOcr: number;
    }>;
    const latestRecords = db.prepare(`
      SELECT
        hash,
        title,
        document_type AS documentType,
        status,
        confidence,
        record_path AS recordPath,
        note_path AS notePath
      FROM records
      ORDER BY extracted_at DESC, hash
      LIMIT 5
    `).all() as VaultContext['latestRecords'];

    return {
      root,
      generatedAt: new Date().toISOString(),
      counts,
      lastGmailSync: {
        at: state.last_gmail_sync.at,
        highWatermarkDate: state.last_gmail_sync.high_watermark_date,
        lookbackDays: state.last_gmail_sync.lookback_days,
        messagesSeenTotal: state.last_gmail_sync.messages_seen_total,
      },
      latestDocuments: latestDocuments.map((document) => ({
        ...document,
        needsOcr: document.needsOcr === 1,
      })),
      latestRecords,
      extractionWork: await listExtractionWork(root, 10),
    };
  } finally {
    db.close();
  }
}

export async function reindex(root = resolveRepoRoot()): Promise<ReindexResult> {
  const paths = getVaultPaths(root);

  await ensureFileLayout(paths, root);
  await removeDatabaseFiles(paths);
  await initializeDatabase(root);

  const documentRows = await readCanonicalDocuments(paths);
  const sourceObservations = await readSourceObservations(paths.sourcesJsonl);
  const canonicalRecords = await readCanonicalRecords(paths);
  const canonicalNotes = await readCanonicalNotes(paths);
  const canonicalEmails = await readCanonicalEmails(paths);
  const canonicalDocumentTags = await readCanonicalDocumentTags(paths);
  const knownDocumentHashes = new Set(documentRows.map((row) => row.hash));
  let sourcesIndexed = 0;
  let sourcesSkipped = 0;
  let recordsIndexed = 0;
  let emailsIndexed = 0;
  let emailAttachmentsIndexed = 0;
  let documentTagsIndexed = 0;

  const db = await openVaultDatabase(root);

  try {
    const transaction = db.transaction(() => {
      const insertDocument = db.prepare(`
        INSERT INTO documents (
          hash,
          mime,
          size_bytes,
          ingested_at,
          page_count,
          has_text_layer,
          needs_ocr,
          ocr_status,
          document_date,
          asset_tag,
          local_path,
          updated_at
        )
        VALUES (
          @hash,
          @mime,
          @sizeBytes,
          @ingestedAt,
          @pageCount,
          @hasTextLayer,
          @needsOcr,
          @ocrStatus,
          NULL,
          NULL,
          @relativePath,
          datetime('now')
        )
      `);
      const insertSource = db.prepare(`
        INSERT OR IGNORE INTO document_sources (
          hash,
          source_kind,
          source_ref,
          seen_at,
          original_filename
        )
        VALUES (
          @hash,
          @sourceKind,
          @sourceRef,
          @seenAt,
          @originalFilename
        )
      `);
      const updateDocumentTag = db.prepare(`
        UPDATE documents
        SET asset_tag = @tag, updated_at = datetime('now')
        WHERE hash = @hash
      `);
      const insertEmail = db.prepare(`
        INSERT INTO emails (
          gmail_id,
          thread_id,
          history_id,
          internal_date,
          sent_at,
          received_at,
          sender,
          recipients,
          subject,
          labels,
          body_path,
          raw_headers,
          updated_at
        )
        VALUES (
          @gmailId,
          @threadId,
          @historyId,
          @internalDate,
          @sentAt,
          @receivedAt,
          @sender,
          @recipients,
          @subject,
          '[]',
          @bodyPath,
          @rawHeaders,
          datetime('now')
        )
      `);
      const insertEmailAttachment = db.prepare(`
        INSERT INTO email_attachments (
          gmail_id,
          attachment_index,
          attachment_id,
          filename,
          declared_mime,
          sniffed_mime,
          size_bytes,
          hash
        )
        VALUES (
          @gmailId,
          @attachmentIndex,
          @attachmentId,
          @filename,
          @declaredMime,
          @sniffedMime,
          @sizeBytes,
          @hash
        )
      `);

      for (const document of documentRows) {
        insertDocument.run(document);
      }

      for (const observation of sourceObservations) {
        if (!knownDocumentHashes.has(observation.hash)) {
          sourcesSkipped += 1;
          continue;
        }

        const result = insertSource.run({
          hash: observation.hash,
          sourceKind: observation.source.kind,
          sourceRef: stableStringify(sourceReferenceForIdentity(observation.source)),
          seenAt: observation.seen_at,
          originalFilename: originalFilenameFromObservation(observation),
        });

        if (result.changes > 0) {
          sourcesIndexed += 1;
        }
      }

      for (const [hash, tag] of canonicalDocumentTags) {
        if (!knownDocumentHashes.has(hash)) {
          continue;
        }

        const result = updateDocumentTag.run({ hash, tag });
        if (result.changes > 0) {
          documentTagsIndexed += 1;
        }
      }

      for (const email of canonicalEmails) {
        insertEmail.run(email);
        emailsIndexed += 1;

        for (const attachment of email.attachments) {
          insertEmailAttachment.run(attachment);
          emailAttachmentsIndexed += 1;
        }
      }

      for (const record of canonicalRecords) {
        if (!knownDocumentHashes.has(record.hash)) {
          continue;
        }

        indexRecord(db, paths, record.hash, record.record, canonicalNotes.get(record.hash) ?? null);
        recordsIndexed += 1;
      }
    });

    transaction();
  } finally {
    db.close();
  }

  const anomalyResult = await detectAnomaliesAfterReindex(root);

  return {
    root: paths.root,
    documentsIndexed: documentRows.length,
    sourcesIndexed,
    sourcesSkipped,
    emailsIndexed,
    emailAttachmentsIndexed,
    documentTagsIndexed,
    recordsIndexed,
    notesIndexed: canonicalNotes.size,
    anomaliesOpen: anomalyResult.open,
  };
}

async function ensureFileLayout(
  paths: VaultPaths,
  root: string,
): Promise<Pick<InitResult, 'createdDirectories' | 'createdFiles'>> {
  const createdDirectories: string[] = [];
  const createdFiles: string[] = [];

  for (const directory of directoriesForInit(paths)) {
    const existed = await pathExists(directory);
    await mkdir(directory, { recursive: true });

    if (!existed) {
      createdDirectories.push(directory);
    }
  }

  if (!(await pathExists(paths.sourcesJsonl))) {
    await writeFile(paths.sourcesJsonl, '', { encoding: 'utf8', flag: 'wx' });
    createdFiles.push(paths.sourcesJsonl);
  }

  if (!(await pathExists(paths.stateJson))) {
    await writeState(createDefaultState(), root);
    createdFiles.push(paths.stateJson);
  } else {
    await readState(root);
  }

  return {
    createdDirectories,
    createdFiles,
  };
}

export async function registerDocument(
  input: RegisterDocumentInput,
  root = resolveRepoRoot(),
): Promise<RegisterDocumentResult> {
  await init(root);

  const paths = getVaultPaths(root);
  const sourcePath = path.resolve(input.path);
  const sourceStats = await stat(sourcePath);

  if (!sourceStats.isFile()) {
    throw new Error(`Document path is not a file: ${sourcePath}`);
  }

  const bytes = await readFile(sourcePath);
  const hash = sha256Buffer(bytes);
  const detected = await fileTypeFromBuffer(bytes);
  const extension = normalizeExtension(
    detected?.ext ?? path.extname(sourcePath).replace(/^\./, '') ?? 'bin',
  );
  const mime = detected?.mime ?? mimeFromExtension(extension);
  const metadata = await inspectDocumentMetadata(bytes, mime, extension);
  const canonicalPath = path.join(paths.documentsDir, `${hash}.${extension}`);
  const relativePath = toRepoRelativePath(paths.root, canonicalPath);
  const ingestedAt = new Date().toISOString();
  const isNewDocument = !(await pathExists(canonicalPath));

  if (isNewDocument) {
    await writeFile(canonicalPath, bytes, { flag: 'wx' });
  }

  const observation = buildSourceObservation({
    hash,
    sourcePath,
    source: input.source,
    mime,
    sizeBytes: sourceStats.size,
    seenAt: ingestedAt,
  });
  const sourceKind = observation.source.kind;
  const sourceRef = stableStringify(sourceReferenceForIdentity(observation.source));
  const isNewSource = await appendSourceObservationIfMissing(paths.sourcesJsonl, observation);

  const db = await openVaultDatabase(root);

  try {
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO documents (
          hash,
          mime,
          size_bytes,
          ingested_at,
          page_count,
          has_text_layer,
          needs_ocr,
          ocr_status,
          document_date,
          asset_tag,
          local_path,
          updated_at
        )
        VALUES (
          @hash,
          @mime,
          @sizeBytes,
          @ingestedAt,
          @pageCount,
          @hasTextLayer,
          @needsOcr,
          @ocrStatus,
          NULL,
          NULL,
          @relativePath,
          datetime('now')
        )
        ON CONFLICT(hash) DO UPDATE SET
          mime = excluded.mime,
          size_bytes = excluded.size_bytes,
          page_count = excluded.page_count,
          has_text_layer = excluded.has_text_layer,
          needs_ocr = excluded.needs_ocr,
          ocr_status = excluded.ocr_status,
          local_path = excluded.local_path,
          updated_at = datetime('now')
      `).run({
        hash,
        mime,
        sizeBytes: sourceStats.size,
        ingestedAt,
        pageCount: metadata.pageCount,
        hasTextLayer: metadata.hasTextLayer ? 1 : 0,
        needsOcr: metadata.needsOcr ? 1 : 0,
        ocrStatus: metadata.ocrStatus,
        relativePath,
      });

      db.prepare(`
        INSERT OR IGNORE INTO document_sources (
          hash,
          source_kind,
          source_ref,
          seen_at,
          original_filename
        )
        VALUES (
          @hash,
          @sourceKind,
          @sourceRef,
          @seenAt,
          @originalFilename
        )
      `).run({
        hash,
        sourceKind,
        sourceRef,
        seenAt: observation.seen_at,
        originalFilename: originalFilenameFromObservation(observation),
      });
    });

    transaction();
  } finally {
    db.close();
  }

  return {
    hash,
    mime,
    extension,
    sizeBytes: sourceStats.size,
    path: canonicalPath,
    relativePath,
    isNewDocument,
    isNewSource,
  };
}

export async function putRecord(
  hash: string,
  input: unknown,
  root = resolveRepoRoot(),
): Promise<PutRecordResult> {
  await init(root);

  const normalizedHash = normalizeSha256(hash);
  const paths = getVaultPaths(root);
  const record = normalizeVaultRecordFinancialCategories(parseVaultRecord(input));
  const recordPath = path.join(paths.recordsDir, `${normalizedHash}.json`);
  const relativePath = toRepoRelativePath(paths.root, recordPath);

  await assertDocumentExists(normalizedHash, root);
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  const note = await readCanonicalNote(paths, normalizedHash);
  const db = await openVaultDatabase(root);

  try {
    const transaction = db.transaction(() => {
      indexRecord(db, paths, normalizedHash, record, note);
    });

    transaction();
  } finally {
    db.close();
  }

  return {
    hash: normalizedHash,
    path: recordPath,
    relativePath,
    documentType: record.document_type,
    title: record.title,
  };
}

export async function putNote(
  hash: string,
  markdown: string,
  root = resolveRepoRoot(),
): Promise<PutNoteResult> {
  await init(root);

  const normalizedHash = normalizeSha256(hash);
  const paths = getVaultPaths(root);
  const notePath = path.join(paths.notesDir, `${normalizedHash}.md`);
  const relativePath = toRepoRelativePath(paths.root, notePath);

  await assertDocumentExists(normalizedHash, root);
  await writeFile(notePath, ensureTrailingNewline(markdown), 'utf8');

  const db = await openVaultDatabase(root);

  try {
    db.prepare(`
      UPDATE records
      SET note_path = @notePath,
          updated_at = datetime('now')
      WHERE hash = @hash
    `).run({
      hash: normalizedHash,
      notePath: relativePath,
    });
    db.prepare(`
      UPDATE fts_records
      SET note = @note
      WHERE hash = @hash
    `).run({
      hash: normalizedHash,
      note: markdown,
    });
  } finally {
    db.close();
  }

  return {
    hash: normalizedHash,
    path: notePath,
    relativePath,
  };
}

export type TagDocumentResult = {
  hash: string;
  tag: string;
};

export async function tagDocument(
  hash: string,
  tag: string,
  root = resolveRepoRoot(),
): Promise<TagDocumentResult> {
  await init(root);

  const normalizedHash = normalizeSha256(hash);
  const paths = getVaultPaths(root);

  await assertDocumentExists(normalizedHash, root);

  const db = await openVaultDatabase(root);

  try {
    const result = db
      .prepare(
        `UPDATE documents SET asset_tag = @tag, updated_at = datetime('now') WHERE hash = @hash`,
      )
      .run({ hash: normalizedHash, tag });

    if (result.changes === 0) {
      throw new Error(`Document not found in index: ${normalizedHash}`);
    }
  } finally {
    db.close();
  }

  await writeCanonicalDocumentTag(paths, normalizedHash, tag);

  return { hash: normalizedHash, tag };
}

export const vault = {
  context,
  init,
  listExtractionWork,
  reindex,
  search,
  sql,
  validate,
  registerDocument,
  putRecord,
  putNote,
  tagDocument,
};

function directoriesForInit(paths: VaultPaths): string[] {
  return [
    paths.vaultDir,
    paths.documentsDir,
    paths.vaultOcrDir,
    paths.emailsDir,
    paths.recordsDir,
    paths.notesDir,
    paths.indexDir,
    paths.rendersDir,
    paths.indexOcrDir,
    paths.reportsDir,
    paths.reportArchiveDir,
  ];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

type DocumentIndexRow = {
  hash: string;
  mime: string;
  sizeBytes: number;
  ingestedAt: string;
  pageCount: number | null;
  hasTextLayer: number;
  needsOcr: number;
  ocrStatus: string;
  relativePath: string;
};

type DbDocumentRow = {
  hash: string;
  localPath: string;
  sizeBytes: number;
};

type DbSourceRow = {
  hash: string;
  sourceKind: string;
  sourceRef: string;
};

type IssueSink = (issue: ValidationIssue) => void;

async function validateStrictGitIgnore(
  paths: VaultPaths,
  issue: IssueSink,
): Promise<void> {
  const gitignorePath = path.join(paths.root, '.gitignore');
  const requiredPatterns = [
    'vault/',
    'index/',
    'reports/',
    'node_modules/',
    '.lock',
    '.env',
  ];

  if (!(await pathExists(gitignorePath))) {
    issue({
      severity: 'error',
      code: 'GITIGNORE_MISSING',
      message: 'Strict validation requires .gitignore to protect private/generated data',
      path: gitignorePath,
    });
    return;
  }

  const gitignore = await readFile(gitignorePath, 'utf8');
  const patterns = new Set(
    gitignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#')),
  );

  for (const pattern of requiredPatterns) {
    if (!patterns.has(pattern)) {
      issue({
        severity: 'error',
        code: 'GITIGNORE_MISSING_ENTRY',
        message: `.gitignore is missing required private/generated data pattern: ${pattern}`,
        path: gitignorePath,
      });
    }
  }
}

function indexRecord(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  paths: VaultPaths,
  hash: string,
  record: VaultRecord,
  note: CanonicalNote | null,
): void {
  const recordPath = toRepoRelativePath(paths.root, path.join(paths.recordsDir, `${hash}.json`));

  db.prepare(`
    INSERT INTO records (
      hash,
      schema_version,
      extractor_version,
      extracted_at,
      extracted_by,
      status,
      confidence,
      document_type,
      document_date,
      period_kind,
      period_value,
      period_start,
      period_end,
      title,
      summary_plain,
      record_path,
      note_path,
      record_json,
      updated_at
    )
    VALUES (
      @hash,
      @schemaVersion,
      @extractorVersion,
      @extractedAt,
      @extractedBy,
      @status,
      @confidence,
      @documentType,
      @documentDate,
      @periodKind,
      @periodValue,
      @periodStart,
      @periodEnd,
      @title,
      @summaryPlain,
      @recordPath,
      @notePath,
      @recordJson,
      datetime('now')
    )
    ON CONFLICT(hash) DO UPDATE SET
      schema_version = excluded.schema_version,
      extractor_version = excluded.extractor_version,
      extracted_at = excluded.extracted_at,
      extracted_by = excluded.extracted_by,
      status = excluded.status,
      confidence = excluded.confidence,
      document_type = excluded.document_type,
      document_date = excluded.document_date,
      period_kind = excluded.period_kind,
      period_value = excluded.period_value,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      title = excluded.title,
      summary_plain = excluded.summary_plain,
      record_path = excluded.record_path,
      note_path = excluded.note_path,
      record_json = excluded.record_json,
      updated_at = datetime('now')
  `).run({
    hash,
    schemaVersion: record.schema_version,
    extractorVersion: record.extractor_version,
    extractedAt: record.extracted_at,
    extractedBy: record.extracted_by,
    status: record.status,
    confidence: record.confidence,
    documentType: record.document_type,
    documentDate: record.document_date,
    ...periodColumns(record.period),
    title: record.title,
    summaryPlain: record.summary_plain,
    recordPath,
    notePath: note?.relativePath ?? null,
    recordJson: JSON.stringify(record),
  });

  db.prepare('UPDATE documents SET document_date = @documentDate, updated_at = datetime(\'now\') WHERE hash = @hash')
    .run({ hash, documentDate: record.document_date });

  db.prepare('DELETE FROM financial_rows WHERE hash = ?').run(hash);
  db.prepare('DELETE FROM important_dates WHERE hash = ?').run(hash);
  db.prepare('DELETE FROM resolutions WHERE hash = ?').run(hash);
  db.prepare('DELETE FROM fts_records WHERE hash = ?').run(hash);

  insertFinancialRows(db, hash, record);
  insertImportantDates(db, hash, record);
  insertResolutions(db, hash, record);
  insertFtsRecord(db, hash, record, note?.markdown ?? '');
}

function insertFinancialRows(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  hash: string,
  record: VaultRecord,
): void {
  const insert = db.prepare(`
    INSERT INTO financial_rows (
      hash,
      row_type,
      category,
      category_original,
      category_group,
      period_kind,
      period_value,
      period_start,
      period_end,
      amount_minor,
      currency,
      quantity_value,
      quantity_unit,
      unit_price_minor,
      confidence,
      source_page,
      note
    )
    VALUES (
      @hash,
      @rowType,
      @category,
      @categoryOriginal,
      @categoryGroup,
      @periodKind,
      @periodValue,
      @periodStart,
      @periodEnd,
      @amountMinor,
      @currency,
      @quantityValue,
      @quantityUnit,
      @unitPriceMinor,
      @confidence,
      @sourcePage,
      @note
    )
  `);

  for (const row of record.financial_rows) {
    insert.run({
      hash,
      rowType: row.row_type,
      category: row.category,
      categoryOriginal: row.category_original,
      categoryGroup: row.category_group,
      ...periodColumns(row.period),
      amountMinor: row.money.amount_minor,
      currency: row.money.currency,
      quantityValue: row.quantity?.value ?? null,
      quantityUnit: row.quantity?.unit ?? null,
      unitPriceMinor: row.unit_price_minor,
      confidence: row.confidence,
      sourcePage: row.source_page,
      note: row.note,
    });
  }
}

function insertImportantDates(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  hash: string,
  record: VaultRecord,
): void {
  const insert = db.prepare(`
    INSERT INTO important_dates (hash, date, label, kind)
    VALUES (@hash, @date, @label, @kind)
  `);

  for (const item of record.important_dates) {
    insert.run({
      hash,
      date: item.date,
      label: item.label,
      kind: item.kind,
    });
  }
}

function insertResolutions(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  hash: string,
  record: VaultRecord,
): void {
  const insert = db.prepare(`
    INSERT INTO resolutions (
      hash,
      number,
      subject,
      outcome,
      voting_method,
      money_limit_amount_minor,
      money_limit_currency,
      note
    )
    VALUES (
      @hash,
      @number,
      @subject,
      @outcome,
      @votingMethod,
      @moneyLimitAmountMinor,
      @moneyLimitCurrency,
      @note
    )
  `);

  for (const item of record.resolutions) {
    insert.run({
      hash,
      number: item.number,
      subject: item.subject,
      outcome: item.outcome,
      votingMethod: item.voting_method,
      moneyLimitAmountMinor: item.money_limit?.amount_minor ?? null,
      moneyLimitCurrency: item.money_limit?.currency ?? null,
      note: item.note,
    });
  }
}

function insertFtsRecord(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  hash: string,
  record: VaultRecord,
  note: string,
): void {
  db.prepare(`
    INSERT INTO fts_records (hash, title, summary_plain, key_facts, note)
    VALUES (@hash, @title, @summaryPlain, @keyFacts, @note)
  `).run({
    hash,
    title: record.title,
    summaryPlain: record.summary_plain,
    keyFacts: [
      ...record.key_facts.map((fact) => `${fact.label}: ${fact.value}`),
      ...record.questions_for_user,
      ...record.warnings,
    ].join('\n'),
    note,
  });
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

async function removeDatabaseFiles(paths: VaultPaths): Promise<void> {
  for (const filePath of [
    paths.databasePath,
    `${paths.databasePath}-wal`,
    `${paths.databasePath}-shm`,
  ]) {
    assertInsideDirectory(filePath, paths.indexDir);
    await rm(filePath, { force: true });
  }
}

async function readCanonicalDocuments(paths: VaultPaths): Promise<DocumentIndexRow[]> {
  const entries = await readdir(paths.documentsDir, { withFileTypes: true });
  const documents: DocumentIndexRow[] = [];
  const seenHashes = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const parsed = parseCanonicalDocumentFilename(entry.name);
    const filePath = path.join(paths.documentsDir, entry.name);
    const bytes = await readFile(filePath);
    const actualHash = sha256Buffer(bytes);

    if (actualHash !== parsed.hash) {
      throw new Error(`HASH_DRIFT: ${filePath} has SHA-256 ${actualHash}`);
    }

    if (seenHashes.has(parsed.hash)) {
      throw new Error(`Duplicate canonical document hash: ${parsed.hash}`);
    }

    seenHashes.add(parsed.hash);

    const stats = await stat(filePath);
    const detected = await fileTypeFromBuffer(bytes);
    const mime = detected?.mime ?? mimeFromExtension(parsed.extension);
    const metadata = await inspectDocumentMetadata(bytes, mime, parsed.extension);

    documents.push({
      hash: parsed.hash,
      mime,
      sizeBytes: stats.size,
      ingestedAt: stableFileDate(stats.birthtime, stats.mtime),
      pageCount: metadata.pageCount,
      hasTextLayer: metadata.hasTextLayer ? 1 : 0,
      needsOcr: metadata.needsOcr ? 1 : 0,
      ocrStatus: metadata.ocrStatus,
      relativePath: toRepoRelativePath(paths.root, filePath),
    });
  }

  return documents.sort((left, right) => left.hash.localeCompare(right.hash));
}

async function readCanonicalRecords(paths: VaultPaths): Promise<CanonicalRecord[]> {
  const entries = await readdir(paths.recordsDir, { withFileTypes: true });
  const records: CanonicalRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') {
      continue;
    }

    const hash = normalizeSha256(path.basename(entry.name, '.json'));
    const filePath = path.join(paths.recordsDir, entry.name);
    const raw = await readFile(filePath, 'utf8');
    const record = normalizeVaultRecordFinancialCategories(parseVaultRecord(JSON.parse(raw) as unknown));

    records.push({ hash, record });
  }

  return records.sort((left, right) => left.hash.localeCompare(right.hash));
}

async function readCanonicalNotes(paths: VaultPaths): Promise<Map<string, CanonicalNote>> {
  const entries = await readdir(paths.notesDir, { withFileTypes: true });
  const notes = new Map<string, CanonicalNote>();

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') {
      continue;
    }

    const hash = normalizeSha256(path.basename(entry.name, '.md'));
    const filePath = path.join(paths.notesDir, entry.name);

    notes.set(hash, {
      relativePath: toRepoRelativePath(paths.root, filePath),
      markdown: await readFile(filePath, 'utf8'),
    });
  }

  return notes;
}

async function readCanonicalEmails(paths: VaultPaths): Promise<CanonicalEmail[]> {
  const entries = await readdir(paths.emailsDir, { withFileTypes: true });
  const emails: CanonicalEmail[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const emailDir = path.join(paths.emailsDir, entry.name);
    const metadataPath = path.join(emailDir, 'metadata.json');
    const attachmentsPath = path.join(emailDir, 'attachments.json');
    const bodyPath = path.join(emailDir, 'body.txt');

    if (!(await pathExists(metadataPath)) || !(await pathExists(attachmentsPath))) {
      continue;
    }

    const metadata = parseJsonObject(await readFile(metadataPath, 'utf8'), metadataPath);
    const attachments = parseJsonArray(await readFile(attachmentsPath, 'utf8'), attachmentsPath);
    const gmailId = stringField(metadata, 'id');

    emails.push({
      gmailId,
      threadId: stringField(metadata, 'threadId'),
      historyId: nullableStringField(metadata, 'historyId'),
      internalDate: nullableStringField(metadata, 'internalDate'),
      sentAt: parseEmailDate(nullableStringField(metadata, 'date')),
      receivedAt: parseInternalDate(nullableStringField(metadata, 'internalDate')),
      sender: nullableStringField(metadata, 'from'),
      recipients: JSON.stringify(nullableStringField(metadata, 'to') ? [metadata.to] : []),
      subject: nullableStringField(metadata, 'subject'),
      bodyPath: toRepoRelativePath(paths.root, bodyPath),
      rawHeaders: JSON.stringify(isPlainRecord(metadata.headers) ? metadata.headers : {}),
      attachments: attachments.map((attachment) =>
        canonicalEmailAttachment(gmailId, attachment, attachmentsPath),
      ),
    });
  }

  return emails.sort((left, right) => left.gmailId.localeCompare(right.gmailId));
}

async function readCanonicalDocumentTags(paths: VaultPaths): Promise<Map<string, string>> {
  if (!(await pathExists(paths.documentTagsJson))) {
    return new Map();
  }

  const parsed = parseJsonObject(await readFile(paths.documentTagsJson, 'utf8'), paths.documentTagsJson);
  const tags = new Map<string, string>();

  for (const [hash, tag] of Object.entries(parsed)) {
    tags.set(normalizeSha256(hash), stringValue(tag, `document tag for ${hash}`));
  }

  return tags;
}

async function writeCanonicalDocumentTag(
  paths: VaultPaths,
  hash: string,
  tag: string,
): Promise<void> {
  const tags = await readCanonicalDocumentTags(paths);
  tags.set(hash, tag);

  const serialized = `${JSON.stringify(Object.fromEntries([...tags].sort()), null, 2)}\n`;
  const tempPath = `${paths.documentTagsJson}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tempPath, serialized, { encoding: 'utf8', flag: 'wx' });
  await rename(tempPath, paths.documentTagsJson);
}

async function readCanonicalNote(
  paths: VaultPaths,
  hash: string,
): Promise<CanonicalNote | null> {
  const notePath = path.join(paths.notesDir, `${hash}.md`);

  if (!(await pathExists(notePath))) {
    return null;
  }

  return {
    relativePath: toRepoRelativePath(paths.root, notePath),
    markdown: await readFile(notePath, 'utf8'),
  };
}

function parseCanonicalDocumentFilename(filename: string): {
  hash: string;
  extension: string;
} {
  const extension = normalizeExtension(path.extname(filename).replace(/^\./, ''));
  const hash = path.basename(filename, path.extname(filename)).toLowerCase();

  if (!isSha256Hex(hash)) {
    throw new Error(`Invalid canonical document filename: ${filename}`);
  }

  return {
    hash: normalizeSha256(hash),
    extension,
  };
}

async function assertDocumentExists(hash: string, root: string): Promise<void> {
  const paths = getVaultPaths(root);
  const entries = await readdir(paths.documentsDir, { withFileTypes: true });
  const exists = entries.some((entry) => {
    if (!entry.isFile()) {
      return false;
    }

    try {
      return parseCanonicalDocumentFilename(entry.name).hash === hash;
    } catch {
      return false;
    }
  });

  if (!exists) {
    throw new Error(`Cannot write record or note for missing document hash: ${hash}`);
  }
}

function stableFileDate(birthtime: Date, mtime: Date): string {
  const chosen = Number.isNaN(birthtime.getTime()) ? mtime : birthtime;
  return chosen.toISOString();
}

function assertInsideDirectory(filePath: string, directory: string): void {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(directory);
  const relative = path.relative(resolvedDirectory, resolvedFile);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${resolvedDirectory}: ${resolvedFile}`);
  }
}

function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized === '') {
    return 'bin';
  }

  return normalized;
}

function mimeFromExtension(extension: string): string {
  if (extension === 'pdf') {
    return 'application/pdf';
  }

  if (extension === 'txt') {
    return 'text/plain';
  }

  if (extension === 'json') {
    return 'application/json';
  }

  return 'application/octet-stream';
}

type DocumentMetadata = {
  pageCount: number | null;
  hasTextLayer: boolean;
  needsOcr: boolean;
  ocrStatus: string;
};

async function inspectDocumentMetadata(
  bytes: Uint8Array,
  mime: string,
  extension: string,
): Promise<DocumentMetadata> {
  if (mime !== 'application/pdf' && extension !== 'pdf') {
    return {
      pageCount: null,
      hasTextLayer: false,
      needsOcr: false,
      ocrStatus: 'not_needed',
    };
  }

  const inspection = await inspectPdf(bytes);

  return {
    pageCount: inspection.pageCount,
    hasTextLayer: inspection.hasTextLayer,
    needsOcr: inspection.needsVision,
    ocrStatus: inspection.needsVision ? 'pending' : 'not_needed',
  };
}

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function ftsQuery(query: string): string {
  const terms = query
    .match(/[\p{L}\p{N}_-]+/gu)
    ?.map((term) => term.trim())
    .filter((term) => term !== '') ?? [];

  if (terms.length === 0) {
    return `"${query.replace(/"/g, '""')}"`;
  }

  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(' AND ');
}

function buildSourceObservation(input: {
  hash: string;
  sourcePath: string;
  source?: DocumentSourceInput;
  mime: string;
  sizeBytes: number;
  seenAt: string;
}): SourceObservation {
  const sourceKind = input.source?.kind ?? 'manual_drop';
  const originalFilename = input.source?.originalFilename ?? path.basename(input.sourcePath);
  const ref = input.source?.ref ?? { path: input.sourcePath };

  return {
    hash: input.hash,
    seen_at: input.source?.seenAt ?? input.seenAt,
    source: {
      kind: sourceKind,
      ...ref,
      original_filename: originalFilename,
      mime: input.mime,
      size: input.sizeBytes,
    },
  };
}

function sourceReferenceForIdentity(
  source: SourceObservation['source'],
): Record<string, unknown> {
  const { kind: _kind, mime: _mime, size: _size, ...identity } = source;
  return identity;
}

function originalFilenameFromObservation(observation: SourceObservation): string | null {
  const value = observation.source.original_filename;
  return typeof value === 'string' ? value : null;
}

function canonicalEmailAttachment(
  gmailId: string,
  value: unknown,
  sourcePath: string,
): CanonicalEmailAttachment {
  if (!isPlainRecord(value)) {
    throw new Error(`Invalid email attachment entry in ${sourcePath}`);
  }

  const hash = nullableStringField(value, 'hash');

  return {
    gmailId,
    attachmentIndex: numberField(value, 'index'),
    attachmentId: nullableStringField(value, 'attachmentId'),
    filename: nullableStringField(value, 'originalFilename'),
    declaredMime: nullableStringField(value, 'declaredMime'),
    sniffedMime: nullableStringField(value, 'sniffedMime'),
    sizeBytes: nullableNumberField(value, 'sizeBytes'),
    hash: hash === null ? null : normalizeSha256(hash),
  };
}

function parseJsonObject(raw: string, sourcePath: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;

  if (!isPlainRecord(parsed)) {
    throw new Error(`Expected JSON object at ${sourcePath}`);
  }

  return parsed;
}

function parseJsonArray(raw: string, sourcePath: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array at ${sourcePath}`);
  }

  return parsed;
}

function stringField(record: Record<string, unknown>, key: string): string {
  return stringValue(record[key], key);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected string for ${label}`);
  }

  return value;
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  return stringValue(value, key);
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Expected integer for ${key}`);
  }

  return value;
}

function nullableNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number') {
    throw new Error(`Expected number for ${key}`);
  }

  return value;
}

function parseEmailDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseInternalDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return new Date(numeric).toISOString();
}

async function detectAnomaliesAfterReindex(root: string): Promise<{ open: number }> {
  const { detectAnomalies } = await import('./anomalies.ts');
  return detectAnomalies({ root });
}

async function appendSourceObservationIfMissing(
  sourcesJsonl: string,
  observation: SourceObservation,
): Promise<boolean> {
  const existing = await readSourceObservations(sourcesJsonl);
  const candidateIdentity = sourceObservationIdentity(observation);

  if (existing.some((item) => sourceObservationIdentity(item) === candidateIdentity)) {
    return false;
  }

  await writeFile(sourcesJsonl, `${stableStringify(observation)}\n`, {
    encoding: 'utf8',
    flag: 'a',
  });

  return true;
}

async function readSourceObservations(sourcesJsonl: string): Promise<SourceObservation[]> {
  const raw = await readFile(sourcesJsonl, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  const observations: SourceObservation[] = [];

  for (const [index, line] of lines.entries()) {
    try {
      observations.push(JSON.parse(line) as SourceObservation);
    } catch (error) {
      throw new Error(`Corrupt sources.jsonl at line ${index + 1}: ${String(error)}`);
    }
  }

  return observations;
}

function validateSourceObservations(
  observations: SourceObservation[],
  issue: IssueSink,
): void {
  const seen = new Set<string>();

  for (const [index, observation] of observations.entries()) {
    const line = index + 1;

    if (!isPlainRecord(observation)) {
      issue({
        severity: 'error',
        code: 'INVALID_SOURCE_OBSERVATION',
        message: `Source observation on line ${line} is not an object`,
      });
      continue;
    }

    if (!isSha256Hex(String(observation.hash))) {
      issue({
        severity: 'error',
        code: 'INVALID_SOURCE_HASH',
        message: `Source observation on line ${line} has invalid hash`,
      });
      continue;
    }

    if (typeof observation.seen_at !== 'string' || observation.seen_at.trim() === '') {
      issue({
        severity: 'error',
        code: 'INVALID_SOURCE_SEEN_AT',
        message: `Source observation on line ${line} has invalid seen_at`,
      });
    }

    if (!isPlainRecord(observation.source)) {
      issue({
        severity: 'error',
        code: 'INVALID_SOURCE_REF',
        message: `Source observation on line ${line} has invalid source object`,
      });
      continue;
    }

    if (typeof observation.source.kind !== 'string' || observation.source.kind.trim() === '') {
      issue({
        severity: 'error',
        code: 'INVALID_SOURCE_KIND',
        message: `Source observation on line ${line} has invalid source.kind`,
      });
      continue;
    }

    const identity = sourceObservationIdentity(observation);
    if (seen.has(identity)) {
      issue({
        severity: 'error',
        code: 'DUPLICATE_SOURCE_OBSERVATION',
        message: `Duplicate source observation on line ${line}`,
      });
    }

    seen.add(identity);
  }
}

function validateDbAgainstCanonical(
  paths: VaultPaths,
  canonicalDocuments: DocumentIndexRow[],
  dbDocuments: DbDocumentRow[],
  dbSources: DbSourceRow[],
  issue: IssueSink,
): void {
  const canonicalByHash = new Map(
    canonicalDocuments.map((document) => [document.hash, document]),
  );
  const dbHashes = new Set(dbDocuments.map((document) => document.hash));

  for (const document of canonicalDocuments) {
    if (!dbHashes.has(document.hash)) {
      issue({
        severity: 'warning',
        code: 'DB_MISSING_DOCUMENT',
        message: `SQLite index is missing canonical document ${document.hash}`,
        path: paths.databasePath,
      });
    }
  }

  for (const document of dbDocuments) {
    const canonical = canonicalByHash.get(document.hash);

    if (!canonical) {
      issue({
        severity: 'error',
        code: 'DB_ORPHAN_DOCUMENT',
        message: `SQLite document row has no canonical file: ${document.hash}`,
        path: paths.databasePath,
      });
      continue;
    }

    if (canonical.relativePath !== document.localPath) {
      issue({
        severity: 'warning',
        code: 'DB_DOCUMENT_PATH_MISMATCH',
        message: `SQLite document ${document.hash} points to ${document.localPath}, expected ${canonical.relativePath}`,
        path: paths.databasePath,
      });
    }

    if (canonical.sizeBytes !== document.sizeBytes) {
      issue({
        severity: 'error',
        code: 'DB_DOCUMENT_SIZE_MISMATCH',
        message: `SQLite document ${document.hash} has size ${document.sizeBytes}, expected ${canonical.sizeBytes}`,
        path: paths.databasePath,
      });
    }
  }

  for (const source of dbSources) {
    if (!canonicalByHash.has(source.hash)) {
      issue({
        severity: 'error',
        code: 'DB_ORPHAN_SOURCE',
        message: `SQLite source row references missing document ${source.hash}`,
        path: paths.databasePath,
      });
    }

    try {
      JSON.parse(source.sourceRef);
    } catch {
      issue({
        severity: 'error',
        code: 'DB_INVALID_SOURCE_REF',
        message: `SQLite source row has invalid JSON source_ref for ${source.hash}`,
        path: paths.databasePath,
      });
    }
  }
}

function sourceObservationIdentity(observation: SourceObservation): string {
  return stableStringify({
    hash: observation.hash,
    kind: observation.source.kind,
    ref: sourceReferenceForIdentity(observation.source),
  });
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertReadOnlySelectQuery(query: string): void {
  const normalized = query.trim().replace(/^\uFEFF/, '');

  if (!/^select\b/i.test(normalized)) {
    throw new Error('vault.sql only accepts SELECT statements');
  }

  const withoutTrailingSemicolon = normalized.replace(/;\s*$/, '');

  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('vault.sql accepts one SELECT statement at a time');
  }
}

import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import {
  CURRENT_DB_SCHEMA_VERSION,
  getDatabaseSchemaVersion,
  initializeDatabase,
  openVaultDatabase,
} from './db.ts';
import { isSha256Hex, normalizeSha256, sha256Buffer } from './hash.ts';
import { getVaultPaths, resolveRepoRoot, type VaultPaths } from './paths.ts';
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

export type ReindexResult = {
  root: string;
  documentsIndexed: number;
  sourcesIndexed: number;
  sourcesSkipped: number;
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
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  counts: {
    canonicalDocuments: number;
    sourceObservations: number;
    dbDocuments: number | null;
    dbSources: number | null;
  };
};

type SourceObservation = {
  hash: string;
  seen_at: string;
  source: {
    kind: string;
    [key: string]: unknown;
  };
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

export async function validate(root = resolveRepoRoot()): Promise<ValidationReport> {
  const paths = getVaultPaths(root);
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

export async function reindex(root = resolveRepoRoot()): Promise<ReindexResult> {
  const paths = getVaultPaths(root);

  await ensureFileLayout(paths, root);
  await removeDatabaseFiles(paths);
  await initializeDatabase(root);

  const documentRows = await readCanonicalDocuments(paths);
  const sourceObservations = await readSourceObservations(paths.sourcesJsonl);
  const knownDocumentHashes = new Set(documentRows.map((row) => row.hash));
  let sourcesIndexed = 0;
  let sourcesSkipped = 0;

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
          NULL,
          0,
          0,
          'pending',
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
    });

    transaction();
  } finally {
    db.close();
  }

  return {
    root: paths.root,
    documentsIndexed: documentRows.length,
    sourcesIndexed,
    sourcesSkipped,
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
          NULL,
          0,
          0,
          'pending',
          NULL,
          NULL,
          @relativePath,
          datetime('now')
        )
        ON CONFLICT(hash) DO UPDATE SET
          mime = excluded.mime,
          size_bytes = excluded.size_bytes,
          local_path = excluded.local_path,
          updated_at = datetime('now')
      `).run({
        hash,
        mime,
        sizeBytes: sourceStats.size,
        ingestedAt,
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

export const vault = {
  init,
  reindex,
  validate,
  registerDocument,
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

    documents.push({
      hash: parsed.hash,
      mime,
      sizeBytes: stats.size,
      ingestedAt: stableFileDate(stats.birthtime, stats.mtime),
      relativePath: toRepoRelativePath(paths.root, filePath),
    });
  }

  return documents.sort((left, right) => left.hash.localeCompare(right.hash));
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

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
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

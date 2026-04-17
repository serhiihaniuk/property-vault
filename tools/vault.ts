import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { initializeDatabase, openVaultDatabase } from './db.ts';
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

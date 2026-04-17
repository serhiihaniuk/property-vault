import { constants } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { initializeDatabase, openVaultDatabase } from './db.ts';
import { sha256Buffer } from './hash.ts';
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

  await initializeDatabase(root);

  return {
    root: paths.root,
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

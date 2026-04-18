import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import {
  getVaultPaths,
  inspectPdf,
  normalizeSha256,
  normalizeVaultRecordFinancialCategories,
  parseVaultRecord,
  resolveRepoRoot,
  sha256Buffer,
  type VaultPaths,
  type VaultRecord,
} from '@dabrowskiego/vault';

export interface CanonicalDocument {
  hash: string;
  mime: string;
  sizeBytes: number;
  ingestedAt: string;
  pageCount: number | null;
  hasTextLayer: boolean;
  needsOcr: boolean;
  ocrStatus: string;
  documentDate: string | null;
  assetTag: string | null;
  localPath: string;
}

export interface CanonicalSourceObservation {
  hash: string;
  sourceKind: string;
  sourceRef: Record<string, unknown>;
  seenAt: string;
  originalFilename: string | null;
}

export interface CanonicalRecordEntry {
  hash: string;
  record: VaultRecord;
  recordPath: string;
}

export interface CanonicalNoteEntry {
  hash: string;
  relativePath: string;
  markdown: string;
}

export interface CanonicalEmailAttachment {
  attachmentIndex: number;
  attachmentId: string | null;
  filename: string | null;
  declaredMime: string | null;
  sniffedMime: string | null;
  sizeBytes: number | null;
  hash: string | null;
}

export interface CanonicalEmailEntry {
  gmailId: string;
  threadId: string;
  historyId: string | null;
  internalDate: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  sender: string | null;
  recipients: string[];
  subject: string | null;
  labels: string[];
  bodyPath: string;
  rawHeaders: Record<string, unknown>;
  attachments: CanonicalEmailAttachment[];
}

export interface CanonicalVaultSnapshotCounts {
  documents: number;
  sourceObservations: number;
  records: number;
  notes: number;
  emails: number;
  emailAttachments: number;
  documentTags: number;
  financialRows: number;
  importantDates: number;
  resolutions: number;
}

export interface CanonicalVaultSnapshot {
  root: string;
  generatedAt: string;
  documents: CanonicalDocument[];
  sourceObservations: CanonicalSourceObservation[];
  records: CanonicalRecordEntry[];
  notes: Map<string, CanonicalNoteEntry>;
  emails: CanonicalEmailEntry[];
  documentTags: Map<string, string>;
  counts: CanonicalVaultSnapshotCounts;
}

export async function readCanonicalVaultSnapshot(
  root = resolveRepoRoot(),
): Promise<CanonicalVaultSnapshot> {
  const paths = getVaultPaths(root);
  const [records, notes, emails, sourceObservations, documentTags] = await Promise.all([
    readCanonicalRecords(paths),
    readCanonicalNotes(paths),
    readCanonicalEmails(paths),
    readSourceObservations(paths.sourcesJsonl),
    readCanonicalDocumentTags(paths),
  ]);
  const documentDateByHash = new Map(
    records.map((entry) => [entry.hash, entry.record.document_date ?? null] as const),
  );
  const documents = await readCanonicalDocuments(paths, documentDateByHash, documentTags);

  return {
    root: paths.root,
    generatedAt: new Date().toISOString(),
    documents,
    sourceObservations,
    records,
    notes,
    emails,
    documentTags,
    counts: {
      documents: documents.length,
      sourceObservations: sourceObservations.length,
      records: records.length,
      notes: notes.size,
      emails: emails.length,
      emailAttachments: emails.reduce((total, email) => total + email.attachments.length, 0),
      documentTags: documentTags.size,
      financialRows: records.reduce(
        (total, entry) => total + entry.record.financial_rows.length,
        0,
      ),
      importantDates: records.reduce(
        (total, entry) => total + entry.record.important_dates.length,
        0,
      ),
      resolutions: records.reduce(
        (total, entry) => total + entry.record.resolutions.length,
        0,
      ),
    },
  };
}

async function readCanonicalDocuments(
  paths: VaultPaths,
  documentDateByHash: ReadonlyMap<string, string | null>,
  documentTags: ReadonlyMap<string, string>,
): Promise<CanonicalDocument[]> {
  if (!(await pathExists(paths.documentsDir))) {
    return [];
  }

  const entries = await readdir(paths.documentsDir, { withFileTypes: true });
  const documents: CanonicalDocument[] = [];
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

    const fileStats = await stat(filePath);
    const detected = await fileTypeFromBuffer(bytes);
    const mime = detected?.mime ?? mimeFromExtension(parsed.extension);
    const metadata = await inspectDocumentMetadata(bytes, mime, parsed.extension);

    documents.push({
      hash: parsed.hash,
      mime,
      sizeBytes: fileStats.size,
      ingestedAt: stableFileDate(fileStats.birthtime, fileStats.mtime),
      pageCount: metadata.pageCount,
      hasTextLayer: metadata.hasTextLayer,
      needsOcr: metadata.needsOcr,
      ocrStatus: metadata.ocrStatus,
      documentDate: documentDateByHash.get(parsed.hash) ?? null,
      assetTag: documentTags.get(parsed.hash) ?? null,
      localPath: toRepoRelativePath(paths.root, filePath),
    });
  }

  return documents.sort((left, right) => left.hash.localeCompare(right.hash));
}

async function readCanonicalRecords(paths: VaultPaths): Promise<CanonicalRecordEntry[]> {
  if (!(await pathExists(paths.recordsDir))) {
    return [];
  }

  const entries = await readdir(paths.recordsDir, { withFileTypes: true });
  const records: CanonicalRecordEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') {
      continue;
    }

    const hash = normalizeSha256(path.basename(entry.name, '.json'));
    const filePath = path.join(paths.recordsDir, entry.name);
    const raw = await readFile(filePath, 'utf8');
    const record = normalizeVaultRecordFinancialCategories(
      parseVaultRecord(JSON.parse(raw) as unknown),
    );

    records.push({
      hash,
      record,
      recordPath: toRepoRelativePath(paths.root, filePath),
    });
  }

  return records.sort((left, right) => left.hash.localeCompare(right.hash));
}

async function readCanonicalNotes(
  paths: VaultPaths,
): Promise<Map<string, CanonicalNoteEntry>> {
  const notes = new Map<string, CanonicalNoteEntry>();

  if (!(await pathExists(paths.notesDir))) {
    return notes;
  }

  const entries = await readdir(paths.notesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') {
      continue;
    }

    const hash = normalizeSha256(path.basename(entry.name, '.md'));
    const filePath = path.join(paths.notesDir, entry.name);

    notes.set(hash, {
      hash,
      relativePath: toRepoRelativePath(paths.root, filePath),
      markdown: await readFile(filePath, 'utf8'),
    });
  }

  return notes;
}

async function readCanonicalEmails(paths: VaultPaths): Promise<CanonicalEmailEntry[]> {
  if (!(await pathExists(paths.emailsDir))) {
    return [];
  }

  const entries = await readdir(paths.emailsDir, { withFileTypes: true });
  const emails: CanonicalEmailEntry[] = [];

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

    emails.push({
      gmailId: stringField(metadata, 'id'),
      threadId: stringField(metadata, 'threadId'),
      historyId: nullableStringField(metadata, 'historyId'),
      internalDate: parseInternalDate(nullableStringField(metadata, 'internalDate')),
      sentAt: parseEmailDate(nullableStringField(metadata, 'date')),
      receivedAt: parseInternalDate(nullableStringField(metadata, 'internalDate')),
      sender: nullableStringField(metadata, 'from'),
      recipients: readStringArrayOrSingle(metadata.to),
      subject: nullableStringField(metadata, 'subject'),
      labels: readStringArray(metadata.labelIds),
      bodyPath: toRepoRelativePath(paths.root, bodyPath),
      rawHeaders: isPlainRecord(metadata.headers) ? metadata.headers : {},
      attachments: attachments
        .map((attachment) => canonicalEmailAttachment(attachment, attachmentsPath))
        .sort((left, right) => left.attachmentIndex - right.attachmentIndex),
    });
  }

  return emails.sort((left, right) => left.gmailId.localeCompare(right.gmailId));
}

async function readCanonicalDocumentTags(
  paths: VaultPaths,
): Promise<Map<string, string>> {
  const tags = new Map<string, string>();

  if (!(await pathExists(paths.documentTagsJson))) {
    return tags;
  }

  const parsed = parseJsonObject(
    await readFile(paths.documentTagsJson, 'utf8'),
    paths.documentTagsJson,
  );

  for (const [hash, tag] of Object.entries(parsed)) {
    tags.set(normalizeSha256(hash), stringValue(tag, `document tag for ${hash}`));
  }

  return tags;
}

async function readSourceObservations(
  sourcesJsonl: string,
): Promise<CanonicalSourceObservation[]> {
  if (!(await pathExists(sourcesJsonl))) {
    return [];
  }

  const raw = await readFile(sourcesJsonl, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  const observations: CanonicalSourceObservation[] = [];

  for (const [index, line] of lines.entries()) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      throw new Error(`Corrupt sources.jsonl at line ${index + 1}: ${String(error)}`);
    }

    if (!isPlainRecord(parsed)) {
      throw new Error(`Source observation at line ${index + 1} is not an object`);
    }

    const hash = normalizeSha256(stringField(parsed, 'hash'));
    const source = parsed.source;

    if (!isPlainRecord(source)) {
      throw new Error(`Source observation at line ${index + 1} is missing source`);
    }

    const sourceKind = stringField(source, 'kind');
    const { kind: _kind, mime: _mime, size: _size, ...sourceRef } = source;

    observations.push({
      hash,
      sourceKind,
      sourceRef,
      seenAt: stringField(parsed, 'seen_at'),
      originalFilename: nullableStringField(source, 'original_filename'),
    });
  }

  return observations.sort(compareSourceObservations);
}

function compareSourceObservations(
  left: CanonicalSourceObservation,
  right: CanonicalSourceObservation,
): number {
  return (
    left.hash.localeCompare(right.hash) ||
    left.sourceKind.localeCompare(right.sourceKind) ||
    stableStringify(left.sourceRef).localeCompare(stableStringify(right.sourceRef))
  );
}

function canonicalEmailAttachment(
  value: unknown,
  sourcePath: string,
): CanonicalEmailAttachment {
  if (!isPlainRecord(value)) {
    throw new Error(`Invalid email attachment entry in ${sourcePath}`);
  }

  const hash = nullableStringField(value, 'hash');

  return {
    attachmentIndex: numberField(value, 'index'),
    attachmentId: nullableStringField(value, 'attachmentId'),
    filename: nullableStringField(value, 'originalFilename'),
    declaredMime: nullableStringField(value, 'declaredMime'),
    sniffedMime: nullableStringField(value, 'sniffedMime'),
    sizeBytes: nullableNumberField(value, 'sizeBytes'),
    hash: hash === null ? null : normalizeSha256(hash),
  };
}

async function inspectDocumentMetadata(
  bytes: Uint8Array,
  mime: string,
  extension: string,
): Promise<{
  pageCount: number | null;
  hasTextLayer: boolean;
  needsOcr: boolean;
  ocrStatus: string;
}> {
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

function parseCanonicalDocumentFilename(filename: string): {
  hash: string;
  extension: string;
} {
  const extension = normalizeExtension(path.extname(filename).replace(/^\./, ''));
  const hash = path.basename(filename, path.extname(filename)).toLowerCase();

  return {
    hash: normalizeSha256(hash),
    extension,
  };
}

function stableFileDate(birthtime: Date, mtime: Date): string {
  const chosen = Number.isNaN(birthtime.getTime()) ? mtime : birthtime;
  return chosen.toISOString();
}

function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === '' ? 'bin' : normalized;
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
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

function readStringArrayOrSingle(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }

  return readStringArray(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

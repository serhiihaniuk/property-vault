import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';

export type LastGmailSyncState = {
  at: string | null;
  high_watermark_date: string | null;
  lookback_days: number;
  messages_seen_total: number;
};

export type VaultState = {
  schema_version: number;
  extractor_version_current: string;
  record_schema_version_current: number;
  last_gmail_sync: LastGmailSyncState;
  known_senders: string[];
};

export class StateError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StateError';
    this.cause = cause;
  }
}

export function createDefaultState(): VaultState {
  return {
    schema_version: 1,
    extractor_version_current: '2026.04-a',
    record_schema_version_current: 1,
    last_gmail_sync: {
      at: null,
      high_watermark_date: null,
      lookback_days: 14,
      messages_seen_total: 0,
    },
    known_senders: [
      'ksiegowosc4@locator.wroclaw.pl',
      'administrator4@locator.wroclaw.pl',
    ],
  };
}

export async function readState(root = resolveRepoRoot()): Promise<VaultState> {
  const paths = getVaultPaths(root);

  try {
    const raw = await readFile(paths.stateJson, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return validateState(parsed);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return createDefaultState();
    }

    throw new StateError(`Could not read vault state at ${paths.stateJson}`, error);
  }
}

export async function writeState(
  state: VaultState,
  root = resolveRepoRoot(),
): Promise<void> {
  const paths = getVaultPaths(root);
  const validated = validateState(state);
  const serialized = `${JSON.stringify(validated, null, 2)}\n`;
  const tempPath = `${paths.stateJson}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(path.dirname(paths.stateJson), { recursive: true });
  await writeFile(tempPath, serialized, { encoding: 'utf8', flag: 'wx' });
  await rename(tempPath, paths.stateJson);
}

export async function updateState(
  updater: (state: VaultState) => VaultState | Promise<VaultState>,
  root = resolveRepoRoot(),
): Promise<VaultState> {
  const current = await readState(root);
  const next = await updater(current);
  await writeState(next, root);
  return next;
}

export function validateState(value: unknown): VaultState {
  if (!isRecord(value)) {
    throw new StateError('Vault state must be a JSON object');
  }

  const lastGmailSync = value.last_gmail_sync;
  if (!isRecord(lastGmailSync)) {
    throw new StateError('Vault state is missing last_gmail_sync');
  }

  const knownSenders = value.known_senders;
  if (!Array.isArray(knownSenders) || !knownSenders.every((item) => typeof item === 'string')) {
    throw new StateError('Vault state known_senders must be an array of strings');
  }

  return {
    schema_version: numberField(value, 'schema_version'),
    extractor_version_current: stringField(value, 'extractor_version_current'),
    record_schema_version_current: numberField(value, 'record_schema_version_current'),
    last_gmail_sync: {
      at: nullableStringField(lastGmailSync, 'at'),
      high_watermark_date: nullableStringField(lastGmailSync, 'high_watermark_date'),
      lookback_days: numberField(lastGmailSync, 'lookback_days'),
      messages_seen_total: numberField(lastGmailSync, 'messages_seen_total'),
    },
    known_senders: [...knownSenders],
  };
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (!Number.isInteger(value)) {
    throw new StateError(`Vault state field ${key} must be an integer`);
  }

  return value;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new StateError(`Vault state field ${key} must be a string`);
  }

  return value;
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value !== null && typeof value !== 'string') {
    throw new StateError(`Vault state field ${key} must be a string or null`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

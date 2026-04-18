import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDatabase } from '@dabrowskiego/db';
import {
  init,
  putNote,
  putRecord,
  registerDocument,
  tagDocument,
  type VaultRecord,
} from '@dabrowskiego/vault';
import { newDb } from 'pg-mem';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveMigrationsFolder } from '@dabrowskiego/db';
import { rebuildVaultSchema, syncVaultToDatabase } from './sync.ts';

test('syncVaultToDatabase mirrors canonical vault data into Postgres idempotently', async () => {
  const fixture = await createFixture();
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  patchPgMemPool(pool);
  const { db } = createDatabase({ pool });

  try {
    await seedCanonicalVault(fixture.root);
    await applyMigrations(pool);

    const first = await syncVaultToDatabase({
      db,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      root: fixture.root,
    });
    const second = await syncVaultToDatabase({
      db,
      now: () => new Date('2026-04-18T12:05:00.000Z'),
      root: fixture.root,
    });

    const counts = await pool.query(`
      SELECT
        (SELECT count(*) FROM "vault"."documents") AS documents,
        (SELECT count(*) FROM "vault"."document_sources") AS sources,
        (SELECT count(*) FROM "vault"."records") AS records,
        (SELECT count(*) FROM "vault"."financial_rows") AS financial_rows,
        (SELECT count(*) FROM "vault"."important_dates") AS important_dates,
        (SELECT count(*) FROM "vault"."resolutions") AS resolutions,
        (SELECT count(*) FROM "vault"."record_search") AS record_search,
        (SELECT count(*) FROM "vault"."emails") AS emails,
        (SELECT count(*) FROM "vault"."email_attachments") AS attachments,
        (SELECT count(*) FROM "vault"."sync_runs") AS sync_runs
    `);
    const syncState = await pool.query(`
      SELECT
        status,
        last_success_at,
        summary_json
      FROM "app"."sync_state"
      WHERE key = 'canonical_vault'
    `);
    const taggedDocument = await pool.query(`
      SELECT asset_tag, document_date
      FROM "vault"."documents"
      WHERE asset_tag = 'asset_logo'
    `);

    assert.equal(first.summary.status, 'ok');
    assert.equal(second.summary.status, 'ok');
    assert.equal(first.summary.snapshot.documents, 2);
    assert.equal(first.summary.snapshot.sourceObservations, 2);
    assert.equal(first.summary.snapshot.records, 1);
    assert.equal(first.summary.snapshot.notes, 1);
    assert.equal(first.summary.snapshot.emails, 1);
    assert.equal(first.summary.snapshot.emailAttachments, 1);
    assert.equal(first.summary.snapshot.documentTags, 1);
    assert.equal(first.snapshotHash, second.snapshotHash);
    assert.deepEqual(normalizeResultRow(counts.rows[0]), {
      attachments: 1,
      documents: 2,
      emails: 1,
      financial_rows: 1,
      important_dates: 1,
      record_search: 1,
      records: 1,
      resolutions: 1,
      sources: 2,
      sync_runs: 2,
    });
    assert.equal(syncState.rows[0]?.status, 'idle');
    assert.equal(
      normalizeTimestamp(syncState.rows[0]?.last_success_at),
      '2026-04-18T12:05:00.000Z',
    );
    assert.equal(syncState.rows[0]?.summary_json?.snapshot?.documents, 2);
    assert.equal(taggedDocument.rows[0]?.asset_tag, 'asset_logo');
    assert.equal(taggedDocument.rows[0]?.document_date, null);
  } finally {
    await pool.end();
    await fixture.remove();
  }
});

test('rebuildVaultSchema clears derived vault rows but preserves app sync state', async () => {
  const fixture = await createFixture();
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  patchPgMemPool(pool);
  const { db } = createDatabase({ pool });

  try {
    await seedCanonicalVault(fixture.root);
    await applyMigrations(pool);
    await syncVaultToDatabase({
      db,
      now: () => new Date('2026-04-18T12:00:00.000Z'),
      root: fixture.root,
    });

    await pool.query(`
      INSERT INTO "app"."sync_state" ("key", "status", "summary_json", "cursor_json")
      VALUES ('manual', 'idle', '{}'::jsonb, '{}'::jsonb)
    `);
    await pool.query(`
      INSERT INTO "vault"."documents" (
        "hash",
        "mime",
        "size_bytes",
        "ingested_at",
        "local_path"
      )
      VALUES (
        '${'b'.repeat(64)}',
        'text/plain',
        1,
        '2026-04-18T00:00:00.000Z',
        'vault/documents/orphan.txt'
      )
    `);
    await pool.query(`
      INSERT INTO "vault"."anomalies" (
        "rule_id",
        "severity",
        "payload_signature",
        "payload_json",
        "detected_at"
      )
      VALUES (
        'missing-record',
        'warning',
        'sig-1',
        '{}'::jsonb,
        '2026-04-18T00:00:00.000Z'
      )
    `);

    const rebuilt = await rebuildVaultSchema({
      db,
      now: () => new Date('2026-04-18T13:00:00.000Z'),
      root: fixture.root,
    });
    const rows = await pool.query(`
      SELECT
        (SELECT count(*) FROM "vault"."documents" WHERE hash = '${'b'.repeat(64)}') AS orphan_documents,
        (SELECT count(*) FROM "vault"."anomalies") AS anomalies,
        (SELECT count(*) FROM "app"."sync_state" WHERE key = 'manual') AS manual_sync_state,
        (SELECT count(*) FROM "vault"."sync_runs") AS sync_runs
    `);

    assert.equal(rebuilt.mode, 'rebuild');
    assert.equal(rebuilt.summary.operations.anomaliesCleared, 1);
    assert.deepEqual(normalizeResultRow(rows.rows[0]), {
      anomalies: 0,
      manual_sync_state: 1,
      orphan_documents: 0,
      sync_runs: 2,
    });
  } finally {
    await pool.end();
    await fixture.remove();
  }
});

async function applyMigrations(pool: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  const statements = await readMigrationStatements(resolveMigrationsFolder());

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function readMigrationStatements(migrationsFolder: string): Promise<string[]> {
  const statements: string[] = [];
  const migrationFiles = (await readdir(migrationsFolder))
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(join(migrationsFolder, migrationFile), 'utf8');

    statements.push(
      ...migrationSql
        .split('--> statement-breakpoint')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  return statements;
}

async function seedCanonicalVault(root: string): Promise<void> {
  await init(root);

  const recordDocumentPath = path.join(root, 'meeting.txt');
  const logoDocumentPath = path.join(root, 'logo.png');
  await writeFile(recordDocumentPath, 'meeting source document', 'utf8');
  await writeFile(logoDocumentPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const meetingDocument = await registerDocument({ path: recordDocumentPath }, root);
  const logoDocument = await registerDocument({ path: logoDocumentPath }, root);

  await putRecord(
    meetingDocument.hash,
    validMeetingNoticeRecord({
      summary: 'Owners discuss roof repairs and payments.',
      title: 'Roof repair vote',
    }),
    root,
  );
  await putNote(meetingDocument.hash, 'Owner follow-up note.', root);
  await tagDocument(logoDocument.hash, 'asset_logo', root);
  await writeCanonicalEmailFixture(root, logoDocument.hash);
}

async function writeCanonicalEmailFixture(root: string, hash: string): Promise<void> {
  const emailDir = path.join(root, 'vault', 'emails', 'gmail-1');
  await mkdir(emailDir, { recursive: true });
  await writeFile(path.join(emailDir, 'body.txt'), 'Email body\n', 'utf8');
  await writeFile(
    path.join(emailDir, 'metadata.json'),
    `${JSON.stringify({
      attachments: [],
      bodyText: 'Email body',
      date: 'Mon, 13 May 2024 10:11:12 +0200',
      from: 'administrator4@locator.wroclaw.pl',
      headers: { from: 'administrator4@locator.wroclaw.pl' },
      historyId: 'history-1',
      id: 'gmail-1',
      internalDate: '1715587872000',
      labelIds: ['INBOX'],
      subject: 'Locator message',
      threadId: 'thread-1',
      to: 'owner@example.test',
    }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(emailDir, 'attachments.json'),
    `${JSON.stringify([
      {
        attachmentId: 'attachment-1',
        declaredMime: 'image/png',
        failed: false,
        hash,
        index: 0,
        originalFilename: 'logo.png',
        sizeBytes: 4,
        sniffedMime: 'image/png',
      },
    ], null, 2)}\n`,
    'utf8',
  );
}

function validMeetingNoticeRecord(input: {
  summary: string;
  title: string;
}): VaultRecord {
  return {
    confidence: 0.92,
    document_date: '2026-03-19',
    document_type: 'meeting_notice',
    extracted_at: '2026-04-17T11:00:00.000Z',
    extracted_by: 'codex-test',
    extractor_version: '2026.04-a',
    financial_rows: [{
      category: 'repair_fund',
      category_group: 'repairs',
      category_original: 'Fundusz remontowy',
      confidence: 0.9,
      money: { amount_minor: 12500, currency: 'PLN' },
      note: null,
      period: { kind: 'month', value: '2026-04' },
      quantity: null,
      row_type: 'charge',
      source_page: 1,
      unit_price_minor: null,
    }],
    important_dates: [{
      date: '2026-04-30',
      kind: 'deadline',
      label: 'Vote deadline',
    }],
    interest_entries: [],
    key_facts: [
      { label: 'Topic', value: 'roof repair vote' },
      { label: 'Reference', value: 'L. dz. 381/2026' },
    ],
    language: 'pl',
    ledger_entries: [],
    mentions: {
      addresses: [],
      emails: [],
      people: [],
      phones: [],
      reference_numbers: ['L. dz. 381/2026'],
    },
    meter_readings: [],
    period: { kind: 'none' },
    questions_for_user: [],
    reference_numbers: {
      bank_account: null,
      document_ref: 'L. dz. 381/2026',
      property_code: null,
      source_document_numbers: [],
      unit_code: null,
    },
    resolutions: [{
      money_limit: null,
      note: null,
      number: '1/2026',
      outcome: 'pending_vote',
      subject: 'Approve roof repair',
      voting_method: 'individual vote collection',
    }],
    schema_version: 1,
    sensitive_findings: [],
    status: 'needs_review',
    summary_plain: input.summary,
    title: input.title,
    warnings: [],
  };
}

async function createFixture(): Promise<{ root: string; remove: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-sync-test-'));

  return {
    root,
    remove: async () => {
      const resolvedRoot = path.resolve(root);
      const resolvedTemp = path.resolve(os.tmpdir());
      const relative = path.relative(resolvedTemp, resolvedRoot);

      assert.ok(!relative.startsWith('..'));
      assert.ok(!path.isAbsolute(relative));

      await rm(resolvedRoot, { force: true, recursive: true });
    },
  };
}

function patchPgMemPool(
  pool: {
    query: (query: unknown, ...params: unknown[]) => Promise<unknown>;
  },
): void {
  const originalQuery = pool.query.bind(pool);

  pool.query = (async (query: unknown, ...params: unknown[]) => {
    if (!query || typeof query !== 'object') {
      return originalQuery(query, ...params);
    }

    const queryConfig = query as {
      rowMode?: string;
      types?: {
        getTypeParser?: (typeId: number, format?: string) => (value: unknown) => unknown;
      };
    } & Record<string, unknown>;
    const { rowMode, types, ...rest } = queryConfig;
    const result = await originalQuery(rest, ...params);

    if (!result || typeof result !== 'object' || !('rows' in result) || !('fields' in result)) {
      return result;
    }

    const fields = result.fields as Array<{
      dataTypeID?: number;
      dataTypeId?: number;
      format?: string;
      name: string;
    }>;
    const rows = result.rows as Array<Record<string, unknown>>;
    const parsers = fields.map((field) => {
      const typeId = field.dataTypeID ?? field.dataTypeId;

      if (!types?.getTypeParser || typeof typeId !== 'number') {
        return (value: unknown) => value;
      }

      return types.getTypeParser(typeId, field.format);
    });
    const parsedRows = rows.map((row) => {
      if (rowMode === 'array') {
        return fields.map((field, index) => parsers[index]?.(row[field.name]));
      }

      return Object.fromEntries(
        fields.map((field, index) => [field.name, parsers[index]?.(row[field.name])]),
      );
    });

    return {
      ...result,
      rows: parsedRows,
    };
  }) as typeof pool.query;
}

function normalizeResultRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, unwrapScalar(value)]),
  );
}

function unwrapScalar(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 1) {
    return unwrapScalar(value[0]);
  }

  return value;
}

function normalizeTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : null;
}

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportRecordJsonSchema } from './export-json-schema.ts';
import { parseVaultRecord, safeParseVaultRecord, type VaultRecord } from './record.ts';

test('RecordSchema accepts a meeting notice record', () => {
  const record = parseVaultRecord(validMeetingNotice());

  assert.equal(record.schema_version, 1);
  assert.equal(record.document_type, 'meeting_notice');
  assert.equal(record.resolutions.length, 1);
});

test('RecordSchema rejects malformed records', () => {
  const moneyAsFloat = validMeetingNotice();
  moneyAsFloat.resolutions[0].money_limit = {
    amount_minor: 123.45,
    currency: 'PLN',
  };

  const badDate = validMeetingNotice();
  badDate.document_date = '17-04-2026';

  const rawPassword = validMeetingNotice();
  rawPassword.summary_plain = 'Portal password: secret123';

  const unredactedSensitive = validMeetingNotice();
  unredactedSensitive.sensitive_findings = [{
    kind: 'password',
    label: 'Portal password',
    value_redacted: 'secret123',
    source_page: 1,
  }];

  assert.equal(safeParseVaultRecord(moneyAsFloat).success, false);
  assert.equal(safeParseVaultRecord(badDate).success, false);
  assert.equal(safeParseVaultRecord(rawPassword).success, false);
  assert.equal(safeParseVaultRecord(unredactedSensitive).success, false);
});

test('exportRecordJsonSchema writes a JSON schema file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'property-vault-schema-test-'));

  try {
    const outputPath = path.join(root, 'record.v1.json');
    const writtenPath = await exportRecordJsonSchema(outputPath);
    const schema = JSON.parse(await readFile(writtenPath, 'utf8')) as {
      definitions?: Record<string, unknown>;
    };

    assert.equal(writtenPath, outputPath);
    assert.ok(schema.definitions?.PropertyVaultRecordV1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('validate-record CLI accepts valid record files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'property-vault-record-cli-test-'));

  try {
    const recordPath = path.join(root, 'record.json');
    await writeFile(recordPath, `${JSON.stringify(validMeetingNotice(), null, 2)}\n`, 'utf8');

    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'tools/cli.ts', 'validate-record', recordPath, '--json'],
      {
        cwd: path.resolve(path.join(import.meta.dirname, '..', '..')),
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"ok": true/);
    assert.match(result.stdout, /"document_type": "meeting_notice"/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function validMeetingNotice(): VaultRecord {
  return {
    schema_version: 1,
    extractor_version: '2026.04-a',
    extracted_at: '2026-04-17T11:00:00.000Z',
    extracted_by: 'codex-test',
    confidence: 0.92,
    status: 'needs_review',
    language: 'pl',
    document_type: 'meeting_notice',
    document_date: '2026-03-19',
    period: { kind: 'none' },
    title: 'Zawiadomienie po zebraniu',
    summary_plain: 'Post-meeting notice with individual vote collection.',
    key_facts: [
      { label: 'Meeting date', value: '2026-02-24' },
      { label: 'Reference', value: 'L. dz. 381/2026' },
    ],
    financial_rows: [],
    meter_readings: [],
    ledger_entries: [],
    interest_entries: [],
    important_dates: [{
      date: '2026-02-24',
      label: 'Meeting',
      kind: 'meeting',
    }],
    resolutions: [{
      number: '1/2026',
      subject: 'Approval of 2025 financial report',
      outcome: 'pending_vote',
      voting_method: 'individual vote collection',
      money_limit: null,
      note: null,
    }],
    reference_numbers: {
      document_ref: 'L. dz. 381/2026',
      property_code: null,
      unit_code: null,
      bank_account: null,
      source_document_numbers: [],
    },
    sensitive_findings: [{
      kind: 'password',
      label: 'Portal credentials present',
      value_redacted: '[redacted]',
      source_page: 1,
    }],
    mentions: {
      people: [],
      addresses: [],
      emails: [],
      phones: [],
      reference_numbers: ['L. dz. 381/2026'],
    },
    questions_for_user: [],
    warnings: [],
  };
}

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectAnomalies } from './anomalies.ts';
import { buildInboxReport, redactSensitiveText, writeInboxReport } from './reports.ts';
import type { VaultRecord } from './schemas/record.ts';
import { putRecord, registerDocument } from './vault.ts';

test('redactSensitiveText removes credential-like values', () => {
  const redacted = redactSensitiveText('Portal password: hunter2 and api key=abcdef');

  assert.equal(redacted.includes('hunter2'), false);
  assert.equal(redacted.includes('abcdef'), false);
  assert.match(redacted, /password: \[redacted\]/);
  assert.match(redacted, /api key: \[redacted\]/);
});

test('writeInboxReport creates a deterministic private inbox report', async () => {
  const fixture = await createFixture();
  const now = new Date('2026-04-17T12:00:00.000Z');

  try {
    const needsExtractionPath = path.join(fixture.root, 'needs-extraction.txt');
    const recordPath = path.join(fixture.root, 'record-source.txt');
    await writeFile(needsExtractionPath, 'needs extraction', 'utf8');
    await writeFile(recordPath, 'record source', 'utf8');

    const needsExtraction = await registerDocument({ path: needsExtractionPath }, fixture.root);
    const registered = await registerDocument({ path: recordPath }, fixture.root);
    await putRecord(registered.hash, validReportRecord(), fixture.root);
    await detectAnomalies({ root: fixture.root, now });

    const first = await writeInboxReport({ root: fixture.root, now });
    const firstContent = await readFile(first.path, 'utf8');
    const second = await writeInboxReport({ root: fixture.root, now });
    const secondContent = await readFile(second.path, 'utf8');
    const built = await buildInboxReport({ root: fixture.root, now });

    assert.equal(first.relativePath, 'reports/inbox.md');
    assert.equal(firstContent, secondContent);
    assert.equal(firstContent, built);
    assert.equal(first.bytes, second.bytes);
    assert.match(firstContent, /# Dabrowskiego Inbox/);
    assert.match(firstContent, /Extraction pending:/);
    assert.match(firstContent, new RegExp(needsExtraction.hash.slice(0, 12)));
    assert.match(firstContent, /Open anomalies:/);
    assert.match(firstContent, /RESOLUTION_PENDING_VOTE/);
    assert.match(firstContent, /Pending votes:/);
    assert.match(firstContent, /Upcoming dates:/);
    assert.match(firstContent, /Questions for you:/);
    assert.match(firstContent, /Latest Financial Changes/);
    assert.match(firstContent, /125\.00 PLN repair_fund/);
    assert.equal(firstContent.includes('hunter2'), false);
  } finally {
    await fixture.remove();
  }
});

function validReportRecord(): VaultRecord {
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
    title: 'Roof repair vote',
    summary_plain: 'Owners will vote about roof repair.',
    key_facts: [
      { label: 'Topic', value: 'roof repair vote' },
      { label: 'Reference', value: 'L. dz. 381/2026' },
    ],
    financial_rows: [{
      row_type: 'charge',
      category: 'repair_fund',
      category_original: 'Fundusz remontowy',
      category_group: 'repairs',
      period: { kind: 'month', value: '2026-04' },
      money: { amount_minor: 12500, currency: 'PLN' },
      quantity: null,
      unit_price_minor: null,
      confidence: 0.9,
      source_page: 1,
      note: null,
    }],
    meter_readings: [],
    ledger_entries: [],
    interest_entries: [],
    important_dates: [{
      date: '2026-04-30',
      label: 'Vote deadline',
      kind: 'deadline',
    }],
    resolutions: [{
      number: '1/2026',
      subject: 'Approve roof repair',
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
      label: 'Portal password',
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
    questions_for_user: ['Should this vote be treated as approved after collection closes?'],
    warnings: [],
  };
}

async function createFixture(): Promise<{ root: string; remove: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-report-test-'));

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

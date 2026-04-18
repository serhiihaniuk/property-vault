import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openVaultDatabase } from './db.ts';
import {
  context,
  listExtractionWork,
  putNote,
  putRecord,
  registerDocument,
  reindex,
  search,
  sql,
  tagDocument,
  validate,
} from './vault.ts';
import type { VaultRecord } from './schemas/record.ts';

test('registerDocument is idempotent for the same file path', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'same file bytes', 'utf8');

    const first = await registerDocument({ path: sourcePath }, fixture.root);
    const second = await registerDocument({ path: sourcePath }, fixture.root);
    const report = await validate(fixture.root);

    assert.equal(first.hash, second.hash);
    assert.equal(first.isNewDocument, true);
    assert.equal(first.isNewSource, true);
    assert.equal(second.isNewDocument, false);
    assert.equal(second.isNewSource, false);
    assert.equal(report.ok, true);
    assert.equal(report.counts.canonicalDocuments, 1);
    assert.equal(report.counts.sourceObservations, 1);
    assert.equal(report.counts.dbDocuments, 1);
    assert.equal(report.counts.dbSources, 1);
  } finally {
    await fixture.remove();
  }
});

test('registerDocument stores one document with multiple sources for identical bytes', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'notice-a.txt');
    const secondPath = path.join(fixture.root, 'notice-b.txt');
    await writeFile(firstPath, 'shared document bytes', 'utf8');
    await writeFile(secondPath, 'shared document bytes', 'utf8');

    const first = await registerDocument({ path: firstPath }, fixture.root);
    const second = await registerDocument({ path: secondPath }, fixture.root);
    const report = await validate(fixture.root);

    assert.equal(first.hash, second.hash);
    assert.equal(first.isNewDocument, true);
    assert.equal(second.isNewDocument, false);
    assert.equal(second.isNewSource, true);
    assert.equal(report.ok, true);
    assert.equal(report.counts.canonicalDocuments, 1);
    assert.equal(report.counts.sourceObservations, 2);
    assert.equal(report.counts.dbDocuments, 1);
    assert.equal(report.counts.dbSources, 2);
  } finally {
    await fixture.remove();
  }
});

test('reindex rebuilds document and source rows from canonical files', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'notice-a.txt');
    const secondPath = path.join(fixture.root, 'notice-b.txt');
    await writeFile(firstPath, 'reindex document bytes', 'utf8');
    await writeFile(secondPath, 'reindex document bytes', 'utf8');

    await registerDocument({ path: firstPath }, fixture.root);
    await registerDocument({ path: secondPath }, fixture.root);

    const result = await reindex(fixture.root);
    const db = await openVaultDatabase(fixture.root);

    try {
      const documents = db.prepare('SELECT count(*) AS count FROM documents').get() as {
        count: number;
      };
      const sources = db.prepare('SELECT count(*) AS count FROM document_sources').get() as {
        count: number;
      };

      assert.equal(result.documentsIndexed, 1);
      assert.equal(result.sourcesIndexed, 2);
      assert.equal(result.sourcesSkipped, 0);
      assert.equal(documents.count, 1);
      assert.equal(sources.count, 2);
    } finally {
      db.close();
    }
  } finally {
    await fixture.remove();
  }
});

test('sql allows SELECT statements and rejects writes', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'query document bytes', 'utf8');
    await registerDocument({ path: sourcePath }, fixture.root);

    const rows = await sql<{ count: number }>(
      'SELECT count(*) AS count FROM documents',
      [],
      fixture.root,
    );

    assert.equal(rows[0]?.count, 1);
    await assert.rejects(
      () => sql('DELETE FROM documents', [], fixture.root),
      /only accepts SELECT/,
    );
  } finally {
    await fixture.remove();
  }
});

test('registerDocument stores PDF page count and text layer flags', async () => {
  const fixture = await createFixture();

  try {
    const textPdfPath = path.join(fixture.root, 'text.pdf');
    const thinPdfPath = path.join(fixture.root, 'thin.pdf');
    await writeFile(
      textPdfPath,
      makePdf('This PDF has enough text to be treated as a searchable document.'),
    );
    await writeFile(thinPdfPath, makePdf(''));

    const textPdf = await registerDocument({ path: textPdfPath }, fixture.root);
    const thinPdf = await registerDocument({ path: thinPdfPath }, fixture.root);
    const rows = await sql<{
      hash: string;
      page_count: number | null;
      has_text_layer: number;
      needs_ocr: number;
      ocr_status: string;
    }>(
      'SELECT hash, page_count, has_text_layer, needs_ocr, ocr_status FROM documents ORDER BY hash',
      [],
      fixture.root,
    );

    const byHash = new Map(rows.map((row) => [row.hash, row]));

    assert.equal(byHash.get(textPdf.hash)?.page_count, 1);
    assert.equal(byHash.get(textPdf.hash)?.has_text_layer, 1);
    assert.equal(byHash.get(textPdf.hash)?.needs_ocr, 0);
    assert.equal(byHash.get(textPdf.hash)?.ocr_status, 'not_needed');
    assert.equal(byHash.get(thinPdf.hash)?.page_count, 1);
    assert.equal(byHash.get(thinPdf.hash)?.has_text_layer, 0);
    assert.equal(byHash.get(thinPdf.hash)?.needs_ocr, 1);
    assert.equal(byHash.get(thinPdf.hash)?.ocr_status, 'pending');
  } finally {
    await fixture.remove();
  }
});

test('reindex rebuilds PDF inspection metadata', async () => {
  const fixture = await createFixture();

  try {
    const pdfPath = path.join(fixture.root, 'text.pdf');
    await writeFile(
      pdfPath,
      makePdf('This PDF metadata should survive a full SQLite reindex operation.'),
    );

    const registered = await registerDocument({ path: pdfPath }, fixture.root);
    await reindex(fixture.root);

    const rows = await sql<{
      hash: string;
      page_count: number | null;
      has_text_layer: number;
      needs_ocr: number;
      ocr_status: string;
    }>(
      'SELECT hash, page_count, has_text_layer, needs_ocr, ocr_status FROM documents',
      [],
      fixture.root,
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.hash, registered.hash);
    assert.equal(rows[0]?.page_count, 1);
    assert.equal(rows[0]?.has_text_layer, 1);
    assert.equal(rows[0]?.needs_ocr, 0);
    assert.equal(rows[0]?.ocr_status, 'not_needed');
  } finally {
    await fixture.remove();
  }
});

test('putRecord and putNote store canonical files and index searchable content', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'meeting.txt');
    await writeFile(sourcePath, 'meeting source document', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);
    const record = validMeetingNoticeRecord({
      title: 'Annual repair vote',
      summary: 'Owners will vote about roof repair.',
    });

    const recordResult = await putRecord(registered.hash, record, fixture.root);
    const noteResult = await putNote(
      registered.hash,
      'Note: roof repair requires owner attention.',
      fixture.root,
    );
    const rows = await sql<{
      document_type: string;
      title: string;
      note_path: string | null;
      financial_rows: number;
      important_dates: number;
      resolutions: number;
    }>(`
      SELECT
        records.document_type,
        records.title,
        records.note_path,
        (SELECT count(*) FROM financial_rows WHERE hash = records.hash) AS financial_rows,
        (SELECT count(*) FROM important_dates WHERE hash = records.hash) AS important_dates,
        (SELECT count(*) FROM resolutions WHERE hash = records.hash) AS resolutions
      FROM records
      WHERE hash = ?
    `, [registered.hash], fixture.root);
    const results = await search({ query: 'roof repair' }, fixture.root);

    assert.equal(recordResult.relativePath, `vault/records/${registered.hash}.json`);
    assert.equal(noteResult.relativePath, `vault/notes/${registered.hash}.md`);
    assert.equal(rows[0]?.document_type, 'meeting_notice');
    assert.equal(rows[0]?.title, 'Annual repair vote');
    assert.equal(rows[0]?.note_path, `vault/notes/${registered.hash}.md`);
    assert.equal(rows[0]?.financial_rows, 1);
    assert.equal(rows[0]?.important_dates, 1);
    assert.equal(rows[0]?.resolutions, 1);
    assert.equal(results[0]?.hash, registered.hash);
  } finally {
    await fixture.remove();
  }
});

test('putRecord normalizes financial categories for dashboard queries', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'monthly-charges.txt');
    await writeFile(sourcePath, 'monthly charge source document', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);
    const record = validMeetingNoticeRecord({
      title: 'Monthly category normalization',
      summary: 'Monthly charges use dashboard category aliases.',
    });
    record.document_type = 'monthly_charges';
    record.financial_rows = [{
      row_type: 'charge',
      category: 'zaliczka_czesc_wspolna',
      category_original: 'Zaliczka na część wspólną',
      category_group: 'utrzymanie_nieruchomosci_wspolnej',
      period: { kind: 'month', value: '2026-04' },
      money: { amount_minor: 14427, currency: 'PLN' },
      quantity: { value: 49.07, unit: 'm2' },
      unit_price_minor: 294,
      confidence: 0.98,
      source_page: 1,
      note: null,
    }, {
      row_type: 'settlement',
      category: 'heat_energy_cost',
      category_original: 'Energia cieplna CO - koszt',
      category_group: 'media_settlement',
      period: {
        kind: 'range',
        start: '2025-01-01',
        end: '2025-12-31',
      },
      money: { amount_minor: 95531, currency: 'PLN' },
      quantity: null,
      unit_price_minor: null,
      confidence: 0.96,
      source_page: 1,
      note: null,
    }, {
      row_type: 'charge',
      category: 'ai_label_woda_ciepla',
      category_original: 'Woda ciepla',
      category_group: 'media',
      period: { kind: 'month', value: '2026-04' },
      money: { amount_minor: 8528, currency: 'PLN' },
      quantity: { value: 2.19, unit: 'm3' },
      unit_price_minor: 3894,
      confidence: 0.91,
      source_page: 1,
      note: null,
    }];

    await putRecord(registered.hash, record, fixture.root);

    const storedRecord = JSON.parse(
      await readFile(path.join(fixture.root, 'vault', 'records', `${registered.hash}.json`), 'utf8'),
    ) as VaultRecord;
    const rows = await sql<{
      category: string;
      category_group: string | null;
      amount_minor: number;
    }>(`
      SELECT category, category_group, amount_minor
      FROM financial_rows
      WHERE hash = ?
      ORDER BY amount_minor
    `, [registered.hash], fixture.root);

    assert.deepEqual(rows, [{
      category: 'hot_water_heating',
      category_group: 'media',
      amount_minor: 8528,
    }, {
      category: 'shared_property_advance',
      category_group: 'shared_property',
      amount_minor: 14427,
    }, {
      category: 'central_heating_cost',
      category_group: 'media_settlement',
      amount_minor: 95531,
    }]);
    assert.equal(storedRecord.financial_rows[0]?.category, 'shared_property_advance');
    assert.equal(storedRecord.financial_rows[0]?.category_original, 'Zaliczka na część wspólną');
    assert.equal(storedRecord.financial_rows[1]?.category, 'central_heating_cost');
    assert.equal(storedRecord.financial_rows[2]?.category, 'hot_water_heating');

    const mediaPath = path.join(fixture.root, 'media-settlement.txt');
    await writeFile(mediaPath, 'media settlement source document', 'utf8');
    const mediaDocument = await registerDocument({ path: mediaPath }, fixture.root);
    const mediaRecord = validMeetingNoticeRecord({
      title: 'Media category normalization',
      summary: 'Media settlement uses source-label guardrails.',
    });
    mediaRecord.document_type = 'media_settlement';
    mediaRecord.financial_rows = [{
      row_type: 'settlement',
      category: 'strange_ai_label',
      category_original: 'Ciepla woda - koszt',
      category_group: 'media_settlement',
      period: {
        kind: 'range',
        start: '2025-01-01',
        end: '2025-12-31',
      },
      money: { amount_minor: 89381, currency: 'PLN' },
      quantity: null,
      unit_price_minor: null,
      confidence: 0.91,
      source_page: 1,
      note: null,
    }];

    await putRecord(mediaDocument.hash, mediaRecord, fixture.root);

    const mediaRows = await sql<{
      category: string;
      category_group: string | null;
    }>(`
      SELECT category, category_group
      FROM financial_rows
      WHERE hash = ?
    `, [mediaDocument.hash], fixture.root);

    assert.deepEqual(mediaRows, [{
      category: 'hot_water_cost',
      category_group: 'media_settlement',
    }]);
  } finally {
    await fixture.remove();
  }
});

test('reindex rebuilds records, notes, and search index from canonical files', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'meeting.txt');
    await writeFile(sourcePath, 'meeting source document', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);

    await putRecord(
      registered.hash,
      validMeetingNoticeRecord({
        title: 'Balcony renovation vote',
        summary: 'Owners discuss balcony renovation costs.',
      }),
      fixture.root,
    );
    await putNote(registered.hash, 'Balcony renovation note.', fixture.root);

    const result = await reindex(fixture.root);
    const rows = await sql<{ count: number }>(
      'SELECT count(*) AS count FROM records',
      [],
      fixture.root,
    );
    const results = await search({ query: 'balcony renovation' }, fixture.root);

    assert.equal(result.recordsIndexed, 1);
    assert.equal(result.notesIndexed, 1);
    assert.equal(rows[0]?.count, 1);
    assert.equal(results[0]?.hash, registered.hash);
    assert.equal(results[0]?.notePath, `vault/notes/${registered.hash}.md`);
  } finally {
    await fixture.remove();
  }
});

test('reindex rebuilds canonical emails, asset tags, and anomalies', async () => {
  const fixture = await createFixture();

  try {
    const logoPath = path.join(fixture.root, 'logo.png');
    const missingPath = path.join(fixture.root, 'needs-extraction.txt');
    await writeFile(logoPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(missingPath, 'needs extraction', 'utf8');

    const logo = await registerDocument({ path: logoPath }, fixture.root);
    const missing = await registerDocument({ path: missingPath }, fixture.root);
    await tagDocument(logo.hash, 'asset_logo', fixture.root);
    await writeCanonicalEmailFixture(fixture.root, logo.hash);

    const result = await reindex(fixture.root);
    const rows = await sql<{
      emails: number;
      attachments: number;
      taggedDocuments: number;
      openAnomalies: number;
    }>(
      `
        SELECT
          (SELECT count(*) FROM emails) AS emails,
          (SELECT count(*) FROM email_attachments) AS attachments,
          (SELECT count(*) FROM documents WHERE asset_tag = 'asset_logo') AS taggedDocuments,
          (SELECT count(*) FROM anomalies WHERE status = 'open') AS openAnomalies
      `,
      [],
      fixture.root,
    );
    const work = await listExtractionWork(fixture.root);

    assert.equal(result.emailsIndexed, 1);
    assert.equal(result.emailAttachmentsIndexed, 1);
    assert.equal(result.documentTagsIndexed, 1);
    assert.equal(result.anomaliesOpen, 1);
    assert.deepEqual(rows[0], {
      emails: 1,
      attachments: 1,
      taggedDocuments: 1,
      openAnomalies: 1,
    });
    assert.deepEqual(work.map((item) => item.hash), [missing.hash]);
  } finally {
    await fixture.remove();
  }
});

test('listExtractionWork reports documents without records', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'needs-extraction.txt');
    const secondPath = path.join(fixture.root, 'has-record.txt');
    await writeFile(firstPath, 'needs extraction document', 'utf8');
    await writeFile(secondPath, 'already extracted document', 'utf8');

    const needsExtraction = await registerDocument({ path: firstPath }, fixture.root);
    const hasRecord = await registerDocument({ path: secondPath }, fixture.root);
    await putRecord(
      hasRecord.hash,
      validMeetingNoticeRecord({
        title: 'Already extracted',
        summary: 'This record is already extracted.',
      }),
      fixture.root,
    );

    const work = await listExtractionWork(fixture.root);

    assert.equal(work.length, 1);
    assert.equal(work[0]?.hash, needsExtraction.hash);
    assert.equal(work[0]?.localPath, `vault/documents/${needsExtraction.hash}.txt`);
    assert.deepEqual(work[0]?.sourceKinds, ['manual_drop']);
  } finally {
    await fixture.remove();
  }
});

test('context summarizes counts, Gmail state, records, and extraction work', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'needs-extraction.txt');
    const secondPath = path.join(fixture.root, 'has-record.txt');
    await writeFile(firstPath, 'needs extraction document', 'utf8');
    await writeFile(secondPath, 'already extracted document', 'utf8');

    const needsExtraction = await registerDocument({ path: firstPath }, fixture.root);
    const hasRecord = await registerDocument({ path: secondPath }, fixture.root);
    await putRecord(
      hasRecord.hash,
      validMeetingNoticeRecord({
        title: 'Context record',
        summary: 'This record appears in context.',
      }),
      fixture.root,
    );

    const result = await context(fixture.root);

    assert.equal(result.counts.documents, 2);
    assert.equal(result.counts.records, 1);
    assert.equal(result.counts.extractionWork, 1);
    assert.equal(result.lastGmailSync.lookbackDays, 14);
    assert.equal(result.latestRecords[0]?.hash, hasRecord.hash);
    assert.equal(result.extractionWork[0]?.hash, needsExtraction.hash);
  } finally {
    await fixture.remove();
  }
});

test('strict validation catches missing Git ignore protections', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'strict validation bytes', 'utf8');
    await registerDocument({ path: sourcePath }, fixture.root);

    const missing = await validate(fixture.root, { strict: true });
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((issue) => issue.code === 'GITIGNORE_MISSING'));

    await writeFile(
      path.join(fixture.root, '.gitignore'),
      'vault/\nindex/\nreports/\nnode_modules/\n.lock\n.env\n',
      'utf8',
    );

    const protectedReport = await validate(fixture.root, { strict: true });
    assert.equal(protectedReport.ok, true);
    assert.equal(protectedReport.strict, true);
  } finally {
    await fixture.remove();
  }
});

async function writeCanonicalEmailFixture(root: string, hash: string): Promise<void> {
  const emailDir = path.join(root, 'vault', 'emails', 'gmail-1');
  await mkdir(emailDir, { recursive: true });
  await writeFile(path.join(emailDir, 'body.txt'), 'Email body\n', 'utf8');
  await writeFile(
    path.join(emailDir, 'metadata.json'),
    `${JSON.stringify({
      id: 'gmail-1',
      threadId: 'thread-1',
      historyId: 'history-1',
      internalDate: '1715587872000',
      headers: { from: 'administrator4@locator.wroclaw.pl' },
      subject: 'Locator message',
      from: 'administrator4@locator.wroclaw.pl',
      to: 'owner@example.test',
      date: 'Mon, 13 May 2024 10:11:12 +0200',
      bodyText: 'Email body',
      attachments: [],
    }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(emailDir, 'attachments.json'),
    `${JSON.stringify([
      {
        index: 0,
        attachmentId: 'attachment-1',
        originalFilename: 'logo.png',
        declaredMime: 'image/png',
        sniffedMime: 'image/png',
        sizeBytes: 4,
        hash,
        failed: false,
      },
    ], null, 2)}\n`,
    'utf8',
  );
}

function makePdf(text: string): Buffer {
  const objects: string[] = [];
  const content = text ? `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET` : '';

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push(
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  );

  let body = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }

  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, 'utf8');
}

function validMeetingNoticeRecord(input: {
  title: string;
  summary: string;
}): VaultRecord {
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
    title: input.title,
    summary_plain: input.summary,
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
    sensitive_findings: [],
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

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function createFixture(): Promise<{ root: string; remove: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-test-'));

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

import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openVaultDatabase } from './db.ts';
import { registerDocument, reindex, sql, validate } from './vault.ts';

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

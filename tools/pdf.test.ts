import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectPdf, renderPdfPages } from './pdf.ts';
import { registerDocument } from './vault.ts';

test('inspectPdf detects a useful text layer', async () => {
  const fixture = await createFixture();

  try {
    const pdfPath = path.join(fixture.root, 'text.pdf');
    await writeFile(
      pdfPath,
      makePdf(
        'This generated PDF contains enough searchable text for the inspection threshold.',
      ),
    );

    const result = await inspectPdf(pdfPath);

    assert.equal(result.pageCount, 1);
    assert.equal(result.hasTextLayer, true);
    assert.equal(result.needsVision, false);
    assert.match(result.textPreview, /generated PDF contains enough searchable/);
  } finally {
    await fixture.remove();
  }
});

test('inspectPdf marks thin text as needing vision', async () => {
  const fixture = await createFixture();

  try {
    const pdfPath = path.join(fixture.root, 'thin.pdf');
    await writeFile(pdfPath, makePdf(''));

    const result = await inspectPdf(pdfPath);

    assert.equal(result.pageCount, 1);
    assert.equal(result.hasTextLayer, false);
    assert.equal(result.needsVision, true);
  } finally {
    await fixture.remove();
  }
});

test('renderPdfPages writes PNG pages under index/renders', async () => {
  const fixture = await createFixture();

  try {
    const pdfPath = path.join(fixture.root, 'render.pdf');
    await writeFile(
      pdfPath,
      makePdf('Render this generated PDF page into a deterministic PNG file.'),
    );

    const registered = await registerDocument({ path: pdfPath }, fixture.root);
    const firstRender = await renderPdfPages(registered.hash, {
      root: fixture.root,
      scale: 1,
    });
    const secondRender = await renderPdfPages(registered.hash, {
      root: fixture.root,
      scale: 1,
    });

    assert.equal(firstRender.length, 1);
    assert.equal(secondRender.length, 1);
    assert.equal(path.basename(secondRender[0]?.path ?? ''), 'page-001.png');

    const pngBytes = await readFile(secondRender[0]?.path ?? '');
    const pngStats = await stat(secondRender[0]?.path ?? '');

    assert.equal(pngBytes[0], 0x89);
    assert.equal(pngBytes[1], 0x50);
    assert.equal(pngBytes[2], 0x4e);
    assert.equal(pngBytes[3], 0x47);
    assert.ok(pngStats.size > 1000);
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
  const root = await mkdtemp(path.join(os.tmpdir(), 'property-vault-pdf-test-'));

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

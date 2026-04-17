import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectAnomalies, listOpenAnomalies } from './anomalies.ts';
import { openVaultDatabase } from './db.ts';
import { registerDocument, sql } from './vault.ts';

test('detectAnomalies creates idempotent extraction work and resolves it later', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'needs extraction', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);

    const first = await detectAnomalies({
      root: fixture.root,
      now: new Date('2026-04-17T12:00:00.000Z'),
    });
    const second = await detectAnomalies({
      root: fixture.root,
      now: new Date('2026-04-17T12:01:00.000Z'),
    });
    const rows = await sql<{ count: number }>(
      'SELECT count(*) AS count FROM anomalies',
      [],
      fixture.root,
    );
    const open = await listOpenAnomalies(fixture.root);

    assert.equal(first.detected, 1);
    assert.equal(second.detected, 1);
    assert.equal(rows[0]?.count, 1);
    assert.equal(open[0]?.ruleId, 'EXTRACTION_MISSING');
    assert.equal(open[0]?.subjectHash, registered.hash);

    await insertRecord(fixture.root, registered.hash, { confidence: 0.9 });
    const resolved = await detectAnomalies({
      root: fixture.root,
      now: new Date('2026-04-17T12:02:00.000Z'),
    });

    assert.equal(resolved.detected, 0);
    assert.equal(resolved.open, 0);
    assert.equal(resolved.resolved, 1);
  } finally {
    await fixture.remove();
  }
});

test('detectAnomalies flags OCR, Gmail, confidence, vote, and deadline work', async () => {
  const fixture = await createFixture();

  try {
    const pdfPath = path.join(fixture.root, 'scanned.pdf');
    await writeFile(pdfPath, makePdf(''));
    const registered = await registerDocument({ path: pdfPath }, fixture.root);
    await insertRecord(fixture.root, registered.hash, { confidence: 0.4 });

    const db = await openVaultDatabase(fixture.root);
    try {
      db.prepare(`
        INSERT INTO resolutions (hash, number, subject, outcome)
        VALUES (@hash, '1/2026', 'Approve repair', 'pending_vote')
      `).run({ hash: registered.hash });
      db.prepare(`
        INSERT INTO important_dates (hash, date, label, kind)
        VALUES
          (@hash, '2026-04-10', 'Overdue payment', 'deadline'),
          (@hash, '2026-04-20', 'Upcoming vote', 'deadline')
      `).run({ hash: registered.hash });
      db.prepare(`
        INSERT INTO emails (gmail_id, thread_id, body_path)
        VALUES ('gmail-1', 'thread-1', 'vault/emails/gmail-1/body.txt')
      `).run();
      db.prepare(`
        INSERT INTO email_attachments (
          gmail_id,
          attachment_index,
          attachment_id,
          filename,
          declared_mime,
          hash
        )
        VALUES ('gmail-1', 0, 'missing-attachment', 'missing.pdf', 'application/pdf', NULL)
      `).run();
    } finally {
      db.close();
    }

    const result = await detectAnomalies({
      root: fixture.root,
      now: new Date('2026-04-17T12:00:00.000Z'),
    });
    const ruleIds = (await listOpenAnomalies(fixture.root)).map((item) => item.ruleId).sort();

    assert.equal(result.open, 6);
    assert.deepEqual(ruleIds, [
      'DEADLINE_APPROACHING',
      'DEADLINE_MISSED',
      'GMAIL_ATTACHMENT_FETCH_FAILED',
      'LOW_CONFIDENCE',
      'OCR_PENDING',
      'RESOLUTION_PENDING_VOTE',
    ]);
  } finally {
    await fixture.remove();
  }
});

test('detectAnomalies reports visible secrets without storing the secret value', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'record source', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);
    await insertRecord(fixture.root, registered.hash, {
      confidence: 0.9,
      summary: 'Portal password: very-secret-value',
    });

    const result = await detectAnomalies({
      root: fixture.root,
      now: new Date('2026-04-17T12:00:00.000Z'),
    });
    const secret = (await listOpenAnomalies(fixture.root))
      .find((item) => item.ruleId === 'SECRET_VISIBLE');

    assert.equal(result.open, 1);
    assert.equal(secret?.severity, 'critical');
    assert.equal(secret?.payload.redacted, true);
    assert.equal(JSON.stringify(secret?.payload).includes('very-secret-value'), false);
  } finally {
    await fixture.remove();
  }
});

async function insertRecord(
  root: string,
  hash: string,
  options: { confidence: number; summary?: string },
): Promise<void> {
  const db = await openVaultDatabase(root);

  try {
    db.prepare(`
      INSERT INTO records (
        hash,
        schema_version,
        extractor_version,
        extracted_at,
        extracted_by,
        status,
        confidence,
        document_type,
        period_kind,
        title,
        summary_plain,
        record_path,
        record_json
      )
      VALUES (
        @hash,
        1,
        'test',
        '2026-04-17T12:00:00.000Z',
        'test',
        'extracted',
        @confidence,
        'notice',
        'none',
        'Fixture record',
        @summary,
        'vault/records/fixture.json',
        '{}'
      )
      ON CONFLICT(hash) DO UPDATE SET
        confidence = excluded.confidence,
        summary_plain = excluded.summary_plain
    `).run({
      hash,
      confidence: options.confidence,
      summary: options.summary ?? 'Fixture summary',
    });
  } finally {
    db.close();
  }
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

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function createFixture(): Promise<{ root: string; remove: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-anomalies-test-'));

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

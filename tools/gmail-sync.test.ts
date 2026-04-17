import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { type GmailMessageRef, type GmailMessageWithAttachments } from './gmail.ts';
import { lookbackDate, syncGmail, type GmailSyncClient } from './gmail-sync.ts';
import { readState, writeState } from './state.ts';
import { init, sql } from './vault.ts';

test('lookbackDate subtracts the configured window from the Gmail watermark', () => {
  assert.equal(lookbackDate('2026-04-17T12:00:00.000Z', 14), '2026-04-03');
  assert.equal(lookbackDate(null, 14), null);
  assert.equal(lookbackDate('not-a-date', 14), null);
});

test('syncGmail stores emails, attachments, documents, and state idempotently', async () => {
  const fixture = await createFixture();
  const message = fixtureMessage();
  const client = createMockClient([{
    id: message.id,
    threadId: message.threadId,
  }], message, makePdf('Locator accounting attachment with a searchable text layer.'));

  try {
    const first = await syncGmail({
      root: fixture.root,
      client,
      backfillFrom: '2026-04-01',
    });
    const second = await syncGmail({
      root: fixture.root,
      client,
      backfillFrom: '2026-04-01',
    });
    const rows = await sql<{
      documents: number;
      sources: number;
      emails: number;
      attachments: number;
    }>(`
      SELECT
        (SELECT count(*) FROM documents) AS documents,
        (SELECT count(*) FROM document_sources) AS sources,
        (SELECT count(*) FROM emails) AS emails,
        (SELECT count(*) FROM email_attachments) AS attachments
    `, [], fixture.root);
    const attachmentRows = await sql<{
      declared_mime: string;
      sniffed_mime: string;
      hash: string;
    }>('SELECT declared_mime, sniffed_mime, hash FROM email_attachments', [], fixture.root);
    const state = await readState(fixture.root);

    assert.equal(first.query.endsWith('after:2026/04/01'), true);
    assert.equal(first.messagesStored, 1);
    assert.equal(first.documentsRegistered, 1);
    assert.equal(first.attachmentFailures, 0);
    assert.equal(second.messagesStored, 1);
    assert.deepEqual(rows[0], {
      documents: 1,
      sources: 1,
      emails: 1,
      attachments: 1,
    });
    assert.equal(attachmentRows[0]?.declared_mime, 'application/octet-stream');
    assert.equal(attachmentRows[0]?.sniffed_mime, 'application/pdf');
    assert.match(attachmentRows[0]?.hash ?? '', /^[a-f0-9]{64}$/);
    assert.equal(state.last_gmail_sync.high_watermark_date, '2026-04-17T10:00:00.000Z');
    assert.equal(state.last_gmail_sync.messages_seen_total, 2);
    assert.equal(client.queries[0], client.queries[1]);
  } finally {
    await fixture.remove();
  }
});

test('syncGmail uses the saved high-watermark date with a 14 day lookback', async () => {
  const fixture = await createFixture();
  const message = fixtureMessage();
  const client = createMockClient([{
    id: message.id,
    threadId: message.threadId,
  }], message, makePdf('Another attachment'));

  try {
    await init(fixture.root);
    const state = await readState(fixture.root);
    await writeState({
      ...state,
      last_gmail_sync: {
        ...state.last_gmail_sync,
        high_watermark_date: '2026-04-17T10:00:00.000Z',
      },
    }, fixture.root);

    const result = await syncGmail({ root: fixture.root, client });

    assert.equal(result.query.endsWith('after:2026/04/03'), true);
    assert.equal(client.queries[0], result.query);
  } finally {
    await fixture.remove();
  }
});

function fixtureMessage(): GmailMessageWithAttachments {
  return {
    id: 'gmail-1',
    threadId: 'thread-1',
    historyId: '99',
    internalDate: String(Date.parse('2026-04-17T10:00:00.000Z')),
    headers: {
      subject: 'Locator rozliczenie',
      from: 'ksiegowosc4@locator.wroclaw.pl',
      to: 'owner@example.com',
      date: 'Fri, 17 Apr 2026 12:00:00 +0200',
    },
    subject: 'Locator rozliczenie',
    from: 'ksiegowosc4@locator.wroclaw.pl',
    to: 'owner@example.com',
    date: 'Fri, 17 Apr 2026 12:00:00 +0200',
    bodyText: 'Dzien dobry, w zalaczeniu rozliczenie.',
    attachments: [{
      partId: '1',
      filename: 'rozliczenie.pdf',
      mimeType: 'application/octet-stream',
      attachmentId: 'attachment-1',
      size: 123,
    }],
  };
}

function createMockClient(
  refs: GmailMessageRef[],
  message: GmailMessageWithAttachments,
  attachmentBytes: Buffer,
): GmailSyncClient & { queries: string[] } {
  const queries: string[] = [];

  return {
    queries,
    async listMessages(query: string): Promise<GmailMessageRef[]> {
      queries.push(query);
      return refs;
    },
    async getMessage(): Promise<GmailMessageWithAttachments> {
      return message;
    },
    async fetchAttachmentBytes(): Promise<Buffer> {
      return attachmentBytes;
    },
  };
}

function makePdf(text: string): Buffer {
  const objects: string[] = [];
  const content = `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;

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
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-gmail-sync-test-'));

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

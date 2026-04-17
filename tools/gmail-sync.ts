import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { openVaultDatabase } from './db.ts';
import {
  buildLocatorQuery,
  fetchAttachmentBytes,
  getMessage,
  listMessages,
  type GmailAttachmentPart,
  type GmailMessageRef,
  type GmailMessageWithAttachments,
} from './gmail.ts';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';
import { readState, updateState } from './state.ts';
import { init, registerDocument } from './vault.ts';

export type GmailSyncClient = {
  listMessages(query: string, maxResults?: number): Promise<GmailMessageRef[]>;
  getMessage(gmailId: string): Promise<GmailMessageWithAttachments>;
  fetchAttachmentBytes(gmailId: string, attachmentId: string): Promise<Buffer>;
};

export type GmailSyncOptions = {
  backfillFrom?: string;
  maxResults?: number;
  client?: GmailSyncClient;
  root?: string;
};

export type GmailSyncResult = {
  query: string;
  messagesFound: number;
  messagesStored: number;
  attachmentsSeen: number;
  attachmentsFetched: number;
  documentsRegistered: number;
  attachmentFailures: number;
  highWatermarkDate: string | null;
};

type EmailAttachmentRow = {
  attachmentIndex: number;
  part: GmailAttachmentPart;
  sniffedMime: string | null;
  sizeBytes: number | null;
  hash: string | null;
  failed: boolean;
};

export async function syncGmail(options: GmailSyncOptions = {}): Promise<GmailSyncResult> {
  const root = options.root ?? resolveRepoRoot();
  await init(root);

  const state = await readState(root);
  const after = options.backfillFrom ?? lookbackDate(
    state.last_gmail_sync.high_watermark_date,
    state.last_gmail_sync.lookback_days,
  );
  const query = buildLocatorQuery({ after: after ?? undefined });
  const client = options.client ?? defaultGmailSyncClient;
  const refs = await client.listMessages(query, options.maxResults);
  const run = await beginSyncRun(root, { query, backfillFrom: options.backfillFrom ?? null });
  const result: GmailSyncResult = {
    query,
    messagesFound: refs.length,
    messagesStored: 0,
    attachmentsSeen: 0,
    attachmentsFetched: 0,
    documentsRegistered: 0,
    attachmentFailures: 0,
    highWatermarkDate: state.last_gmail_sync.high_watermark_date,
  };

  try {
    for (const ref of refs) {
      const message = await client.getMessage(ref.id);
      const attachments = await processAttachments(message, client, root);

      await storeEmail(message, attachments, root);
      result.messagesStored += 1;
      result.attachmentsSeen += message.attachments.length;
      result.attachmentsFetched += attachments.filter((item) => item.hash !== null).length;
      result.documentsRegistered += attachments.filter((item) => item.hash !== null).length;
      result.attachmentFailures += attachments.filter((item) => item.failed).length;
      result.highWatermarkDate = newestIsoDate(
        result.highWatermarkDate,
        messageDateForWatermark(message),
      );
    }

    await updateState((current) => ({
      ...current,
      last_gmail_sync: {
        ...current.last_gmail_sync,
        at: new Date().toISOString(),
        high_watermark_date: result.highWatermarkDate,
        messages_seen_total: current.last_gmail_sync.messages_seen_total + refs.length,
      },
    }), root);

    await finishSyncRun(run.id, 'ok', result, root);
    return result;
  } catch (error) {
    await finishSyncRun(run.id, 'failed', {
      ...result,
      error: error instanceof Error ? error.message : String(error),
    }, root);
    throw error;
  }
}

export function lookbackDate(
  highWatermarkDate: string | null,
  lookbackDays: number,
): string | null {
  if (!highWatermarkDate) {
    return null;
  }

  const date = new Date(highWatermarkDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - lookbackDays);
  return date.toISOString().slice(0, 10);
}

const defaultGmailSyncClient: GmailSyncClient = {
  listMessages: (query, maxResults) => listMessages({ query, maxResults }),
  getMessage,
  fetchAttachmentBytes,
};

async function processAttachments(
  message: GmailMessageWithAttachments,
  client: GmailSyncClient,
  root: string,
): Promise<EmailAttachmentRow[]> {
  const rows: EmailAttachmentRow[] = [];

  for (const [index, part] of message.attachments.entries()) {
    if (!part.attachmentId) {
      rows.push({
        attachmentIndex: index,
        part,
        sniffedMime: null,
        sizeBytes: part.size,
        hash: null,
        failed: true,
      });
      continue;
    }

    try {
      const bytes = await client.fetchAttachmentBytes(message.id, part.attachmentId);
      const tmpPath = await writeTempBytes(message.id, index, bytes, root);
      const detected = await fileTypeFromBuffer(bytes);
      const registered = await registerDocument({
        path: tmpPath,
        source: {
          kind: 'gmail_attachment',
          ref: {
            gmail_id: message.id,
            thread_id: message.threadId,
            attachment_index: index,
            attachment_id: part.attachmentId,
            filename: part.filename,
          },
          originalFilename: part.filename || `attachment-${index}.bin`,
          seenAt: messageDateForWatermark(message) ?? new Date().toISOString(),
        },
      }, root);

      await unlink(tmpPath).catch(() => {});

      rows.push({
        attachmentIndex: index,
        part,
        sniffedMime: detected?.mime ?? registered.mime,
        sizeBytes: bytes.byteLength,
        hash: registered.hash,
        failed: false,
      });
    } catch {
      rows.push({
        attachmentIndex: index,
        part,
        sniffedMime: null,
        sizeBytes: part.size,
        hash: null,
        failed: true,
      });
    }
  }

  return rows;
}

async function storeEmail(
  message: GmailMessageWithAttachments,
  attachments: EmailAttachmentRow[],
  root: string,
): Promise<void> {
  const paths = getVaultPaths(root);
  const emailDir = path.join(paths.emailsDir, safePathSegment(message.id));
  const bodyPath = path.join(emailDir, 'body.txt');
  const metadataPath = path.join(emailDir, 'metadata.json');
  const relativeBodyPath = toRepoRelativePath(paths.root, bodyPath);

  const attachmentsJsonPath = path.join(emailDir, 'attachments.json');
  const attachmentsMeta = attachments.map((a) => ({
    index: a.attachmentIndex,
    attachmentId: a.part.attachmentId,
    originalFilename: a.part.filename || null,
    declaredMime: a.part.mimeType || null,
    sniffedMime: a.sniffedMime,
    sizeBytes: a.sizeBytes,
    hash: a.hash,
    failed: a.failed,
  }));

  await mkdir(emailDir, { recursive: true });
  await writeFile(bodyPath, `${message.bodyText}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(message, null, 2)}\n`, 'utf8');
  await writeFile(attachmentsJsonPath, `${JSON.stringify(attachmentsMeta, null, 2)}\n`, 'utf8');

  const db = await openVaultDatabase(root);

  try {
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO emails (
          gmail_id,
          thread_id,
          history_id,
          internal_date,
          sent_at,
          received_at,
          sender,
          recipients,
          subject,
          labels,
          body_path,
          raw_headers,
          updated_at
        )
        VALUES (
          @gmailId,
          @threadId,
          @historyId,
          @internalDate,
          @sentAt,
          @receivedAt,
          @sender,
          @recipients,
          @subject,
          '[]',
          @bodyPath,
          @rawHeaders,
          datetime('now')
        )
        ON CONFLICT(gmail_id) DO UPDATE SET
          thread_id = excluded.thread_id,
          history_id = excluded.history_id,
          internal_date = excluded.internal_date,
          sent_at = excluded.sent_at,
          received_at = excluded.received_at,
          sender = excluded.sender,
          recipients = excluded.recipients,
          subject = excluded.subject,
          body_path = excluded.body_path,
          raw_headers = excluded.raw_headers,
          updated_at = datetime('now')
      `).run({
        gmailId: message.id,
        threadId: message.threadId,
        historyId: message.historyId,
        internalDate: message.internalDate,
        sentAt: parseEmailDate(message.date),
        receivedAt: parseInternalDate(message.internalDate),
        sender: message.from,
        recipients: JSON.stringify(message.to ? [message.to] : []),
        subject: message.subject,
        bodyPath: relativeBodyPath,
        rawHeaders: JSON.stringify(message.headers),
      });

      const insertAttachment = db.prepare(`
        INSERT INTO email_attachments (
          gmail_id,
          attachment_index,
          attachment_id,
          filename,
          declared_mime,
          sniffed_mime,
          size_bytes,
          hash
        )
        VALUES (
          @gmailId,
          @attachmentIndex,
          @attachmentId,
          @filename,
          @declaredMime,
          @sniffedMime,
          @sizeBytes,
          @hash
        )
        ON CONFLICT(gmail_id, attachment_index) DO UPDATE SET
          attachment_id = excluded.attachment_id,
          filename = excluded.filename,
          declared_mime = excluded.declared_mime,
          sniffed_mime = excluded.sniffed_mime,
          size_bytes = excluded.size_bytes,
          hash = excluded.hash
      `);

      for (const attachment of attachments) {
        insertAttachment.run({
          gmailId: message.id,
          attachmentIndex: attachment.attachmentIndex,
          attachmentId: attachment.part.attachmentId,
          filename: attachment.part.filename,
          declaredMime: attachment.part.mimeType,
          sniffedMime: attachment.sniffedMime,
          sizeBytes: attachment.sizeBytes,
          hash: attachment.hash,
        });
      }
    });

    transaction();
  } finally {
    db.close();
  }
}

async function writeTempBytes(
  gmailId: string,
  index: number,
  bytes: Buffer,
  root: string,
): Promise<string> {
  const paths = getVaultPaths(root);
  const tmpDir = path.join(paths.indexDir, 'tmp');
  const filePath = path.join(tmpDir, `${safePathSegment(gmailId)}-${index}.bin`);

  await mkdir(tmpDir, { recursive: true });
  await writeFile(filePath, bytes);
  return filePath;
}

async function beginSyncRun(
  root: string,
  summary: Record<string, unknown>,
): Promise<{ id: number }> {
  const db = await openVaultDatabase(root);

  try {
    const result = db.prepare(`
      INSERT INTO sync_runs (kind, started_at, status, summary_json)
      VALUES ('gmail', @startedAt, 'running', @summaryJson)
    `).run({
      startedAt: new Date().toISOString(),
      summaryJson: JSON.stringify(summary),
    });

    return { id: Number(result.lastInsertRowid) };
  } finally {
    db.close();
  }
}

async function finishSyncRun(
  id: number,
  status: 'ok' | 'failed',
  summary: unknown,
  root: string,
): Promise<void> {
  const db = await openVaultDatabase(root);

  try {
    db.prepare(`
      UPDATE sync_runs
      SET finished_at = @finishedAt,
          status = @status,
          summary_json = @summaryJson
      WHERE id = @id
    `).run({
      id,
      finishedAt: new Date().toISOString(),
      status,
      summaryJson: JSON.stringify(summary),
    });
  } finally {
    db.close();
  }
}

function messageDateForWatermark(message: GmailMessageWithAttachments): string | null {
  return parseInternalDate(message.internalDate) ?? parseEmailDate(message.date);
}

function newestIsoDate(left: string | null, right: string | null): string | null {
  if (!right) {
    return left;
  }

  if (!left || right > left) {
    return right;
  }

  return left;
}

function parseInternalDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseEmailDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized === '' ? 'unnamed' : normalized;
}

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

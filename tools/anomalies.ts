import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openVaultDatabase } from './db.ts';
import { sha256Text } from './hash.ts';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';
import { init } from './vault.ts';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export type DetectedAnomaly = {
  ruleId: string;
  severity: AnomalySeverity;
  subjectHash: string | null;
  payload: Record<string, unknown>;
};

export type StoredAnomaly = {
  id: number;
  ruleId: string;
  severity: AnomalySeverity;
  subjectHash: string | null;
  status: string;
  detectedAt: string;
  payload: Record<string, unknown>;
};

export type DetectAnomaliesResult = {
  detected: number;
  open: number;
  resolved: number;
};

export type DetectAnomaliesOptions = {
  now?: Date;
  root?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.65;
const DEADLINE_APPROACHING_DAYS = 30;
const SECRET_PATTERN = /\b(password|passwd|haslo|hasło|secret|token|api[_ -]?key)\b\s*[:=]\s*\S+/i;

export async function detectAnomalies(
  options: DetectAnomaliesOptions = {},
): Promise<DetectAnomaliesResult> {
  const root = options.root ?? resolveRepoRoot();
  const now = options.now ?? new Date();

  await init(root);

  const detectedAt = now.toISOString();
  const detected = await collectDetectedAnomalies(root, now);
  const activeKeys = new Set<string>();
  const db = await openVaultDatabase(root);

  try {
    const transaction = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO anomalies (
          rule_id,
          severity,
          subject_hash,
          payload_signature,
          payload_json,
          status,
          detected_at,
          resolved_at,
          updated_at
        )
        VALUES (
          @ruleId,
          @severity,
          @subjectHash,
          @payloadSignature,
          @payloadJson,
          'open',
          @detectedAt,
          NULL,
          datetime('now')
        )
        ON CONFLICT(rule_id, subject_hash, payload_signature) DO UPDATE SET
          severity = excluded.severity,
          payload_json = excluded.payload_json,
          status = 'open',
          resolved_at = NULL,
          updated_at = datetime('now')
      `);

      for (const anomaly of detected) {
        const payloadJson = stableStringify(anomaly.payload);
        const payloadSignature = anomalySignature(anomaly, payloadJson);
        activeKeys.add(anomalyKey(anomaly.ruleId, anomaly.subjectHash, payloadSignature));
        upsert.run({
          ruleId: anomaly.ruleId,
          severity: anomaly.severity,
          subjectHash: anomaly.subjectHash,
          payloadSignature,
          payloadJson,
          detectedAt,
        });
      }

      const openRows = db.prepare(`
        SELECT id, rule_id AS ruleId, subject_hash AS subjectHash, payload_signature AS payloadSignature
        FROM anomalies
        WHERE status = 'open'
      `).all() as Array<{
        id: number;
        ruleId: string;
        subjectHash: string | null;
        payloadSignature: string;
      }>;
      const resolve = db.prepare(`
        UPDATE anomalies
        SET status = 'resolved',
            resolved_at = @resolvedAt,
            updated_at = datetime('now')
        WHERE id = @id
      `);

      for (const row of openRows) {
        if (!activeKeys.has(anomalyKey(row.ruleId, row.subjectHash, row.payloadSignature))) {
          resolve.run({ id: row.id, resolvedAt: detectedAt });
        }
      }
    });

    transaction();

    const open = db.prepare(`
      SELECT count(*) AS count
      FROM anomalies
      WHERE status = 'open'
    `).get() as { count: number };
    const resolved = db.prepare(`
      SELECT count(*) AS count
      FROM anomalies
      WHERE status = 'resolved'
    `).get() as { count: number };

    return {
      detected: detected.length,
      open: open.count,
      resolved: resolved.count,
    };
  } finally {
    db.close();
  }
}

export async function listOpenAnomalies(root = resolveRepoRoot()): Promise<StoredAnomaly[]> {
  await init(root);

  const db = await openVaultDatabase(root);

  try {
    const rows = db.prepare(`
      SELECT
        id,
        rule_id AS ruleId,
        severity,
        subject_hash AS subjectHash,
        status,
        detected_at AS detectedAt,
        payload_json AS payloadJson
      FROM anomalies
      WHERE status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 0
          WHEN 'warning' THEN 1
          ELSE 2
        END,
        rule_id,
        subject_hash,
        id
    `).all() as Array<{
      id: number;
      ruleId: string;
      severity: AnomalySeverity;
      subjectHash: string | null;
      status: string;
      detectedAt: string;
      payloadJson: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      severity: row.severity,
      subjectHash: row.subjectHash,
      status: row.status,
      detectedAt: row.detectedAt,
      payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    }));
  } finally {
    db.close();
  }
}

async function collectDetectedAnomalies(root: string, now: Date): Promise<DetectedAnomaly[]> {
  const db = await openVaultDatabase(root);

  try {
    const anomalies: DetectedAnomaly[] = [
      ...detectExtractionMissing(db),
      ...detectOcrPending(db),
      ...detectGmailAttachmentFetchFailed(db),
      ...detectLowConfidence(db),
      ...detectPendingVotes(db),
      ...detectDeadlines(db, now),
    ];
    anomalies.push(...await detectVisibleSecrets(db, root));
    return anomalies.sort(compareAnomalies);
  } finally {
    db.close();
  }
}

function detectExtractionMissing(db: Awaited<ReturnType<typeof openVaultDatabase>>): DetectedAnomaly[] {
  const rows = db.prepare(`
    SELECT documents.hash, documents.mime, documents.local_path AS localPath
    FROM documents
    LEFT JOIN records ON records.hash = documents.hash
    WHERE records.hash IS NULL
      AND documents.asset_tag IS NULL
    ORDER BY documents.hash
  `).all() as Array<{ hash: string; mime: string; localPath: string }>;

  return rows.map((row) => ({
    ruleId: 'EXTRACTION_MISSING',
    severity: 'warning',
    subjectHash: row.hash,
    payload: {
      hash: row.hash,
      mime: row.mime,
      local_path: row.localPath,
    },
  }));
}

function detectOcrPending(db: Awaited<ReturnType<typeof openVaultDatabase>>): DetectedAnomaly[] {
  const rows = db.prepare(`
    SELECT hash, local_path AS localPath, page_count AS pageCount
    FROM documents
    WHERE needs_ocr = 1
      AND ocr_status = 'pending'
    ORDER BY hash
  `).all() as Array<{ hash: string; localPath: string; pageCount: number | null }>;

  return rows.map((row) => ({
    ruleId: 'OCR_PENDING',
    severity: 'info',
    subjectHash: row.hash,
    payload: {
      hash: row.hash,
      local_path: row.localPath,
      page_count: row.pageCount,
    },
  }));
}

function detectGmailAttachmentFetchFailed(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
): DetectedAnomaly[] {
  const rows = db.prepare(`
    SELECT
      gmail_id AS gmailId,
      attachment_index AS attachmentIndex,
      attachment_id AS attachmentId,
      filename
    FROM email_attachments
    WHERE attachment_id IS NOT NULL
      AND hash IS NULL
    ORDER BY gmail_id, attachment_index
  `).all() as Array<{
    gmailId: string;
    attachmentIndex: number;
    attachmentId: string | null;
    filename: string | null;
  }>;

  return rows.map((row) => ({
    ruleId: 'GMAIL_ATTACHMENT_FETCH_FAILED',
    severity: 'warning',
    subjectHash: null,
    payload: {
      gmail_id: row.gmailId,
      attachment_index: row.attachmentIndex,
      attachment_id: row.attachmentId,
      filename: row.filename,
    },
  }));
}

function detectLowConfidence(db: Awaited<ReturnType<typeof openVaultDatabase>>): DetectedAnomaly[] {
  const rows = db.prepare(`
    SELECT hash, confidence, title
    FROM records
    WHERE confidence < @threshold
    ORDER BY confidence, hash
  `).all({ threshold: LOW_CONFIDENCE_THRESHOLD }) as Array<{
    hash: string;
    confidence: number;
    title: string;
  }>;

  return rows.map((row) => ({
    ruleId: 'LOW_CONFIDENCE',
    severity: 'warning',
    subjectHash: row.hash,
    payload: {
      hash: row.hash,
      confidence: row.confidence,
      threshold: LOW_CONFIDENCE_THRESHOLD,
      title: row.title,
    },
  }));
}

function detectPendingVotes(db: Awaited<ReturnType<typeof openVaultDatabase>>): DetectedAnomaly[] {
  const rows = db.prepare(`
    SELECT hash, number, subject, outcome
    FROM resolutions
    WHERE outcome = 'pending_vote'
    ORDER BY hash, number
  `).all() as Array<{
    hash: string;
    number: string;
    subject: string;
    outcome: string;
  }>;

  return rows.map((row) => ({
    ruleId: 'RESOLUTION_PENDING_VOTE',
    severity: 'warning',
    subjectHash: row.hash,
    payload: {
      hash: row.hash,
      number: row.number,
      subject: row.subject,
      outcome: row.outcome,
    },
  }));
}

function detectDeadlines(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  now: Date,
): DetectedAnomaly[] {
  const today = dateOnly(now);
  const approaching = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  approaching.setUTCDate(approaching.getUTCDate() + DEADLINE_APPROACHING_DAYS);
  const approachingDate = dateOnly(approaching);
  const rows = db.prepare(`
    SELECT hash, date, label, kind
    FROM important_dates
    WHERE lower(kind) IN ('deadline', 'payment_due', 'due')
    ORDER BY date, hash, label
  `).all() as Array<{
    hash: string;
    date: string;
    label: string;
    kind: string;
  }>;

  return rows.flatMap((row) => {
    if (row.date < today) {
      return [{
        ruleId: 'DEADLINE_MISSED',
        severity: 'critical' as const,
        subjectHash: row.hash,
        payload: {
          hash: row.hash,
          date: row.date,
          label: row.label,
          kind: row.kind,
        },
      }];
    }

    if (row.date <= approachingDate) {
      return [{
        ruleId: 'DEADLINE_APPROACHING',
        severity: 'warning' as const,
        subjectHash: row.hash,
        payload: {
          hash: row.hash,
          date: row.date,
          label: row.label,
          kind: row.kind,
          days_window: DEADLINE_APPROACHING_DAYS,
        },
      }];
    }

    return [];
  });
}

async function detectVisibleSecrets(
  db: Awaited<ReturnType<typeof openVaultDatabase>>,
  root: string,
): Promise<DetectedAnomaly[]> {
  const paths = getVaultPaths(root);
  const anomalies: DetectedAnomaly[] = [];
  const emails = db.prepare(`
    SELECT gmail_id AS gmailId, subject, body_path AS bodyPath
    FROM emails
    ORDER BY gmail_id
  `).all() as Array<{
    gmailId: string;
    subject: string | null;
    bodyPath: string;
  }>;
  const records = db.prepare(`
    SELECT hash, title, summary_plain AS summaryPlain
    FROM records
    ORDER BY hash
  `).all() as Array<{
    hash: string;
    title: string;
    summaryPlain: string;
  }>;

  for (const email of emails) {
    const bodyPath = path.join(paths.root, email.bodyPath);
    const body = await readTextIfAvailable(bodyPath);
    if (SECRET_PATTERN.test(`${email.subject ?? ''}\n${body}`)) {
      anomalies.push({
        ruleId: 'SECRET_VISIBLE',
        severity: 'critical',
        subjectHash: null,
        payload: {
          source: 'email',
          gmail_id: email.gmailId,
          subject: email.subject,
          redacted: true,
        },
      });
    }
  }

  for (const record of records) {
    if (SECRET_PATTERN.test(`${record.title}\n${record.summaryPlain}`)) {
      anomalies.push({
        ruleId: 'SECRET_VISIBLE',
        severity: 'critical',
        subjectHash: record.hash,
        payload: {
          source: 'record',
          hash: record.hash,
          title: record.title,
          redacted: true,
        },
      });
    }
  }

  return anomalies;
}

async function readTextIfAvailable(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function anomalySignature(anomaly: DetectedAnomaly, payloadJson: string): string {
  return sha256Text(stableStringify({
    rule_id: anomaly.ruleId,
    subject_hash: anomaly.subjectHash,
    payload_json: payloadJson,
  }));
}

function anomalyKey(
  ruleId: string,
  subjectHash: string | null,
  payloadSignature: string,
): string {
  return stableStringify({ ruleId, subjectHash, payloadSignature });
}

function compareAnomalies(left: DetectedAnomaly, right: DetectedAnomaly): number {
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    String(left.subjectHash ?? '').localeCompare(String(right.subjectHash ?? '')) ||
    stableStringify(left.payload).localeCompare(stableStringify(right.payload))
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }

  return value;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

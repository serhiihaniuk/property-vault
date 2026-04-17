import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listOpenAnomalies } from './anomalies.ts';
import { openVaultDatabase } from './db.ts';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';
import { context, init, listExtractionWork } from './vault.ts';

export type WriteInboxOptions = {
  now?: Date;
  root?: string;
};

export type WriteInboxResult = {
  path: string;
  relativePath: string;
  bytes: number;
};

type PendingVote = {
  hash: string;
  number: string;
  subject: string;
  title: string;
};

type UpcomingDeadline = {
  hash: string;
  date: string;
  label: string;
  kind: string;
  title: string | null;
};

type UserQuestion = {
  hash: string;
  title: string;
  question: string;
};

type FinancialChange = {
  hash: string;
  category: string;
  rowType: string;
  amountMinor: number;
  currency: string;
  periodKind: string;
  periodValue: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  title: string | null;
};

const SECRET_VALUE_PATTERN = /\b(password|passwd|haslo|secret|token|api[_ -]?key)\b\s*[:=]\s*([^\s,;]+)/gi;

export async function writeInboxReport(
  options: WriteInboxOptions = {},
): Promise<WriteInboxResult> {
  const root = options.root ?? resolveRepoRoot();
  const paths = getVaultPaths(root);
  const markdown = await buildInboxReport({
    root,
    now: options.now ?? new Date(),
  });
  const redacted = redactSensitiveText(markdown);

  await mkdir(path.dirname(paths.inboxReport), { recursive: true });
  await writeFile(paths.inboxReport, redacted, 'utf8');

  return {
    path: paths.inboxReport,
    relativePath: toRepoRelativePath(paths.root, paths.inboxReport),
    bytes: Buffer.byteLength(redacted, 'utf8'),
  };
}

export async function buildInboxReport(options: {
  root?: string;
  now?: Date;
} = {}): Promise<string> {
  const root = options.root ?? resolveRepoRoot();
  const now = options.now ?? new Date();

  await init(root);

  const vaultContext = await context(root);
  const extractionWork = await listExtractionWork(root, 10);
  const anomalies = await listOpenAnomalies(root);
  const pendingVotes = await listPendingVotes(root);
  const deadlines = await listUpcomingDeadlines(root, now);
  const questions = await listQuestionsForUser(root);
  const financialChanges = await listFinancialChanges(root);
  const lines: string[] = [];

  lines.push('# Dabrowskiego Inbox');
  lines.push('');
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push('');
  lines.push(`- Documents: ${vaultContext.counts.documents}`);
  lines.push(`- Records: ${vaultContext.counts.records}`);
  lines.push(`- Emails: ${vaultContext.counts.emails}`);
  lines.push(`- Open anomalies: ${vaultContext.counts.openAnomalies}`);
  lines.push(`- Extraction work: ${vaultContext.counts.extractionWork}`);
  lines.push(`- Last Gmail sync: ${vaultContext.lastGmailSync.at ?? 'never'}`);
  lines.push('');
  lines.push('## Needs Attention');
  lines.push('');

  if (
    anomalies.length === 0 &&
    extractionWork.length === 0 &&
    pendingVotes.length === 0 &&
    deadlines.length === 0 &&
    questions.length === 0
  ) {
    lines.push('- Nothing needs attention right now.');
  } else {
    appendExtractionWork(lines, extractionWork);
    appendAnomalies(lines, anomalies);
    appendPendingVotes(lines, pendingVotes);
    appendUpcomingDeadlines(lines, deadlines);
    appendQuestions(lines, questions);
  }

  lines.push('');
  lines.push('## Latest Financial Changes');
  lines.push('');
  if (financialChanges.length === 0) {
    lines.push('- No indexed financial rows yet.');
  } else {
    for (const row of financialChanges) {
      lines.push(
        `- ${formatMoney(row.amountMinor, row.currency)} ${row.category} (${row.rowType}, ${formatPeriod(row)}) ` +
        `from ${safeTitle(row.title)} [${shortHash(row.hash)}]`,
      );
    }
  }

  lines.push('');
  lines.push('## Recent Documents');
  lines.push('');
  if (vaultContext.latestDocuments.length === 0) {
    lines.push('- No documents registered yet.');
  } else {
    for (const document of vaultContext.latestDocuments) {
      lines.push(
        `- ${document.mime} [${shortHash(document.hash)}] ${document.localPath}` +
        `${document.needsOcr ? ' (needs OCR/vision)' : ''}`,
      );
    }
  }

  lines.push('');
  return `${redactSensitiveText(lines.join('\n'))}\n`;
}

export function redactSensitiveText(value: string): string {
  return value.replace(SECRET_VALUE_PATTERN, (_match, label: string) => `${label}: [redacted]`);
}

async function listPendingVotes(root: string): Promise<PendingVote[]> {
  const db = await openVaultDatabase(root);

  try {
    return db.prepare(`
      SELECT
        resolutions.hash,
        resolutions.number,
        resolutions.subject,
        records.title
      FROM resolutions
      JOIN records ON records.hash = resolutions.hash
      WHERE resolutions.outcome = 'pending_vote'
      ORDER BY resolutions.hash, resolutions.number
      LIMIT 20
    `).all() as PendingVote[];
  } finally {
    db.close();
  }
}

async function listUpcomingDeadlines(root: string, now: Date): Promise<UpcomingDeadline[]> {
  const db = await openVaultDatabase(root);
  const today = now.toISOString().slice(0, 10);

  try {
    return db.prepare(`
      SELECT
        important_dates.hash,
        important_dates.date,
        important_dates.label,
        important_dates.kind,
        records.title
      FROM important_dates
      LEFT JOIN records ON records.hash = important_dates.hash
      WHERE important_dates.date >= @today
        AND lower(important_dates.kind) IN ('deadline', 'payment_due', 'due', 'vote', 'meeting')
      ORDER BY important_dates.date, important_dates.hash
      LIMIT 20
    `).all({ today }) as UpcomingDeadline[];
  } finally {
    db.close();
  }
}

async function listQuestionsForUser(root: string): Promise<UserQuestion[]> {
  const db = await openVaultDatabase(root);

  try {
    const records = db.prepare(`
      SELECT hash, title, record_json AS recordJson
      FROM records
      ORDER BY extracted_at DESC, hash
      LIMIT 50
    `).all() as Array<{
      hash: string;
      title: string;
      recordJson: string;
    }>;
    const questions: UserQuestion[] = [];

    for (const record of records) {
      const parsed = JSON.parse(record.recordJson) as { questions_for_user?: unknown };
      const values = Array.isArray(parsed.questions_for_user)
        ? parsed.questions_for_user
        : [];

      for (const value of values) {
        if (typeof value === 'string' && value.trim() !== '') {
          questions.push({
            hash: record.hash,
            title: record.title,
            question: value,
          });
        }
      }
    }

    return questions.slice(0, 20);
  } finally {
    db.close();
  }
}

async function listFinancialChanges(root: string): Promise<FinancialChange[]> {
  const db = await openVaultDatabase(root);

  try {
    return db.prepare(`
      SELECT
        financial_rows.hash,
        financial_rows.category,
        financial_rows.row_type AS rowType,
        financial_rows.amount_minor AS amountMinor,
        financial_rows.currency,
        financial_rows.period_kind AS periodKind,
        financial_rows.period_value AS periodValue,
        financial_rows.period_start AS periodStart,
        financial_rows.period_end AS periodEnd,
        records.title
      FROM financial_rows
      LEFT JOIN records ON records.hash = financial_rows.hash
      ORDER BY financial_rows.id DESC
      LIMIT 10
    `).all() as FinancialChange[];
  } finally {
    db.close();
  }
}

function appendExtractionWork(lines: string[], items: Awaited<ReturnType<typeof listExtractionWork>>): void {
  if (items.length === 0) {
    return;
  }

  lines.push('- Extraction pending:');
  for (const item of items) {
    lines.push(`  - ${item.mime} [${shortHash(item.hash)}] ${item.localPath}`);
  }
}

function appendAnomalies(
  lines: string[],
  anomalies: Awaited<ReturnType<typeof listOpenAnomalies>>,
): void {
  if (anomalies.length === 0) {
    return;
  }

  lines.push('- Open anomalies:');
  for (const anomaly of anomalies.slice(0, 20)) {
    const subject = anomaly.subjectHash ? ` [${shortHash(anomaly.subjectHash)}]` : '';
    lines.push(`  - ${anomaly.severity.toUpperCase()} ${anomaly.ruleId}${subject}`);
  }
}

function appendPendingVotes(lines: string[], votes: PendingVote[]): void {
  if (votes.length === 0) {
    return;
  }

  lines.push('- Pending votes:');
  for (const vote of votes) {
    lines.push(`  - ${vote.number}: ${vote.subject} [${shortHash(vote.hash)}] ${safeTitle(vote.title)}`);
  }
}

function appendUpcomingDeadlines(lines: string[], deadlines: UpcomingDeadline[]): void {
  if (deadlines.length === 0) {
    return;
  }

  lines.push('- Upcoming dates:');
  for (const deadline of deadlines) {
    lines.push(
      `  - ${deadline.date}: ${deadline.label} (${deadline.kind}) ` +
      `[${shortHash(deadline.hash)}] ${safeTitle(deadline.title)}`,
    );
  }
}

function appendQuestions(lines: string[], questions: UserQuestion[]): void {
  if (questions.length === 0) {
    return;
  }

  lines.push('- Questions for you:');
  for (const question of questions) {
    lines.push(`  - ${question.question} [${shortHash(question.hash)}] ${safeTitle(question.title)}`);
  }
}

function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

function safeTitle(value: string | null): string {
  return value?.trim() || 'untitled';
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function formatPeriod(row: FinancialChange): string {
  if (row.periodValue) {
    return row.periodValue;
  }

  if (row.periodStart || row.periodEnd) {
    return `${row.periodStart ?? '?'}..${row.periodEnd ?? '?'}`;
  }

  return row.periodKind;
}

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

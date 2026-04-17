import { z } from 'zod';

export const RECORD_SCHEMA_VERSION = 1;

export const DocumentType = z.enum([
  'monthly_charges',
  'media_settlement',
  'shared_property_settlement',
  'interest_note',
  'account_statement',
  'resolution',
  'meeting_notice',
  'service_notice',
  'correspondence',
  'other',
]);

export const Money = z.object({
  amount_minor: z.number().int(),
  currency: z.literal('PLN'),
});

export const Period = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('month'), value: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({ kind: z.literal('year'), value: z.string().regex(/^\d{4}$/) }),
  z.object({
    kind: z.literal('range'),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ kind: z.literal('none') }),
]);

export const ReferenceNumbers = z.object({
  document_ref: z.string().nullable(),
  property_code: z.string().nullable(),
  unit_code: z.string().nullable(),
  bank_account: z.string().nullable(),
  source_document_numbers: z.array(z.string()).default([]),
});

export const FinancialRow = z.object({
  row_type: z.enum([
    'charge',
    'settlement',
    'payment',
    'credit',
    'debit',
    'interest',
    'balance',
  ]),
  category: z.string(),
  category_original: z.string(),
  category_group: z.string().nullable(),
  period: Period,
  money: Money,
  quantity: z.object({
    value: z.number(),
    unit: z.string(),
  }).nullable(),
  unit_price_minor: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
  source_page: z.number().int().nullable(),
  note: z.string().nullable(),
});

export const MeterReading = z.object({
  meter_kind: z.enum(['cold_water', 'hot_water', 'heat_energy', 'other']),
  meter_number: z.string().nullable(),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reading_value: z.number(),
  usage_value: z.number().nullable(),
  unit: z.string(),
  source_page: z.number().int().nullable(),
});

export const LedgerEntry = z.object({
  operation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  document_number: z.string().nullable(),
  obligation: Money.nullable(),
  payment: Money.nullable(),
  balance_after: Money.nullable(),
  comment: z.string().nullable(),
  source_page: z.number().int().nullable(),
});

export const InterestEntry = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  obligation: Money,
  obligation_document: z.string().nullable(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  payment: Money.nullable(),
  payment_document: z.string().nullable(),
  days_late: z.number().int(),
  interest_rate_percent: z.number(),
  interest: Money,
  source_page: z.number().int().nullable(),
});

export const ImportantDate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string(),
  kind: z.enum(['deadline', 'meeting', 'vote', 'effective_from', 'booking', 'other']),
});

export const Resolution = z.object({
  number: z.string(),
  subject: z.string(),
  outcome: z.enum(['passed', 'pending_vote', 'rejected', 'unknown']),
  voting_method: z.string().nullable(),
  money_limit: Money.nullable(),
  note: z.string().nullable(),
});

export const SensitiveFinding = z.object({
  kind: z.enum(['password', 'login', 'email', 'bank_account', 'personal_data']),
  label: z.string(),
  value_redacted: z.string(),
  source_page: z.number().int().nullable(),
});

const KeyFact = z.object({
  label: z.string(),
  value: z.string(),
});

const Mentions = z.object({
  people: z.array(z.string()).default([]),
  addresses: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  phones: z.array(z.string()).default([]),
  reference_numbers: z.array(z.string()).default([]),
});

export const RecordSchema = z.object({
  schema_version: z.literal(RECORD_SCHEMA_VERSION),
  extractor_version: z.string(),
  extracted_at: z.string().datetime(),
  extracted_by: z.string(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['ok', 'needs_review', 'failed']),
  language: z.literal('pl'),

  document_type: DocumentType,
  document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  period: Period,

  title: z.string(),
  summary_plain: z.string(),
  key_facts: z.array(KeyFact),

  financial_rows: z.array(FinancialRow).default([]),
  meter_readings: z.array(MeterReading).default([]),
  ledger_entries: z.array(LedgerEntry).default([]),
  interest_entries: z.array(InterestEntry).default([]),
  important_dates: z.array(ImportantDate).default([]),
  resolutions: z.array(Resolution).default([]),

  reference_numbers: ReferenceNumbers,
  sensitive_findings: z.array(SensitiveFinding).default([]),
  mentions: Mentions,

  questions_for_user: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
}).superRefine((record, context) => {
  validateNoRawSecrets(record, context);
});

export type VaultRecord = z.infer<typeof RecordSchema>;

export function parseVaultRecord(value: unknown): VaultRecord {
  return RecordSchema.parse(value);
}

export function safeParseVaultRecord(value: unknown): z.SafeParseReturnType<unknown, VaultRecord> {
  return RecordSchema.safeParse(value);
}

function validateNoRawSecrets(record: z.infer<typeof RecordSchema>, context: z.RefinementCtx): void {
  const userFacingTexts = [
    ['summary_plain', record.summary_plain],
    ...record.key_facts.flatMap((fact, index) => [
      [`key_facts.${index}.label`, fact.label] as const,
      [`key_facts.${index}.value`, fact.value] as const,
    ]),
    ...record.questions_for_user.map((value, index) => [`questions_for_user.${index}`, value] as const),
    ...record.warnings.map((value, index) => [`warnings.${index}`, value] as const),
  ];

  for (const [pathLabel, value] of userFacingTexts) {
    if (looksLikeRawSecret(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Raw credential-like value is not allowed in ${pathLabel}`,
        path: pathLabel.split('.'),
      });
    }
  }

  for (const [index, finding] of record.sensitive_findings.entries()) {
    if (!isRedactedValue(finding.value_redacted)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sensitive finding values must be redacted',
        path: ['sensitive_findings', index, 'value_redacted'],
      });
    }
  }
}

function looksLikeRawSecret(value: string): boolean {
  return /\b(password|passwd|haslo|hasło|login)\b\s*[:=]\s*\S{3,}/i.test(value);
}

function isRedactedValue(value: string): boolean {
  return /\[redacted\]|\*\*\*|<redacted>|redacted/i.test(value);
}

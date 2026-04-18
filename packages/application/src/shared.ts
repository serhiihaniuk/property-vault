import {
  documentReferenceSchema,
  moneyAmountSchema,
  periodReferenceSchema,
} from '@dabrowskiego/contracts';

export type DocumentReference = ReturnType<typeof documentReferenceSchema.parse>;
export type MoneyAmount = ReturnType<typeof moneyAmountSchema.parse>;
export type PeriodReference = ReturnType<typeof periodReferenceSchema.parse>;

export interface CreateDocumentReferenceInput {
  documentDate?: string | null;
  documentType: string;
  hash: string;
  title: string;
}

export interface CreateMoneyAmountInput {
  amountMinor: number;
  currency?: string;
}

export interface CreatePeriodReferenceInput {
  endDate?: string;
  kind: PeriodReference['kind'];
  label?: string;
  startDate?: string;
  value?: string;
}

export function createMoneyAmount(input: CreateMoneyAmountInput): MoneyAmount {
  return moneyAmountSchema.parse({
    amountMinor: input.amountMinor,
    currency: input.currency ?? 'PLN',
  });
}

export function createDocumentReference(
  input: CreateDocumentReferenceInput,
): DocumentReference {
  return documentReferenceSchema.parse({
    documentDate: input.documentDate ?? null,
    documentType: input.documentType,
    hash: input.hash,
    title: input.title,
  });
}

export function createPeriodReference(input: CreatePeriodReferenceInput): PeriodReference {
  return periodReferenceSchema.parse({
    kind: input.kind,
    label: resolvePeriodLabel(input),
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.value ? { value: input.value } : {}),
  });
}

function resolvePeriodLabel(input: CreatePeriodReferenceInput): string {
  const explicitLabel = input.label?.trim();

  if (explicitLabel) {
    return explicitLabel;
  }

  if (input.value) {
    return input.value;
  }

  if (input.kind === 'custom') {
    if (input.startDate && input.endDate) {
      return `${input.startDate} to ${input.endDate}`;
    }

    if (input.startDate) {
      return `From ${input.startDate}`;
    }

    if (input.endDate) {
      return `Until ${input.endDate}`;
    }
  }

  throw new Error(`Cannot derive a label for period kind "${input.kind}".`);
}

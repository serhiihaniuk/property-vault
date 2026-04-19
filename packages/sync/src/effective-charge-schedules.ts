import type { CanonicalRecordEntry } from './canonical.ts';

export type EffectiveChargeRow = {
  amountMinor: number;
  category: string;
  categoryGroup: string | null;
  categoryOriginal: string;
  confidence: number;
  currency: string;
  effectivePeriodValue: string;
  hash: string;
  note: string | null;
  quantityUnit: string | null;
  quantityValue: number | null;
  sourcePage: number | null;
  sourcePeriodValue: string;
  unitPriceMinor: number | null;
};

type ChargeScheduleRow = Omit<EffectiveChargeRow, 'effectivePeriodValue'>;

const MONTH_VALUE_PATTERN = /^\d{4}-\d{2}$/;

export function buildEffectiveChargeRows(
  records: readonly CanonicalRecordEntry[],
  throughMonth: string,
): EffectiveChargeRow[] {
  const scheduleRows = records
    .flatMap((entry) => buildChargeScheduleRows(entry))
    .sort((left, right) =>
      left.sourcePeriodValue.localeCompare(right.sourcePeriodValue),
    );

  if (scheduleRows.length === 0) {
    return [];
  }

  const distinctScheduleMonths = Array.from(
    new Set(scheduleRows.map((row) => row.sourcePeriodValue)),
  ).sort();
  const effectiveThroughMonth = maxMonthValue(
    throughMonth,
    distinctScheduleMonths[distinctScheduleMonths.length - 1] ?? throughMonth,
  );
  const nextScheduleMonthBySource = new Map<string, string | null>();

  for (let index = 0; index < distinctScheduleMonths.length; index += 1) {
    nextScheduleMonthBySource.set(
      distinctScheduleMonths[index] ?? '',
      distinctScheduleMonths[index + 1] ?? null,
    );
  }

  return scheduleRows.flatMap((row) => {
    const nextScheduleMonth =
      nextScheduleMonthBySource.get(row.sourcePeriodValue) ?? null;
    const rangeEndMonth = nextScheduleMonth
      ? addMonths(nextScheduleMonth, -1)
      : effectiveThroughMonth;

    if (row.sourcePeriodValue.localeCompare(rangeEndMonth) > 0) {
      return [];
    }

    return enumerateMonthRange(row.sourcePeriodValue, rangeEndMonth).map(
      (effectivePeriodValue) => ({
        ...row,
        effectivePeriodValue,
      }),
    );
  });
}

function buildChargeScheduleRows(
  entry: CanonicalRecordEntry,
): ChargeScheduleRow[] {
  if (entry.record.document_type !== 'monthly_charges') {
    return [];
  }

  return entry.record.financial_rows.flatMap((row) => {
    if (row.row_type !== 'charge' || row.period.kind !== 'month') {
      return [];
    }

    if (!isMonthValue(row.period.value)) {
      return [];
    }

    return [
      {
        amountMinor: row.money.amount_minor,
        category: row.category,
        categoryGroup: row.category_group,
        categoryOriginal: row.category_original,
        confidence: row.confidence,
        currency: row.money.currency,
        hash: entry.hash,
        note: row.note,
        quantityUnit: row.quantity?.unit ?? null,
        quantityValue: row.quantity?.value ?? null,
        sourcePage: row.source_page,
        sourcePeriodValue: row.period.value,
        unitPriceMinor: row.unit_price_minor,
      },
    ];
  });
}

function enumerateMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let currentMonth = startMonth;

  while (currentMonth.localeCompare(endMonth) <= 0) {
    months.push(currentMonth);
    currentMonth = addMonths(currentMonth, 1);
  }

  return months;
}

function addMonths(monthValue: string, delta: number): string {
  const parsed = parseMonthValue(monthValue);

  if (!parsed) {
    throw new Error(`Invalid month value "${monthValue}".`);
  }

  const nextMonthIndex = parsed.year * 12 + (parsed.month - 1) + delta;
  const year = Math.floor(nextMonthIndex / 12);
  const month = (nextMonthIndex % 12 + 12) % 12;

  return `${year.toString().padStart(4, '0')}-${(month + 1)
    .toString()
    .padStart(2, '0')}`;
}

function maxMonthValue(left: string, right: string): string {
  return left.localeCompare(right) >= 0 ? left : right;
}

function parseMonthValue(
  monthValue: string,
): { month: number; year: number } | null {
  if (!isMonthValue(monthValue)) {
    return null;
  }

  const [yearPart, monthPart] = monthValue.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return {
    month,
    year,
  };
}

function isMonthValue(value: string): boolean {
  return MONTH_VALUE_PATTERN.test(value);
}

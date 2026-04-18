import {
  dashboardMonthBreakdownQuerySchema,
  dashboardMonthBreakdownResponseSchema,
} from '@dabrowskiego/contracts';
import {
  vaultDocuments,
  vaultFinancialRows,
  vaultRecords,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { PropertyVaultApplicationContext } from './context.ts';
import {
  createDocumentReference,
  createMoneyAmount,
  createPeriodReference,
} from './shared.ts';

const MONTH_BREAKDOWN_ROW_TYPE = 'charge';
const MONTH_BREAKDOWN_PERIOD_KIND = 'month';

const CATEGORY_LABELS: Record<string, string> = {
  central_heating_energy: 'Central heating energy',
  cold_water_and_sewage: 'Cold water and sewage',
  e_kartoteka_access: 'e-Kartoteka access',
  hot_water_heating: 'Hot water heating',
  municipal_waste: 'Municipal waste',
  ordered_heating_power: 'Ordered heating power',
  renovation_investment_fund: 'Renovation and investment fund',
  shared_property_advance: 'Shared property advance',
};

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  funds: 'Funds',
  individual: 'Individual',
  media: 'Media',
  media_settlement: 'Media settlement',
  shared_property: 'Shared property',
};

type DashboardMonthBreakdownQuery = ReturnType<
  typeof dashboardMonthBreakdownQuerySchema.parse
>;
type DashboardMonthBreakdownResponse = ReturnType<
  typeof dashboardMonthBreakdownResponseSchema.parse
>;

type DashboardMonthHistoryRow = {
  periodValue: string;
  totalAmountMinor: number;
};

type DashboardBreakdownRow = {
  category: string;
  categoryGroup: string | null;
  totalAmountMinor: number;
};

type DashboardDocumentRow = {
  category: string;
  documentDate: string | null;
  documentType: string;
  hash: string;
  title: string;
};

type DashboardBreakdownItem = DashboardMonthBreakdownResponse['breakdown'][number];
type DashboardDocumentReference = ReturnType<typeof createDocumentReference>;
type DashboardPeriodReference = ReturnType<typeof createPeriodReference>;
type DashboardDependencies = {
  loadBreakdownRows: typeof loadBreakdownRows;
  loadDocumentRows: typeof loadDocumentRows;
  loadMonthHistory: typeof loadMonthHistory;
};

const defaultDashboardDependencies: DashboardDependencies = {
  loadBreakdownRows,
  loadDocumentRows,
  loadMonthHistory,
};

export interface DashboardApplicationService {
  getMonthBreakdown: (
    query?: DashboardMonthBreakdownQuery,
  ) => Promise<DashboardMonthBreakdownResponse>;
}

export class DashboardMonthNotFoundError extends Error {
  readonly month: string;

  constructor(month: string) {
    super(`Dashboard month "${month}" was not found.`);
    this.name = 'DashboardMonthNotFoundError';
    this.month = month;
  }
}

export function createDashboardApplicationService(
  context: PropertyVaultApplicationContext,
  dependencies: DashboardDependencies = defaultDashboardDependencies,
): DashboardApplicationService {
  return {
    async getMonthBreakdown(query = {}) {
      const db = requireDatabase(context.db);
      const months = await dependencies.loadMonthHistory(db);
      const selectedPeriodValue = resolveSelectedMonth(months, query.month);
      const previousPeriodValue =
        selectedPeriodValue === null
          ? null
          : resolvePreviousMonth(months, selectedPeriodValue);

      if (!selectedPeriodValue) {
        return dashboardMonthBreakdownResponseSchema.parse({
          breakdown: [],
          generatedAt: context.now().toISOString(),
          months: [],
          previousMonth: null,
          selectedMonth: null,
          summary: null,
          supportingDocuments: [],
        });
      }

      const [selectedBreakdownRows, previousBreakdownRows, selectedDocumentRows] =
        await Promise.all([
          dependencies.loadBreakdownRows(db, selectedPeriodValue),
          previousPeriodValue
            ? dependencies.loadBreakdownRows(db, previousPeriodValue)
            : [],
          dependencies.loadDocumentRows(db, selectedPeriodValue),
        ]);

      const previousBreakdownByCategory = new Map(
        previousBreakdownRows.map((row) => [row.category, row]),
      );
      const documentsByCategory = groupDocumentsByCategory(selectedDocumentRows);
      const supportingDocuments = collectSupportingDocuments(selectedDocumentRows);
      const totalAmountMinor = selectedBreakdownRows.reduce(
        (sum, row) => sum + row.totalAmountMinor,
        0,
      );
      const previousTotalAmountMinor = previousPeriodValue
        ? previousBreakdownRows.reduce((sum, row) => sum + row.totalAmountMinor, 0)
        : null;
      const breakdown = selectedBreakdownRows
        .map((row) =>
          createBreakdownItem({
            documents: documentsByCategory.get(row.category) ?? [],
            hasPreviousMonth: previousPeriodValue !== null,
            previousRow: previousBreakdownByCategory.get(row.category),
            row,
            totalAmountMinor,
          }),
        )
        .sort((left, right) => right.amount.amountMinor - left.amount.amountMinor);
      const summary = createSummary({
        breakdown,
        previousTotalAmountMinor,
        totalAmountMinor,
      });

      return dashboardMonthBreakdownResponseSchema.parse({
        breakdown,
        generatedAt: context.now().toISOString(),
        months: months.map((row) => ({
          period: createMonthReference(row.periodValue),
          totalCharges: createMoneyAmount({ amountMinor: row.totalAmountMinor }),
        })),
        previousMonth: previousPeriodValue
          ? createMonthReference(previousPeriodValue)
          : null,
        selectedMonth: createMonthReference(selectedPeriodValue),
        summary,
        supportingDocuments,
      });
    },
  };
}

async function loadMonthHistory(
  db: PropertyVaultDatabase,
): Promise<DashboardMonthHistoryRow[]> {
  const rows = await db
    .select({
      periodValue: vaultFinancialRows.periodValue,
      totalAmountMinor: sql<string | number>`sum(${vaultFinancialRows.amountMinor})`,
    })
    .from(vaultFinancialRows)
    .where(
      and(
        eq(vaultFinancialRows.periodKind, MONTH_BREAKDOWN_PERIOD_KIND),
        eq(vaultFinancialRows.rowType, MONTH_BREAKDOWN_ROW_TYPE),
        isNotNull(vaultFinancialRows.periodValue),
      ),
    )
    .groupBy(vaultFinancialRows.periodValue)
    .orderBy(desc(vaultFinancialRows.periodValue));

  return rows
    .filter((row): row is typeof row & { periodValue: string } => typeof row.periodValue === 'string')
    .map((row) => ({
      periodValue: row.periodValue,
      totalAmountMinor: Number(row.totalAmountMinor ?? 0),
    }));
}

async function loadBreakdownRows(
  db: PropertyVaultDatabase,
  periodValue: string,
): Promise<DashboardBreakdownRow[]> {
  const rows = await db
    .select({
      category: vaultFinancialRows.category,
      categoryGroup: vaultFinancialRows.categoryGroup,
      totalAmountMinor: sql<string | number>`sum(${vaultFinancialRows.amountMinor})`,
    })
    .from(vaultFinancialRows)
    .where(
      and(
        eq(vaultFinancialRows.periodKind, MONTH_BREAKDOWN_PERIOD_KIND),
        eq(vaultFinancialRows.periodValue, periodValue),
        eq(vaultFinancialRows.rowType, MONTH_BREAKDOWN_ROW_TYPE),
      ),
    )
    .groupBy(vaultFinancialRows.category, vaultFinancialRows.categoryGroup);

  return rows.map((row) => ({
    ...row,
    totalAmountMinor: Number(row.totalAmountMinor ?? 0),
  }));
}

async function loadDocumentRows(
  db: PropertyVaultDatabase,
  periodValue: string,
): Promise<DashboardDocumentRow[]> {
  return db
    .select({
      category: vaultFinancialRows.category,
      documentDate: vaultDocuments.documentDate,
      documentType: vaultRecords.documentType,
      hash: vaultRecords.hash,
      title: vaultRecords.title,
    })
    .from(vaultFinancialRows)
    .innerJoin(vaultRecords, eq(vaultRecords.hash, vaultFinancialRows.hash))
    .innerJoin(vaultDocuments, eq(vaultDocuments.hash, vaultRecords.hash))
    .where(
      and(
        eq(vaultFinancialRows.periodKind, MONTH_BREAKDOWN_PERIOD_KIND),
        eq(vaultFinancialRows.periodValue, periodValue),
        eq(vaultFinancialRows.rowType, MONTH_BREAKDOWN_ROW_TYPE),
      ),
    )
    .groupBy(
      vaultFinancialRows.category,
      vaultDocuments.documentDate,
      vaultRecords.documentType,
      vaultRecords.hash,
      vaultRecords.title,
    );
}

function createBreakdownItem(input: {
  documents: DashboardDocumentReference[];
  hasPreviousMonth: boolean;
  previousRow: DashboardBreakdownRow | undefined;
  row: DashboardBreakdownRow;
  totalAmountMinor: number;
}): DashboardBreakdownItem {
  const previousAmountMinor = input.hasPreviousMonth
    ? (input.previousRow?.totalAmountMinor ?? 0)
    : null;
  const deltaAmountMinor =
    previousAmountMinor === null
      ? null
      : input.row.totalAmountMinor - previousAmountMinor;

  return {
    amount: createMoneyAmount({ amountMinor: input.row.totalAmountMinor }),
    category: input.row.category,
    categoryGroup: input.row.categoryGroup,
    categoryGroupLabel: formatCategoryGroupLabel(input.row.categoryGroup),
    categoryLabel: formatCategoryLabel(input.row.category),
    changeStatus: resolveChangeStatus(
      input.row.totalAmountMinor,
      previousAmountMinor,
    ),
    delta:
      deltaAmountMinor === null
        ? null
        : createMoneyAmount({ amountMinor: deltaAmountMinor }),
    previousAmount:
      previousAmountMinor === null
        ? null
        : createMoneyAmount({ amountMinor: previousAmountMinor }),
    sharePercent: calculateSharePercent(
      input.row.totalAmountMinor,
      input.totalAmountMinor,
    ),
    sourceDocuments: input.documents,
  };
}

function createSummary(input: {
  breakdown: DashboardMonthBreakdownResponse['breakdown'];
  previousTotalAmountMinor: number | null;
  totalAmountMinor: number;
}): DashboardMonthBreakdownResponse['summary'] {
  const topChangeCandidate =
    input.previousTotalAmountMinor === null
      ? null
      : [...input.breakdown]
          .filter((item) => item.delta && item.delta.amountMinor !== 0)
          .sort(
            (left, right) =>
              Math.abs(right.delta?.amountMinor ?? 0) -
              Math.abs(left.delta?.amountMinor ?? 0),
          )[0] ?? null;
  const largestCategory =
    [...input.breakdown].sort(
      (left, right) => right.amount.amountMinor - left.amount.amountMinor,
    )[0] ?? null;

  return {
    categoryCount: input.breakdown.length,
    changedCategoryCount:
      input.previousTotalAmountMinor === null
        ? 0
        : input.breakdown.filter((item) => item.delta?.amountMinor !== 0).length,
    largestCategory: largestCategory
      ? {
          amount: largestCategory.amount,
          category: largestCategory.category,
          categoryLabel: largestCategory.categoryLabel,
        }
      : null,
    previousTotalCharges:
      input.previousTotalAmountMinor === null
        ? null
        : createMoneyAmount({ amountMinor: input.previousTotalAmountMinor }),
    topChange:
      topChangeCandidate && topChangeCandidate.delta
        ? {
            category: topChangeCandidate.category,
            categoryLabel: topChangeCandidate.categoryLabel,
            changeStatus: topChangeCandidate.changeStatus,
            delta: topChangeCandidate.delta,
          }
        : null,
    totalCharges: createMoneyAmount({ amountMinor: input.totalAmountMinor }),
    totalDelta:
      input.previousTotalAmountMinor === null
        ? null
        : createMoneyAmount({
            amountMinor: input.totalAmountMinor - input.previousTotalAmountMinor,
          }),
  };
}

function groupDocumentsByCategory(
  rows: DashboardDocumentRow[],
): Map<string, DashboardDocumentReference[]> {
  const grouped = new Map<string, Map<string, DashboardDocumentReference>>();

  for (const row of rows) {
    const documentsForCategory = grouped.get(row.category) ?? new Map();
    documentsForCategory.set(
      row.hash,
      createDocumentReference({
        documentDate: row.documentDate,
        documentType: row.documentType,
        hash: row.hash,
        title: row.title,
      }),
    );
    grouped.set(row.category, documentsForCategory);
  }

  return new Map(
    Array.from(grouped.entries()).map(([category, documents]) => [
      category,
      Array.from(documents.values()),
    ]),
  );
}

function collectSupportingDocuments(
  rows: DashboardDocumentRow[],
): DashboardDocumentReference[] {
  return Array.from(
    rows.reduce((documents, row) => {
      documents.set(
        row.hash,
        createDocumentReference({
          documentDate: row.documentDate,
          documentType: row.documentType,
          hash: row.hash,
          title: row.title,
        }),
      );

      return documents;
    }, new Map<string, DashboardDocumentReference>()),
  )
    .map(([, document]) => document)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function resolveSelectedMonth(
  months: DashboardMonthHistoryRow[],
  requestedMonth: string | undefined,
): string | null {
  if (months.length === 0) {
    return null;
  }

  if (!requestedMonth) {
    return months[0]?.periodValue ?? null;
  }

  if (months.some((month) => month.periodValue === requestedMonth)) {
    return requestedMonth;
  }

  throw new DashboardMonthNotFoundError(requestedMonth);
}

function resolvePreviousMonth(
  months: DashboardMonthHistoryRow[],
  selectedMonth: string,
): string | null {
  const selectedIndex = months.findIndex((month) => month.periodValue === selectedMonth);

  if (selectedIndex < 0) {
    return null;
  }

  return months[selectedIndex + 1]?.periodValue ?? null;
}

function resolveChangeStatus(
  amountMinor: number,
  previousAmountMinor: number | null,
): DashboardBreakdownItem['changeStatus'] {
  if (previousAmountMinor === null) {
    return 'no_previous';
  }

  if (previousAmountMinor === 0 && amountMinor > 0) {
    return 'new';
  }

  if (amountMinor > previousAmountMinor) {
    return 'up';
  }

  if (amountMinor < previousAmountMinor) {
    return 'down';
  }

  return 'flat';
}

function calculateSharePercent(amountMinor: number, totalAmountMinor: number): number {
  if (totalAmountMinor <= 0) {
    return 0;
  }

  return Number(((amountMinor / totalAmountMinor) * 100).toFixed(1));
}

function createMonthReference(periodValue: string): DashboardPeriodReference {
  return createPeriodReference({
    kind: 'month',
    label: formatMonthLabel(periodValue),
    value: periodValue,
  });
}

function formatMonthLabel(periodValue: string): string {
  const [year, month] = periodValue.split('-');

  if (!year || !month) {
    return periodValue;
  }

  const date = new Date(`${periodValue}-01T00:00:00.000Z`);

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function formatCategoryGroupLabel(categoryGroup: string | null): string {
  if (!categoryGroup) {
    return 'Uncategorized';
  }

  return CATEGORY_GROUP_LABELS[categoryGroup] ?? humanizeIdentifier(categoryGroup);
}

function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanizeIdentifier(category);
}

function humanizeIdentifier(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function requireDatabase(
  db: PropertyVaultDatabase | undefined,
): PropertyVaultDatabase {
  if (!db) {
    throw new Error('Dashboard application service requires a configured database.');
  }

  return db;
}

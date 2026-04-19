import {
  anomalyFeedResponseSchema,
  yearlyReconciliationQuerySchema,
  yearlyReconciliationResponseSchema,
} from '@dabrowskiego/contracts';
import {
  vaultAnomalies,
  vaultDocuments,
  vaultEffectiveChargeRows,
  vaultFinancialRows,
  vaultRecords,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { and, desc, eq, gte, isNotNull, lte, ne } from 'drizzle-orm';
import type { PropertyVaultApplicationContext } from './context.ts';
import {
  createDocumentReference,
  createMoneyAmount,
  createPeriodReference,
} from './shared.ts';

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

const ANOMALY_RULE_LABELS: Record<string, string> = {
  DEADLINE_MISSED: 'Missed deadline',
  OCR_PENDING: 'OCR pending',
  PAYMENT_DEADLINE_UNCONFIRMED: 'Payment deadline needs confirmation',
  RESOLUTION_PENDING_VOTE: 'Resolution still pending vote',
};

const ANOMALY_SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  info: 'Info',
  warning: 'Warning',
};

const ANOMALY_SEVERITY_ORDER = new Map([
  ['critical', 0],
  ['warning', 1],
  ['info', 2],
]);

const RECONCILIATION_STATUS_LABELS: Record<string, string> = {
  credit: 'Credit',
  due: 'Due',
  matched: 'Matched',
  schedule_only: 'Schedule only',
};

type YearlyReconciliationQuery = ReturnType<
  typeof yearlyReconciliationQuerySchema.parse
>;
type YearlyReconciliationResponse = ReturnType<
  typeof yearlyReconciliationResponseSchema.parse
>;
type AnomalyFeedResponse = ReturnType<typeof anomalyFeedResponseSchema.parse>;
type DocumentReference = ReturnType<typeof createDocumentReference>;
type LineStatus = YearlyReconciliationResponse['lines'][number]['status'];

type YearAvailability = {
  scheduleYears: string[];
  settlementYears: string[];
};

type ScheduleRow = {
  amountMinor: number;
  category: string;
  documentDate: string | null;
  documentType: string;
  effectivePeriodValue: string;
  hash: string;
  title: string;
};

type SettlementRow = {
  amountMinor: number;
  category: string;
  documentDate: string | null;
  documentType: string;
  hash: string;
  rowType: string;
  title: string;
};

type OpenAnomalyRow = {
  detectedAt: string;
  documentDate: string | null;
  documentType: string | null;
  id: number;
  payloadJson: unknown;
  ruleId: string;
  severity: string;
  status: string;
  subjectHash: string | null;
  title: string | null;
};

type ReconciliationLineConfig = {
  advanceCategories: readonly string[];
  balanceCreditCategories: readonly string[];
  balanceDebitCategories: readonly string[];
  category: string;
  costCategories: readonly string[];
  creditCategories: readonly string[];
  label: string;
};

const RECONCILIATION_LINES: readonly ReconciliationLineConfig[] = [
  {
    advanceCategories: ['advance_payments_total'],
    balanceCreditCategories: ['settlement_result_overpayment'],
    balanceDebitCategories: ['settlement_result_due'],
    category: 'shared_property_advance',
    costCategories: ['shared_property_costs_total'],
    creditCategories: ['shared_property_revenues_total'],
    label: 'Shared property advance',
  },
  {
    advanceCategories: [
      'water_and_sewage_advances',
      'water_and_sewage_subscription_advances',
    ],
    balanceCreditCategories: ['water_and_sewage_overpayment'],
    balanceDebitCategories: [
      'main_meter_difference_underpayment',
      'water_and_sewage_subscription_underpayment',
      'water_and_sewage_underpayment',
    ],
    category: 'cold_water_and_sewage',
    costCategories: [
      'main_meter_difference_cost',
      'water_and_sewage_cost',
      'water_and_sewage_subscription_cost',
    ],
    creditCategories: [],
    label: 'Cold water and sewage',
  },
  {
    advanceCategories: ['hot_water_advances'],
    balanceCreditCategories: ['hot_water_overpayment'],
    balanceDebitCategories: ['hot_water_underpayment'],
    category: 'hot_water_heating',
    costCategories: ['hot_water_cost'],
    creditCategories: [],
    label: 'Hot water heating',
  },
  {
    advanceCategories: ['central_heating_advances'],
    balanceCreditCategories: ['central_heating_overpayment'],
    balanceDebitCategories: ['central_heating_underpayment'],
    category: 'central_heating_energy',
    costCategories: ['central_heating_cost'],
    creditCategories: [],
    label: 'Central heating energy',
  },
  {
    advanceCategories: ['ordered_heat_power_advances'],
    balanceCreditCategories: ['ordered_heat_power_overpayment'],
    balanceDebitCategories: ['ordered_heat_power_underpayment'],
    category: 'ordered_heating_power',
    costCategories: ['ordered_heat_power_cost'],
    creditCategories: [],
    label: 'Ordered heating power',
  },
  {
    advanceCategories: ['e_kartoteka_access_advances'],
    balanceCreditCategories: ['e_kartoteka_access_overpayment'],
    balanceDebitCategories: ['e_kartoteka_access_underpayment'],
    category: 'e_kartoteka_access',
    costCategories: ['e_kartoteka_access_cost'],
    creditCategories: [],
    label: 'e-Kartoteka access',
  },
  {
    advanceCategories: [],
    balanceCreditCategories: [],
    balanceDebitCategories: [],
    category: 'municipal_waste',
    costCategories: [],
    creditCategories: [],
    label: 'Municipal waste',
  },
  {
    advanceCategories: [],
    balanceCreditCategories: [],
    balanceDebitCategories: [],
    category: 'renovation_investment_fund',
    costCategories: [],
    creditCategories: [],
    label: 'Renovation and investment fund',
  },
];

type FinancialsDependencies = {
  loadOpenAnomalyRows: typeof loadOpenAnomalyRows;
  loadScheduleRows: typeof loadScheduleRows;
  loadSettlementRows: typeof loadSettlementRows;
  loadYearAvailability: typeof loadYearAvailability;
};

const defaultFinancialsDependencies: FinancialsDependencies = {
  loadOpenAnomalyRows,
  loadScheduleRows,
  loadSettlementRows,
  loadYearAvailability,
};

export interface FinancialsApplicationService {
  getOpenAnomalies: () => Promise<AnomalyFeedResponse>;
  getYearlyReconciliation: (
    query?: YearlyReconciliationQuery,
  ) => Promise<YearlyReconciliationResponse>;
}

export class YearlyReconciliationYearNotFoundError extends Error {
  readonly year: string;

  constructor(year: string) {
    super(`Yearly reconciliation year "${year}" was not found.`);
    this.name = 'YearlyReconciliationYearNotFoundError';
    this.year = year;
  }
}

export function createFinancialsApplicationService(
  context: PropertyVaultApplicationContext,
  dependencies: FinancialsDependencies = defaultFinancialsDependencies,
): FinancialsApplicationService {
  return {
    async getOpenAnomalies() {
      const db = requireDatabase(context.db);
      const rows = await dependencies.loadOpenAnomalyRows(db);
      const anomalies = rows
        .map((row) => createAnomalyItem(row))
        .sort(compareAnomalyItems);

      return anomalyFeedResponseSchema.parse({
        anomalies,
        countsBySeverity: ['critical', 'warning', 'info'].map((severity) => ({
          count: anomalies.filter((anomaly) => anomaly.severity === severity).length,
          severity,
        })),
        generatedAt: context.now().toISOString(),
        openCount: anomalies.length,
      });
    },

    async getYearlyReconciliation(query = {}) {
      const db = requireDatabase(context.db);
      const availability = await dependencies.loadYearAvailability(db);
      const selectedYearValue = resolveSelectedYear(availability, query.year);

      if (!selectedYearValue) {
        return yearlyReconciliationResponseSchema.parse({
          availableYears: [],
          coverage: {
            monthsCovered: 0,
            status: 'partial',
            throughMonth: null,
          },
          generatedAt: context.now().toISOString(),
          lines: [],
          selectedYear: null,
          summary: null,
        });
      }

      const [scheduleRows, settlementRows] = await Promise.all([
        dependencies.loadScheduleRows(db, selectedYearValue),
        dependencies.loadSettlementRows(db, selectedYearValue),
      ]);
      const coverage = createCoverage(selectedYearValue, scheduleRows, context.now());
      const lines = createYearlyReconciliationLines(scheduleRows, settlementRows);
      const summary = createYearlyReconciliationSummary(lines);

      return yearlyReconciliationResponseSchema.parse({
        availableYears: createAvailableYearReferences(availability),
        coverage,
        generatedAt: context.now().toISOString(),
        lines,
        selectedYear: createYearReference(selectedYearValue),
        summary,
      });
    },
  };
}

async function loadYearAvailability(
  db: PropertyVaultDatabase,
): Promise<YearAvailability> {
  const [scheduleRows, settlementRows] = await Promise.all([
    db
      .select({
        effectivePeriodValue: vaultEffectiveChargeRows.effectivePeriodValue,
      })
      .from(vaultEffectiveChargeRows)
      .groupBy(vaultEffectiveChargeRows.effectivePeriodValue)
      .orderBy(desc(vaultEffectiveChargeRows.effectivePeriodValue)),
    db
      .select({
        periodEnd: vaultFinancialRows.periodEnd,
      })
      .from(vaultFinancialRows)
      .where(
        and(
          ne(vaultFinancialRows.rowType, 'charge'),
          isNotNull(vaultFinancialRows.periodEnd),
        ),
      )
      .groupBy(vaultFinancialRows.periodEnd)
      .orderBy(desc(vaultFinancialRows.periodEnd)),
  ]);

  return {
    scheduleYears: uniqueValues(
      scheduleRows
        .map((row) => extractYear(row.effectivePeriodValue))
        .filter((value): value is string => value !== null),
    ),
    settlementYears: uniqueValues(
      settlementRows
        .map((row) => extractYear(row.periodEnd))
        .filter((value): value is string => value !== null),
    ),
  };
}

async function loadScheduleRows(
  db: PropertyVaultDatabase,
  year: string,
): Promise<ScheduleRow[]> {
  const rows = await db
    .select({
      amountMinor: vaultEffectiveChargeRows.amountMinor,
      category: vaultEffectiveChargeRows.category,
      documentDate: vaultDocuments.documentDate,
      documentType: vaultRecords.documentType,
      effectivePeriodValue: vaultEffectiveChargeRows.effectivePeriodValue,
      hash: vaultRecords.hash,
      title: vaultRecords.title,
    })
    .from(vaultEffectiveChargeRows)
    .innerJoin(vaultRecords, eq(vaultRecords.hash, vaultEffectiveChargeRows.hash))
    .innerJoin(vaultDocuments, eq(vaultDocuments.hash, vaultRecords.hash))
    .where(
      and(
        gte(vaultEffectiveChargeRows.effectivePeriodValue, `${year}-01`),
        lte(vaultEffectiveChargeRows.effectivePeriodValue, `${year}-12`),
      ),
    );

  return rows.map((row) => ({
    amountMinor: row.amountMinor,
    category: row.category,
    documentDate: row.documentDate,
    documentType: row.documentType,
    effectivePeriodValue: row.effectivePeriodValue,
    hash: row.hash,
    title: row.title,
  }));
}

async function loadSettlementRows(
  db: PropertyVaultDatabase,
  year: string,
): Promise<SettlementRow[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const rows = await db
    .select({
      amountMinor: vaultFinancialRows.amountMinor,
      category: vaultFinancialRows.category,
      documentDate: vaultDocuments.documentDate,
      documentType: vaultRecords.documentType,
      hash: vaultRecords.hash,
      rowType: vaultFinancialRows.rowType,
      title: vaultRecords.title,
    })
    .from(vaultFinancialRows)
    .innerJoin(vaultRecords, eq(vaultRecords.hash, vaultFinancialRows.hash))
    .innerJoin(vaultDocuments, eq(vaultDocuments.hash, vaultRecords.hash))
    .where(
      and(
        ne(vaultFinancialRows.rowType, 'charge'),
        isNotNull(vaultFinancialRows.periodStart),
        isNotNull(vaultFinancialRows.periodEnd),
        lte(vaultFinancialRows.periodStart, yearEnd),
        gte(vaultFinancialRows.periodEnd, yearStart),
      ),
    );

  return rows.map((row) => ({
    amountMinor: row.amountMinor,
    category: row.category,
    documentDate: row.documentDate,
    documentType: row.documentType,
    hash: row.hash,
    rowType: row.rowType,
    title: row.title,
  }));
}

async function loadOpenAnomalyRows(
  db: PropertyVaultDatabase,
): Promise<OpenAnomalyRow[]> {
  const rows = await db
    .select({
      detectedAt: vaultAnomalies.detectedAt,
      documentDate: vaultDocuments.documentDate,
      documentType: vaultRecords.documentType,
      id: vaultAnomalies.id,
      payloadJson: vaultAnomalies.payloadJson,
      ruleId: vaultAnomalies.ruleId,
      severity: vaultAnomalies.severity,
      status: vaultAnomalies.status,
      subjectHash: vaultAnomalies.subjectHash,
      title: vaultRecords.title,
    })
    .from(vaultAnomalies)
    .leftJoin(vaultRecords, eq(vaultRecords.hash, vaultAnomalies.subjectHash))
    .leftJoin(vaultDocuments, eq(vaultDocuments.hash, vaultAnomalies.subjectHash))
    .where(eq(vaultAnomalies.status, 'open'))
    .orderBy(desc(vaultAnomalies.detectedAt));

  return rows.map((row) => ({
    detectedAt: row.detectedAt,
    documentDate: row.documentDate,
    documentType: row.documentType,
    id: row.id,
    payloadJson: row.payloadJson,
    ruleId: row.ruleId,
    severity: row.severity,
    status: row.status,
    subjectHash: row.subjectHash,
    title: row.title,
  }));
}

function createYearlyReconciliationLines(
  scheduleRows: ScheduleRow[],
  settlementRows: SettlementRow[],
): YearlyReconciliationResponse['lines'] {
  return RECONCILIATION_LINES.map((line) => {
    const scheduleRowsForLine = scheduleRows.filter(
      (row) => row.category === line.category,
    );
    const settlementRowsForLine = settlementRows.filter((row) =>
      matchesSettlementLine(line, row.category),
    );
    const scheduledAmountMinor = scheduleRowsForLine.reduce(
      (sum, row) => sum + row.amountMinor,
      0,
    );
    const scheduleDocuments = collectScheduleDocuments(scheduleRowsForLine);
    const settlementDocuments = collectSettlementDocuments(settlementRowsForLine);
    const hasSettlement = settlementDocuments.length > 0;
    const settlementAdvanceMinor = hasSettlement
      ? sumAmounts(settlementRowsForLine, line.advanceCategories)
      : null;
    const actualCostMinor = hasSettlement
      ? sumAmounts(settlementRowsForLine, line.costCategories)
      : null;
    const creditsMinor = hasSettlement
      ? sumAmounts(settlementRowsForLine, line.creditCategories)
      : null;
    const explicitBalanceMinor = hasSettlement
      ? sumBalanceAmounts(
          settlementRowsForLine,
          line.balanceDebitCategories,
          line.balanceCreditCategories,
        )
      : null;
    const netBalanceMinor = resolveNetBalanceMinor({
      actualCostMinor,
      creditsMinor,
      explicitBalanceMinor,
      hasSettlement,
      settlementAdvanceMinor,
    });
    const status = resolveLineStatus(hasSettlement, netBalanceMinor);

    return {
      actualCostAmount: actualCostMinor === null ? null : createMoneyAmount({
        amountMinor: actualCostMinor,
      }),
      category: line.category,
      categoryLabel: line.label,
      coverageMonths: uniqueValues(
        scheduleRowsForLine.map((row) => row.effectivePeriodValue),
      ).length,
      creditsAmount: creditsMinor === null ? null : createMoneyAmount({
        amountMinor: creditsMinor,
      }),
      netBalance: netBalanceMinor === null ? null : createMoneyAmount({
        amountMinor: netBalanceMinor,
      }),
      scheduleDelta:
        settlementAdvanceMinor === null
          ? null
          : createMoneyAmount({
              amountMinor: scheduledAmountMinor - settlementAdvanceMinor,
            }),
      scheduleDocuments,
      scheduledAmount: createMoneyAmount({
        amountMinor: scheduledAmountMinor,
      }),
      settlementAdvanceAmount:
        settlementAdvanceMinor === null
          ? null
          : createMoneyAmount({
              amountMinor: settlementAdvanceMinor,
            }),
      settlementDocuments,
      status,
      statusLabel: RECONCILIATION_STATUS_LABELS[status],
    };
  }).filter(
    (line) =>
      line.scheduledAmount.amountMinor > 0 || line.settlementDocuments.length > 0,
  );
}

function createYearlyReconciliationSummary(
  lines: YearlyReconciliationResponse['lines'],
): YearlyReconciliationResponse['summary'] {
  const settledLines = lines.filter((line) => line.status !== 'schedule_only');

  return {
    actualCostTotal:
      settledLines.length === 0
        ? null
        : createMoneyAmount({
            amountMinor: settledLines.reduce(
              (sum, line) => sum + (line.actualCostAmount?.amountMinor ?? 0),
              0,
            ),
          }),
    creditsTotal:
      settledLines.length === 0
        ? null
        : createMoneyAmount({
            amountMinor: settledLines.reduce(
              (sum, line) => sum + (line.creditsAmount?.amountMinor ?? 0),
              0,
            ),
          }),
    netBalance:
      settledLines.length === 0
        ? null
        : createMoneyAmount({
            amountMinor: settledLines.reduce(
              (sum, line) => sum + (line.netBalance?.amountMinor ?? 0),
              0,
            ),
          }),
    openLineCount: lines.filter((line) => line.status !== 'matched').length,
    scheduledTotal: createMoneyAmount({
      amountMinor: lines.reduce(
        (sum, line) => sum + line.scheduledAmount.amountMinor,
        0,
      ),
    }),
    settledLineCount: settledLines.length,
    settlementAdvanceTotal:
      settledLines.length === 0
        ? null
        : createMoneyAmount({
            amountMinor: settledLines.reduce(
              (sum, line) => sum + (line.settlementAdvanceAmount?.amountMinor ?? 0),
              0,
            ),
          }),
  };
}

function createCoverage(
  selectedYear: string,
  scheduleRows: ScheduleRow[],
  now: Date,
): YearlyReconciliationResponse['coverage'] {
  const months = uniqueValues(
    scheduleRows.map((row) => row.effectivePeriodValue),
  ).sort((left, right) => right.localeCompare(left));
  const throughMonthValue = months[0] ?? null;
  const currentMonthValue = formatCurrentMonth(now);
  let status: YearlyReconciliationResponse['coverage']['status'] = 'partial';

  if (months.length >= 12) {
    status = 'full_year';
  } else if (selectedYear === String(now.getUTCFullYear()) && throughMonthValue === currentMonthValue) {
    status = 'year_to_date';
  }

  return {
    monthsCovered: months.length,
    status,
    throughMonth: throughMonthValue ? createMonthReference(throughMonthValue) : null,
  };
}

function resolveSelectedYear(
  availability: YearAvailability,
  requestedYear: string | undefined,
): string | null {
  const availableYears = mergeAvailableYears(availability);

  if (availableYears.length === 0) {
    if (requestedYear) {
      throw new YearlyReconciliationYearNotFoundError(requestedYear);
    }

    return null;
  }

  if (requestedYear) {
    if (!availableYears.includes(requestedYear)) {
      throw new YearlyReconciliationYearNotFoundError(requestedYear);
    }

    return requestedYear;
  }

  return availability.settlementYears[0] ?? availableYears[0] ?? null;
}

function createAvailableYearReferences(
  availability: YearAvailability,
): YearlyReconciliationResponse['availableYears'] {
  return mergeAvailableYears(availability).map((year) => createYearReference(year));
}

function mergeAvailableYears(availability: YearAvailability): string[] {
  return uniqueValues([
    ...availability.settlementYears,
    ...availability.scheduleYears,
  ]).sort((left, right) => right.localeCompare(left));
}

function matchesSettlementLine(
  line: ReconciliationLineConfig,
  category: string,
): boolean {
  return (
    line.advanceCategories.includes(category) ||
    line.costCategories.includes(category) ||
    line.creditCategories.includes(category) ||
    line.balanceDebitCategories.includes(category) ||
    line.balanceCreditCategories.includes(category)
  );
}

function sumAmounts(
  rows: SettlementRow[],
  categories: readonly string[],
): number | null {
  if (categories.length === 0) {
    return null;
  }

  return rows
    .filter((row) => categories.includes(row.category))
    .reduce((sum, row) => sum + row.amountMinor, 0);
}

function sumBalanceAmounts(
  rows: SettlementRow[],
  debitCategories: readonly string[],
  creditCategories: readonly string[],
): number | null {
  if (debitCategories.length === 0 && creditCategories.length === 0) {
    return null;
  }

  const debitRows = rows.filter((row) => debitCategories.includes(row.category));
  const creditRows = rows.filter((row) => creditCategories.includes(row.category));

  if (debitRows.length === 0 && creditRows.length === 0) {
    return null;
  }

  const debitAmount = debitRows.reduce((sum, row) => sum + row.amountMinor, 0);
  const creditAmount = creditRows.reduce((sum, row) => sum + row.amountMinor, 0);

  return debitAmount - creditAmount;
}

function resolveNetBalanceMinor(input: {
  actualCostMinor: number | null;
  creditsMinor: number | null;
  explicitBalanceMinor: number | null;
  hasSettlement: boolean;
  settlementAdvanceMinor: number | null;
}): number | null {
  if (!input.hasSettlement) {
    return null;
  }

  if (input.explicitBalanceMinor !== null) {
    return input.explicitBalanceMinor;
  }

  return (
    (input.actualCostMinor ?? 0) -
    (input.creditsMinor ?? 0) -
    (input.settlementAdvanceMinor ?? 0)
  );
}

function resolveLineStatus(
  hasSettlement: boolean,
  netBalanceMinor: number | null,
): LineStatus {
  if (!hasSettlement) {
    return 'schedule_only';
  }

  if ((netBalanceMinor ?? 0) > 0) {
    return 'due';
  }

  if ((netBalanceMinor ?? 0) < 0) {
    return 'credit';
  }

  return 'matched';
}

function collectScheduleDocuments(rows: ScheduleRow[]): DocumentReference[] {
  return collectDocuments(
    rows.map((row) => ({
      documentDate: row.documentDate,
      documentType: row.documentType,
      hash: row.hash,
      title: row.title,
    })),
  );
}

function collectSettlementDocuments(rows: SettlementRow[]): DocumentReference[] {
  return collectDocuments(
    rows.map((row) => ({
      documentDate: row.documentDate,
      documentType: row.documentType,
      hash: row.hash,
      title: row.title,
    })),
  );
}

function collectDocuments(
  rows: Array<{
    documentDate: string | null;
    documentType: string;
    hash: string;
    title: string;
  }>,
): DocumentReference[] {
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
    }, new Map<string, DocumentReference>()),
  )
    .map(([, document]) => document)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function createAnomalyItem(
  row: OpenAnomalyRow,
): AnomalyFeedResponse['anomalies'][number] {
  const payload = normalizePayload(row.payloadJson);
  const subjectDocument =
    row.subjectHash === null
      ? null
      : createDocumentReference({
          documentDate: row.documentDate,
          documentType: row.documentType ?? 'document',
          hash: row.subjectHash,
          title: row.title ?? `Document ${row.subjectHash.slice(0, 12)}`,
        });

  return {
    context: createAnomalyContextFields(payload),
    date: typeof payload.date === 'string' ? payload.date : null,
    detectedAt: row.detectedAt,
    id: row.id,
    ruleId: row.ruleId,
    ruleLabel: ANOMALY_RULE_LABELS[row.ruleId] ?? humanizeIdentifier(row.ruleId),
    severity: normalizeSeverity(row.severity),
    severityLabel:
      ANOMALY_SEVERITY_LABELS[normalizeSeverity(row.severity)] ?? 'Info',
    status: row.status === 'resolved' ? 'resolved' : 'open',
    subjectDocument,
    summary: createAnomalySummary(row.ruleId, payload, row.title),
  };
}

function compareAnomalyItems(
  left: AnomalyFeedResponse['anomalies'][number],
  right: AnomalyFeedResponse['anomalies'][number],
): number {
  const severityDifference =
    (ANOMALY_SEVERITY_ORDER.get(left.severity) ?? 99) -
    (ANOMALY_SEVERITY_ORDER.get(right.severity) ?? 99);

  if (severityDifference !== 0) {
    return severityDifference;
  }

  if (left.detectedAt !== right.detectedAt) {
    return right.detectedAt.localeCompare(left.detectedAt);
  }

  return left.summary.localeCompare(right.summary);
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function createAnomalySummary(
  ruleId: string,
  payload: Record<string, unknown>,
  title: string | null,
): string {
  if (typeof payload.label === 'string' && payload.label.trim().length > 0) {
    return payload.label;
  }

  if (typeof payload.subject === 'string' && payload.subject.trim().length > 0) {
    return payload.subject;
  }

  if (ruleId === 'OCR_PENDING') {
    if (typeof payload.page_count === 'number') {
      return `Document still needs OCR (${payload.page_count} pages).`;
    }

    return 'Document still needs OCR.';
  }

  if (title) {
    return title;
  }

  return ANOMALY_RULE_LABELS[ruleId] ?? humanizeIdentifier(ruleId);
}

function createAnomalyContextFields(
  payload: Record<string, unknown>,
): AnomalyFeedResponse['anomalies'][number]['context'] {
  const fields: AnomalyFeedResponse['anomalies'][number]['context'] = [];

  if (typeof payload.number === 'string' && payload.number.trim().length > 0) {
    fields.push({
      label: 'Resolution',
      value: payload.number,
    });
  }

  if (typeof payload.date === 'string' && payload.date.trim().length > 0) {
    fields.push({
      label: 'Date',
      value: payload.date,
    });
  }

  if (typeof payload.page_count === 'number') {
    fields.push({
      label: 'Pages',
      value: String(payload.page_count),
    });
  }

  if (payload.needs_confirmation === true) {
    fields.push({
      label: 'Needs confirmation',
      value: 'Yes',
    });
  }

  return fields;
}

function normalizeSeverity(
  severity: string,
): AnomalyFeedResponse['anomalies'][number]['severity'] {
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    return severity;
  }

  return 'info';
}

function extractYear(value: string | null): string | null {
  if (!value || value.length < 4) {
    return null;
  }

  return value.slice(0, 4);
}

function createYearReference(year: string) {
  return createPeriodReference({
    kind: 'year',
    value: year,
  });
}

function createMonthReference(periodValue: string) {
  return createPeriodReference({
    kind: 'month',
    label: formatMonthLabel(periodValue),
    value: periodValue,
  });
}

function formatCurrentMonth(now: Date): string {
  return `${now.getUTCFullYear().toString().padStart(4, '0')}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
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

function uniqueValues<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function humanizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireDatabase(
  db: PropertyVaultDatabase | undefined,
): PropertyVaultDatabase {
  if (!db) {
    throw new Error('Financials application service requires a configured database.');
  }

  return db;
}

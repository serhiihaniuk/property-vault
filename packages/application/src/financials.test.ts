import assert from 'node:assert/strict';
import test from 'node:test';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { createPropertyVaultApplicationContext } from './context.ts';
import {
  createFinancialsApplicationService,
  YearlyReconciliationYearNotFoundError,
} from './financials.ts';

test('financials service defaults to the latest year with settlement evidence and normalizes yearly lines', async () => {
  const financials = createFinancialsApplicationService(createFinancialsContext(), {
    async loadOpenAnomalyRows() {
      return [];
    },
    async loadScheduleRows(_db, year) {
      assert.equal(year, '2025');

      return [
        ...createScheduleRows({
          amountMinor: 10000,
          category: 'shared_property_advance',
          hash: 'a'.repeat(64),
          months: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'],
          title: 'Shared property notice H1',
        }),
        ...createScheduleRows({
          amountMinor: 10000,
          category: 'shared_property_advance',
          hash: 'b'.repeat(64),
          months: ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'],
          title: 'Shared property notice H2',
        }),
        ...createScheduleRows({
          amountMinor: 5000,
          category: 'cold_water_and_sewage',
          hash: 'c'.repeat(64),
          months: YEAR_2025_MONTHS,
          title: 'Water notice 2025',
        }),
        ...createScheduleRows({
          amountMinor: 2500,
          category: 'hot_water_heating',
          hash: 'd'.repeat(64),
          months: YEAR_2025_MONTHS,
          title: 'Hot water notice 2025',
        }),
        ...createScheduleRows({
          amountMinor: 1000,
          category: 'municipal_waste',
          hash: 'e'.repeat(64),
          months: YEAR_2025_MONTHS,
          title: 'Municipal waste notice 2025',
        }),
      ];
    },
    async loadSettlementRows(_db, year) {
      assert.equal(year, '2025');

      return [
        {
          amountMinor: 120000,
          category: 'advance_payments_total',
          documentDate: '2026-03-15',
          documentType: 'shared_property_settlement',
          hash: 'f'.repeat(64),
          rowType: 'payment',
          title: 'Shared property settlement 2025',
        },
        {
          amountMinor: 145000,
          category: 'shared_property_costs_total',
          documentDate: '2026-03-15',
          documentType: 'shared_property_settlement',
          hash: 'f'.repeat(64),
          rowType: 'settlement',
          title: 'Shared property settlement 2025',
        },
        {
          amountMinor: 20000,
          category: 'shared_property_revenues_total',
          documentDate: '2026-03-15',
          documentType: 'shared_property_settlement',
          hash: 'f'.repeat(64),
          rowType: 'credit',
          title: 'Shared property settlement 2025',
        },
        {
          amountMinor: 5000,
          category: 'settlement_result_due',
          documentDate: '2026-03-15',
          documentType: 'shared_property_settlement',
          hash: 'f'.repeat(64),
          rowType: 'debit',
          title: 'Shared property settlement 2025',
        },
        {
          amountMinor: 60000,
          category: 'water_and_sewage_advances',
          documentDate: '2026-02-20',
          documentType: 'media_settlement',
          hash: 'g'.repeat(64),
          rowType: 'settlement',
          title: 'Water settlement 2025',
        },
        {
          amountMinor: 55000,
          category: 'water_and_sewage_cost',
          documentDate: '2026-02-20',
          documentType: 'media_settlement',
          hash: 'g'.repeat(64),
          rowType: 'settlement',
          title: 'Water settlement 2025',
        },
        {
          amountMinor: 5000,
          category: 'water_and_sewage_overpayment',
          documentDate: '2026-02-20',
          documentType: 'media_settlement',
          hash: 'g'.repeat(64),
          rowType: 'credit',
          title: 'Water settlement 2025',
        },
        {
          amountMinor: 30000,
          category: 'hot_water_advances',
          documentDate: '2026-02-20',
          documentType: 'media_settlement',
          hash: 'h'.repeat(64),
          rowType: 'settlement',
          title: 'Hot water settlement 2025',
        },
        {
          amountMinor: 30000,
          category: 'hot_water_cost',
          documentDate: '2026-02-20',
          documentType: 'media_settlement',
          hash: 'h'.repeat(64),
          rowType: 'settlement',
          title: 'Hot water settlement 2025',
        },
      ];
    },
    async loadYearAvailability() {
      return {
        scheduleYears: ['2026', '2025', '2024'],
        settlementYears: ['2025', '2024'],
      };
    },
  });

  const reconciliation = await financials.getYearlyReconciliation();
  const sharedPropertyLine = reconciliation.lines.find(
    (line) => line.category === 'shared_property_advance',
  );
  const waterLine = reconciliation.lines.find(
    (line) => line.category === 'cold_water_and_sewage',
  );
  const hotWaterLine = reconciliation.lines.find(
    (line) => line.category === 'hot_water_heating',
  );
  const wasteLine = reconciliation.lines.find(
    (line) => line.category === 'municipal_waste',
  );

  assert.equal(reconciliation.selectedYear?.value, '2025');
  assert.deepEqual(
    reconciliation.availableYears.map((year) => year.value),
    ['2026', '2025', '2024'],
  );
  assert.deepEqual(reconciliation.coverage, {
    monthsCovered: 12,
    status: 'full_year',
    throughMonth: {
      kind: 'month',
      label: 'December 2025',
      value: '2025-12',
    },
  });
  assert.deepEqual(reconciliation.summary, {
    actualCostTotal: {
      amountMinor: 230000,
      currency: 'PLN',
    },
    creditsTotal: {
      amountMinor: 20000,
      currency: 'PLN',
    },
    netBalance: {
      amountMinor: 0,
      currency: 'PLN',
    },
    openLineCount: 3,
    scheduledTotal: {
      amountMinor: 222000,
      currency: 'PLN',
    },
    settledLineCount: 3,
    settlementAdvanceTotal: {
      amountMinor: 210000,
      currency: 'PLN',
    },
  });
  assert.equal(sharedPropertyLine?.status, 'due');
  assert.equal(sharedPropertyLine?.netBalance?.amountMinor, 5000);
  assert.equal(sharedPropertyLine?.scheduleDocuments.length, 2);
  assert.equal(sharedPropertyLine?.scheduleDelta?.amountMinor, 0);
  assert.equal(waterLine?.status, 'credit');
  assert.equal(waterLine?.netBalance?.amountMinor, -5000);
  assert.equal(hotWaterLine?.status, 'matched');
  assert.equal(hotWaterLine?.netBalance?.amountMinor, 0);
  assert.equal(wasteLine?.status, 'schedule_only');
  assert.equal(wasteLine?.settlementAdvanceAmount, null);
  assert.equal(wasteLine?.scheduleDelta, null);
});

test('financials service returns an empty yearly payload when no schedule or settlement years exist', async () => {
  const financials = createFinancialsApplicationService(createFinancialsContext(), {
    async loadOpenAnomalyRows() {
      return [];
    },
    async loadScheduleRows() {
      return [];
    },
    async loadSettlementRows() {
      return [];
    },
    async loadYearAvailability() {
      return {
        scheduleYears: [],
        settlementYears: [],
      };
    },
  });

  const reconciliation = await financials.getYearlyReconciliation();

  assert.deepEqual(reconciliation, {
    availableYears: [],
    coverage: {
      monthsCovered: 0,
      status: 'partial',
      throughMonth: null,
    },
    generatedAt: '2026-04-19T09:00:00.000Z',
    lines: [],
    selectedYear: null,
    summary: null,
  });
});

test('financials service rejects an unavailable requested reconciliation year', async () => {
  const financials = createFinancialsApplicationService(createFinancialsContext(), {
    async loadOpenAnomalyRows() {
      return [];
    },
    async loadScheduleRows() {
      return [];
    },
    async loadSettlementRows() {
      return [];
    },
    async loadYearAvailability() {
      return {
        scheduleYears: ['2026', '2025'],
        settlementYears: ['2025'],
      };
    },
  });

  await assert.rejects(
    financials.getYearlyReconciliation({ year: '2024' }),
    (error) => error instanceof YearlyReconciliationYearNotFoundError,
  );
});

test('financials service normalizes open anomalies with counts, labels, and context fields', async () => {
  const financials = createFinancialsApplicationService(createFinancialsContext(), {
    async loadOpenAnomalyRows() {
      return [
        {
          detectedAt: '2026-04-18T08:19:16.538Z',
          documentDate: '2026-03-15',
          documentType: 'shared_property_settlement',
          id: 1,
          payloadJson: {
            date: '2026-03-31',
            label: 'Payment deadline for the 2025 shared-property settlement result',
            needs_confirmation: true,
          },
          ruleId: 'PAYMENT_DEADLINE_UNCONFIRMED',
          severity: 'warning',
          status: 'open',
          subjectHash: 'f'.repeat(64),
          title: 'Shared property settlement 2025',
        },
        {
          detectedAt: '2026-04-18T08:19:16.538Z',
          documentDate: null,
          documentType: null,
          id: 2,
          payloadJson: JSON.stringify({
            hash: 'z'.repeat(64),
            page_count: 4,
          }),
          ruleId: 'OCR_PENDING',
          severity: 'info',
          status: 'open',
          subjectHash: 'z'.repeat(64),
          title: null,
        },
        {
          detectedAt: '2026-04-18T08:19:16.538Z',
          documentDate: '2026-02-12',
          documentType: 'meeting_notice',
          id: 3,
          payloadJson: {
            number: '4/2/2026',
            subject: 'Adopt the annual property plan for 2026',
          },
          ruleId: 'RESOLUTION_PENDING_VOTE',
          severity: 'critical',
          status: 'open',
          subjectHash: 'q'.repeat(64),
          title: 'Annual meeting notice 2026',
        },
      ];
    },
    async loadScheduleRows() {
      return [];
    },
    async loadSettlementRows() {
      return [];
    },
    async loadYearAvailability() {
      return {
        scheduleYears: [],
        settlementYears: [],
      };
    },
  });

  const anomalyFeed = await financials.getOpenAnomalies();

  assert.equal(anomalyFeed.openCount, 3);
  assert.deepEqual(anomalyFeed.countsBySeverity, [
    {
      count: 1,
      severity: 'critical',
    },
    {
      count: 1,
      severity: 'warning',
    },
    {
      count: 1,
      severity: 'info',
    },
  ]);
  assert.equal(anomalyFeed.anomalies[0]?.ruleId, 'RESOLUTION_PENDING_VOTE');
  assert.equal(anomalyFeed.anomalies[0]?.ruleLabel, 'Resolution still pending vote');
  assert.equal(anomalyFeed.anomalies[0]?.summary, 'Adopt the annual property plan for 2026');
  assert.deepEqual(anomalyFeed.anomalies[0]?.context, [
    {
      label: 'Resolution',
      value: '4/2/2026',
    },
  ]);
  assert.equal(anomalyFeed.anomalies[1]?.ruleId, 'PAYMENT_DEADLINE_UNCONFIRMED');
  assert.deepEqual(anomalyFeed.anomalies[1]?.context, [
    {
      label: 'Date',
      value: '2026-03-31',
    },
    {
      label: 'Needs confirmation',
      value: 'Yes',
    },
  ]);
  assert.equal(anomalyFeed.anomalies[2]?.summary, 'Document still needs OCR (4 pages).');
  assert.equal(
    anomalyFeed.anomalies[2]?.subjectDocument?.title,
    `Document ${'z'.repeat(12)}`,
  );
});

function createFinancialsContext() {
  return createPropertyVaultApplicationContext({
    db: {} as PropertyVaultDatabase,
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
  });
}

function createScheduleRows(input: {
  amountMinor: number;
  category: string;
  hash: string;
  months: string[];
  title: string;
}) {
  return input.months.map((month) => ({
    amountMinor: input.amountMinor,
    category: input.category,
    documentDate: `${month}-01`,
    documentType: 'monthly_charges',
    effectivePeriodValue: month,
    hash: input.hash,
    title: input.title,
  }));
}

const YEAR_2025_MONTHS = [
  '2025-01',
  '2025-02',
  '2025-03',
  '2025-04',
  '2025-05',
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
];

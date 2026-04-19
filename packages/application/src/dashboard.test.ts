import assert from 'node:assert/strict';
import test from 'node:test';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { createPropertyVaultApplicationContext } from './context.ts';
import {
  createDashboardApplicationService,
  DashboardMonthNotFoundError,
} from './dashboard.ts';

test('dashboard service returns the latest month summary and previous-available breakdown', async () => {
  const dashboard = createDashboardApplicationService(createDashboardContext(), {
    async loadBreakdownRows(_db, periodValue) {
      return BREAKDOWN_ROWS[periodValue] ?? [];
    },
    async loadDocumentRows(_db, periodValue) {
      return DOCUMENT_ROWS[periodValue] ?? [];
    },
    async loadMonthHistory() {
      return [...MONTH_HISTORY_ROWS];
    },
  });

  const breakdown = await dashboard.getMonthBreakdown();

  assert.equal(breakdown.selectedMonth?.value, '2026-04');
  assert.equal(breakdown.previousMonth?.value, '2026-03');
  assert.equal(breakdown.months.length, 7);
  assert.deepEqual(breakdown.summary, {
    categoryCount: 4,
    changedCategoryCount: 2,
    largestCategory: {
      amount: {
        amountMinor: 14427,
        currency: 'PLN',
      },
      category: 'shared_property_advance',
      categoryLabel: 'Shared property advance',
    },
    previousTotalCharges: {
      amountMinor: 27662,
      currency: 'PLN',
    },
    topChange: {
      category: 'central_heating_energy',
      categoryLabel: 'Central heating energy',
      changeStatus: 'up',
      delta: {
        amountMinor: 3891,
        currency: 'PLN',
      },
    },
    totalCharges: {
      amountMinor: 34791,
      currency: 'PLN',
    },
    totalDelta: {
      amountMinor: 7129,
      currency: 'PLN',
    },
  });
  assert.equal(breakdown.breakdown[0]?.category, 'shared_property_advance');
  assert.equal(breakdown.breakdown[1]?.category, 'central_heating_energy');
  assert.equal(breakdown.breakdown[1]?.changeStatus, 'up');
  assert.equal(breakdown.breakdown[1]?.delta?.amountMinor, 3891);
  assert.equal(
    breakdown.breakdown[0]?.sourceDocuments[0]?.title,
    'April 2026 monthly charges',
  );
  assert.equal(
    breakdown.supportingDocuments[0]?.title,
    'April 2026 monthly charges',
  );
  assert.deepEqual(breakdown.months[1], {
    isCarriedForward: true,
    period: {
      kind: 'month',
      label: 'March 2026',
      value: '2026-03',
    },
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourceMonth: {
      kind: 'month',
      label: 'October 2025',
      value: '2025-10',
    },
    totalCharges: {
      amountMinor: 27662,
      currency: 'PLN',
    },
  });
});

test('dashboard service returns an empty payload when no monthly charges exist', async () => {
  const dashboard = createDashboardApplicationService(createDashboardContext(), {
    async loadBreakdownRows() {
      return [];
    },
    async loadDocumentRows() {
      return [];
    },
    async loadMonthHistory() {
      return [];
    },
  });

  const breakdown = await dashboard.getMonthBreakdown();

  assert.deepEqual(breakdown, {
    breakdown: [],
    generatedAt: '2026-04-18T12:00:00.000Z',
    months: [],
    previousMonth: null,
    selectedMonth: null,
    summary: null,
    supportingDocuments: [],
  });
});

test('dashboard service rejects an unavailable requested month', async () => {
  const dashboard = createDashboardApplicationService(createDashboardContext(), {
    async loadBreakdownRows(_db, periodValue) {
      return BREAKDOWN_ROWS[periodValue] ?? [];
    },
    async loadDocumentRows(_db, periodValue) {
      return DOCUMENT_ROWS[periodValue] ?? [];
    },
    async loadMonthHistory() {
      return [...MONTH_HISTORY_ROWS];
    },
  });

  await assert.rejects(
    dashboard.getMonthBreakdown({ month: '2024-01' }),
    (error) => error instanceof DashboardMonthNotFoundError,
  );
});

test('dashboard service keeps previous-only categories in the month comparison', async () => {
  const dashboard = createDashboardApplicationService(createDashboardContext(), {
    async loadBreakdownRows(_db, periodValue) {
      return REMOVED_CATEGORY_BREAKDOWN_ROWS[periodValue] ?? [];
    },
    async loadDocumentRows(_db, periodValue) {
      return REMOVED_CATEGORY_DOCUMENT_ROWS[periodValue] ?? [];
    },
    async loadMonthHistory() {
      return [...REMOVED_CATEGORY_MONTH_HISTORY_ROWS];
    },
  });

  const breakdown = await dashboard.getMonthBreakdown();
  const removedCategory = breakdown.breakdown.find(
    (item) => item.category === 'e_kartoteka_access',
  );

  assert.equal(breakdown.summary?.categoryCount, 1);
  assert.equal(breakdown.summary?.changedCategoryCount, 1);
  assert.deepEqual(breakdown.summary?.topChange, {
    category: 'e_kartoteka_access',
    categoryLabel: 'e-Kartoteka access',
    changeStatus: 'down',
    delta: {
      amountMinor: -6000,
      currency: 'PLN',
    },
  });
  assert.deepEqual(removedCategory, {
    amount: {
      amountMinor: 0,
      currency: 'PLN',
    },
    category: 'e_kartoteka_access',
    categoryGroup: 'individual',
    categoryGroupLabel: 'Individual',
    categoryLabel: 'e-Kartoteka access',
    changeStatus: 'down',
    delta: {
      amountMinor: -6000,
      currency: 'PLN',
    },
    previousAmount: {
      amountMinor: 6000,
      currency: 'PLN',
    },
    sharePercent: 0,
    sourceDocuments: [],
  });
});

test('dashboard service keeps carried-forward month provenance on requested months', async () => {
  const dashboard = createDashboardApplicationService(createDashboardContext(), {
    async loadBreakdownRows(_db, periodValue) {
      return BREAKDOWN_ROWS[periodValue] ?? [];
    },
    async loadDocumentRows(_db, periodValue) {
      return DOCUMENT_ROWS[periodValue] ?? [];
    },
    async loadMonthHistory() {
      return [...MONTH_HISTORY_ROWS];
    },
  });

  const breakdown = await dashboard.getMonthBreakdown({ month: '2026-03' });

  assert.equal(breakdown.selectedMonth?.value, '2026-03');
  assert.equal(breakdown.previousMonth?.value, '2026-02');
  assert.equal(breakdown.summary?.totalDelta?.amountMinor, 0);
  assert.equal(breakdown.supportingDocuments[0]?.title, 'October 2025 monthly charges');
  assert.deepEqual(
    breakdown.months.find((month) => month.period.value === '2026-03'),
    {
      isCarriedForward: true,
      period: {
        kind: 'month',
        label: 'March 2026',
        value: '2026-03',
      },
      sourceDocuments: [
        {
          documentDate: '2025-10-01',
          documentType: 'monthly_charges',
          hash: 'b'.repeat(64),
          title: 'October 2025 monthly charges',
        },
      ],
      sourceMonth: {
        kind: 'month',
        label: 'October 2025',
        value: '2025-10',
      },
      totalCharges: {
        amountMinor: 27662,
        currency: 'PLN',
      },
    },
  );
});

function createDashboardContext() {
  return createPropertyVaultApplicationContext({
    db: {} as PropertyVaultDatabase,
    environment: 'test',
    now: () => new Date('2026-04-18T12:00:00.000Z'),
  });
}

const MONTH_HISTORY_ROWS = [
  {
    periodValue: '2026-04',
    sourceDocuments: [
      {
        documentDate: '2026-04-01',
        documentType: 'monthly_charges',
        hash: 'a'.repeat(64),
        title: 'April 2026 monthly charges',
      },
    ],
    sourcePeriodValue: '2026-04',
    totalAmountMinor: 34791,
  },
  {
    periodValue: '2026-03',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
  {
    periodValue: '2026-02',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
  {
    periodValue: '2026-01',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
  {
    periodValue: '2025-12',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
  {
    periodValue: '2025-11',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
  {
    periodValue: '2025-10',
    sourceDocuments: [
      {
        documentDate: '2025-10-01',
        documentType: 'monthly_charges',
        hash: 'b'.repeat(64),
        title: 'October 2025 monthly charges',
      },
    ],
    sourcePeriodValue: '2025-10',
    totalAmountMinor: 27662,
  },
];

const BREAKDOWN_ROWS: Record<
  string,
  Array<{
    category: string;
    categoryGroup: string | null;
    totalAmountMinor: number;
  }>
> = {
  '2026-04': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 14427,
    },
    {
      category: 'central_heating_energy',
      categoryGroup: 'media',
      totalAmountMinor: 9216,
    },
    {
      category: 'cold_water_and_sewage',
      categoryGroup: 'media',
      totalAmountMinor: 8204,
    },
    {
      category: 'renovation_investment_fund',
      categoryGroup: 'funds',
      totalAmountMinor: 2944,
    },
  ],
  '2026-03': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 14427,
    },
    {
      category: 'central_heating_energy',
      categoryGroup: 'media',
      totalAmountMinor: 5325,
    },
    {
      category: 'cold_water_and_sewage',
      categoryGroup: 'media',
      totalAmountMinor: 4966,
    },
    {
      category: 'renovation_investment_fund',
      categoryGroup: 'funds',
      totalAmountMinor: 2944,
    },
  ],
  '2026-02': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 14427,
    },
    {
      category: 'central_heating_energy',
      categoryGroup: 'media',
      totalAmountMinor: 5325,
    },
    {
      category: 'cold_water_and_sewage',
      categoryGroup: 'media',
      totalAmountMinor: 4966,
    },
    {
      category: 'renovation_investment_fund',
      categoryGroup: 'funds',
      totalAmountMinor: 2944,
    },
  ],
  '2025-10': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 14427,
    },
    {
      category: 'central_heating_energy',
      categoryGroup: 'media',
      totalAmountMinor: 5325,
    },
    {
      category: 'cold_water_and_sewage',
      categoryGroup: 'media',
      totalAmountMinor: 4966,
    },
    {
      category: 'renovation_investment_fund',
      categoryGroup: 'funds',
      totalAmountMinor: 2944,
    },
  ],
};

const DOCUMENT_ROWS: Record<
  string,
  Array<{
    category: string;
    documentDate: string | null;
    documentType: string;
    hash: string;
    title: string;
  }>
> = {
  '2026-04': [
    {
      category: 'shared_property_advance',
      documentDate: '2026-04-01',
      documentType: 'monthly_charges',
      hash: 'a'.repeat(64),
      title: 'April 2026 monthly charges',
    },
    {
      category: 'central_heating_energy',
      documentDate: '2026-04-01',
      documentType: 'monthly_charges',
      hash: 'a'.repeat(64),
      title: 'April 2026 monthly charges',
    },
    {
      category: 'cold_water_and_sewage',
      documentDate: '2026-04-01',
      documentType: 'monthly_charges',
      hash: 'a'.repeat(64),
      title: 'April 2026 monthly charges',
    },
    {
      category: 'renovation_investment_fund',
      documentDate: '2026-04-01',
      documentType: 'monthly_charges',
      hash: 'a'.repeat(64),
      title: 'April 2026 monthly charges',
    },
  ],
  '2026-03': [
    {
      category: 'shared_property_advance',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'central_heating_energy',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'cold_water_and_sewage',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'renovation_investment_fund',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
  ],
  '2026-02': [
    {
      category: 'shared_property_advance',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'central_heating_energy',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'cold_water_and_sewage',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
    {
      category: 'renovation_investment_fund',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
  ],
  '2025-10': [
    {
      category: 'shared_property_advance',
      documentDate: '2025-10-01',
      documentType: 'monthly_charges',
      hash: 'b'.repeat(64),
      title: 'October 2025 monthly charges',
    },
  ],
};

const REMOVED_CATEGORY_MONTH_HISTORY_ROWS = [
  {
    periodValue: '2026-04',
    sourceDocuments: [],
    sourcePeriodValue: '2026-04',
    totalAmountMinor: 12000,
  },
  {
    periodValue: '2026-03',
    sourceDocuments: [],
    sourcePeriodValue: '2026-03',
    totalAmountMinor: 18000,
  },
];

const REMOVED_CATEGORY_BREAKDOWN_ROWS: Record<
  string,
  Array<{
    category: string;
    categoryGroup: string | null;
    totalAmountMinor: number;
  }>
> = {
  '2026-04': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 12000,
    },
  ],
  '2026-03': [
    {
      category: 'shared_property_advance',
      categoryGroup: 'shared_property',
      totalAmountMinor: 12000,
    },
    {
      category: 'e_kartoteka_access',
      categoryGroup: 'individual',
      totalAmountMinor: 6000,
    },
  ],
};

const REMOVED_CATEGORY_DOCUMENT_ROWS: Record<
  string,
  Array<{
    category: string;
    documentDate: string | null;
    documentType: string;
    hash: string;
    title: string;
  }>
> = {
  '2026-04': [
    {
      category: 'shared_property_advance',
      documentDate: '2026-04-01',
      documentType: 'monthly_charges',
      hash: 'c'.repeat(64),
      title: 'April 2026 monthly charges',
    },
  ],
  '2026-03': [
    {
      category: 'e_kartoteka_access',
      documentDate: '2026-03-01',
      documentType: 'monthly_charges',
      hash: 'd'.repeat(64),
      title: 'March 2026 monthly charges',
    },
  ],
};

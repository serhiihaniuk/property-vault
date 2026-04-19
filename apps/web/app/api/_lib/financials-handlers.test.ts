import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPropertyVaultApplication,
  YearlyReconciliationYearNotFoundError,
} from '@dabrowskiego/application';
import {
  anomalyFeedResponseSchema,
  yearlyReconciliationResponseSchema,
  type OpenApiDocument,
} from '@dabrowskiego/contracts';
import {
  createOpenAnomaliesGetHandler,
  createYearlyReconciliationGetHandler,
} from './financials-handlers.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';

type YearlyReconciliationPayload = ReturnType<
  typeof yearlyReconciliationResponseSchema.parse
>;
type AnomalyFeedPayload = ReturnType<typeof anomalyFeedResponseSchema.parse>;

test('yearly reconciliation route handler returns the db-backed financial payload', async () => {
  const runtime = createTestRuntime({
    yearlyReconciliationPayload: {
      availableYears: [
        {
          kind: 'year',
          label: '2025',
          value: '2025',
        },
      ],
      coverage: {
        monthsCovered: 12,
        status: 'full_year',
        throughMonth: {
          kind: 'month',
          label: 'December 2025',
          value: '2025-12',
        },
      },
      generatedAt: '2026-04-19T09:00:00.000Z',
      lines: [],
      selectedYear: {
        kind: 'year',
        label: '2025',
        value: '2025',
      },
      summary: {
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
      },
    },
  });

  const response = await createYearlyReconciliationGetHandler(() => runtime)(
    new Request('http://example.test/api/financials/year-reconciliation'),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    yearlyReconciliationResponseSchema.parse(await response.json()),
    await runtime.getDbApplication().financials.getYearlyReconciliation(),
  );
});

test('yearly reconciliation route maps a missing year into the declared problem response', async () => {
  const runtime = createTestRuntime({
    missingYear: '2023',
  });

  const response = await createYearlyReconciliationGetHandler(() => runtime)(
    new Request('http://example.test/api/financials/year-reconciliation?year=2023'),
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.code, 'yearly_reconciliation_year_not_found');
  assert.match(payload.detail, /2023/);
});

test('open anomalies route handler returns the db-backed anomaly feed payload', async () => {
  const runtime = createTestRuntime({
    anomalyFeedPayload: {
      anomalies: [
        {
          context: [],
          date: '2026-03-31',
          detectedAt: '2026-04-18T08:19:16.538Z',
          id: 1,
          ruleId: 'PAYMENT_DEADLINE_UNCONFIRMED',
          ruleLabel: 'Payment deadline needs confirmation',
          severity: 'warning',
          severityLabel: 'Warning',
          status: 'open',
          subjectDocument: {
            documentDate: '2026-03-15',
            documentType: 'shared_property_settlement',
            hash: 'a'.repeat(64),
            title: 'Shared property settlement 2025',
          },
          summary: 'Payment deadline for the 2025 shared-property settlement result',
        },
      ],
      countsBySeverity: [
        {
          count: 0,
          severity: 'critical',
        },
        {
          count: 1,
          severity: 'warning',
        },
        {
          count: 0,
          severity: 'info',
        },
      ],
      generatedAt: '2026-04-19T09:00:00.000Z',
      openCount: 1,
    },
  });

  const response = await createOpenAnomaliesGetHandler(() => runtime)(
    new Request('http://example.test/api/anomalies'),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    anomalyFeedResponseSchema.parse(await response.json()),
    await runtime.getDbApplication().financials.getOpenAnomalies(),
  );
});

function createTestRuntime(options: {
  anomalyFeedPayload?: AnomalyFeedPayload;
  missingYear?: string;
  yearlyReconciliationPayload?: YearlyReconciliationPayload;
} = {}): PropertyVaultApiRuntime {
  const application = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
  });
  const dbApplication = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
  });
  const openApiDocument: OpenApiDocument = {
    components: {
      schemas: {},
    },
    info: {
      title: 'Test API',
      version: 'test-version',
    },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    openapi: '3.1.0',
    paths: {},
  };

  dbApplication.financials = {
    async getOpenAnomalies() {
      return anomalyFeedResponseSchema.parse(
        options.anomalyFeedPayload ?? {
          anomalies: [],
          countsBySeverity: [
            {
              count: 0,
              severity: 'critical',
            },
            {
              count: 0,
              severity: 'warning',
            },
            {
              count: 0,
              severity: 'info',
            },
          ],
          generatedAt: '2026-04-19T09:00:00.000Z',
          openCount: 0,
        },
      );
    },
    async getYearlyReconciliation(query) {
      if (options.missingYear && query?.year === options.missingYear) {
        throw new YearlyReconciliationYearNotFoundError(options.missingYear);
      }

      return yearlyReconciliationResponseSchema.parse(
        options.yearlyReconciliationPayload ?? {
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
        },
      );
    },
  };

  return {
    application,
    getDbApplication() {
      return dbApplication;
    },
    openApiDocument,
  };
}

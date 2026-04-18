import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPropertyVaultApplication,
  DashboardMonthNotFoundError,
} from '@dabrowskiego/application';
import {
  dashboardMonthBreakdownResponseSchema,
  type OpenApiDocument,
} from '@dabrowskiego/contracts';
import {
  createDashboardMonthBreakdownGetHandler,
} from './dashboard-handlers.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';

type DashboardMonthBreakdownPayload = ReturnType<
  typeof dashboardMonthBreakdownResponseSchema.parse
>;

test('dashboard route handler returns the db-backed month breakdown payload', async () => {
  const runtime = createTestRuntime({
    dashboardPayload: {
      breakdown: [],
      generatedAt: '2026-04-18T12:00:00.000Z',
      months: [
        {
          period: {
            kind: 'month',
            label: 'April 2026',
            value: '2026-04',
          },
          totalCharges: {
            amountMinor: 53775,
            currency: 'PLN',
          },
        },
      ],
      previousMonth: null,
      selectedMonth: {
        kind: 'month',
        label: 'April 2026',
        value: '2026-04',
      },
      summary: {
        categoryCount: 0,
        changedCategoryCount: 0,
        largestCategory: null,
        previousTotalCharges: null,
        topChange: null,
        totalCharges: {
          amountMinor: 53775,
          currency: 'PLN',
        },
        totalDelta: null,
      },
      supportingDocuments: [],
    },
  });

  const response = await createDashboardMonthBreakdownGetHandler(() => runtime)(
    new Request('http://example.test/api/dashboard/month-breakdown'),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    dashboardMonthBreakdownResponseSchema.parse(await response.json()),
    await runtime.getDbApplication().dashboard.getMonthBreakdown(),
  );
});

test('dashboard route maps a missing requested month into the declared problem response', async () => {
  const runtime = createTestRuntime({
    missingMonth: '2024-01',
  });

  const response = await createDashboardMonthBreakdownGetHandler(() => runtime)(
    new Request('http://example.test/api/dashboard/month-breakdown?month=2024-01'),
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.code, 'dashboard_month_not_found');
  assert.match(payload.detail, /2024-01/);
});

function createTestRuntime(options: {
  dashboardPayload?: DashboardMonthBreakdownPayload;
  missingMonth?: string;
} = {}): PropertyVaultApiRuntime {
  const application = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-18T12:00:00.000Z'),
  });
  const dbApplication = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-18T12:00:00.000Z'),
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

  dbApplication.dashboard = {
    async getMonthBreakdown(query) {
      if (options.missingMonth && query?.month === options.missingMonth) {
        throw new DashboardMonthNotFoundError(options.missingMonth);
      }

      return dashboardMonthBreakdownResponseSchema.parse(
        options.dashboardPayload ?? {
          breakdown: [],
          generatedAt: '2026-04-18T12:00:00.000Z',
          months: [],
          previousMonth: null,
          selectedMonth: null,
          summary: null,
          supportingDocuments: [],
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

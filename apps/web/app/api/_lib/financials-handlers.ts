import {
  type PropertyVaultApplication,
  YearlyReconciliationYearNotFoundError,
} from '@dabrowskiego/application';
import {
  openAnomalyFeedRoute,
  yearlyReconciliationQuerySchema,
  yearlyReconciliationRoute,
} from '@dabrowskiego/contracts';
import {
  createApiProblem,
  ApiProblemError,
} from './problem.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;
type DbApplicationResolver = (runtime: PropertyVaultApiRuntime) => PropertyVaultApplication;

export function createYearlyReconciliationGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: yearlyReconciliationRoute,
    async execute({ query }) {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      try {
        return await application.financials.getYearlyReconciliation(
          yearlyReconciliationQuerySchema.parse(query),
        );
      } catch (error) {
        if (error instanceof YearlyReconciliationYearNotFoundError) {
          throw new ApiProblemError(
            createApiProblem({
              code: 'yearly_reconciliation_year_not_found',
              detail: `No yearly reconciliation data is available for year "${error.year}".`,
              status: 404,
              title: 'Yearly reconciliation year not found.',
            }),
          );
        }

        throw error;
      }
    },
  });
}

export function createOpenAnomaliesGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: openAnomalyFeedRoute,
    async execute() {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      return await application.financials.getOpenAnomalies();
    },
  });
}

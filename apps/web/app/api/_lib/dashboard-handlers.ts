import {
  DashboardMonthNotFoundError,
  type PropertyVaultApplication,
} from '@dabrowskiego/application';
import {
  createApiProblem,
  ApiProblemError,
} from './problem.ts';
import {
  dashboardMonthBreakdownQuerySchema,
  dashboardMonthBreakdownRoute,
} from '@dabrowskiego/contracts';
import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;
type DbApplicationResolver = (runtime: PropertyVaultApiRuntime) => PropertyVaultApplication;

export function createDashboardMonthBreakdownGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: dashboardMonthBreakdownRoute,
    async execute({ query }) {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      try {
        return await application.dashboard.getMonthBreakdown(
          dashboardMonthBreakdownQuerySchema.parse(query),
        );
      } catch (error) {
        if (error instanceof DashboardMonthNotFoundError) {
          throw new ApiProblemError(
            createApiProblem({
              code: 'dashboard_month_not_found',
              detail: `No dashboard data is available for month "${error.month}".`,
              status: 404,
              title: 'Dashboard month not found.',
            }),
          );
        }

        throw error;
      }
    },
  });
}

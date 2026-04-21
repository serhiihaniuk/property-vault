import type { PropertyVaultApplication } from '@dabrowskiego/application';
import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';
import { ApiProblemError, createApiProblem } from './problem.ts';
import {
  apiIndexRoute,
  healthCheckRoute,
  syncStatusRoute,
} from '@dabrowskiego/contracts';
import { createJsonResponse } from './response.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;
type DbApplicationResolver = (runtime: PropertyVaultApiRuntime) => PropertyVaultApplication;
type SystemHealthChecks = Awaited<
  ReturnType<PropertyVaultApiRuntime['application']['system']['getHealthStatus']>
>['checks'];

export function createApiIndexGetHandler(resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime) {
  return createRouteHandler({
    contract: apiIndexRoute,
    async execute() {
      const runtime = resolveRuntime();

      return runtime.application.system.getApiIndex();
    },
  });
}

export function createHealthCheckGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: healthCheckRoute,
    async execute() {
      const runtime = resolveRuntime();
      const health = await runtime.application.system.getHealthStatus();

      if (hasUnavailableHealthCheck(health.checks)) {
        throw new ApiProblemError(
          createApiProblem({
            code: 'health_check_failed',
            detail: summarizeHealthFailure(health.checks),
            status: 503,
            title: 'One or more health checks failed.',
          }),
        );
      }

      return health;
    },
  });
}

export function createOpenApiDocumentGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return async function openApiDocumentGetHandler(): Promise<Response> {
    const runtime = resolveRuntime();

    return createJsonResponse(runtime.openApiDocument, {
      status: 200,
    });
  };
}

export function createSyncStatusGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: syncStatusRoute,
    async execute() {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      return application.system.getSyncStatus();
    },
  });
}

function hasUnavailableHealthCheck(checks: SystemHealthChecks): boolean {
  return checks.some((check) => check.status === 'down');
}

function summarizeHealthFailure(checks: SystemHealthChecks): string {
  return checks
    .filter((check) => check.status === 'down')
    .map((check) => (check.detail ? `${check.name}: ${check.detail}` : `${check.name}: ${check.status}`))
    .join('; ');
}

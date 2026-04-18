import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';
import { ApiProblemError, createApiProblem } from './problem.ts';
import { apiIndexRoute, healthCheckRoute } from '@dabrowskiego/contracts';
import { createJsonResponse } from './response.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;

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

      if (health.status !== 'ok') {
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

function summarizeHealthFailure(
  checks: Awaited<ReturnType<PropertyVaultApiRuntime['application']['system']['getHealthStatus']>>['checks'],
): string {
  return checks
    .filter((check) => check.status !== 'ok')
    .map((check) => (check.detail ? `${check.name}: ${check.detail}` : `${check.name}: ${check.status}`))
    .join('; ');
}

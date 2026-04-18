import {
  apiIndexResponseSchema,
  healthCheckResponseSchema,
} from '@dabrowskiego/contracts';
import type { PropertyVaultApplicationContext } from './context.ts';
import { runApplicationHealthDependency } from './health.ts';

export type ApiIndexResponse = ReturnType<typeof apiIndexResponseSchema.parse>;
export type ApplicationHealthResponse = ReturnType<typeof healthCheckResponseSchema.parse>;

export interface SystemApplicationService {
  getApiIndex: () => Promise<ApiIndexResponse>;
  getHealthStatus: () => Promise<ApplicationHealthResponse>;
}

export function createSystemApplicationService(
  context: PropertyVaultApplicationContext,
): SystemApplicationService {
  return {
    async getApiIndex() {
      return apiIndexResponseSchema.parse({
        environment: context.environment,
        healthPath: context.healthPath,
        openApiPath: context.openApiPath,
        serviceName: context.serviceName,
        version: context.version,
      });
    },
    async getHealthStatus() {
      const checks = await Promise.all(
        context.healthDependencies.map((dependency) =>
          runApplicationHealthDependency(dependency),
        ),
      );

      return healthCheckResponseSchema.parse({
        checks,
        generatedAt: context.now().toISOString(),
        status: checks.some((check) => check.status !== 'ok') ? 'degraded' : 'ok',
      });
    },
  };
}

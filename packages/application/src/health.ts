import { healthCheckDependencySchema } from '@dabrowskiego/contracts';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { sql } from 'drizzle-orm';

export type ApplicationHealthCheck = ReturnType<typeof healthCheckDependencySchema.parse>;
export type ApplicationHealthStatus = ApplicationHealthCheck['status'];

export interface ApplicationHealthDependency {
  check: () => Promise<{
    detail?: string;
    status: ApplicationHealthStatus;
  }>;
  name: string;
}

export function createDatabaseHealthDependency(
  db: PropertyVaultDatabase,
): ApplicationHealthDependency {
  return {
    async check() {
      try {
        await db.execute(sql`select 1`);

        return { status: 'ok' };
      } catch (error) {
        return {
          detail: getErrorMessage(error),
          status: 'down',
        };
      }
    },
    name: 'database',
  };
}

export async function runApplicationHealthDependency(
  dependency: ApplicationHealthDependency,
): Promise<ApplicationHealthCheck> {
  return healthCheckDependencySchema.parse({
    ...(await dependency.check()),
    name: dependency.name,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown dependency error.';
}

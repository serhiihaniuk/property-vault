import { runtimeEnvironmentSchema } from '@dabrowskiego/contracts';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import {
  createDatabaseHealthDependency,
  type ApplicationHealthDependency,
} from './health.ts';

export type RuntimeEnvironment = ReturnType<typeof runtimeEnvironmentSchema.parse>;

export interface CreatePropertyVaultApplicationContextOptions {
  db?: PropertyVaultDatabase;
  environment?: RuntimeEnvironment | string;
  healthDependencies?: readonly ApplicationHealthDependency[];
  healthPath?: string;
  now?: () => Date;
  openApiPath?: string;
  serviceName?: string;
  version?: string;
}

export interface PropertyVaultApplicationContext {
  db?: PropertyVaultDatabase;
  environment: RuntimeEnvironment;
  healthDependencies: readonly ApplicationHealthDependency[];
  healthPath: string;
  now: () => Date;
  openApiPath: string;
  serviceName: string;
  version: string;
}

export function createPropertyVaultApplicationContext(
  options: CreatePropertyVaultApplicationContextOptions = {},
): PropertyVaultApplicationContext {
  const {
    db,
    healthDependencies = [],
    now = () => new Date(),
    ...rest
  } = options;

  return {
    db,
    environment: runtimeEnvironmentSchema.parse(
      rest.environment ?? process.env.NODE_ENV ?? 'development',
    ),
    healthDependencies: collectHealthDependencies(db, healthDependencies),
    healthPath: rest.healthPath ?? '/api/health',
    now,
    openApiPath: rest.openApiPath ?? '/api/openapi.json',
    serviceName: rest.serviceName ?? 'Property Vault API',
    version: rest.version ?? '0.1.0',
  };
}

function collectHealthDependencies(
  db: PropertyVaultDatabase | undefined,
  healthDependencies: readonly ApplicationHealthDependency[],
): readonly ApplicationHealthDependency[] {
  const dependencies = [...healthDependencies];

  if (db && !dependencies.some((dependency) => dependency.name === 'database')) {
    dependencies.unshift(createDatabaseHealthDependency(db));
  }

  return dependencies;
}

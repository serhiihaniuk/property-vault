import {
  createDatabase,
  type CreateDatabaseOptions,
  type DatabaseHandle,
  type PropertyVaultDatabase,
} from './client.ts';

declare global {
  var __propertyVaultRuntimeDatabaseHandle: DatabaseHandle | undefined;
}

export interface GetRuntimeDatabaseOptions
  extends Omit<CreateDatabaseOptions, 'logger' | 'pool'> {
  logger?: boolean;
}

export function getRuntimeDatabaseHandle(
  options: GetRuntimeDatabaseOptions = {},
): DatabaseHandle {
  if (shouldCreateIsolatedHandle(options)) {
    return createDatabase(options);
  }

  globalThis.__propertyVaultRuntimeDatabaseHandle ??= createDatabase({
    logger: options.logger ?? false,
  });

  return globalThis.__propertyVaultRuntimeDatabaseHandle;
}

export function getRuntimeDatabase(
  options: GetRuntimeDatabaseOptions = {},
): PropertyVaultDatabase {
  return getRuntimeDatabaseHandle(options).db;
}

export function resetRuntimeDatabaseHandleForTests(): void {
  globalThis.__propertyVaultRuntimeDatabaseHandle = undefined;
}

function shouldCreateIsolatedHandle(options: GetRuntimeDatabaseOptions): boolean {
  return Boolean(options.connectionString);
}

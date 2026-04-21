import { getRuntimeDatabase, type GetRuntimeDatabaseOptions } from '@dabrowskiego/db/runtime';
import {
  createPropertyVaultAuth,
  type CreatePropertyVaultAuthOptions,
  type PropertyVaultAuth,
} from './auth.ts';

declare global {
  var __propertyVaultRuntimeAuth: PropertyVaultAuth | undefined;
}

export interface CreateRuntimePropertyVaultAuthOptions
  extends Omit<CreatePropertyVaultAuthOptions, 'db'>,
    GetRuntimeDatabaseOptions {}

export function createRuntimePropertyVaultAuth(
  options: CreateRuntimePropertyVaultAuthOptions = {},
): PropertyVaultAuth {
  const { connectionString, logger, ...authOptions } = options;

  return createPropertyVaultAuth({
    ...authOptions,
    db: getRuntimeDatabase({ connectionString, logger }),
  });
}

export function getRuntimePropertyVaultAuth(): PropertyVaultAuth {
  globalThis.__propertyVaultRuntimeAuth ??= createRuntimePropertyVaultAuth();

  return globalThis.__propertyVaultRuntimeAuth;
}

export function resetRuntimePropertyVaultAuthForTests(): void {
  globalThis.__propertyVaultRuntimeAuth = undefined;
}

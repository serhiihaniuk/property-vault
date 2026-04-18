import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getDatabaseUrl } from './config.ts';
import { schema, type PropertyVaultSchema } from './schema/index.ts';

export type PropertyVaultDatabase = NodePgDatabase<PropertyVaultSchema>;

export interface CreatePoolOptions extends Omit<PoolConfig, 'connectionString'> {
  connectionString?: string;
}

export interface CreateDatabaseOptions extends CreatePoolOptions {
  logger?: boolean;
  pool?: Pool;
}

export interface DatabaseHandle {
  db: PropertyVaultDatabase;
  pool: Pool;
}

export function createPool(options: CreatePoolOptions = {}): Pool {
  const { connectionString = getDatabaseUrl(), ...poolOptions } = options;

  return new Pool({
    connectionString,
    ...poolOptions,
  });
}

export function createDatabase(options: CreateDatabaseOptions = {}): DatabaseHandle {
  const { logger = false, pool, ...poolOptions } = options;
  const activePool = pool ?? createPool(poolOptions);

  return {
    pool: activePool,
    db: drizzle(activePool, { logger, schema }),
  };
}

export async function closeDatabase(handle: DatabaseHandle): Promise<void> {
  await handle.pool.end();
}

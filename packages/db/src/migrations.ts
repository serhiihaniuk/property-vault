import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PropertyVaultDatabase } from './client.ts';

export function resolveMigrationsFolder(): string {
  return fileURLToPath(new URL('../migrations', import.meta.url));
}

export async function migrateDatabase(
  db: PropertyVaultDatabase,
  migrationsFolder = resolveMigrationsFolder(),
): Promise<void> {
  await migrate(db, { migrationsFolder });
}

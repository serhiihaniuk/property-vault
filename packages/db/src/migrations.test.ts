import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { newDb } from 'pg-mem';
import { createDatabase } from './client.ts';
import { resolveMigrationsFolder } from './migrations.ts';

async function readMigrationStatements(migrationsFolder: string): Promise<string[]> {
  const statements: string[] = [];
  const migrationFiles = (await readdir(migrationsFolder))
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(join(migrationsFolder, migrationFile), 'utf8');

    statements.push(
      ...migrationSql
        .split('--> statement-breakpoint')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  return statements;
}

test('migrations create auth, app, and vault schemas with usable tables', async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const handle = createDatabase({ pool });

  assert.equal(handle.pool, pool);
  assert.ok(handle.db);

  const statements = await readMigrationStatements(resolveMigrationsFolder());
  assert.ok(statements.length > 0, 'expected generated SQL migrations');

  for (const statement of statements) {
    await pool.query(statement);
  }

  await pool.query(
    `insert into "auth"."user" ("id", "name", "email")
     values ('user-1', 'Serhii', 'owner@example.com')`,
  );
  await pool.query(
    `insert into "app"."user_preference" ("user_id", "timezone", "period_view")
     values ('user-1', 'Europe/Warsaw', 'monthly')`,
  );
  await pool.query(
    `insert into "vault"."documents" ("hash", "mime", "size_bytes", "ingested_at", "local_path")
     values ('${'a'.repeat(64)}', 'application/pdf', 1024, '2026-04-18T00:00:00Z', 'vault/documents/example.pdf')`,
  );

  const authUserResult = await pool.query(
    'select role from "auth"."user" where id = \'user-1\'',
  );
  const appPreferenceResult = await pool.query(
    'select user_id from "app"."user_preference" where user_id = \'user-1\'',
  );
  const vaultDocumentResult = await pool.query(
    `select hash from "vault"."documents" where hash = '${'a'.repeat(64)}'`,
  );

  assert.equal(authUserResult.rows[0]?.role, 'viewer');
  assert.equal(appPreferenceResult.rows[0]?.user_id, 'user-1');
  assert.equal(vaultDocumentResult.rows[0]?.hash.length, 64);

  await pool.end();
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { newDb } from 'pg-mem';
import { createDatabase } from './client.ts';
import { resolveMigrationsFolder } from './migrations.ts';

test('migrations create auth, app, and vault schemas with usable tables', async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const handle = createDatabase({ pool });

  assert.equal(handle.pool, pool);
  assert.ok(handle.db);

  const migrationSql = await readFile(
    `${resolveMigrationsFolder()}\\0000_silly_power_man.sql`,
    'utf8',
  );

  for (const statement of migrationSql
    .split('--> statement-breakpoint')
    .map((value) => value.trim())
    .filter(Boolean)) {
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

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { APIError } from 'better-auth/api';
import { createDatabase, resolveMigrationsFolder } from '@dabrowskiego/db';
import { newDb } from 'pg-mem';
import { createPropertyVaultAuth } from './auth.ts';
import {
  AuthenticationRequiredError,
  getSessionFromHeaders,
  getSessionRole,
  requireSessionFromHeaders,
  requireSessionRole,
  sessionHasMinimumRole,
} from './session.ts';

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

async function createTestAuth() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const handle = createDatabase({ pool });
  const statements = await readMigrationStatements(resolveMigrationsFolder());

  for (const statement of statements) {
    await pool.query(statement);
  }

  const auth = createPropertyVaultAuth({
    baseURL: 'http://localhost:3000',
    db: handle.db,
    secret: 'pV8vQ3L9mZ2sN7xC1kR4tY6wB0jH5uF2aD8eG1nM9qT3',
  });

  return { auth, pool };
}

test('auth package exposes Better Auth over the shared Postgres schema', async () => {
  const { auth, pool } = await createTestAuth();

  const response = await auth.handler(
    new Request('http://localhost:3000/api/auth/get-session'),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);

  const session = await getSessionFromHeaders(auth, new Headers());
  assert.equal(session, null);

  await pool.end();
});

test('public email sign-up is disabled by default', async () => {
  const { auth, pool } = await createTestAuth();

  await assert.rejects(
    auth.api.signUpEmail({
      body: {
        email: 'new-user@example.com',
        name: 'New User',
        password: 'password1234',
      },
    }),
    (error) => {
      assert.ok(error instanceof APIError);
      assert.match(error.message.toLowerCase(), /sign.?up|disabled/);
      return true;
    },
  );

  await pool.end();
});

test('session helpers enforce authentication and role checks', async () => {
  const { auth, pool } = await createTestAuth();

  await assert.rejects(
    requireSessionFromHeaders(auth, new Headers()),
    (error) => error instanceof AuthenticationRequiredError,
  );

  const ownerSession = {
    user: {
      role: 'owner',
    },
  };

  const viewerSession = {
    user: {
      role: 'viewer',
    },
  };

  assert.equal(getSessionRole(ownerSession), 'owner');
  assert.equal(sessionHasMinimumRole(ownerSession, 'editor'), true);
  assert.equal(sessionHasMinimumRole(viewerSession, 'editor'), false);
  assert.equal(requireSessionRole(ownerSession, 'editor'), ownerSession);

  assert.throws(() => requireSessionRole(viewerSession, 'editor'));

  await pool.end();
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '@dabrowskiego/db';
import { newDb } from 'pg-mem';
import { createPropertyVaultApplication } from './application.ts';
import {
  createDocumentReference,
  createMoneyAmount,
  createPeriodReference,
} from './shared.ts';

test('application package exposes contract-aligned system services', async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const { db } = createDatabase({ pool });

  const application = createPropertyVaultApplication({
    db,
    environment: 'test',
    version: 'test-version',
  });

  const apiIndex = await application.system.getApiIndex();
  const health = await application.system.getHealthStatus();

  assert.deepEqual(apiIndex, {
    environment: 'test',
    healthPath: '/api/health',
    openApiPath: '/api/openapi.json',
    serviceName: 'Property Vault API',
    version: 'test-version',
  });
  assert.equal(application.context.healthDependencies.length, 1);
  assert.equal(health.status, 'ok');
  assert.equal(health.checks[0]?.name, 'database');
  assert.equal(health.checks[0]?.status, 'ok');

  await pool.end();
});

test('health service reports degraded status when any dependency is down', async () => {
  const application = createPropertyVaultApplication({
    environment: 'test',
    healthDependencies: [
      {
        async check() {
          return {
            detail: 'Sync worker timed out.',
            status: 'down',
          };
        },
        name: 'sync-worker',
      },
    ],
    now: () => new Date('2026-04-18T12:00:00.000Z'),
  });

  const health = await application.system.getHealthStatus();

  assert.deepEqual(health, {
    checks: [
      {
        detail: 'Sync worker timed out.',
        name: 'sync-worker',
        status: 'down',
      },
    ],
    generatedAt: '2026-04-18T12:00:00.000Z',
    status: 'degraded',
  });
});

test('shared builders normalize money, document, and period DTOs', () => {
  const amount = createMoneyAmount({ amountMinor: 12345 });
  const document = createDocumentReference({
    documentDate: '2026-04-01',
    documentType: 'invoice',
    hash: 'a'.repeat(64),
    title: 'April utility invoice',
  });
  const month = createPeriodReference({
    kind: 'month',
    value: '2026-04',
  });
  const custom = createPeriodReference({
    endDate: '2026-04-30',
    kind: 'custom',
    startDate: '2026-04-01',
  });

  assert.deepEqual(amount, {
    amountMinor: 12345,
    currency: 'PLN',
  });
  assert.deepEqual(document, {
    documentDate: '2026-04-01',
    documentType: 'invoice',
    hash: 'a'.repeat(64),
    title: 'April utility invoice',
  });
  assert.deepEqual(month, {
    kind: 'month',
    label: '2026-04',
    value: '2026-04',
  });
  assert.deepEqual(custom, {
    endDate: '2026-04-30',
    kind: 'custom',
    label: '2026-04-01 to 2026-04-30',
    startDate: '2026-04-01',
  });
  assert.throws(() => createPeriodReference({ kind: 'year' }));
});

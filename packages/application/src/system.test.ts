import assert from 'node:assert/strict';
import test from 'node:test';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { createPropertyVaultApplicationContext } from './context.ts';
import { createSystemApplicationService } from './system.ts';

test('system service reports canonical sync status as never_synced when no operational state exists', async () => {
  const system = createSystemApplicationService(createSystemContext(), {
    async loadCanonicalSyncState() {
      return null;
    },
  });

  const syncStatus = await system.getSyncStatus();

  assert.deepEqual(syncStatus, {
    lastError: null,
    lastFinishedAt: null,
    lastStartedAt: null,
    lastSuccessAt: null,
    status: 'never_synced',
  });
});

test('system service returns the explicit operational sync state from app.sync_state', async () => {
  const system = createSystemApplicationService(createSystemContext(), {
    async loadCanonicalSyncState() {
      return {
        lastError: 'The canonical sync failed to write run history.',
        lastFinishedAt: '2026-04-21T08:10:00.000Z',
        lastStartedAt: '2026-04-21T08:05:00.000Z',
        lastSuccessAt: '2026-04-20T18:00:00.000Z',
        status: 'error',
      };
    },
  });

  const syncStatus = await system.getSyncStatus();

  assert.deepEqual(syncStatus, {
    lastError: 'The canonical sync failed to write run history.',
    lastFinishedAt: '2026-04-21T08:10:00.000Z',
    lastStartedAt: '2026-04-21T08:05:00.000Z',
    lastSuccessAt: '2026-04-20T18:00:00.000Z',
    status: 'error',
  });
});

test('system service treats the canonical app.sync_state row as the live operational status shape', async () => {
  const system = createSystemApplicationService(createSystemContext(), {
    async loadCanonicalSyncState() {
      return {
        lastError: null,
        lastFinishedAt: '2026-04-21T08:03:00.000Z',
        lastStartedAt: '2026-04-21T08:00:00.000Z',
        lastSuccessAt: '2026-04-21T08:03:00.000Z',
        status: 'idle',
      };
    },
  });

  const syncStatus = await system.getSyncStatus();

  assert.deepEqual(syncStatus, {
    lastError: null,
    lastFinishedAt: '2026-04-21T08:03:00.000Z',
    lastStartedAt: '2026-04-21T08:00:00.000Z',
    lastSuccessAt: '2026-04-21T08:03:00.000Z',
    status: 'idle',
  });
});

function createSystemContext() {
  return createPropertyVaultApplicationContext({
    db: {} as PropertyVaultDatabase,
    environment: 'test',
    now: () => new Date('2026-04-21T12:00:00.000Z'),
  });
}

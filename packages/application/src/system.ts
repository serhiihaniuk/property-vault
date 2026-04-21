import {
  apiIndexResponseSchema,
  healthCheckResponseSchema,
  syncStatusResponseSchema,
} from '@dabrowskiego/contracts';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { sql } from 'drizzle-orm';
import type { PropertyVaultApplicationContext } from './context.ts';
import { runApplicationHealthDependency } from './health.ts';

export type ApiIndexResponse = ReturnType<typeof apiIndexResponseSchema.parse>;
export type ApplicationHealthResponse = ReturnType<typeof healthCheckResponseSchema.parse>;
export type SyncStatusResponse = ReturnType<typeof syncStatusResponseSchema.parse>;

const DEFAULT_CANONICAL_SYNC_STATE_KEY = 'canonical_vault';

type CanonicalSyncStateRow = {
  lastError: string | null;
  lastFinishedAt: string | null;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  status: string;
};

type SystemDependencies = {
  loadCanonicalSyncState: typeof loadCanonicalSyncState;
};

const defaultSystemDependencies: SystemDependencies = {
  loadCanonicalSyncState,
};

export interface SystemApplicationService {
  getApiIndex: () => Promise<ApiIndexResponse>;
  getHealthStatus: () => Promise<ApplicationHealthResponse>;
  getSyncStatus: () => Promise<SyncStatusResponse>;
}

export function createSystemApplicationService(
  context: PropertyVaultApplicationContext,
  dependencies: SystemDependencies = defaultSystemDependencies,
): SystemApplicationService {
  return {
    async getApiIndex() {
      return apiIndexResponseSchema.parse({
        environment: context.environment,
        healthPath: context.healthPath,
        openApiPath: context.openApiPath,
        serviceName: context.serviceName,
        version: context.version,
      });
    },
    async getHealthStatus() {
      const checks = await Promise.all(
        context.healthDependencies.map((dependency) =>
          runApplicationHealthDependency(dependency),
        ),
      );

      return healthCheckResponseSchema.parse({
        checks,
        generatedAt: context.now().toISOString(),
        status: checks.some((check) => check.status !== 'ok') ? 'degraded' : 'ok',
      });
    },
    async getSyncStatus() {
      const db = requireDatabase(context.db);
      const syncState = await dependencies.loadCanonicalSyncState(
        db,
        DEFAULT_CANONICAL_SYNC_STATE_KEY,
      );

      return syncStatusResponseSchema.parse({
        lastError: syncState?.lastError?.trim() || null,
        lastFinishedAt: syncState?.lastFinishedAt ?? null,
        lastStartedAt: syncState?.lastStartedAt ?? null,
        lastSuccessAt: syncState?.lastSuccessAt ?? null,
        status: normalizeSyncStatus(syncState),
      });
    },
  };
}

// Operational freshness is sourced from app.sync_state; vault.sync_runs remains
// append-only audit history and should not drive the live UI state directly.
async function loadCanonicalSyncState(
  db: PropertyVaultDatabase,
  syncStateKey: string,
): Promise<CanonicalSyncStateRow | null> {
  const result = await db.execute(sql`
    select
      last_error as "lastError",
      last_finished_at as "lastFinishedAt",
      last_started_at as "lastStartedAt",
      last_success_at as "lastSuccessAt",
      status
    from "app"."sync_state"
    where "key" = ${syncStateKey}
    limit 1
  `);
  const syncState = result.rows[0] as
    | {
        lastError?: unknown;
        lastFinishedAt?: unknown;
        lastStartedAt?: unknown;
        lastSuccessAt?: unknown;
        status?: unknown;
      }
    | undefined;

  if (!syncState) {
    return null;
  }

  return {
    lastError: typeof syncState.lastError === 'string' ? syncState.lastError : null,
    lastFinishedAt: normalizeTimestamp(syncState.lastFinishedAt),
    lastStartedAt: normalizeTimestamp(syncState.lastStartedAt),
    lastSuccessAt: normalizeTimestamp(syncState.lastSuccessAt),
    status: typeof syncState.status === 'string' ? syncState.status : 'idle',
  };
}

function normalizeSyncStatus(
  syncState: CanonicalSyncStateRow | null,
): SyncStatusResponse['status'] {
  if (!syncState) {
    return 'never_synced';
  }

  if (syncState.status === 'running') {
    return 'running';
  }

  if (syncState.status === 'error') {
    return 'error';
  }

  if (
    syncState.lastStartedAt ||
    syncState.lastFinishedAt ||
    syncState.lastSuccessAt
  ) {
    return 'idle';
  }

  return 'never_synced';
}

function requireDatabase(
  db: PropertyVaultDatabase | undefined,
): PropertyVaultDatabase {
  if (!db) {
    throw new Error('System application service requires a configured database.');
  }

  return db;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'string') {
    const timestamp = new Date(value);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }

    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

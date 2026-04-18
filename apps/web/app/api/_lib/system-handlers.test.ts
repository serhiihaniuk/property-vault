import assert from 'node:assert/strict';
import test from 'node:test';
import {
  apiIndexResponseSchema,
  healthCheckResponseSchema,
  type OpenApiDocument,
} from '@dabrowskiego/contracts';
import { createPropertyVaultApplication } from '@dabrowskiego/application';
import {
  createApiIndexGetHandler,
  createHealthCheckGetHandler,
  createOpenApiDocumentGetHandler,
} from './system-handlers.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';

test('system route handlers return application-backed API metadata and health data', async () => {
  const runtime = createTestRuntime({
    healthDependencies: [
      {
        async check() {
          return {
            status: 'ok',
          };
        },
        name: 'background-sync',
      },
    ],
  });
  const apiIndexResponse = await createApiIndexGetHandler(() => runtime)(
    new Request('http://example.test/api'),
  );
  const healthResponse = await createHealthCheckGetHandler(() => runtime)(
    new Request('http://example.test/api/health'),
  );

  assert.equal(apiIndexResponse.status, 200);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(
    apiIndexResponseSchema.parse(await apiIndexResponse.json()),
    await runtime.application.system.getApiIndex(),
  );
  assert.deepEqual(
    healthCheckResponseSchema.parse(await healthResponse.json()),
    await runtime.application.system.getHealthStatus(),
  );
});

test('health route returns degraded health using the declared 200 response contract', async () => {
  const runtime = createTestRuntime({
    healthDependencies: [
      {
        async check() {
          return {
            detail: 'Background sync is lagging behind the latest inbox changes.',
            status: 'degraded',
          };
        },
        name: 'background-sync',
      },
    ],
  });
  const response = await createHealthCheckGetHandler(() => runtime)(
    new Request('http://example.test/api/health'),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    healthCheckResponseSchema.parse(await response.json()),
    await runtime.application.system.getHealthStatus(),
  );
});

test('health route maps unavailable application health into the declared problem response', async () => {
  const runtime = createTestRuntime({
    healthDependencies: [
      {
        async check() {
          return {
            detail: 'Database did not answer within the timeout.',
            status: 'down',
          };
        },
        name: 'database',
      },
    ],
  });
  const response = await createHealthCheckGetHandler(() => runtime)(
    new Request('http://example.test/api/health'),
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, 'health_check_failed');
  assert.match(payload.detail, /database/i);
});

test('openapi route returns the generated OpenAPI document', async () => {
  const runtime = createTestRuntime();
  const response = await createOpenApiDocumentGetHandler(() => runtime)();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), runtime.openApiDocument);
});

function createTestRuntime(
  options: Parameters<typeof createPropertyVaultApplication>[0] = {},
): PropertyVaultApiRuntime {
  const application = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-18T12:00:00.000Z'),
    ...options,
  });
  const openApiDocument: OpenApiDocument = {
    components: {
      schemas: {},
    },
    info: {
      title: 'Test API',
      version: 'test-version',
    },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    openapi: '3.1.0',
    paths: {},
  };

  return {
    application,
    openApiDocument,
  };
}

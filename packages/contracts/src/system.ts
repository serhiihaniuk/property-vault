import { z } from 'zod';
import { accessRouteCatalog } from './access.ts';
import { dashboardRouteCatalog } from './dashboard.ts';
import { documentsRouteCatalog } from './documents.ts';
import { financialsRouteCatalog } from './financials.ts';
import {
  apiProblemSchema,
  documentReferenceSchema,
  isoDateTimeSchema,
  moneyAmountSchema,
  paginationMetaSchema,
  periodReferenceSchema,
} from './shared.ts';
import {
  defineRoute,
  generateOpenApiDocument,
  jsonResponse,
  namedSchema,
  type GenerateOpenApiDocumentOptions,
  type NamedSchema,
  type RouteContract,
} from './openapi.ts';

export const runtimeEnvironmentSchema = z
  .enum(['development', 'test', 'production'])
  .describe('Runtime environment label.');

export const apiIndexResponseSchema = z
  .object({
    healthPath: z.string().min(1),
    openApiPath: z.string().min(1),
    serviceName: z.string().min(1),
    version: z.string().min(1),
    environment: runtimeEnvironmentSchema,
  })
  .strict()
  .describe('Top-level API metadata and discovery links.');

export const healthCheckDependencySchema = z
  .object({
    detail: z.string().min(1).optional(),
    name: z.string().min(1),
    status: z.enum(['ok', 'degraded', 'down']),
  })
  .strict()
  .describe('Health status for a single dependency or subsystem.');

export const healthCheckResponseSchema = z
  .object({
    checks: z.array(healthCheckDependencySchema),
    generatedAt: isoDateTimeSchema,
    status: z.enum(['ok', 'degraded']),
  })
  .strict()
  .describe('Aggregate API health response.');

export const syncStatusSchema = z
  .enum(['never_synced', 'idle', 'running', 'error'])
  .describe('Current operational state for the canonical vault sync.');

export const syncStatusResponseSchema = z
  .object({
    lastError: z
      .string()
      .min(1)
      .nullable()
      .describe('Most recent sync error when the latest sync attempt failed.'),
    lastFinishedAt: isoDateTimeSchema
      .nullable()
      .describe('Timestamp when the latest sync attempt finished.'),
    lastStartedAt: isoDateTimeSchema
      .nullable()
      .describe('Timestamp when the latest sync attempt started.'),
    lastSuccessAt: isoDateTimeSchema
      .nullable()
      .describe('Timestamp when the latest successful sync completed.'),
    status: syncStatusSchema,
  })
  .strict()
  .describe('Current canonical vault sync freshness and operational status.');

export const propertyVaultSharedSchemas = [
  namedSchema('ApiProblem', apiProblemSchema),
  namedSchema('DocumentReference', documentReferenceSchema),
  namedSchema('MoneyAmount', moneyAmountSchema),
  namedSchema('PaginationMeta', paginationMetaSchema),
  namedSchema('PeriodReference', periodReferenceSchema),
  namedSchema('RuntimeEnvironment', runtimeEnvironmentSchema),
] as const satisfies readonly NamedSchema[];

export const apiIndexRoute = defineRoute({
  method: 'get',
  operationId: 'getApiIndex',
  path: '/api',
  responses: {
    200: jsonResponse('API metadata and discovery links.', apiIndexResponseSchema, {
      schemaName: 'ApiIndexResponse',
    }),
  },
  summary: 'Get API entry metadata.',
  tags: ['system'],
});

export const healthCheckRoute = defineRoute({
  method: 'get',
  operationId: 'getApiHealth',
  path: '/api/health',
  responses: {
    200: jsonResponse('Current API health status.', healthCheckResponseSchema, {
      schemaName: 'HealthCheckResponse',
    }),
    503: jsonResponse('One or more core dependencies are unavailable.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Get API health status.',
  tags: ['system'],
});

export const syncStatusRoute = defineRoute({
  method: 'get',
  operationId: 'getSyncStatus',
  path: '/api/sync-status',
  responses: {
    200: jsonResponse('Current canonical vault sync status.', syncStatusResponseSchema, {
      schemaName: 'SyncStatusResponse',
    }),
  },
  summary: 'Get canonical vault sync freshness and operational status.',
  tags: ['system'],
});

export const propertyVaultRouteCatalog = {
  ...accessRouteCatalog,
  ...dashboardRouteCatalog,
  ...documentsRouteCatalog,
  ...financialsRouteCatalog,
  getApiIndex: apiIndexRoute,
  getApiHealth: healthCheckRoute,
  getSyncStatus: syncStatusRoute,
} as const;

export const propertyVaultBaseRoutes = Object.values(
  propertyVaultRouteCatalog,
) as readonly RouteContract[];

export interface GeneratePropertyVaultOpenApiOptions
  extends Partial<Omit<GenerateOpenApiDocumentOptions, 'components' | 'routes'>> {}

export function generatePropertyVaultOpenApiDocument(
  options: GeneratePropertyVaultOpenApiOptions = {},
) {
  return generateOpenApiDocument({
    components: propertyVaultSharedSchemas,
    description:
      options.description ??
      'REST transport contracts for the private Property Vault application.',
    routes: propertyVaultBaseRoutes,
    servers: options.servers,
    title: options.title ?? 'Property Vault API',
    version: options.version ?? '0.1.0',
  });
}

import { z } from 'zod';
import {
  apiProblemSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyAmountSchema,
  periodReferenceSchema,
} from './shared.ts';
import { defineRoute, jsonResponse } from './openapi.ts';

export const documentHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'Expected a SHA-256 document hash.')
  .describe('Canonical SHA-256 document hash.');

export const documentRecordStatusSchema = z
  .enum(['ok', 'needs_review', 'failed'])
  .describe('Normalized extraction status for the document record.');

export const documentCatalogQuerySchema = z
  .object({
    documentType: z.string().min(1).optional(),
  })
  .strict()
  .describe('Optional document type filter for the catalog view.');

export const documentCatalogTypeSchema = z
  .object({
    count: z.number().int().min(0),
    documentType: z.string().min(1),
    label: z.string().min(1),
  })
  .strict()
  .describe('Available document type filter with result count.');

export const documentCatalogItemSchema = z
  .object({
    assetTag: z.string().min(1).nullable(),
    confidence: z.number().min(0).max(1),
    documentDate: isoDateSchema.nullable(),
    documentType: z.string().min(1),
    documentTypeLabel: z.string().min(1),
    extractedAt: isoDateTimeSchema,
    financialRowCount: z.number().int().min(0),
    hash: documentHashSchema,
    pageCount: z.number().int().min(0).nullable(),
    period: periodReferenceSchema.nullable(),
    sourceCount: z.number().int().min(0),
    status: documentRecordStatusSchema,
    summaryPlain: z.string(),
    title: z.string().min(1),
  })
  .strict()
  .describe('Catalog item for a single indexed document.');

export const documentCatalogResponseSchema = z
  .object({
    availableTypes: z.array(documentCatalogTypeSchema),
    documents: z.array(documentCatalogItemSchema),
    generatedAt: isoDateTimeSchema,
    selectedDocumentType: z.string().min(1).nullable(),
  })
  .strict()
  .describe('Document catalog with optional type filtering.');

export const documentDetailPathParamsSchema = z
  .object({
    hash: documentHashSchema,
  })
  .strict()
  .describe('Path params for a document detail request.');

export const documentDetailKeyFactSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict()
  .describe('Key fact extracted from the canonical record.');

export const documentDetailQuantitySchema = z
  .object({
    unit: z.string().min(1),
    value: z.number(),
  })
  .strict()
  .describe('Optional normalized quantity extracted from a financial row.');

export const documentDetailFinancialRowSchema = z
  .object({
    amount: moneyAmountSchema,
    category: z.string().min(1),
    categoryGroup: z.string().min(1).nullable(),
    categoryGroupLabel: z.string().min(1),
    categoryLabel: z.string().min(1),
    note: z.string().nullable(),
    period: periodReferenceSchema.nullable(),
    quantity: documentDetailQuantitySchema.nullable(),
    rowType: z.string().min(1),
    rowTypeLabel: z.string().min(1),
    sourcePage: z.number().int().min(1).nullable(),
    unitPrice: moneyAmountSchema.nullable(),
  })
  .strict()
  .describe('Financial row extracted from the document with source-page provenance.');

export const documentDetailSourceFieldSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict()
  .describe('Human-readable source reference field.');

export const documentDetailSourceObservationSchema = z
  .object({
    originalFilename: z.string().min(1).nullable(),
    reference: z.array(documentDetailSourceFieldSchema),
    seenAt: isoDateTimeSchema,
    sourceKind: z.string().min(1),
    sourceKindLabel: z.string().min(1),
  })
  .strict()
  .describe('Source observation proving where the canonical document came from.');

export const documentDetailDocumentSchema = z
  .object({
    assetTag: z.string().min(1).nullable(),
    confidence: z.number().min(0).max(1),
    documentDate: isoDateSchema.nullable(),
    documentType: z.string().min(1),
    documentTypeLabel: z.string().min(1),
    extractedAt: isoDateTimeSchema,
    extractedBy: z.string().min(1),
    extractorVersion: z.string().min(1),
    financialRowCount: z.number().int().min(0),
    hash: documentHashSchema,
    hasTextLayer: z.boolean(),
    ingestedAt: isoDateTimeSchema,
    mime: z.string().min(1),
    needsOcr: z.boolean(),
    noteAvailable: z.boolean(),
    ocrStatus: z.string().min(1),
    pageCount: z.number().int().min(0).nullable(),
    period: periodReferenceSchema.nullable(),
    sizeBytes: z.number().int().min(0),
    sourceCount: z.number().int().min(0),
    status: documentRecordStatusSchema,
    summaryPlain: z.string(),
    title: z.string().min(1),
  })
  .strict()
  .describe('High-level document detail metadata and extraction state.');

export const documentDetailResponseSchema = z
  .object({
    document: documentDetailDocumentSchema,
    financialRows: z.array(documentDetailFinancialRowSchema),
    generatedAt: isoDateTimeSchema,
    keyFacts: z.array(documentDetailKeyFactSchema),
    questionsForUser: z.array(z.string().min(1)),
    sourceObservations: z.array(documentDetailSourceObservationSchema),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .describe('Document detail response with provenance and extracted evidence.');

export const documentsCatalogRoute = defineRoute({
  method: 'get',
  operationId: 'getDocuments',
  path: '/api/documents',
  query: documentCatalogQuerySchema,
  responses: {
    200: jsonResponse('Document catalog with optional type filtering.', documentCatalogResponseSchema, {
      schemaName: 'DocumentCatalogResponse',
    }),
  },
  summary: 'Get the indexed document catalog.',
  tags: ['documents'],
});

export const documentDetailRoute = defineRoute({
  method: 'get',
  operationId: 'getDocumentDetail',
  path: '/api/documents/{hash}',
  pathParams: documentDetailPathParamsSchema,
  responses: {
    200: jsonResponse('Document detail with provenance and extracted evidence.', documentDetailResponseSchema, {
      schemaName: 'DocumentDetailResponse',
    }),
    404: jsonResponse('Requested document was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Get document detail with provenance.',
  tags: ['documents'],
});

export const documentsRouteCatalog = {
  getDocumentDetail: documentDetailRoute,
  getDocuments: documentsCatalogRoute,
} as const;

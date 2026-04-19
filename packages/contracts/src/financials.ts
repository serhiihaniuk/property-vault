import { z } from 'zod';
import {
  apiProblemSchema,
  documentReferenceSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyAmountSchema,
  periodReferenceSchema,
} from './shared.ts';
import { defineRoute, jsonResponse } from './openapi.ts';

export const financialYearSchema = z
  .string()
  .regex(/^\d{4}$/, 'Expected a reporting year in YYYY format.')
  .describe('Reporting year in YYYY format.');

export const yearlyReconciliationStatusSchema = z
  .enum(['matched', 'due', 'credit', 'schedule_only'])
  .describe('Operator-facing status for a yearly reconciliation line.');

export const yearlyReconciliationCoverageStatusSchema = z
  .enum(['full_year', 'year_to_date', 'partial'])
  .describe('Coverage state for the selected reconciliation year.');

export const yearlyReconciliationCoverageSchema = z
  .object({
    monthsCovered: z.number().int().min(0).max(12),
    status: yearlyReconciliationCoverageStatusSchema,
    throughMonth: periodReferenceSchema.nullable(),
  })
  .strict()
  .describe('Month coverage and horizon for the selected reconciliation year.');

export const yearlyReconciliationSummarySchema = z
  .object({
    actualCostTotal: moneyAmountSchema.nullable(),
    creditsTotal: moneyAmountSchema.nullable(),
    netBalance: moneyAmountSchema.nullable(),
    openLineCount: z.number().int().min(0),
    scheduledTotal: moneyAmountSchema,
    settledLineCount: z.number().int().min(0),
    settlementAdvanceTotal: moneyAmountSchema.nullable(),
  })
  .strict()
  .describe('Headline totals for the selected yearly reconciliation view.');

export const yearlyReconciliationLineSchema = z
  .object({
    actualCostAmount: moneyAmountSchema.nullable(),
    category: z.string().min(1),
    categoryLabel: z.string().min(1),
    coverageMonths: z.number().int().min(0).max(12),
    creditsAmount: moneyAmountSchema.nullable(),
    netBalance: moneyAmountSchema.nullable(),
    scheduleDelta: moneyAmountSchema.nullable(),
    scheduleDocuments: z.array(documentReferenceSchema),
    scheduledAmount: moneyAmountSchema,
    settlementAdvanceAmount: moneyAmountSchema.nullable(),
    settlementDocuments: z.array(documentReferenceSchema),
    status: yearlyReconciliationStatusSchema,
    statusLabel: z.string().min(1),
  })
  .strict()
  .describe(
    'One yearly reconciliation line comparing carried-forward scheduled charges against settlement evidence.',
  );

export const yearlyReconciliationResponseSchema = z
  .object({
    availableYears: z.array(periodReferenceSchema),
    coverage: yearlyReconciliationCoverageSchema,
    generatedAt: isoDateTimeSchema,
    lines: z.array(yearlyReconciliationLineSchema),
    selectedYear: periodReferenceSchema.nullable(),
    summary: yearlyReconciliationSummarySchema.nullable(),
  })
  .strict()
  .describe('Yearly reconciliation totals, line items, and available reporting years.');

export const yearlyReconciliationQuerySchema = z
  .object({
    year: financialYearSchema.optional(),
  })
  .strict()
  .describe('Optional selected reconciliation year.');

export const anomalySeveritySchema = z
  .enum(['critical', 'warning', 'info'])
  .describe('Normalized anomaly severity.');

export const anomalyStatusSchema = z
  .enum(['open', 'resolved'])
  .describe('Normalized anomaly workflow status.');

export const anomalyContextFieldSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict()
  .describe('Compact anomaly context field for operator review.');

export const anomalySeverityCountSchema = z
  .object({
    count: z.number().int().min(0),
    severity: anomalySeveritySchema,
  })
  .strict()
  .describe('Open anomaly count for a single severity bucket.');

export const anomalyFeedItemSchema = z
  .object({
    context: z.array(anomalyContextFieldSchema),
    date: isoDateSchema.nullable(),
    detectedAt: isoDateTimeSchema,
    id: z.number().int().min(1),
    ruleId: z.string().min(1),
    ruleLabel: z.string().min(1),
    severity: anomalySeveritySchema,
    severityLabel: z.string().min(1),
    status: anomalyStatusSchema,
    subjectDocument: documentReferenceSchema.nullable(),
    summary: z.string().min(1),
  })
  .strict()
  .describe('Normalized open anomaly item with optional linked document context.');

export const anomalyFeedResponseSchema = z
  .object({
    anomalies: z.array(anomalyFeedItemSchema),
    countsBySeverity: z.array(anomalySeverityCountSchema),
    generatedAt: isoDateTimeSchema,
    openCount: z.number().int().min(0),
  })
  .strict()
  .describe('Open anomaly counts plus normalized anomaly feed items.');

export const yearlyReconciliationRoute = defineRoute({
  method: 'get',
  operationId: 'getYearlyReconciliation',
  path: '/api/financials/year-reconciliation',
  query: yearlyReconciliationQuerySchema,
  responses: {
    200: jsonResponse(
      'Yearly reconciliation totals and anomaly-aware financial comparison.',
      yearlyReconciliationResponseSchema,
      {
        schemaName: 'YearlyReconciliationResponse',
      },
    ),
    404: jsonResponse(
      'Requested reconciliation year was not found.',
      apiProblemSchema,
      {
        schemaName: 'ApiProblem',
      },
    ),
  },
  summary: 'Get yearly reconciliation totals and line items.',
  tags: ['financials'],
});

export const openAnomalyFeedRoute = defineRoute({
  method: 'get',
  operationId: 'getOpenAnomalies',
  path: '/api/anomalies',
  responses: {
    200: jsonResponse('Open anomalies for operator review.', anomalyFeedResponseSchema, {
      schemaName: 'AnomalyFeedResponse',
    }),
  },
  summary: 'Get open anomalies.',
  tags: ['anomalies'],
});

export const financialsRouteCatalog = {
  getOpenAnomalies: openAnomalyFeedRoute,
  getYearlyReconciliation: yearlyReconciliationRoute,
} as const;

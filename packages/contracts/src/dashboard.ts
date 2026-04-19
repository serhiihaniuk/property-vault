import { z } from 'zod';
import {
  apiProblemSchema,
  documentReferenceSchema,
  isoDateTimeSchema,
  moneyAmountSchema,
  periodReferenceSchema,
} from './shared.ts';
import { defineRoute, jsonResponse } from './openapi.ts';

export const dashboardMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Expected a reporting month in YYYY-MM format.')
  .describe('Reporting month in YYYY-MM format.');

export const dashboardMonthChangeStatusSchema = z
  .enum(['up', 'down', 'flat', 'new', 'no_previous'])
  .describe('Month-over-month change status for a dashboard metric.');

export const dashboardMonthHistoryItemSchema = z
  .object({
    isCarriedForward: z.boolean(),
    period: periodReferenceSchema,
    sourceDocuments: z.array(documentReferenceSchema),
    sourceMonth: periodReferenceSchema,
    totalCharges: moneyAmountSchema,
  })
  .strict()
  .describe(
    'Monthly dashboard total for a selectable reporting period, including the source schedule month and provenance.',
  );

export const dashboardMonthLargestCategorySchema = z
  .object({
    amount: moneyAmountSchema,
    category: z.string().min(1),
    categoryLabel: z.string().min(1),
  })
  .strict()
  .describe('Largest category in the selected dashboard month.');

export const dashboardMonthTopChangeSchema = z
  .object({
    category: z.string().min(1),
    categoryLabel: z.string().min(1),
    changeStatus: dashboardMonthChangeStatusSchema,
    delta: moneyAmountSchema,
  })
  .strict()
  .describe('Largest category change between the selected and previous dashboard month.');

export const dashboardMonthSummarySchema = z
  .object({
    categoryCount: z.number().int().min(0),
    changedCategoryCount: z.number().int().min(0),
    largestCategory: dashboardMonthLargestCategorySchema.nullable(),
    previousTotalCharges: moneyAmountSchema.nullable(),
    topChange: dashboardMonthTopChangeSchema.nullable(),
    totalCharges: moneyAmountSchema,
    totalDelta: moneyAmountSchema.nullable(),
  })
  .strict()
  .describe('Headline dashboard summary metrics for the selected month.');

export const dashboardMonthBreakdownItemSchema = z
  .object({
    amount: moneyAmountSchema,
    category: z.string().min(1),
    categoryGroup: z.string().min(1).nullable(),
    categoryGroupLabel: z.string().min(1),
    categoryLabel: z.string().min(1),
    changeStatus: dashboardMonthChangeStatusSchema,
    delta: moneyAmountSchema.nullable(),
    previousAmount: moneyAmountSchema.nullable(),
    sharePercent: z.number().min(0).max(100),
    sourceDocuments: z.array(documentReferenceSchema),
  })
  .strict()
  .describe('Normalized category breakdown row for the selected dashboard month.');

export const dashboardMonthBreakdownResponseSchema = z
  .object({
    breakdown: z.array(dashboardMonthBreakdownItemSchema),
    generatedAt: isoDateTimeSchema,
    months: z.array(dashboardMonthHistoryItemSchema),
    previousMonth: periodReferenceSchema.nullable(),
    selectedMonth: periodReferenceSchema.nullable(),
    summary: dashboardMonthSummarySchema.nullable(),
    supportingDocuments: z.array(documentReferenceSchema),
  })
  .strict()
  .describe('Dashboard month summary, history, and normalized category breakdown.');

export const dashboardMonthBreakdownQuerySchema = z
  .object({
    month: dashboardMonthSchema.optional(),
  })
  .strict()
  .describe('Optional selected dashboard month.');

export const dashboardMonthBreakdownRoute = defineRoute({
  method: 'get',
  operationId: 'getDashboardMonthBreakdown',
  path: '/api/dashboard/month-breakdown',
  query: dashboardMonthBreakdownQuerySchema,
  responses: {
    200: jsonResponse(
      'Dashboard month summary and normalized category breakdown.',
      dashboardMonthBreakdownResponseSchema,
      {
        schemaName: 'DashboardMonthBreakdownResponse',
      },
    ),
    404: jsonResponse('Requested dashboard month was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Get dashboard month summary and category breakdown.',
  tags: ['dashboard'],
});

export const dashboardRouteCatalog = {
  getDashboardMonthBreakdown: dashboardMonthBreakdownRoute,
} as const;

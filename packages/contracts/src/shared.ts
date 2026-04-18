import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date in YYYY-MM-DD format.')
  .describe('ISO 8601 calendar date.');

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe('ISO 8601 timestamp with timezone offset.');

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Expected a three-letter ISO currency code.')
  .describe('Three-letter ISO currency code.');

export const moneyAmountSchema = z
  .object({
    amountMinor: z
      .number()
      .int()
      .describe('Integer amount in grosz or other currency minor unit.'),
    currency: currencyCodeSchema,
  })
  .strict()
  .describe('Monetary amount stored as minor units.');

export const periodKindSchema = z
  .enum(['month', 'quarter', 'year', 'custom'])
  .describe('Supported aggregation period kinds.');

export const periodReferenceSchema = z
  .object({
    kind: periodKindSchema,
    label: z.string().min(1).describe('Human-readable period label.'),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    value: z.string().min(1).optional(),
  })
  .strict()
  .describe('Normalized reporting period reference.');

export const documentReferenceSchema = z
  .object({
    hash: z.string().min(1).describe('Canonical document hash.'),
    title: z.string().min(1).describe('Display title for the document.'),
    documentType: z.string().min(1).describe('Normalized document type.'),
    documentDate: isoDateSchema.nullable().optional(),
  })
  .strict()
  .describe('Reference to a canonical source document.');

export const paginationMetaSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict()
  .describe('Pagination metadata for list endpoints.');

export const apiProblemSchema = z
  .object({
    type: z.string().min(1).describe('Problem type identifier.'),
    title: z.string().min(1).describe('Short human-readable error summary.'),
    status: z.number().int().min(100).max(599),
    detail: z.string().min(1).optional(),
    instance: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
  })
  .strict()
  .describe('RFC 7807-style API problem details payload.');

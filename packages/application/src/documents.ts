import {
  documentCatalogQuerySchema,
  documentCatalogResponseSchema,
  documentRecordStatusSchema,
  documentDetailResponseSchema,
} from '@dabrowskiego/contracts';
import {
  vaultDocumentSources,
  vaultDocuments,
  vaultFinancialRows,
  vaultRecords,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { eq, inArray, sql } from 'drizzle-orm';
import type { PropertyVaultApplicationContext } from './context.ts';
import { createMoneyAmount, createPeriodReference } from './shared.ts';

const CATEGORY_LABELS: Record<string, string> = {
  central_heating_energy: 'Central heating energy',
  cold_water_and_sewage: 'Cold water and sewage',
  e_kartoteka_access: 'e-Kartoteka access',
  hot_water_heating: 'Hot water heating',
  municipal_waste: 'Municipal waste',
  ordered_heating_power: 'Ordered heating power',
  renovation_investment_fund: 'Renovation and investment fund',
  shared_property_advance: 'Shared property advance',
};

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  funds: 'Funds',
  individual: 'Individual',
  media: 'Media',
  media_settlement: 'Media settlement',
  shared_property: 'Shared property',
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  account_statement: 'Account statement',
  correspondence: 'Correspondence',
  interest_note: 'Interest note',
  media_settlement: 'Media settlement',
  meeting_notice: 'Meeting notice',
  monthly_charges: 'Monthly charges',
  other: 'Other',
  resolution: 'Resolution',
  service_notice: 'Service notice',
  shared_property_settlement: 'Shared property settlement',
};

const ROW_TYPE_LABELS: Record<string, string> = {
  balance: 'Balance',
  charge: 'Charge',
  credit: 'Credit',
  debit: 'Debit',
  interest: 'Interest',
  payment: 'Payment',
  settlement: 'Settlement',
};

const ROW_TYPE_ORDER: Record<string, number> = {
  charge: 0,
  settlement: 1,
  payment: 2,
  credit: 3,
  debit: 4,
  interest: 5,
  balance: 6,
};

type DocumentsCatalogQuery = ReturnType<typeof documentCatalogQuerySchema.parse>;
type DocumentsCatalogResponse = ReturnType<typeof documentCatalogResponseSchema.parse>;
type DocumentCatalogItem = DocumentsCatalogResponse['documents'][number];
type DocumentCatalogType = DocumentsCatalogResponse['availableTypes'][number];
type DocumentDetailResponse = ReturnType<typeof documentDetailResponseSchema.parse>;
type DocumentDetail = DocumentDetailResponse['document'];
type DocumentFinancialRow = DocumentDetailResponse['financialRows'][number];
type DocumentSourceObservation = DocumentDetailResponse['sourceObservations'][number];
type DocumentKeyFact = DocumentDetailResponse['keyFacts'][number];

type CatalogBaseRow = {
  assetTag: string | null;
  confidence: number;
  documentDate: string | null;
  documentType: string;
  extractedAt: string;
  hash: string;
  pageCount: number | null;
  periodEnd: string | null;
  periodKind: string;
  periodStart: string | null;
  periodValue: string | null;
  status: string;
  summaryPlain: string;
  title: string;
};

type DocumentDetailRow = {
  assetTag: string | null;
  confidence: number;
  documentDate: string | null;
  documentType: string;
  extractedAt: string;
  extractedBy: string;
  extractorVersion: string;
  hasTextLayer: boolean;
  hash: string;
  ingestedAt: string;
  mime: string;
  needsOcr: boolean;
  notePath: string | null;
  ocrStatus: string;
  pageCount: number | null;
  periodEnd: string | null;
  periodKind: string;
  periodStart: string | null;
  periodValue: string | null;
  recordJson: unknown;
  sizeBytes: number;
  status: string;
  summaryPlain: string;
  title: string;
};

type DocumentFinancialRowRecord = {
  amountMinor: number;
  category: string;
  categoryGroup: string | null;
  note: string | null;
  periodEnd: string | null;
  periodKind: string;
  periodStart: string | null;
  periodValue: string | null;
  quantityUnit: string | null;
  quantityValue: number | null;
  rowType: string;
  sourcePage: number | null;
  unitPriceMinor: number | null;
};

type DocumentSourceRow = {
  originalFilename: string | null;
  seenAt: string;
  sourceKind: string;
  sourceRef: string;
};

type DocumentCountRow = {
  count: number;
  hash: string;
};

type DocumentTypeRow = {
  count: number;
  documentType: string;
};

type ParsedRecordDetails = {
  keyFacts: DocumentKeyFact[];
  questionsForUser: string[];
  warnings: string[];
};

type DocumentsDependencies = {
  loadCatalogBaseRows: typeof loadCatalogBaseRows;
  loadDocumentDetailRow: typeof loadDocumentDetailRow;
  loadDocumentFinancialCounts: typeof loadDocumentFinancialCounts;
  loadDocumentFinancialRows: typeof loadDocumentFinancialRows;
  loadDocumentSourceCounts: typeof loadDocumentSourceCounts;
  loadDocumentSourceRows: typeof loadDocumentSourceRows;
  loadDocumentTypes: typeof loadDocumentTypes;
};

const defaultDocumentsDependencies: DocumentsDependencies = {
  loadCatalogBaseRows,
  loadDocumentDetailRow,
  loadDocumentFinancialCounts,
  loadDocumentFinancialRows,
  loadDocumentSourceCounts,
  loadDocumentSourceRows,
  loadDocumentTypes,
};

export interface DocumentsApplicationService {
  getCatalog: (
    query?: DocumentsCatalogQuery,
  ) => Promise<DocumentsCatalogResponse>;
  getDetail: (hash: string) => Promise<DocumentDetailResponse>;
}

export class DocumentNotFoundError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(`Document "${hash}" was not found.`);
    this.name = 'DocumentNotFoundError';
    this.hash = hash;
  }
}

export function createDocumentsApplicationService(
  context: PropertyVaultApplicationContext,
  dependencies: DocumentsDependencies = defaultDocumentsDependencies,
): DocumentsApplicationService {
  return {
    async getCatalog(query = {}) {
      const db = requireDatabase(context.db);
      const [catalogRows, availableTypes] = await Promise.all([
        dependencies.loadCatalogBaseRows(db, query.documentType),
        dependencies.loadDocumentTypes(db),
      ]);
      const hashes = catalogRows.map((row) => row.hash);
      const [sourceCountRows, financialCountRows] = await Promise.all([
        dependencies.loadDocumentSourceCounts(db, hashes),
        dependencies.loadDocumentFinancialCounts(db, hashes),
      ]);
      const sourceCounts = new Map(sourceCountRows.map((row) => [row.hash, row.count]));
      const financialCounts = new Map(
        financialCountRows.map((row) => [row.hash, row.count]),
      );

      return documentCatalogResponseSchema.parse({
        availableTypes: availableTypes
          .map((row) => ({
            count: row.count,
            documentType: row.documentType,
            label: formatDocumentTypeLabel(row.documentType),
          }))
          .sort(compareDocumentTypes),
        documents: catalogRows
          .map((row) =>
            createDocumentCatalogItem({
              financialRowCount: financialCounts.get(row.hash) ?? 0,
              row,
              sourceCount: sourceCounts.get(row.hash) ?? 0,
            }),
          )
          .sort(compareDocumentCatalogItems),
        generatedAt: context.now().toISOString(),
        selectedDocumentType: query.documentType ?? null,
      });
    },
    async getDetail(hash) {
      const db = requireDatabase(context.db);
      const detailRow = await dependencies.loadDocumentDetailRow(db, hash);

      if (!detailRow) {
        throw new DocumentNotFoundError(hash);
      }

      const [financialRows, sourceRows] = await Promise.all([
        dependencies.loadDocumentFinancialRows(db, hash),
        dependencies.loadDocumentSourceRows(db, hash),
      ]);
      const recordDetails = parseRecordDetails(detailRow.recordJson);
      const detail = createDocumentDetail(detailRow, {
        financialRowCount: financialRows.length,
        sourceCount: sourceRows.length,
      });

      return documentDetailResponseSchema.parse({
        document: detail,
        financialRows: financialRows.map(createDocumentFinancialRow).sort(compareFinancialRows),
        generatedAt: context.now().toISOString(),
        keyFacts: recordDetails.keyFacts,
        questionsForUser: recordDetails.questionsForUser,
        sourceObservations: sourceRows
          .map(createDocumentSourceObservation)
          .sort(compareSourceObservations),
        warnings: recordDetails.warnings,
      });
    },
  };
}

async function loadCatalogBaseRows(
  db: PropertyVaultDatabase,
  documentType: string | undefined,
): Promise<CatalogBaseRow[]> {
  const baseQuery = db
    .select({
      assetTag: vaultDocuments.assetTag,
      confidence: vaultRecords.confidence,
      documentDate: vaultRecords.documentDate,
      documentType: vaultRecords.documentType,
      extractedAt: vaultRecords.extractedAt,
      hash: vaultDocuments.hash,
      pageCount: vaultDocuments.pageCount,
      periodEnd: vaultRecords.periodEnd,
      periodKind: vaultRecords.periodKind,
      periodStart: vaultRecords.periodStart,
      periodValue: vaultRecords.periodValue,
      status: vaultRecords.status,
      summaryPlain: vaultRecords.summaryPlain,
      title: vaultRecords.title,
    })
    .from(vaultDocuments)
    .innerJoin(vaultRecords, eq(vaultRecords.hash, vaultDocuments.hash));

  const rows = documentType
    ? await baseQuery.where(eq(vaultRecords.documentType, documentType))
    : await baseQuery;

  return rows;
}

async function loadDocumentSourceCounts(
  db: PropertyVaultDatabase,
  hashes: readonly string[],
): Promise<DocumentCountRow[]> {
  if (hashes.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      count: sql<string | number>`count(*)`,
      hash: vaultDocumentSources.hash,
    })
    .from(vaultDocumentSources)
    .where(inArray(vaultDocumentSources.hash, [...hashes]))
    .groupBy(vaultDocumentSources.hash);

  return rows.map((row) => ({
    count: Number(row.count ?? 0),
    hash: row.hash,
  }));
}

async function loadDocumentFinancialCounts(
  db: PropertyVaultDatabase,
  hashes: readonly string[],
): Promise<DocumentCountRow[]> {
  if (hashes.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      count: sql<string | number>`count(*)`,
      hash: vaultFinancialRows.hash,
    })
    .from(vaultFinancialRows)
    .where(inArray(vaultFinancialRows.hash, [...hashes]))
    .groupBy(vaultFinancialRows.hash);

  return rows.map((row) => ({
    count: Number(row.count ?? 0),
    hash: row.hash,
  }));
}

async function loadDocumentTypes(
  db: PropertyVaultDatabase,
): Promise<DocumentTypeRow[]> {
  const rows = await db
    .select({
      count: sql<string | number>`count(*)`,
      documentType: vaultRecords.documentType,
    })
    .from(vaultRecords)
    .groupBy(vaultRecords.documentType);

  return rows.map((row) => ({
    count: Number(row.count ?? 0),
    documentType: row.documentType,
  }));
}

async function loadDocumentDetailRow(
  db: PropertyVaultDatabase,
  hash: string,
): Promise<DocumentDetailRow | null> {
  const rows = await db
    .select({
      assetTag: vaultDocuments.assetTag,
      confidence: vaultRecords.confidence,
      documentDate: vaultRecords.documentDate,
      documentType: vaultRecords.documentType,
      extractedAt: vaultRecords.extractedAt,
      extractedBy: vaultRecords.extractedBy,
      extractorVersion: vaultRecords.extractorVersion,
      hash: vaultDocuments.hash,
      hasTextLayer: vaultDocuments.hasTextLayer,
      ingestedAt: vaultDocuments.ingestedAt,
      mime: vaultDocuments.mime,
      needsOcr: vaultDocuments.needsOcr,
      notePath: vaultRecords.notePath,
      ocrStatus: vaultDocuments.ocrStatus,
      pageCount: vaultDocuments.pageCount,
      periodEnd: vaultRecords.periodEnd,
      periodKind: vaultRecords.periodKind,
      periodStart: vaultRecords.periodStart,
      periodValue: vaultRecords.periodValue,
      recordJson: vaultRecords.recordJson,
      sizeBytes: vaultDocuments.sizeBytes,
      status: vaultRecords.status,
      summaryPlain: vaultRecords.summaryPlain,
      title: vaultRecords.title,
    })
    .from(vaultDocuments)
    .innerJoin(vaultRecords, eq(vaultRecords.hash, vaultDocuments.hash))
    .where(eq(vaultDocuments.hash, hash))
    .limit(1);

  return rows[0] ?? null;
}

async function loadDocumentFinancialRows(
  db: PropertyVaultDatabase,
  hash: string,
): Promise<DocumentFinancialRowRecord[]> {
  return db
    .select({
      amountMinor: vaultFinancialRows.amountMinor,
      category: vaultFinancialRows.category,
      categoryGroup: vaultFinancialRows.categoryGroup,
      note: vaultFinancialRows.note,
      periodEnd: vaultFinancialRows.periodEnd,
      periodKind: vaultFinancialRows.periodKind,
      periodStart: vaultFinancialRows.periodStart,
      periodValue: vaultFinancialRows.periodValue,
      quantityUnit: vaultFinancialRows.quantityUnit,
      quantityValue: vaultFinancialRows.quantityValue,
      rowType: vaultFinancialRows.rowType,
      sourcePage: vaultFinancialRows.sourcePage,
      unitPriceMinor: vaultFinancialRows.unitPriceMinor,
    })
    .from(vaultFinancialRows)
    .where(eq(vaultFinancialRows.hash, hash));
}

async function loadDocumentSourceRows(
  db: PropertyVaultDatabase,
  hash: string,
): Promise<DocumentSourceRow[]> {
  return db
    .select({
      originalFilename: vaultDocumentSources.originalFilename,
      seenAt: vaultDocumentSources.seenAt,
      sourceKind: vaultDocumentSources.sourceKind,
      sourceRef: vaultDocumentSources.sourceRef,
    })
    .from(vaultDocumentSources)
    .where(eq(vaultDocumentSources.hash, hash));
}

function createDocumentCatalogItem(input: {
  financialRowCount: number;
  row: CatalogBaseRow;
  sourceCount: number;
}): DocumentCatalogItem {
  return {
    assetTag: input.row.assetTag,
    confidence: input.row.confidence,
    documentDate: input.row.documentDate,
    documentType: input.row.documentType,
    documentTypeLabel: formatDocumentTypeLabel(input.row.documentType),
    extractedAt: normalizeIsoDateTime(input.row.extractedAt),
    financialRowCount: input.financialRowCount,
    hash: input.row.hash,
    pageCount: input.row.pageCount,
    period: createStoredPeriodReference(input.row),
    sourceCount: input.sourceCount,
    status: parseDocumentRecordStatus(input.row.status),
    summaryPlain: input.row.summaryPlain,
    title: input.row.title,
  };
}

function createDocumentDetail(
  row: DocumentDetailRow,
  counts: {
    financialRowCount: number;
    sourceCount: number;
  },
): DocumentDetail {
  return {
    assetTag: row.assetTag,
    confidence: row.confidence,
    documentDate: row.documentDate,
    documentType: row.documentType,
    documentTypeLabel: formatDocumentTypeLabel(row.documentType),
    extractedAt: normalizeIsoDateTime(row.extractedAt),
    extractedBy: row.extractedBy,
    extractorVersion: row.extractorVersion,
    financialRowCount: counts.financialRowCount,
    hash: row.hash,
    hasTextLayer: row.hasTextLayer,
    ingestedAt: normalizeIsoDateTime(row.ingestedAt),
    mime: row.mime,
    needsOcr: row.needsOcr,
    noteAvailable: Boolean(row.notePath),
    ocrStatus: row.ocrStatus,
    pageCount: row.pageCount,
    period: createStoredPeriodReference(row),
    sizeBytes: row.sizeBytes,
    sourceCount: counts.sourceCount,
    status: parseDocumentRecordStatus(row.status),
    summaryPlain: row.summaryPlain,
    title: row.title,
  };
}

function createDocumentFinancialRow(
  row: DocumentFinancialRowRecord,
): DocumentFinancialRow {
  return {
    amount: createMoneyAmount({ amountMinor: row.amountMinor }),
    category: row.category,
    categoryGroup: row.categoryGroup,
    categoryGroupLabel: formatCategoryGroupLabel(row.categoryGroup),
    categoryLabel: formatCategoryLabel(row.category),
    note: row.note,
    period: createStoredPeriodReference(row),
    quantity:
      row.quantityValue === null || row.quantityUnit === null
        ? null
        : {
            unit: row.quantityUnit,
            value: row.quantityValue,
          },
    rowType: row.rowType,
    rowTypeLabel: formatRowTypeLabel(row.rowType),
    sourcePage: row.sourcePage,
    unitPrice:
      row.unitPriceMinor === null
        ? null
        : createMoneyAmount({ amountMinor: row.unitPriceMinor }),
  };
}

function createDocumentSourceObservation(
  row: DocumentSourceRow,
): DocumentSourceObservation {
  return {
    originalFilename: row.originalFilename,
    reference: createSourceReferenceFields(row.sourceRef),
    seenAt: normalizeIsoDateTime(row.seenAt),
    sourceKind: row.sourceKind,
    sourceKindLabel: formatSourceKindLabel(row.sourceKind),
  };
}

function parseRecordDetails(recordJson: unknown): ParsedRecordDetails {
  if (!isPlainRecord(recordJson)) {
    return {
      keyFacts: [],
      questionsForUser: [],
      warnings: [],
    };
  }

  return {
    keyFacts: readKeyFacts(recordJson.key_facts),
    questionsForUser: readStringArray(recordJson.questions_for_user),
    warnings: readStringArray(recordJson.warnings),
  };
}

function readKeyFacts(value: unknown): DocumentKeyFact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const factValue = typeof entry.value === 'string' ? entry.value.trim() : '';

    if (label === '' || factValue === '') {
      return [];
    }

    return [
      {
        label,
        value: factValue,
      },
    ];
  });
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function createSourceReferenceFields(sourceRef: string): DocumentSourceObservation['reference'] {
  const parsed = parseJsonRecord(sourceRef);
  const entries = Object.entries(parsed).sort(([left], [right]) => left.localeCompare(right));

  return entries.map(([key, value]) => ({
    label: formatSourceReferenceLabel(key),
    value: stringifySourceReferenceValue(value),
  }));
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifySourceReferenceValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifySourceReferenceValue(item)).join(', ');
  }

  if (isPlainRecord(value)) {
    return JSON.stringify(sortJson(value));
  }

  return String(value);
}

function createStoredPeriodReference(input: {
  periodEnd: string | null;
  periodKind: string;
  periodStart: string | null;
  periodValue: string | null;
}) {
  if (input.periodKind === 'month' && input.periodValue) {
    return createPeriodReference({
      kind: 'month',
      label: formatMonthLabel(input.periodValue),
      value: input.periodValue,
    });
  }

  if (input.periodKind === 'year' && input.periodValue) {
    return createPeriodReference({
      kind: 'year',
      label: input.periodValue,
      value: input.periodValue,
    });
  }

  if (input.periodKind === 'range' && input.periodStart && input.periodEnd) {
    return createPeriodReference({
      endDate: input.periodEnd,
      kind: 'custom',
      label: `${formatDateLabel(input.periodStart)} - ${formatDateLabel(input.periodEnd)}`,
      startDate: input.periodStart,
    });
  }

  return null;
}

function compareDocumentCatalogItems(
  left: DocumentCatalogItem,
  right: DocumentCatalogItem,
): number {
  return (
    compareNullableDates(right.documentDate, left.documentDate) ||
    right.extractedAt.localeCompare(left.extractedAt) ||
    left.title.localeCompare(right.title)
  );
}

function compareDocumentTypes(
  left: DocumentCatalogType,
  right: DocumentCatalogType,
): number {
  return right.count - left.count || left.label.localeCompare(right.label);
}

function compareFinancialRows(
  left: DocumentFinancialRow,
  right: DocumentFinancialRow,
): number {
  return (
    resolveRowTypeOrder(left.rowType) - resolveRowTypeOrder(right.rowType) ||
    right.amount.amountMinor - left.amount.amountMinor ||
    left.categoryLabel.localeCompare(right.categoryLabel)
  );
}

function compareSourceObservations(
  left: DocumentSourceObservation,
  right: DocumentSourceObservation,
): number {
  return (
    right.seenAt.localeCompare(left.seenAt) ||
    left.sourceKindLabel.localeCompare(right.sourceKindLabel)
  );
}

function compareNullableDates(left: string | null, right: string | null): number {
  if (left && right) {
    return left.localeCompare(right);
  }

  if (left) {
    return 1;
  }

  if (right) {
    return -1;
  }

  return 0;
}

function resolveRowTypeOrder(rowType: string): number {
  return ROW_TYPE_ORDER[rowType] ?? Number.MAX_SAFE_INTEGER;
}

function formatMonthLabel(periodValue: string): string {
  const date = new Date(`${periodValue}-01T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return periodValue;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function formatDocumentTypeLabel(documentType: string): string {
  return DOCUMENT_TYPE_LABELS[documentType] ?? humanizeIdentifier(documentType);
}

function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanizeIdentifier(category);
}

function formatCategoryGroupLabel(categoryGroup: string | null): string {
  if (!categoryGroup) {
    return 'Uncategorized';
  }

  return CATEGORY_GROUP_LABELS[categoryGroup] ?? humanizeIdentifier(categoryGroup);
}

function formatRowTypeLabel(rowType: string): string {
  return ROW_TYPE_LABELS[rowType] ?? humanizeIdentifier(rowType);
}

function formatSourceKindLabel(sourceKind: string): string {
  return humanizeIdentifier(sourceKind);
}

function formatSourceReferenceLabel(key: string): string {
  return humanizeIdentifier(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2'));
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeIsoDateTime(value: string): string {
  const normalized = new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return value;
  }

  return normalized.toISOString();
}

function parseDocumentRecordStatus(value: string): DocumentDetail['status'] {
  return documentRecordStatusSchema.parse(value);
}

function sortJson(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [
        key,
        Array.isArray(entryValue)
          ? entryValue
          : isPlainRecord(entryValue)
            ? sortJson(entryValue)
            : entryValue,
      ]),
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireDatabase(
  db: PropertyVaultDatabase | undefined,
): PropertyVaultDatabase {
  if (!db) {
    throw new Error('Documents application service requires a configured database.');
  }

  return db;
}

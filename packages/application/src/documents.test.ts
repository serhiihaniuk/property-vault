import assert from 'node:assert/strict';
import test from 'node:test';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import { createPropertyVaultApplicationContext } from './context.ts';
import {
  createDocumentsApplicationService,
  DocumentNotFoundError,
} from './documents.ts';

test('documents service returns the catalog with type filters and provenance counts', async () => {
  const documents = createDocumentsApplicationService(createDocumentsContext(), {
    async loadCatalogBaseRows(_db, documentType) {
      return CATALOG_ROWS.filter(
        (row) => !documentType || row.documentType === documentType,
      );
    },
    async loadDocumentDetailRow() {
      return null;
    },
    async loadDocumentFinancialCounts(_db, hashes) {
      return hashes.map((hash) => ({
        count: hash === 'a'.repeat(64) ? 3 : 1,
        hash,
      }));
    },
    async loadDocumentFinancialRows() {
      return [];
    },
    async loadDocumentSourceCounts(_db, hashes) {
      return hashes.map((hash) => ({
        count: hash === 'a'.repeat(64) ? 2 : 1,
        hash,
      }));
    },
    async loadDocumentSourceRows() {
      return [];
    },
    async loadDocumentTypes() {
      return [
        {
          count: 1,
          documentType: 'resolution',
        },
        {
          count: 2,
          documentType: 'monthly_charges',
        },
      ];
    },
  });

  const catalog = await documents.getCatalog({
    documentType: 'monthly_charges',
  });

  assert.equal(catalog.selectedDocumentType, 'monthly_charges');
  assert.equal(catalog.availableTypes[0]?.documentType, 'monthly_charges');
  assert.equal(catalog.availableTypes[0]?.label, 'Monthly charges');
  assert.equal(catalog.documents.length, 1);
  assert.deepEqual(catalog.documents[0], {
    assetTag: 'unit-12',
    confidence: 0.98,
    documentDate: '2026-04-01',
    documentType: 'monthly_charges',
    documentTypeLabel: 'Monthly charges',
    extractedAt: '2026-04-18T08:00:00.000Z',
    financialRowCount: 3,
    hash: 'a'.repeat(64),
    pageCount: 2,
    period: {
      kind: 'month',
      label: 'April 2026',
      value: '2026-04',
    },
    sourceCount: 2,
    status: 'ok',
    summaryPlain: 'Monthly housing charges for April 2026.',
    title: 'April 2026 monthly charges',
  });
});

test('documents service returns detail provenance and extracted facts', async () => {
  const documents = createDocumentsApplicationService(createDocumentsContext(), {
    async loadCatalogBaseRows() {
      return [];
    },
    async loadDocumentDetailRow() {
      return DETAIL_ROW;
    },
    async loadDocumentFinancialCounts() {
      return [];
    },
    async loadDocumentFinancialRows() {
      return [...DETAIL_FINANCIAL_ROWS];
    },
    async loadDocumentSourceCounts() {
      return [];
    },
    async loadDocumentSourceRows() {
      return [...DETAIL_SOURCE_ROWS];
    },
    async loadDocumentTypes() {
      return [];
    },
  });

  const detail = await documents.getDetail('a'.repeat(64));

  assert.equal(detail.document.documentTypeLabel, 'Monthly charges');
  assert.equal(detail.document.sourceCount, 2);
  assert.equal(detail.document.financialRowCount, 2);
  assert.equal(detail.document.noteAvailable, true);
  assert.deepEqual(detail.keyFacts, [
    {
      label: 'Amount due',
      value: 'PLN 347.91',
    },
    {
      label: 'Due date',
      value: '2026-04-15',
    },
  ]);
  assert.deepEqual(detail.questionsForUser, ['Confirm whether the parking surcharge still applies.']);
  assert.deepEqual(detail.warnings, ['Portal screenshot includes login hints but the value was redacted.']);
  assert.equal(detail.sourceObservations[0]?.sourceKindLabel, 'Portal Download');
  assert.deepEqual(detail.sourceObservations[0]?.reference, [
    {
      label: 'Portal',
      value: 'e-kartoteka',
    },
    {
      label: 'Section',
      value: 'charges',
    },
  ]);
  assert.equal(detail.financialRows[0]?.rowType, 'charge');
  assert.equal(detail.financialRows[0]?.sourcePage, 1);
  assert.deepEqual(detail.financialRows[0]?.period, {
    kind: 'month',
    label: 'April 2026',
    value: '2026-04',
  });
  assert.deepEqual(detail.financialRows[1]?.period, {
    endDate: '2026-03-31',
    kind: 'custom',
    label: 'Mar 1, 2026 - Mar 31, 2026',
    startDate: '2026-03-01',
  });
});

test('documents service normalizes postgres timestamp strings in catalog and detail responses', async () => {
  const documents = createDocumentsApplicationService(createDocumentsContext(), {
    async loadCatalogBaseRows() {
      return [
        {
          ...CATALOG_ROWS[0],
          extractedAt: '2026-04-18 08:00:00+00',
        },
      ];
    },
    async loadDocumentDetailRow() {
      return {
        ...DETAIL_ROW,
        extractedAt: '2026-04-18 08:00:00+00',
        ingestedAt: '2026-04-18 07:00:00+00',
      };
    },
    async loadDocumentFinancialCounts(_db, hashes) {
      return hashes.map((hash) => ({
        count: hash === 'a'.repeat(64) ? 3 : 1,
        hash,
      }));
    },
    async loadDocumentFinancialRows() {
      return [...DETAIL_FINANCIAL_ROWS];
    },
    async loadDocumentSourceCounts(_db, hashes) {
      return hashes.map((hash) => ({
        count: hash === 'a'.repeat(64) ? 2 : 1,
        hash,
      }));
    },
    async loadDocumentSourceRows() {
      return DETAIL_SOURCE_ROWS.map((row) => ({
        ...row,
        seenAt: '2026-04-18 06:58:00+00',
      }));
    },
    async loadDocumentTypes() {
      return [
        {
          count: 1,
          documentType: 'monthly_charges',
        },
      ];
    },
  });

  const catalog = await documents.getCatalog();
  const detail = await documents.getDetail('a'.repeat(64));

  assert.equal(catalog.documents[0]?.extractedAt, '2026-04-18T08:00:00.000Z');
  assert.equal(detail.document.extractedAt, '2026-04-18T08:00:00.000Z');
  assert.equal(detail.document.ingestedAt, '2026-04-18T07:00:00.000Z');
  assert.equal(detail.sourceObservations[0]?.seenAt, '2026-04-18T06:58:00.000Z');
});

test('documents service rejects a missing document detail request', async () => {
  const documents = createDocumentsApplicationService(createDocumentsContext(), {
    async loadCatalogBaseRows() {
      return [];
    },
    async loadDocumentDetailRow() {
      return null;
    },
    async loadDocumentFinancialCounts() {
      return [];
    },
    async loadDocumentFinancialRows() {
      return [];
    },
    async loadDocumentSourceCounts() {
      return [];
    },
    async loadDocumentSourceRows() {
      return [];
    },
    async loadDocumentTypes() {
      return [];
    },
  });

  await assert.rejects(
    documents.getDetail('f'.repeat(64)),
    (error) => error instanceof DocumentNotFoundError,
  );
});

function createDocumentsContext() {
  return createPropertyVaultApplicationContext({
    db: {} as PropertyVaultDatabase,
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
  });
}

const CATALOG_ROWS = [
  {
    assetTag: 'unit-12',
    confidence: 0.98,
    documentDate: '2026-04-01',
    documentType: 'monthly_charges',
    extractedAt: '2026-04-18T08:00:00.000Z',
    hash: 'a'.repeat(64),
    pageCount: 2,
    periodEnd: null,
    periodKind: 'month',
    periodStart: null,
    periodValue: '2026-04',
    status: 'ok' as const,
    summaryPlain: 'Monthly housing charges for April 2026.',
    title: 'April 2026 monthly charges',
  },
  {
    assetTag: null,
    confidence: 0.92,
    documentDate: '2026-03-20',
    documentType: 'resolution',
    extractedAt: '2026-03-21T10:30:00.000Z',
    hash: 'b'.repeat(64),
    pageCount: 4,
    periodEnd: '2026-03-31',
    periodKind: 'range',
    periodStart: '2026-03-01',
    periodValue: null,
    status: 'needs_review' as const,
    summaryPlain: 'Owner resolution covering the heating surcharge.',
    title: 'Resolution on heating surcharge',
  },
];

const DETAIL_ROW = {
  assetTag: 'unit-12',
  confidence: 0.98,
  documentDate: '2026-04-01',
  documentType: 'monthly_charges',
  extractedAt: '2026-04-18T08:00:00.000Z',
  extractedBy: 'codex-sync',
  extractorVersion: 'v1.4.2',
  hasTextLayer: true,
  hash: 'a'.repeat(64),
  ingestedAt: '2026-04-18T07:00:00.000Z',
  mime: 'application/pdf',
  needsOcr: false,
  notePath: 'vault/notes/a.md',
  ocrStatus: 'not_needed',
  pageCount: 2,
  periodEnd: null,
  periodKind: 'month',
  periodStart: null,
  periodValue: '2026-04',
  recordJson: {
    key_facts: [
      {
        label: 'Amount due',
        value: 'PLN 347.91',
      },
      {
        label: 'Due date',
        value: '2026-04-15',
      },
    ],
    questions_for_user: ['Confirm whether the parking surcharge still applies.'],
    warnings: ['Portal screenshot includes login hints but the value was redacted.'],
  },
  sizeBytes: 482199,
  status: 'ok' as const,
  summaryPlain: 'Monthly housing charges for April 2026.',
  title: 'April 2026 monthly charges',
};

const DETAIL_FINANCIAL_ROWS = [
  {
    amountMinor: 14427,
    category: 'shared_property_advance',
    categoryGroup: 'shared_property',
    note: 'Main monthly advance',
    periodEnd: null,
    periodKind: 'month',
    periodStart: null,
    periodValue: '2026-04',
    quantityUnit: null,
    quantityValue: null,
    rowType: 'charge',
    sourcePage: 1,
    unitPriceMinor: null,
  },
  {
    amountMinor: 8204,
    category: 'cold_water_and_sewage',
    categoryGroup: 'media',
    note: null,
    periodEnd: '2026-03-31',
    periodKind: 'range',
    periodStart: '2026-03-01',
    periodValue: null,
    quantityUnit: 'm3',
    quantityValue: 8.4,
    rowType: 'charge',
    sourcePage: 2,
    unitPriceMinor: 977,
  },
];

const DETAIL_SOURCE_ROWS = [
  {
    originalFilename: 'charges-april-2026.pdf',
    seenAt: '2026-04-18T06:58:00.000Z',
    sourceKind: 'portal_download',
    sourceRef: JSON.stringify({
      portal: 'e-kartoteka',
      section: 'charges',
    }),
  },
  {
    originalFilename: 'charges-april-2026.pdf',
    seenAt: '2026-04-18T06:55:00.000Z',
    sourceKind: 'gmail_attachment',
    sourceRef: JSON.stringify({
      messageId: '1875abc',
      threadId: 'thread-99',
    }),
  },
];

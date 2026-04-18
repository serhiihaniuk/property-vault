import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPropertyVaultApplication,
  DocumentNotFoundError,
} from '@dabrowskiego/application';
import {
  documentCatalogResponseSchema,
  documentDetailResponseSchema,
  type OpenApiDocument,
} from '@dabrowskiego/contracts';
import {
  createDocumentDetailGetHandler,
  createDocumentsCatalogGetHandler,
} from './documents-handlers.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';

type DocumentCatalogPayload = ReturnType<typeof documentCatalogResponseSchema.parse>;
type DocumentDetailPayload = ReturnType<typeof documentDetailResponseSchema.parse>;

test('documents catalog route handler returns the db-backed catalog payload', async () => {
  const runtime = createTestRuntime({
    catalogPayload: {
      availableTypes: [
        {
          count: 1,
          documentType: 'monthly_charges',
          label: 'Monthly charges',
        },
      ],
      documents: [],
      generatedAt: '2026-04-19T09:00:00.000Z',
      selectedDocumentType: null,
    },
  });

  const response = await createDocumentsCatalogGetHandler(() => runtime)(
    new Request('http://example.test/api/documents'),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    documentCatalogResponseSchema.parse(await response.json()),
    await runtime.getDbApplication().documents.getCatalog(),
  );
});

test('documents detail route handler returns the db-backed provenance payload', async () => {
  const runtime = createTestRuntime({
    detailPayload: {
      document: {
        assetTag: 'unit-12',
        confidence: 0.98,
        documentDate: '2026-04-01',
        documentType: 'monthly_charges',
        documentTypeLabel: 'Monthly charges',
        extractedAt: '2026-04-18T08:00:00.000Z',
        extractedBy: 'codex-sync',
        extractorVersion: 'v1.4.2',
        financialRowCount: 0,
        hash: 'a'.repeat(64),
        hasTextLayer: true,
        ingestedAt: '2026-04-18T07:00:00.000Z',
        mime: 'application/pdf',
        needsOcr: false,
        noteAvailable: true,
        ocrStatus: 'not_needed',
        pageCount: 2,
        period: {
          kind: 'month',
          label: 'April 2026',
          value: '2026-04',
        },
        sizeBytes: 482199,
        sourceCount: 1,
        status: 'ok',
        summaryPlain: 'Monthly housing charges for April 2026.',
        title: 'April 2026 monthly charges',
      },
      financialRows: [],
      generatedAt: '2026-04-19T09:00:00.000Z',
      keyFacts: [],
      questionsForUser: [],
      sourceObservations: [],
      warnings: [],
    },
  });

  const response = await createDocumentDetailGetHandler(() => runtime)(
    new Request(`http://example.test/api/documents/${'a'.repeat(64)}`),
    {
      params: Promise.resolve({
        hash: 'a'.repeat(64),
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    documentDetailResponseSchema.parse(await response.json()),
    await runtime.getDbApplication().documents.getDetail('a'.repeat(64)),
  );
});

test('documents detail route maps a missing document into the declared problem response', async () => {
  const missingHash = 'f'.repeat(64);
  const runtime = createTestRuntime({
    missingHash,
  });

  const response = await createDocumentDetailGetHandler(() => runtime)(
    new Request(`http://example.test/api/documents/${missingHash}`),
    {
      params: Promise.resolve({
        hash: missingHash,
      }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.code, 'document_not_found');
  assert.match(payload.detail, new RegExp(missingHash));
});

function createTestRuntime(options: {
  catalogPayload?: DocumentCatalogPayload;
  detailPayload?: DocumentDetailPayload;
  missingHash?: string;
} = {}): PropertyVaultApiRuntime {
  const application = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
  });
  const dbApplication = createPropertyVaultApplication({
    environment: 'test',
    now: () => new Date('2026-04-19T09:00:00.000Z'),
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

  dbApplication.documents = {
    async getCatalog() {
      return documentCatalogResponseSchema.parse(
        options.catalogPayload ?? {
          availableTypes: [],
          documents: [],
          generatedAt: '2026-04-19T09:00:00.000Z',
          selectedDocumentType: null,
        },
      );
    },
    async getDetail(hash) {
      if (options.missingHash && hash === options.missingHash) {
        throw new DocumentNotFoundError(options.missingHash);
      }

      return documentDetailResponseSchema.parse(
        options.detailPayload ?? {
          document: {
            assetTag: null,
            confidence: 0.95,
            documentDate: '2026-04-01',
            documentType: 'monthly_charges',
            documentTypeLabel: 'Monthly charges',
            extractedAt: '2026-04-18T08:00:00.000Z',
            extractedBy: 'codex-sync',
            extractorVersion: 'v1.0.0',
            financialRowCount: 0,
            hash,
            hasTextLayer: true,
            ingestedAt: '2026-04-18T07:00:00.000Z',
            mime: 'application/pdf',
            needsOcr: false,
            noteAvailable: false,
            ocrStatus: 'not_needed',
            pageCount: 1,
            period: null,
            sizeBytes: 1200,
            sourceCount: 0,
            status: 'ok',
            summaryPlain: 'Document summary.',
            title: 'Document title',
          },
          financialRows: [],
          generatedAt: '2026-04-19T09:00:00.000Z',
          keyFacts: [],
          questionsForUser: [],
          sourceObservations: [],
          warnings: [],
        },
      );
    },
  };

  return {
    application,
    getDbApplication() {
      return dbApplication;
    },
    openApiDocument,
  };
}

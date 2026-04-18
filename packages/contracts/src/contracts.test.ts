import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  defineRoute,
  generateOpenApiDocument,
  jsonResponse,
} from './openapi.ts';
import { generatePropertyVaultOpenApiDocument } from './system.ts';
import {
  apiProblemSchema,
  moneyAmountSchema,
} from './shared.ts';

test('shared schemas validate normalized payloads', () => {
  const parsedMoney = moneyAmountSchema.parse({
    amountMinor: 12345,
    currency: 'PLN',
  });

  assert.deepEqual(parsedMoney, {
    amountMinor: 12345,
    currency: 'PLN',
  });

  const invalidProblem = apiProblemSchema.safeParse({
    status: 500,
    title: 'Internal error',
    type: '',
  });

  assert.equal(invalidProblem.success, false);
});

test('property vault OpenAPI generation exposes system routes and shared components', () => {
  const document = generatePropertyVaultOpenApiDocument({
    version: 'test-version',
  });

  assert.equal(document.openapi, '3.1.0');
  assert.equal(document.info.title, 'Property Vault API');
  assert.equal(document.info.version, 'test-version');
  assert.ok(document.paths['/api']?.get);
  assert.ok(document.paths['/api/health']?.get);
  assert.ok(document.paths['/api/dashboard/month-breakdown']?.get);
  assert.ok(document.paths['/api/documents']?.get);
  assert.ok(document.paths['/api/documents/{hash}']?.get);
  assert.deepEqual(document.paths['/api/health']?.get?.tags, ['system']);
  assert.deepEqual(document.paths['/api/dashboard/month-breakdown']?.get?.tags, [
    'dashboard',
  ]);
  assert.deepEqual(document.paths['/api/documents']?.get?.tags, ['documents']);
  assert.deepEqual(document.paths['/api/documents/{hash}']?.get?.tags, ['documents']);
  assert.ok(document.components.schemas.ApiProblem);
  assert.ok(document.components.schemas.MoneyAmount);

  const unavailableResponse =
    document.paths['/api/health']?.get?.responses['503']?.content?.['application/json']
      ?.schema;

  assert.deepEqual(unavailableResponse, {
    $ref: '#/components/schemas/ApiProblem',
  });
  assert.equal(
    document.paths['/api/dashboard/month-breakdown']?.get?.parameters?.[0]?.name,
    'month',
  );
  assert.equal(
    document.paths['/api/documents/{hash}']?.get?.parameters?.[0]?.name,
    'hash',
  );
});

test('parameter schemas convert to OpenAPI parameters with required path params', () => {
  const route = defineRoute({
    method: 'get',
    operationId: 'getDocumentPreview',
    path: '/api/documents/{hash}',
    pathParams: z.object({
      hash: z.string().min(1).describe('Document hash path parameter.'),
    }),
    query: z.object({
      includeSources: z.boolean().optional().describe('Whether to include sources.'),
    }),
    responses: {
      200: jsonResponse(
        'Document preview.',
        z.object({
          hash: z.string(),
        }),
      ),
    },
    summary: 'Get a document preview.',
    tags: ['documents'],
  });

  const document = generateOpenApiDocument({
    routes: [route],
    title: 'Test API',
    version: '0.0.0-test',
  });

  const parameters = document.paths['/api/documents/{hash}']?.get?.parameters ?? [];

  assert.equal(parameters.length, 2);

  const hashParameter = parameters.find((parameter) => parameter.name === 'hash');
  const includeSourcesParameter = parameters.find(
    (parameter) => parameter.name === 'includeSources',
  );

  assert.equal(hashParameter?.in, 'path');
  assert.equal(hashParameter?.required, true);
  assert.equal(hashParameter?.schema.type, 'string');
  assert.equal(includeSourcesParameter?.in, 'query');
  assert.equal(includeSourcesParameter?.required, false);
  assert.equal(includeSourcesParameter?.schema.type, 'boolean');
});

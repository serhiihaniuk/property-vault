import assert from 'node:assert/strict';
import test from 'node:test';
import type { RouteContract } from '@dabrowskiego/contracts';
import { createRouteHandler } from './route-handler.ts';

test('createRouteHandler validates query input and returns the contract response body', async () => {
  const handler = createRouteHandler({
    contract: {
      method: 'get',
      operationId: 'getRouteHandlerTest',
      path: '/api/test',
      query: createRequiredPageQuerySchema(),
      responses: {
        200: {
          description: 'Echo response.',
          schema: createPageResponseSchema(),
        },
      },
      summary: 'Test route handler validation.',
      tags: ['test'],
    } satisfies RouteContract,
    async execute(request) {
      return {
        page: request.query.page,
      };
    },
  });

  const response = await handler(new Request('http://example.test/api/test?page=1'));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { page: '1' });
});

test('createRouteHandler returns an RFC 7807 problem for invalid input', async () => {
  const handler = createRouteHandler({
    contract: {
      method: 'get',
      operationId: 'getRouteHandlerValidationErrorTest',
      path: '/api/test',
      query: createRequiredPageQuerySchema(),
      responses: {
        200: {
          description: 'Echo response.',
          schema: createPageResponseSchema(),
        },
      },
      summary: 'Test route handler validation failure.',
      tags: ['test'],
    } satisfies RouteContract,
    async execute(request) {
      return {
        page: request.query.page,
      };
    },
  });

  const response = await handler(new Request('http://example.test/api/test'));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/problem+json');
  assert.equal(payload.code, 'invalid_request');
  assert.match(payload.detail, /page/i);
});

function createRequiredPageQuerySchema(): RouteContract['query'] {
  return {
    parse(value: unknown) {
      const candidate = value as Record<string, unknown>;

      if (typeof candidate.page !== 'string' || candidate.page.length === 0) {
        throw createValidationError('page', 'Expected a non-empty page query parameter.');
      }

      return {
        page: candidate.page,
      };
    },
  } as unknown as RouteContract['query'];
}

function createPageResponseSchema(): NonNullable<RouteContract['responses'][200]['schema']> {
  return {
    parse(value: unknown) {
      const candidate = value as Record<string, unknown>;

      if (typeof candidate.page !== 'string' || candidate.page.length === 0) {
        throw createValidationError('page', 'Expected a non-empty page response value.');
      }

      return {
        page: candidate.page,
      };
    },
  } as unknown as NonNullable<RouteContract['responses'][200]['schema']>;
}

function createValidationError(path: string, message: string) {
  return {
    issues: [
      {
        message,
        path: [path],
      },
    ],
  };
}

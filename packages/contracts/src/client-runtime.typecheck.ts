import { z } from 'zod';
import {
  buildContractClientMethod,
  type ContractClientTransport,
} from './client-runtime.ts';
import {
  defineRoute,
  jsonRequestBody,
  jsonResponse,
} from './openapi.ts';

const createDocumentRoute = defineRoute({
  method: 'post',
  operationId: 'createDocument',
  path: '/api/documents/{hash}',
  pathParams: z.object({
    hash: z.string().min(1),
  }),
  query: z.object({
    includePreview: z.boolean().optional(),
    locale: z.string().min(2),
  }),
  requestBody: jsonRequestBody(
    z.object({
      title: z.string().min(1),
    }),
  ),
  responses: {
    201: jsonResponse(
      'Created document.',
      z.object({
        id: z.string().min(1),
      }),
    ),
  },
  summary: 'Create a document.',
});

const listDocumentsRoute = defineRoute({
  method: 'get',
  operationId: 'listDocuments',
  path: '/api/documents',
  query: z.object({
    page: z.number().int().positive().optional(),
  }),
  responses: {
    200: jsonResponse(
      'Listed documents.',
      z.object({
        items: z.array(z.string()),
      }),
    ),
  },
  summary: 'List documents.',
});

const transport: ContractClientTransport = {
  async request<TResponse>(
    _options: Parameters<ContractClientTransport['request']>[0],
  ): Promise<TResponse> {
    throw new Error(`unused transport for ${String(_options.method)}`) as never as TResponse;
  },
};

const createDocument = buildContractClientMethod(transport, createDocumentRoute);
const listDocuments = buildContractClientMethod(transport, listDocumentsRoute);

// @ts-expect-error createDocument requires contract-defined inputs.
void createDocument();
// @ts-expect-error createDocument requires path params, body, and the required query field.
void createDocument({});
// @ts-expect-error path params stay required.
void createDocument({
  body: {
    title: 'Quarterly report',
  },
  query: {
    locale: 'pl',
  },
});
// @ts-expect-error request body stays required.
void createDocument({
  pathParams: {
    hash: 'doc-123',
  },
  query: {
    locale: 'pl',
  },
});
// @ts-expect-error required query fields stay required even when other query fields are optional.
void createDocument({
  body: {
    title: 'Quarterly report',
  },
  pathParams: {
    hash: 'doc-123',
  },
});

void createDocument({
  body: {
    title: 'Quarterly report',
  },
  pathParams: {
    hash: 'doc-123',
  },
  query: {
    includePreview: true,
    locale: 'pl',
  },
});

void listDocuments();
void listDocuments({});
void listDocuments({
  query: {
    page: 1,
  },
});

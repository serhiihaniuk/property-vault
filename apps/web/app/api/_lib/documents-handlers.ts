import {
  DocumentNotFoundError,
  type PropertyVaultApplication,
} from '@dabrowskiego/application';
import {
  documentCatalogQuerySchema,
  documentDetailPathParamsSchema,
  documentDetailRoute,
  documentsCatalogRoute,
} from '@dabrowskiego/contracts';
import {
  createApiProblem,
  ApiProblemError,
} from './problem.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;
type DbApplicationResolver = (runtime: PropertyVaultApiRuntime) => PropertyVaultApplication;

export function createDocumentsCatalogGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: documentsCatalogRoute,
    async execute({ query }) {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      return await application.documents.getCatalog(
        documentCatalogQuerySchema.parse(query),
      );
    },
  });
}

export function createDocumentDetailGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
  resolveDbApplication: DbApplicationResolver = (runtime) => runtime.getDbApplication(),
) {
  return createRouteHandler({
    contract: documentDetailRoute,
    async execute({ pathParams }) {
      const runtime = resolveRuntime();
      const application = resolveDbApplication(runtime);

      try {
        const { hash } = documentDetailPathParamsSchema.parse(pathParams);
        return await application.documents.getDetail(hash);
      } catch (error) {
        if (error instanceof DocumentNotFoundError) {
          throw new ApiProblemError(
            createApiProblem({
              code: 'document_not_found',
              detail: `No indexed document is available for hash "${error.hash}".`,
              status: 404,
              title: 'Document not found.',
            }),
          );
        }

        throw error;
      }
    },
  });
}

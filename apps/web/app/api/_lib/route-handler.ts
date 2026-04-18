import type { RouteContract } from '@dabrowskiego/contracts';
import { createJsonResponse, getRouteErrorResponse, validateRouteResponse } from './response.ts';
import {
  parseRouteRequest,
  type ParsedRouteRequest,
  type PropertyVaultRouteContext,
} from './request.ts';

export interface RouteHandlerResult<TBody> {
  body: TBody;
  headers?: HeadersInit;
  status?: number;
}

export interface CreateRouteHandlerOptions<TBody, TContext extends PropertyVaultRouteContext> {
  contract: RouteContract;
  execute: (
    request: ParsedRouteRequest,
    context: TContext,
    incomingRequest: Request,
  ) => Promise<RouteHandlerResult<TBody> | TBody>;
}

export function createRouteHandler<TBody, TContext extends PropertyVaultRouteContext = PropertyVaultRouteContext>(
  options: CreateRouteHandlerOptions<TBody, TContext>,
) {
  return async function routeHandler(
    request: Request,
    context: TContext = {} as TContext,
  ): Promise<Response> {
    try {
      const parsedRequest = await parseRouteRequest(request, options.contract, context);
      const result = await options.execute(parsedRequest, context, request);
      const normalizedResult = normalizeResult(result);
      const validatedBody = validateRouteResponse(
        normalizedResult.body,
        options.contract,
        normalizedResult.status,
      );

      return createJsonResponse(validatedBody, {
        headers: normalizedResult.headers,
        status: normalizedResult.status,
      });
    } catch (error) {
      return getRouteErrorResponse(error, request);
    }
  };
}

function normalizeResult<TBody>(
  result: RouteHandlerResult<TBody> | TBody,
): Required<RouteHandlerResult<TBody>> {
  if (!isRouteHandlerResult(result)) {
    return {
      body: result,
      headers: {},
      status: 200,
    };
  }

  return {
    body: result.body,
    headers: result.headers ?? {},
    status: result.status ?? 200,
  };
}

function isRouteHandlerResult<TBody>(
  value: RouteHandlerResult<TBody> | TBody,
): value is RouteHandlerResult<TBody> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return 'body' in value && ('status' in value || 'headers' in value);
}

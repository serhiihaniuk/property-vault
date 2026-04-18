import type { ResponseContract, RouteContract } from '@dabrowskiego/contracts';
import { NextResponse } from 'next/server.js';
import {
  ApiProblemError,
  createApiProblem,
  type PropertyVaultApiProblem,
  RouteValidationError,
} from './problem.ts';

export interface JsonResponseOptions {
  headers?: HeadersInit;
  status: number;
}

export function createJsonResponse<TBody>(
  body: TBody,
  options: JsonResponseOptions,
): NextResponse<TBody> {
  return NextResponse.json(body, {
    headers: options.headers,
    status: options.status,
  });
}

export function createProblemResponse(
  problem: PropertyVaultApiProblem,
): NextResponse<PropertyVaultApiProblem> {
  return new NextResponse(JSON.stringify(problem), {
    headers: new Headers({
      'content-type': 'application/problem+json',
    }),
    status: problem.status,
  });
}

export function validateRouteResponse<TBody>(
  body: TBody,
  contract: RouteContract,
  status: number,
): TBody {
  const responseContract = resolveResponseContract(contract, status);

  if (!responseContract.schema) {
    return body;
  }

  return responseContract.schema.parse(body) as TBody;
}

export function getRouteErrorResponse(
  error: unknown,
  request: Request,
): NextResponse<PropertyVaultApiProblem> {
  if (error instanceof ApiProblemError) {
    return createProblemResponse(error.problem);
  }

  if (error instanceof RouteValidationError) {
    return createProblemResponse(
      createApiProblem({
        code: 'invalid_request',
        detail: error.detail,
        instance: request.url,
        status: 400,
        title: 'Invalid request.',
      }),
    );
  }

  return createProblemResponse(
    createApiProblem({
      code: 'internal_error',
      instance: request.url,
      status: 500,
      title: 'Internal server error.',
    }),
  );
}

function resolveResponseContract(contract: RouteContract, status: number): ResponseContract {
  const responseContract = contract.responses[status];

  if (!responseContract) {
    throw new ApiProblemError({
      code: 'missing_response_contract',
      detail: `Route "${contract.operationId}" does not define a ${status} response.`,
      status: 500,
      title: 'Route response contract is incomplete.',
    });
  }

  return responseContract;
}

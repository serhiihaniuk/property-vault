import type { RouteContract } from '@dabrowskiego/contracts';
import { RouteValidationError } from './problem.ts';

type RouteParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = Promise<T> | T;
type ParsedSchemaIssues = Array<{
  message: string;
  path: Array<string | number>;
}>;
type RequestBodySchema = NonNullable<RouteContract['requestBody']>['schema'];

export interface PropertyVaultRouteContext {
  params?: MaybePromise<RouteParams>;
}

export interface ParsedRouteRequest {
  body: unknown;
  pathParams: Record<string, unknown>;
  query: Record<string, unknown>;
}

export async function parseRouteRequest(
  request: Request,
  contract: RouteContract,
  context: PropertyVaultRouteContext = {},
): Promise<ParsedRouteRequest> {
  try {
    const [pathParams, query, body] = await Promise.all([
      parseObjectSchema(await resolveParams(context.params), contract.pathParams),
      parseObjectSchema(extractQueryParams(request), contract.query),
      parseRequestBody(request, contract.requestBody?.schema),
    ]);

    return {
      body,
      pathParams,
      query,
    };
  } catch (error) {
    if (isSchemaValidationError(error)) {
      throw new RouteValidationError(formatZodIssues(error));
    }

    throw error;
  }
}

async function resolveParams(
  params: PropertyVaultRouteContext['params'],
): Promise<RouteParams> {
  if (!params) {
    return {};
  }

  return await params;
}

function extractQueryParams(request: Request): Record<string, unknown> {
  const url = new URL(request.url);
  const queryParams = new Map<string, string[]>();

  for (const [key, value] of url.searchParams.entries()) {
    const values = queryParams.get(key);

    if (values) {
      values.push(value);
      continue;
    }

    queryParams.set(key, [value]);
  }

  return Object.fromEntries(
    Array.from(queryParams.entries()).map(([key, values]) => [
      key,
      values.length === 1 ? values[0] : values,
    ]),
  );
}

async function parseRequestBody(
  request: Request,
  schema: RequestBodySchema | undefined,
): Promise<unknown> {
  if (!schema) {
    return undefined;
  }

  const contentType = request.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    throw new RouteValidationError('Expected an application/json request body.');
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new RouteValidationError('Request body is not valid JSON.');
  }

  return schema.parse(payload);
}

function parseObjectSchema(
  value: Record<string, unknown>,
  schema: RouteContract['query'] | RouteContract['pathParams'],
): Record<string, unknown> {
  if (!schema) {
    return {};
  }

  return schema.parse(value);
}

function formatZodIssues(error: { issues: ParsedSchemaIssues }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'request';

      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function isSchemaValidationError(error: unknown): error is { issues: ParsedSchemaIssues } {
  if (!error || typeof error !== 'object' || !('issues' in error)) {
    return false;
  }

  const issues = (error as { issues?: unknown }).issues;

  return (
    Array.isArray(issues) &&
    issues.every(
      (issue) =>
        issue &&
        typeof issue === 'object' &&
        'message' in issue &&
        typeof (issue as { message: unknown }).message === 'string' &&
        'path' in issue &&
        Array.isArray((issue as { path: unknown }).path),
    )
  );
}

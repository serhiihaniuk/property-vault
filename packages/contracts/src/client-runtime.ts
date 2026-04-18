import type {
  AnyZodObject,
  ZodTypeAny,
  input as ZodInput,
  output as ZodOutput,
} from 'zod';
import type { ResponseContract, RouteContract } from './openapi.ts';

type QueryValue = boolean | null | number | string | undefined;
type SuccessfulStatusCode = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226;

type RouteStatusCode<TRoute extends RouteContract> = keyof TRoute['responses'] & number;
type RouteSuccessfulStatusCode<TRoute extends RouteContract> = Extract<
  RouteStatusCode<TRoute>,
  SuccessfulStatusCode
>;
type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {};

type ContractResponseOutput<TResponse extends ResponseContract> =
  TResponse extends ResponseContract<infer TSchema>
    ? [TSchema] extends [ZodTypeAny]
      ? ZodOutput<TSchema>
      : undefined
    : never;

export type ContractRouteSuccessResponse<TRoute extends RouteContract> =
  [RouteSuccessfulStatusCode<TRoute>] extends [never]
    ? never
    : {
        [TStatus in RouteSuccessfulStatusCode<TRoute>]: ContractResponseOutput<
          TRoute['responses'][TStatus]
        >;
      }[RouteSuccessfulStatusCode<TRoute>];

export type ContractRoutePathParamsInput<TRoute extends RouteContract> =
  TRoute extends {
    pathParams: infer TPathParams extends AnyZodObject;
  }
    ? ZodInput<TPathParams>
    : never;

export type ContractRouteQueryInput<TRoute extends RouteContract> =
  TRoute extends {
    query: infer TQuery extends AnyZodObject;
  }
    ? ZodInput<TQuery>
    : never;

export type ContractRouteRequestBodyInput<TRoute extends RouteContract> =
  TRoute extends {
    requestBody: {
      schema: infer TSchema extends ZodTypeAny;
    };
  }
    ? ZodInput<TSchema>
    : never;

export interface ContractClientTransportRequestOptions<TResponse>
  extends Omit<RequestInit, 'body' | 'headers' | 'method'> {
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
  parse?: (payload: unknown, response: Response) => TResponse;
  path: `/${string}` | string;
  query?: Record<string, QueryValue>;
}

export interface ContractClientTransport {
  request<TResponse>(options: ContractClientTransportRequestOptions<TResponse>): Promise<TResponse>;
}

export type ContractClientMethodOptions<TRoute extends RouteContract> = Simplify<
  Omit<
    ContractClientTransportRequestOptions<ContractRouteSuccessResponse<TRoute>>,
    'body' | 'method' | 'parse' | 'path' | 'query'
  > & {
    body?: ContractRouteRequestBodyInput<TRoute>;
    pathParams?: ContractRoutePathParamsInput<TRoute>;
    query?: ContractRouteQueryInput<TRoute>;
  }
>;

export function buildContractClientMethod<TRoute extends RouteContract>(
  transport: ContractClientTransport,
  route: TRoute,
) {
  return async function contractClientMethod(
    options: ContractClientMethodOptions<TRoute> = {} as ContractClientMethodOptions<TRoute>,
  ): Promise<ContractRouteSuccessResponse<TRoute>> {
    const { body, pathParams, query, ...requestOptions } = options;

    return transport.request({
      ...requestOptions,
      body: normalizeRouteBody(route, body),
      method: route.method.toUpperCase(),
      parse: (payload, response) =>
        parseContractRouteSuccess(route, payload, response) as ContractRouteSuccessResponse<TRoute>,
      path: buildContractRoutePath(route.path, normalizePathParams(route, pathParams)),
      query: normalizeRouteQuery(route, query),
    });
  };
}

function normalizePathParams(
  route: RouteContract,
  pathParams: unknown,
): Record<string, unknown> {
  if (!route.pathParams) {
    return {};
  }

  return route.pathParams.parse(pathParams ?? {});
}

function buildContractRoutePath(
  pathTemplate: string,
  pathParams: Record<string, unknown>,
): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_token, key: string) => {
    const value = pathParams[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter "${key}".`);
    }

    return encodeURIComponent(String(value));
  });
}

function normalizeRouteQuery(
  route: RouteContract,
  query: unknown,
): Record<string, QueryValue> | undefined {
  if (!route.query) {
    return undefined;
  }

  const parsedQuery = route.query.parse(query ?? {});
  const normalizedEntries = Object.entries(parsedQuery).flatMap(([key, value]) => {
    if (value === undefined || value === null) {
      return [];
    }

    if (isQueryValue(value)) {
      return [[key, value] as const];
    }

    throw new Error(
      `Route "${route.operationId}" query parameter "${key}" resolved to an unsupported value.`,
    );
  });

  return Object.fromEntries(normalizedEntries);
}

function normalizeRouteBody(
  route: RouteContract,
  body: unknown,
): unknown {
  if (!route.requestBody) {
    return undefined;
  }

  if (body === undefined && route.requestBody.required === false) {
    return undefined;
  }

  return route.requestBody.schema.parse(body);
}

function parseContractRouteSuccess(
  route: RouteContract,
  payload: unknown,
  response: Response,
): unknown {
  const responseContract = route.responses[response.status];

  if (!isSuccessfulStatus(response.status) || !responseContract) {
    throw new Error(
      `Route "${route.operationId}" does not define a successful ${response.status} response contract.`,
    );
  }

  if (!responseContract.schema) {
    return undefined;
  }

  return responseContract.schema.parse(payload);
}

function isQueryValue(value: unknown): value is Exclude<QueryValue, undefined> {
  return (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}

function isSuccessfulStatus(status: number): status is SuccessfulStatusCode {
  return status >= 200 && status < 300;
}

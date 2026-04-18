import { resolvePropertyVaultPublicConfig } from "../config/public-env.ts";

export interface PropertyVaultApiProblem {
  code?: string;
  detail?: string;
  instance?: string;
  status: number;
  title: string;
  type: string;
}

export interface PropertyVaultApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface PropertyVaultApiRequestOptions<TResponse>
  extends Omit<RequestInit, "body" | "headers" | "method"> {
  body?: BodyInit | FormData | Record<string, unknown> | undefined;
  headers?: HeadersInit;
  method?: string;
  parse?: (payload: unknown) => TResponse;
  path: `/${string}` | string;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export interface PropertyVaultApiClient {
  get<TResponse>(
    path: PropertyVaultApiRequestOptions<TResponse>["path"],
    options?: Omit<PropertyVaultApiRequestOptions<TResponse>, "method" | "path">,
  ): Promise<TResponse>;
  request<TResponse>(options: PropertyVaultApiRequestOptions<TResponse>): Promise<TResponse>;
}

export class PropertyVaultApiError extends Error {
  readonly problem?: PropertyVaultApiProblem;
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string, problem?: PropertyVaultApiProblem) {
    super(problem?.title ?? `API request failed with status ${status}.`);
    this.name = "PropertyVaultApiError";
    this.problem = problem;
    this.status = status;
    this.statusText = statusText;
  }
}

export function createPropertyVaultApiClient(
  options: PropertyVaultApiClientOptions = {},
): PropertyVaultApiClient {
  const config = resolvePropertyVaultPublicConfig();
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? config.apiBasePath);
  const fetchImplementation = options.fetch ?? fetch;

  async function request<TResponse>(
    requestOptions: PropertyVaultApiRequestOptions<TResponse>,
  ): Promise<TResponse> {
    const url = buildRequestUrl(baseUrl, requestOptions.path, requestOptions.query);
    const headers = new Headers(requestOptions.headers);

    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }

    const init: RequestInit = {
      ...requestOptions,
      body: serializeBody(requestOptions.body, headers),
      credentials: requestOptions.credentials ?? "include",
      headers,
      method: requestOptions.method ?? "GET",
    };

    const response = await fetchImplementation(url, init);
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new PropertyVaultApiError(
        response.status,
        response.statusText,
        isApiProblem(payload) ? payload : undefined,
      );
    }

    if (requestOptions.parse) {
      return requestOptions.parse(payload);
    }

    return payload as TResponse;
  }

  return {
    get(path, requestOptions) {
      return request({
        ...requestOptions,
        method: "GET",
        path,
      });
    },
    request,
  };
}

function normalizeBaseUrl(baseUrl: string) {
  if (baseUrl === "/") {
    return baseUrl;
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildRequestUrl(
  baseUrl: string,
  path: string,
  query: PropertyVaultApiRequestOptions<unknown>["query"],
) {
  const requestUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const search = searchParams.toString();

  return search ? `${requestUrl}?${search}` : requestUrl;
}

function serializeBody(
  body: PropertyVaultApiRequestOptions<unknown>["body"],
  headers: Headers,
) {
  if (body === undefined) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  return response.json();
}

function isApiProblem(value: unknown): value is PropertyVaultApiProblem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PropertyVaultApiProblem>;

  return (
    typeof candidate.type === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "number"
  );
}

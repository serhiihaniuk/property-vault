import { zodToJsonSchema } from 'zod-to-json-schema';
import { type AnyZodObject, type ZodTypeAny } from 'zod';

export type HttpMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';
export type ParameterLocation = 'path' | 'query';

export interface NamedSchema<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  schema: TSchema;
}

export interface JsonRequestBody<TSchema extends ZodTypeAny = ZodTypeAny> {
  description?: string;
  required?: boolean;
  schema: TSchema;
  schemaName?: string;
}

export interface ResponseContract<TSchema extends ZodTypeAny | undefined = ZodTypeAny | undefined> {
  description: string;
  schema?: TSchema;
  schemaName?: string;
}

export interface RouteContract {
  description?: string;
  method: HttpMethod;
  operationId: string;
  path: `/${string}`;
  pathParams?: AnyZodObject;
  query?: AnyZodObject;
  requestBody?: JsonRequestBody;
  responses: Record<number, ResponseContract>;
  summary: string;
  tags?: string[];
}

export interface OpenApiInfo {
  description?: string;
  title: string;
  version: string;
}

export interface OpenApiServer {
  description?: string;
  url: string;
}

export interface OpenApiParameter {
  description?: string;
  in: ParameterLocation;
  name: string;
  required: boolean;
  schema: OpenApiSchema;
}

export interface OpenApiMediaType {
  schema: OpenApiSchema;
}

export interface OpenApiRequestBodyObject {
  content: Record<'application/json', OpenApiMediaType>;
  description?: string;
  required?: boolean;
}

export interface OpenApiResponseObject {
  content?: Record<'application/json', OpenApiMediaType>;
  description: string;
}

export interface OpenApiOperation {
  description?: string;
  operationId: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBodyObject;
  responses: Record<string, OpenApiResponseObject>;
  summary: string;
  tags?: string[];
}

export interface OpenApiDocument {
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
  info: OpenApiInfo;
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema';
  openapi: '3.1.0';
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  servers?: OpenApiServer[];
}

export type OpenApiSchema = Record<string, unknown>;

export interface GenerateOpenApiDocumentOptions {
  components?: readonly NamedSchema[];
  description?: string;
  routes: readonly RouteContract[];
  servers?: readonly OpenApiServer[];
  title: string;
  version: string;
}

export function namedSchema<TSchema extends ZodTypeAny>(
  name: string,
  schema: TSchema,
): NamedSchema<TSchema> {
  return { name, schema };
}

export function jsonRequestBody<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options: Omit<JsonRequestBody<TSchema>, 'schema'> = {},
): JsonRequestBody<TSchema> {
  return {
    ...options,
    required: options.required ?? true,
    schema,
  };
}

export function jsonResponse<TSchema extends ZodTypeAny>(
  description: string,
  schema: TSchema,
  options: Omit<ResponseContract<TSchema>, 'description' | 'schema'> = {},
): ResponseContract<TSchema> {
  return { ...options, description, schema };
}

export function emptyResponse(description: string): ResponseContract<undefined> {
  return { description };
}

export function defineRoute<const TRoute extends RouteContract>(route: TRoute): TRoute {
  return route;
}

export function generateOpenApiDocument(
  options: GenerateOpenApiDocumentOptions,
): OpenApiDocument {
  const components: Record<string, OpenApiSchema> = {};

  for (const component of options.components ?? []) {
    addComponentSchema(components, component.name, component.schema);
  }

  const paths: OpenApiDocument['paths'] = {};

  for (const route of options.routes) {
    const operation: OpenApiOperation = {
      operationId: route.operationId,
      responses: buildResponses(route, components),
      summary: route.summary,
    };

    if (route.description) {
      operation.description = route.description;
    }

    if (route.tags?.length) {
      operation.tags = [...route.tags];
    }

    const parameters = [
      ...buildParameters(route.pathParams, 'path', `${route.operationId}PathParams`, components),
      ...buildParameters(route.query, 'query', `${route.operationId}Query`, components),
    ];

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (route.requestBody) {
      operation.requestBody = buildRequestBody(
        route.requestBody,
        `${route.operationId}RequestBody`,
        components,
      );
    }

    const pathItem = (paths[route.path] ??= {});
    pathItem[route.method] = operation;
  }

  return {
    components: {
      schemas: components,
    },
    info: {
      description: options.description,
      title: options.title,
      version: options.version,
    },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    openapi: '3.1.0',
    paths,
    servers: options.servers ? [...options.servers] : undefined,
  };
}

function buildParameters(
  schema: AnyZodObject | undefined,
  location: ParameterLocation,
  schemaName: string,
  components: Record<string, OpenApiSchema>,
): OpenApiParameter[] {
  if (!schema) {
    return [];
  }

  const { definitions, rootSchema } = convertZodSchema(schema, schemaName);
  mergeSchemas(components, definitions);

  if (rootSchema.type !== 'object') {
    throw new Error(`Expected "${schemaName}" to resolve to an object schema.`);
  }

  const properties = isRecord(rootSchema.properties) ? rootSchema.properties : {};
  const required = new Set(
    Array.isArray(rootSchema.required)
      ? rootSchema.required.filter((property): property is string => typeof property === 'string')
      : [],
  );

  return Object.entries(properties).map(([name, propertySchema]) => {
    const normalizedSchema = isRecord(propertySchema) ? propertySchema : {};

    return {
      description:
        typeof normalizedSchema.description === 'string'
          ? normalizedSchema.description
          : undefined,
      in: location,
      name,
      required: location === 'path' ? true : required.has(name),
      schema: normalizedSchema,
    };
  });
}

function buildRequestBody(
  requestBody: JsonRequestBody,
  schemaName: string,
  components: Record<string, OpenApiSchema>,
): OpenApiRequestBodyObject {
  return {
    content: {
      'application/json': {
        schema: addComponentSchema(
          components,
          requestBody.schemaName ?? schemaName,
          requestBody.schema,
        ),
      },
    },
    description: requestBody.description,
    required: requestBody.required,
  };
}

function buildResponses(
  route: RouteContract,
  components: Record<string, OpenApiSchema>,
): Record<string, OpenApiResponseObject> {
  return Object.fromEntries(
    Object.entries(route.responses).map(([statusCode, response]) => {
      const responseObject: OpenApiResponseObject = {
        description: response.description,
      };

      if (response.schema) {
        responseObject.content = {
              'application/json': {
                schema: addComponentSchema(
                  components,
                  response.schemaName ?? `${route.operationId}Response${statusCode}`,
                  response.schema,
                ),
              },
        };
      }

      return [statusCode, responseObject];
    }),
  );
}

function addComponentSchema(
  components: Record<string, OpenApiSchema>,
  name: string,
  schema: ZodTypeAny,
): OpenApiSchema {
  const { definitions } = convertZodSchema(schema, name);
  mergeSchemas(components, definitions);

  return { $ref: `#/components/schemas/${name}` };
}

function convertZodSchema(
  schema: ZodTypeAny,
  name: string,
): {
  definitions: Record<string, OpenApiSchema>;
  rootSchema: OpenApiSchema;
} {
  const generated = zodToJsonSchema(schema, {
    $refStrategy: 'root',
    name,
    target: 'openApi3',
  }) as Record<string, unknown>;

  const definitions = isRecord(generated.definitions) ? generated.definitions : {};
  const rewrittenDefinitions = Object.fromEntries(
    Object.entries(definitions).map(([definitionName, definition]) => [
      definitionName,
      normalizeSchema(definition),
    ]),
  );

  const rootCandidate = rewrittenDefinitions[name] ?? normalizeSchema(omitDefinitions(generated));
  const rootSchema = isRecord(rootCandidate) ? rootCandidate : {};

  if (!(name in rewrittenDefinitions)) {
    rewrittenDefinitions[name] = rootSchema;
  }

  return {
    definitions: rewrittenDefinitions,
    rootSchema,
  };
}

function mergeSchemas(
  components: Record<string, OpenApiSchema>,
  definitions: Record<string, OpenApiSchema>,
): void {
  for (const [name, schema] of Object.entries(definitions)) {
    const existing = components[name];

    if (!existing) {
      components[name] = schema;
      continue;
    }

    if (JSON.stringify(existing) !== JSON.stringify(schema)) {
      throw new Error(`OpenAPI schema name collision detected for "${name}".`);
    }
  }
}

function omitDefinitions(schema: Record<string, unknown>): Record<string, unknown> {
  const { definitions: _definitions, ...rest } = schema;

  return rest;
}

function normalizeSchema(value: unknown): OpenApiSchema {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (key === '$ref' && typeof entryValue === 'string') {
        return [key, entryValue.replace('#/definitions/', '#/components/schemas/')];
      }

      if (Array.isArray(entryValue)) {
        return [key, entryValue.map((item) => (isRecord(item) ? normalizeSchema(item) : item))];
      }

      if (isRecord(entryValue)) {
        return [key, normalizeSchema(entryValue)];
      }

      return [key, entryValue];
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { apiProblemSchema } from '@dabrowskiego/contracts';

export type PropertyVaultApiProblem = ReturnType<typeof apiProblemSchema.parse>;

export interface CreateApiProblemOptions {
  code?: string;
  detail?: string;
  instance?: string;
  status: number;
  title: string;
  type?: string;
}

export class ApiProblemError extends Error {
  readonly problem: PropertyVaultApiProblem;

  constructor(problem: CreateApiProblemOptions) {
    super(problem.title);
    this.name = 'ApiProblemError';
    this.problem = createApiProblem(problem);
  }
}

export class RouteValidationError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('Invalid request.');
    this.name = 'RouteValidationError';
    this.detail = detail;
  }
}

export function createApiProblem(options: CreateApiProblemOptions): PropertyVaultApiProblem {
  return apiProblemSchema.parse({
    code: options.code,
    detail: options.detail,
    instance: options.instance,
    status: options.status,
    title: options.title,
    type: options.type ?? buildProblemType(options.status),
  });
}

export function getPublicErrorDetail(error: unknown): string | undefined {
  if (error instanceof RouteValidationError) {
    return error.detail;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return undefined;
}

function buildProblemType(status: number): string {
  return `urn:property-vault:problem:${status}`;
}

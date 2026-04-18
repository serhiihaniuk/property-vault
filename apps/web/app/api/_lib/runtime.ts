import {
  createPropertyVaultApplication,
  type PropertyVaultApplication,
} from '@dabrowskiego/application';
import {
  generatePropertyVaultOpenApiDocument,
  type OpenApiDocument,
} from '@dabrowskiego/contracts';

const PROPERTY_VAULT_DEFAULT_APP_ORIGIN = 'http://localhost:3000';

export interface PropertyVaultApiRuntime {
  application: PropertyVaultApplication;
  openApiDocument: OpenApiDocument;
}

export interface CreatePropertyVaultApiRuntimeOptions {
  env?: NodeJS.ProcessEnv;
}

declare global {
  var __propertyVaultApiRuntime: PropertyVaultApiRuntime | undefined;
}

export function createPropertyVaultApiRuntime(
  options: CreatePropertyVaultApiRuntimeOptions = {},
): PropertyVaultApiRuntime {
  const env = options.env ?? process.env;
  const serverUrl = resolveServerUrl(env);

  return {
    application: createPropertyVaultApplication(),
    openApiDocument: generatePropertyVaultOpenApiDocument({
      servers: serverUrl
        ? [
            {
              description: 'Configured Property Vault app origin.',
              url: serverUrl,
            },
          ]
        : undefined,
    }),
  };
}

export function getPropertyVaultApiRuntime(): PropertyVaultApiRuntime {
  globalThis.__propertyVaultApiRuntime ??= createPropertyVaultApiRuntime();

  return globalThis.__propertyVaultApiRuntime;
}

export async function resetPropertyVaultApiRuntimeForTests(): Promise<void> {
  globalThis.__propertyVaultApiRuntime = undefined;
}

function resolveServerUrl(env: NodeJS.ProcessEnv): string {
  const candidate =
    env.NEXT_PUBLIC_APP_ORIGIN ??
    env.BETTER_AUTH_URL ??
    PROPERTY_VAULT_DEFAULT_APP_ORIGIN;

  return new URL(candidate).toString().replace(/\/$/, '');
}

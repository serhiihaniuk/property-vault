export const BETTER_AUTH_SECRET_ENV_VAR = 'BETTER_AUTH_SECRET';
export const AUTH_SECRET_ENV_VAR = 'AUTH_SECRET';
export const BETTER_AUTH_URL_ENV_VAR = 'BETTER_AUTH_URL';
export const BETTER_AUTH_TRUSTED_ORIGINS_ENV_VAR = 'BETTER_AUTH_TRUSTED_ORIGINS';
export const PROPERTY_VAULT_APP_NAME = 'Property Vault';

export interface ResolvePropertyVaultAuthConfigOptions {
  appName?: string;
  baseURL?: string;
  env?: NodeJS.ProcessEnv;
  secret?: string;
  trustedOrigins?: readonly string[];
}

export interface PropertyVaultAuthConfig {
  appName: string;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
}

function requireEnvValue(value: string | undefined, envVar: string, message: string): string {
  if (!value) {
    throw new Error(`${message} Set ${envVar} before using @dabrowskiego/auth.`);
  }

  return value;
}

function normalizeBaseUrl(baseURL: string): string {
  const normalized = new URL(baseURL);

  return normalized.toString().replace(/\/$/, '');
}

function parseTrustedOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const trustedOrigins: string[] = [];

  for (const entry of value.split(',')) {
    const trimmed = entry.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    trustedOrigins.push(trimmed);
  }

  return trustedOrigins;
}

export function getBetterAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  return requireEnvValue(
    env[BETTER_AUTH_SECRET_ENV_VAR] ?? env[AUTH_SECRET_ENV_VAR],
    BETTER_AUTH_SECRET_ENV_VAR,
    'Missing Better Auth secret.',
  );
}

export function getBetterAuthUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeBaseUrl(
    requireEnvValue(
      env[BETTER_AUTH_URL_ENV_VAR],
      BETTER_AUTH_URL_ENV_VAR,
      'Missing Better Auth base URL.',
    ),
  );
}

export function getBetterAuthTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseTrustedOrigins(env[BETTER_AUTH_TRUSTED_ORIGINS_ENV_VAR]);
}

export function resolvePropertyVaultAuthConfig(
  options: ResolvePropertyVaultAuthConfigOptions = {},
): PropertyVaultAuthConfig {
  const env = options.env ?? process.env;

  return {
    appName: options.appName ?? PROPERTY_VAULT_APP_NAME,
    baseURL: options.baseURL ? normalizeBaseUrl(options.baseURL) : getBetterAuthUrl(env),
    secret: options.secret ?? getBetterAuthSecret(env),
    trustedOrigins: options.trustedOrigins
      ? [...options.trustedOrigins]
      : getBetterAuthTrustedOrigins(env),
  };
}


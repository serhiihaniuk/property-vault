const DEFAULT_API_BASE_PATH = "/api";
const DEFAULT_AUTH_BASE_PATH = "/api/auth";

export interface PropertyVaultPublicConfig {
  apiBasePath: string;
  authBasePath: string;
}

export function resolvePropertyVaultPublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): PropertyVaultPublicConfig {
  return {
    apiBasePath: normalizeBasePath(env.NEXT_PUBLIC_API_BASE_URL, DEFAULT_API_BASE_PATH),
    authBasePath: normalizeBasePath(env.NEXT_PUBLIC_AUTH_BASE_URL, DEFAULT_AUTH_BASE_PATH),
  };
}

function normalizeBasePath(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;

  if (candidate === "/") {
    return candidate;
  }

  return candidate.replace(/\/+$/, "");
}

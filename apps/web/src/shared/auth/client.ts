import { createAuthClient } from "better-auth/react";

import { resolvePropertyVaultPublicConfig } from "../config/public-env.ts";

export function createPropertyVaultAuthClient(options: { baseURL?: string } = {}) {
  const config = resolvePropertyVaultPublicConfig();

  return createAuthClient({
    baseURL: resolveAuthBaseUrl(options.baseURL ?? config.authBasePath),
  });
}

export type PropertyVaultAuthClient = ReturnType<typeof createPropertyVaultAuthClient>;
export type PropertyVaultSession = PropertyVaultAuthClient["$Infer"]["Session"];

function resolveAuthBaseUrl(baseUrl: string) {
  if (isAbsoluteUrl(baseUrl)) {
    return normalizeAbsoluteUrl(baseUrl);
  }

  return new URL(baseUrl, getAppOrigin()).toString().replace(/\/$/, "");
}

function getAppOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function normalizeAbsoluteUrl(value: string) {
  return new URL(value).toString().replace(/\/$/, "");
}

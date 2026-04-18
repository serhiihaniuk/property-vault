import assert from "node:assert/strict";
import test from "node:test";

import { resolvePropertyVaultPublicConfig } from "./public-env.ts";

test("resolvePropertyVaultPublicConfig falls back to same-origin api paths", () => {
  assert.deepEqual(resolvePropertyVaultPublicConfig({} as NodeJS.ProcessEnv), {
    apiBasePath: "/api",
    authBasePath: "/api/auth",
  });
});

test("resolvePropertyVaultPublicConfig trims trailing slashes from public overrides", () => {
  assert.deepEqual(
    resolvePropertyVaultPublicConfig(
      {
        NEXT_PUBLIC_API_BASE_URL: "https://example.test/api/",
        NEXT_PUBLIC_AUTH_BASE_URL: "/custom-auth/",
      } as unknown as NodeJS.ProcessEnv,
    ),
    {
      apiBasePath: "https://example.test/api",
      authBasePath: "/custom-auth",
    },
  );
});

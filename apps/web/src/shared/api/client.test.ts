import assert from "node:assert/strict";
import test from "node:test";

import { createPropertyVaultApiClient, PropertyVaultApiError } from "./client.ts";

test("createPropertyVaultApiClient issues same-origin json requests with credentials", async () => {
  let receivedUrl: string | undefined;
  let receivedInit: RequestInit | undefined;

  const client = createPropertyVaultApiClient({
    baseUrl: "/api",
    fetch: async (input, init) => {
      receivedUrl = String(input);
      receivedInit = init;

      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      });
    },
  });

  const response = await client.get("/health", {
    query: {
      verbose: true,
    },
  });

  assert.deepEqual(response, { ok: true });
  assert.equal(receivedUrl, "/api/health?verbose=true");
  assert.equal(receivedInit?.credentials, "include");
  assert.equal(new Headers(receivedInit?.headers).get("accept"), "application/json");
});

test("createPropertyVaultApiClient surfaces api problem responses", async () => {
  const client = createPropertyVaultApiClient({
    baseUrl: "/api",
    fetch: async () =>
      new Response(
        JSON.stringify({
          detail: "The service is still booting.",
          status: 503,
          title: "Temporarily unavailable",
          type: "https://property-vault.test/problems/unavailable",
        }),
        {
          headers: {
            "content-type": "application/json",
          },
          status: 503,
          statusText: "Service Unavailable",
        },
      ),
  });

  await assert.rejects(
    () => client.get("/health"),
    (error) => {
      assert.ok(error instanceof PropertyVaultApiError);
      assert.equal(error.status, 503);
      assert.equal(error.problem?.title, "Temporarily unavailable");

      return true;
    },
  );
});

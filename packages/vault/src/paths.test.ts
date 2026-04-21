import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import { getVaultPaths, resolveRepoRoot } from "./paths.ts";

test("resolveRepoRoot honors VAULT_ROOT when provided", () => {
  const explicitRoot = path.resolve("property-vault-root");

  assert.equal(
    resolveRepoRoot({
      cwd: path.resolve("somewhere", "else"),
      env: { VAULT_ROOT: explicitRoot },
    }),
    explicitRoot,
  );
});

test("getVaultPaths derives canonical vault locations from the resolved root", () => {
  const root = path.resolve("property-vault-root");
  const paths = getVaultPaths(root);

  assert.equal(paths.root, root);
  assert.equal(paths.vaultDir, path.join(root, "vault"));
  assert.equal(paths.documentsDir, path.join(root, "vault", "documents"));
  assert.equal(paths.databasePath, path.join(root, "index", "vault.db"));
  assert.equal(paths.inboxReport, path.join(root, "reports", "inbox.md"));
});

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RepoRootOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export type VaultPaths = {
  root: string;
  vaultDir: string;
  documentsDir: string;
  vaultOcrDir: string;
  emailsDir: string;
  recordsDir: string;
  notesDir: string;
  sourcesJsonl: string;
  stateJson: string;
  indexDir: string;
  databasePath: string;
  rendersDir: string;
  indexOcrDir: string;
  reportsDir: string;
  inboxReport: string;
  reportArchiveDir: string;
};

const REPO_MARKERS = ['DESIGN.md', 'IMPLEMENTATION_PLAN.md', 'package.json'];

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

export function resolveRepoRoot(options: RepoRootOptions = {}): string {
  const env = options.env ?? process.env;
  const explicitRoot = env.VAULT_ROOT;

  if (explicitRoot && explicitRoot.trim() !== '') {
    return path.resolve(explicitRoot);
  }

  let current = path.resolve(options.cwd ?? process.cwd());

  while (true) {
    if (isRepoRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new PathError(
        `Could not find repo root from ${path.resolve(options.cwd ?? process.cwd())}`,
      );
    }

    current = parent;
  }
}

export function getVaultPaths(root = resolveRepoRoot()): VaultPaths {
  const resolvedRoot = path.resolve(root);
  const vaultDir = path.join(resolvedRoot, 'vault');
  const indexDir = path.join(resolvedRoot, 'index');
  const reportsDir = path.join(resolvedRoot, 'reports');

  return {
    root: resolvedRoot,
    vaultDir,
    documentsDir: path.join(vaultDir, 'documents'),
    vaultOcrDir: path.join(vaultDir, 'ocr'),
    emailsDir: path.join(vaultDir, 'emails'),
    recordsDir: path.join(vaultDir, 'records'),
    notesDir: path.join(vaultDir, 'notes'),
    sourcesJsonl: path.join(vaultDir, 'sources.jsonl'),
    stateJson: path.join(vaultDir, 'state.json'),
    indexDir,
    databasePath: path.join(indexDir, 'vault.db'),
    rendersDir: path.join(indexDir, 'renders'),
    indexOcrDir: path.join(indexDir, 'ocr'),
    reportsDir,
    inboxReport: path.join(reportsDir, 'inbox.md'),
    reportArchiveDir: path.join(reportsDir, 'archive'),
  };
}

export function fromToolsDir(...parts: string[]): string {
  const toolsDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(toolsDir, ...parts);
}

function isRepoRoot(candidate: string): boolean {
  return REPO_MARKERS.every((marker) => existsSync(path.join(candidate, marker)));
}

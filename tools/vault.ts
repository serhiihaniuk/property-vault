import { constants } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { getVaultPaths, resolveRepoRoot, type VaultPaths } from './paths.ts';
import { createDefaultState, readState, writeState } from './state.ts';

export type InitResult = {
  root: string;
  createdDirectories: string[];
  createdFiles: string[];
};

export async function init(root = resolveRepoRoot()): Promise<InitResult> {
  const paths = getVaultPaths(root);
  const createdDirectories: string[] = [];
  const createdFiles: string[] = [];

  for (const directory of directoriesForInit(paths)) {
    const existed = await pathExists(directory);
    await mkdir(directory, { recursive: true });

    if (!existed) {
      createdDirectories.push(directory);
    }
  }

  if (!(await pathExists(paths.sourcesJsonl))) {
    await writeFile(paths.sourcesJsonl, '', { encoding: 'utf8', flag: 'wx' });
    createdFiles.push(paths.sourcesJsonl);
  }

  if (!(await pathExists(paths.stateJson))) {
    await writeState(createDefaultState(), root);
    createdFiles.push(paths.stateJson);
  } else {
    await readState(root);
  }

  return {
    root: paths.root,
    createdDirectories,
    createdFiles,
  };
}

export const vault = {
  init,
};

function directoriesForInit(paths: VaultPaths): string[] {
  return [
    paths.vaultDir,
    paths.documentsDir,
    paths.vaultOcrDir,
    paths.emailsDir,
    paths.recordsDir,
    paths.notesDir,
    paths.indexDir,
    paths.rendersDir,
    paths.indexOcrDir,
    paths.reportsDir,
    paths.reportArchiveDir,
  ];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'dabrowskiego';

export type AppConfigPaths = {
  configDir: string;
  credentialsJson: string;
  gmailTokenJson: string;
};

export function getAppConfigPaths(): AppConfigPaths {
  const configDir = path.join(os.homedir(), '.config', APP_NAME);

  return {
    configDir,
    credentialsJson: path.join(configDir, 'credentials.json'),
    gmailTokenJson: path.join(configDir, 'gmail-token.json'),
  };
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

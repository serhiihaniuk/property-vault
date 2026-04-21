import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { getBetterAuthSecret, getBetterAuthUrl } from '../packages/auth/src/config.ts';
import { getDatabaseUrl } from '../packages/db/src/config.ts';

const ROOT_ENV_PATH = path.resolve('.env');
const TURBO_BIN_PATH = path.resolve('node_modules', 'turbo', 'bin', 'turbo');
const WEB_FILTER = '@dabrowskiego/web';

function loadRootEnvFile(): void {
  if (!existsSync(ROOT_ENV_PATH)) {
    console.warn('Root .env not found. Falling back to the current shell environment.');
    return;
  }

  process.loadEnvFile(ROOT_ENV_PATH);
  console.log(`Loaded local web env from ${path.relative(process.cwd(), ROOT_ENV_PATH)}.`);
}

function validateLocalDevEnv(): void {
  const errors: string[] = [];

  for (const readConfig of [getDatabaseUrl, getBetterAuthSecret, getBetterAuthUrl]) {
    try {
      readConfig(process.env);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length === 0) {
    return;
  }

  console.error('Local web startup is missing required environment variables.');

  if (!existsSync(ROOT_ENV_PATH)) {
    console.error('Create .env from .env.example, then replace BETTER_AUTH_SECRET before running npm run dev.');
  } else {
    console.error('Update .env or your current shell environment before running npm run dev.');
  }

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

function resolveTurboEntryPoint(): string {
  if (!existsSync(TURBO_BIN_PATH)) {
    throw new Error('Missing node_modules/turbo/bin/turbo. Run npm install before starting local dev.');
  }

  return TURBO_BIN_PATH;
}

function main(): void {
  loadRootEnvFile();
  validateLocalDevEnv();

  const turboEntryPoint = resolveTurboEntryPoint();
  const child = spawnSync(
    process.execPath,
    [turboEntryPoint, 'dev', `--filter=${WEB_FILTER}`, ...process.argv.slice(2)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (child.error) {
    throw child.error;
  }

  if (typeof child.status === 'number') {
    process.exitCode = child.status;
    return;
  }

  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

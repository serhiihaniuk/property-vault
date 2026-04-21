import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { getBetterAuthSecret, getBetterAuthUrl } from '../packages/auth/src/config.ts';
import { getDatabaseUrl } from '../packages/db/src/config.ts';

const ROOT_ENV_PATH = path.resolve('.env');
const TURBO_BIN_PATH = path.resolve('node_modules', 'turbo', 'bin', 'turbo');
const WEB_FILTER = '@dabrowskiego/web';
const SKIP_WEB_PREDEV_ENV_VAR = 'PROPERTY_VAULT_SKIP_WEB_PREDEV';

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

function runBootstrapStep(
  label: string,
  args: string[],
  failureHint?: string,
): void {
  console.log(`\n==> ${label}`);

  const child =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['npm', ...args].join(' ')], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        })
      : spawnSync('npm', args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        });

  if (child.error) {
    if ((child.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('npm is not available in PATH. Install repo dependencies before running npm run dev.');
    }

    throw child.error;
  }

  if (child.status === 0) {
    return;
  }

  const message = failureHint ? `${label} failed. ${failureHint}` : `${label} failed.`;
  throw new Error(message);
}

function bootstrapLocalDev(): void {
  runBootstrapStep(
    'Starting local Postgres in Docker',
    ['run', 'docker:db:up'],
    'Make sure Docker Desktop is running and docker compose is available.',
  );
  runBootstrapStep('Applying database migrations', ['run', 'db:migrate']);
  runBootstrapStep(
    'Syncing canonical vault data into Postgres',
    ['run', 'vault', '--', 'sync'],
    'Fix the reported sync error before starting local web development.',
  );
}

function main(): void {
  loadRootEnvFile();
  validateLocalDevEnv();
  bootstrapLocalDev();

  const turboEntryPoint = resolveTurboEntryPoint();
  process.env[SKIP_WEB_PREDEV_ENV_VAR] = '1';
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

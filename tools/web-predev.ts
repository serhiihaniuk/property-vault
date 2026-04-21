import process from 'node:process';
import { spawnSync } from 'node:child_process';

const SKIP_WEB_PREDEV_ENV_VAR = 'PROPERTY_VAULT_SKIP_WEB_PREDEV';

function main(): void {
  if (process.env[SKIP_WEB_PREDEV_ENV_VAR] === '1') {
    console.log('Skipping apps/web predev migrate because root npm run dev already completed bootstrap.');
    return;
  }

  const child =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm --prefix ../.. run db:migrate'], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        })
      : spawnSync('npm', ['--prefix', '../..', 'run', 'db:migrate'], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        });

  if (child.error) {
    throw child.error;
  }

  if (child.status === 0) {
    return;
  }

  throw new Error('apps/web predev migrate failed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

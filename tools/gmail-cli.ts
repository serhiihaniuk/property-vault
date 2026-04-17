import { authenticateGmail } from './gmail-auth.ts';

const HELP_TEXT = `Dabrowskiego Gmail CLI

Usage:
  pnpm gmail <command>

Commands:
  auth      Authorize Gmail readonly access and save a local token
`;

async function main(argv: string[]): Promise<number> {
  const command = argv[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    return 0;
  }

  if (command !== 'auth') {
    console.error(`Unknown gmail command: ${command}`);
    console.error('');
    console.error(HELP_TEXT);
    return 2;
  }

  const result = await authenticateGmail();
  console.log(`Saved Gmail token to ${result.tokenPath}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);

import { authenticateGmail } from './gmail-auth.ts';
import { buildLocatorQuery, listLocatorMessages } from './gmail.ts';

const HELP_TEXT = `Dabrowskiego Gmail CLI

Usage:
  npm run gmail -- <command> [options]

Commands:
  auth                     Authorize Gmail readonly access and save a local token
  list-locator [--max N]   List Locator message ids using Gmail REST

Options:
  --after YYYY-MM-DD       Add a Gmail after: date filter
  --max N                  Maximum messages to list
  --json                   Print machine-readable JSON
`;

async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    return 0;
  }

  switch (command) {
    case 'auth': {
      const result = await authenticateGmail();
      console.log(`Saved Gmail token to ${result.tokenPath}`);
      return 0;
    }
    case 'list-locator':
      return runListLocator(flags);
    default:
      console.error(`Unknown gmail command: ${command}`);
      console.error('');
      console.error(HELP_TEXT);
      return 2;
  }
}

async function runListLocator(flags: Map<string, string | boolean>): Promise<number> {
  const max = stringFlag(flags, 'max');
  const after = stringFlag(flags, 'after') ?? undefined;
  const messages = await listLocatorMessages({
    maxResults: max ? Number(max) : 20,
    after,
  });

  if (flags.has('json')) {
    console.log(JSON.stringify({
      query: buildLocatorQuery({ after }),
      messages,
    }, null, 2));
  } else {
    console.log(`Query: ${buildLocatorQuery({ after })}`);
    for (const message of messages) {
      console.log(`${message.id}\t${message.threadId}`);
    }
  }

  return 0;
}

function parseArgs(argv: string[]): {
  command: string | null;
  flags: Map<string, string | boolean>;
} {
  const flags = new Map<string, string | boolean>();
  let command: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[index + 1];

      if ((name === 'max' || name === 'after') && next && !next.startsWith('-')) {
        flags.set(name, next);
        index += 1;
      } else {
        flags.set(name, true);
      }

      continue;
    }

    if (!command) {
      command = arg;
    }
  }

  return { command, flags };
}

function stringFlag(flags: Map<string, string | boolean>, name: string): string | null {
  const value = flags.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value : null;
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

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectPdf, renderPdfPages, resolvePdfPathOrHash } from './pdf.ts';
import { exportRecordJsonSchema } from './schemas/export-json-schema.ts';
import { parseVaultRecord } from './schemas/record.ts';
import {
  init,
  registerDocument,
  reindex,
  sql,
  validate,
  type RegisterDocumentResult,
  type ReindexResult,
  type ValidationReport,
} from './vault.ts';

type ParsedArgs = {
  command: string | null;
  positional: string[];
  flags: Map<string, string | boolean>;
};

type CommandContext = {
  args: ParsedArgs;
  json: boolean;
};

const HELP_TEXT = `Property Vault CLI

Usage:
  pnpm vault <command> [options]

Commands:
  setup                         Create vault, index, reports, state, and DB schema
  validate [--json]             Validate vault structure and derived index
  reindex [--json]              Rebuild SQLite index from canonical vault files
  register-document <path>      Register a local file by content hash
  sql --select "<SQL>"           Run a read-only SELECT query
  inspect-pdf <hash-or-path>     Inspect PDF page count and text layer
  render-pdf <hash>              Render canonical PDF pages to index/renders
  export-schema [path]           Export record JSON Schema
  validate-record <path>         Validate a record JSON file

Options:
  --source <kind>               Source kind for register-document (default: manual_drop)
  --select <SQL>                SQL SELECT statement for the sql command
  --scale <number>              Render scale for render-pdf (default: 1.5)
  --desired-width <px>          Target render width for render-pdf
  --json                        Print machine-readable JSON
  -h, --help                    Show help
`;

const COMMANDS = new Set([
  'setup',
  'validate',
  'reindex',
  'register-document',
  'sql',
  'inspect-pdf',
  'render-pdf',
  'export-schema',
  'validate-record',
]);

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.flags.has('help') || args.flags.has('h') || args.command === null) {
    console.log(HELP_TEXT);
    return 0;
  }

  if (!COMMANDS.has(args.command)) {
    console.error(`Unknown command: ${args.command}`);
    console.error('');
    console.error(HELP_TEXT);
    return 2;
  }

  const context: CommandContext = {
    args,
    json: args.flags.has('json'),
  };

  switch (args.command) {
    case 'setup':
      return runSetup(context);
    case 'validate':
      return runValidate(context);
    case 'reindex':
      return runReindex(context);
    case 'register-document':
      return runRegisterDocument(context);
    case 'sql':
      return runSql(context);
    case 'inspect-pdf':
      return runInspectPdf(context);
    case 'render-pdf':
      return runRenderPdf(context);
    case 'export-schema':
      return runExportSchema(context);
    case 'validate-record':
      return runValidateRecord(context);
    default:
      unreachable(args.command);
  }
}

async function runSetup(context: CommandContext): Promise<number> {
  const result = await init();

  if (context.json) {
    printJson(result);
    return 0;
  }

  console.log(`Vault initialized at ${result.root}`);
  console.log(`Created directories: ${result.createdDirectories.length}`);
  console.log(`Created files: ${result.createdFiles.length}`);

  return 0;
}

async function runValidate(context: CommandContext): Promise<number> {
  const report = await validate();

  if (context.json) {
    printJson(report);
  } else {
    printValidationReport(report);
  }

  return report.ok ? 0 : 1;
}

async function runReindex(context: CommandContext): Promise<number> {
  const result = await reindex();

  if (context.json) {
    printJson(result);
  } else {
    printReindexResult(result);
  }

  return 0;
}

async function runRegisterDocument(context: CommandContext): Promise<number> {
  const targetPath = context.args.positional[0];

  if (!targetPath) {
    console.error('register-document requires a file path');
    return 2;
  }

  const sourceKind = stringFlag(context.args, 'source') ?? 'manual_drop';
  const result = await registerDocument({
    path: path.resolve(targetPath),
    source: {
      kind: sourceKind,
    },
  });

  if (context.json) {
    printJson(result);
  } else {
    printRegisterDocumentResult(result);
  }

  return 0;
}

async function runSql(context: CommandContext): Promise<number> {
  const query = stringFlag(context.args, 'select') ?? context.args.positional.join(' ');

  if (!query.trim()) {
    console.error('sql requires --select "<SQL>" or a positional SELECT statement');
    return 2;
  }

  const rows = await sql(query);
  printJson(rows);

  return 0;
}

async function runInspectPdf(context: CommandContext): Promise<number> {
  const target = context.args.positional[0];

  if (!target) {
    console.error('inspect-pdf requires a hash or file path');
    return 2;
  }

  const pdfPath = await resolvePdfPathOrHash(target);
  const result = await inspectPdf(pdfPath);

  if (context.json) {
    printJson(result);
  } else {
    console.log(`Pages: ${result.pageCount}`);
    console.log(`Text length: ${result.textLength}`);
    console.log(`Has text layer: ${yesNo(result.hasTextLayer)}`);
    console.log(`Needs vision: ${yesNo(result.needsVision)}`);
    if (result.textPreview) {
      console.log('');
      console.log(result.textPreview);
    }
  }

  return 0;
}

async function runRenderPdf(context: CommandContext): Promise<number> {
  const hash = context.args.positional[0];

  if (!hash) {
    console.error('render-pdf requires a canonical document hash');
    return 2;
  }

  const scaleFlag = stringFlag(context.args, 'scale');
  const desiredWidthFlag = stringFlag(context.args, 'desired-width');
  const pages = await renderPdfPages(hash, {
    scale: scaleFlag ? Number(scaleFlag) : undefined,
    desiredWidth: desiredWidthFlag ? Number(desiredWidthFlag) : undefined,
  });

  if (context.json) {
    printJson(pages);
  } else {
    console.log(`Rendered pages: ${pages.length}`);
    for (const page of pages) {
      console.log(`Page ${page.page}: ${page.path}`);
    }
  }

  return 0;
}

async function runExportSchema(context: CommandContext): Promise<number> {
  const outputPath = context.args.positional[0]
    ? path.resolve(context.args.positional[0])
    : undefined;
  const writtenPath = await exportRecordJsonSchema(outputPath);

  if (context.json) {
    printJson({ path: writtenPath });
  } else {
    console.log(`Exported record schema to ${writtenPath}`);
  }

  return 0;
}

async function runValidateRecord(context: CommandContext): Promise<number> {
  const targetPath = context.args.positional[0];

  if (!targetPath) {
    console.error('validate-record requires a JSON file path');
    return 2;
  }

  const raw = await readFile(path.resolve(targetPath), 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const record = parseVaultRecord(parsed);

  if (context.json) {
    printJson({
      ok: true,
      document_type: record.document_type,
      title: record.title,
      status: record.status,
    });
  } else {
    console.log(`Record valid: ${record.title}`);
    console.log(`Type: ${record.document_type}`);
    console.log(`Status: ${record.status}`);
  }

  return 0;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
  let command: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const [rawName, inlineValue] = arg.slice(2).split('=', 2);
      const name = rawName.trim();

      if (inlineValue !== undefined) {
        flags.set(name, inlineValue);
        continue;
      }

      const next = argv[index + 1];
      if (next && !next.startsWith('-') && flagExpectsValue(name)) {
        flags.set(name, next);
        index += 1;
      } else {
        flags.set(name, true);
      }

      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      for (const flag of arg.slice(1)) {
        flags.set(flag, true);
      }

      continue;
    }

    if (command === null) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return {
    command,
    positional,
    flags,
  };
}

function flagExpectsValue(name: string): boolean {
  return name === 'source' || name === 'select' || name === 'scale' || name === 'desired-width';
}

function stringFlag(args: ParsedArgs, name: string): string | null {
  const value = args.flags.get(name);

  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  return null;
}

function printRegisterDocumentResult(result: RegisterDocumentResult): void {
  console.log(`Registered document ${result.hash}`);
  console.log(`Path: ${result.relativePath}`);
  console.log(`MIME: ${result.mime}`);
  console.log(`Size: ${result.sizeBytes} bytes`);
  console.log(`New document: ${yesNo(result.isNewDocument)}`);
  console.log(`New source: ${yesNo(result.isNewSource)}`);
}

function printReindexResult(result: ReindexResult): void {
  console.log(`Reindexed vault at ${result.root}`);
  console.log(`Documents indexed: ${result.documentsIndexed}`);
  console.log(`Sources indexed: ${result.sourcesIndexed}`);
  console.log(`Sources skipped: ${result.sourcesSkipped}`);
}

function printValidationReport(report: ValidationReport): void {
  console.log(`Vault validation: ${report.ok ? 'ok' : 'failed'}`);
  console.log(`Root: ${report.root}`);
  console.log(`Canonical documents: ${report.counts.canonicalDocuments}`);
  console.log(`Source observations: ${report.counts.sourceObservations}`);
  console.log(`DB documents: ${report.counts.dbDocuments ?? 'not checked'}`);
  console.log(`DB sources: ${report.counts.dbSources ?? 'not checked'}`);

  for (const issue of [...report.errors, ...report.warnings]) {
    const pathSuffix = issue.path ? ` (${issue.path})` : '';
    console.log(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${pathSuffix}`);
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function unreachable(value: never): never {
  throw new Error(`Unhandled command: ${value}`);
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

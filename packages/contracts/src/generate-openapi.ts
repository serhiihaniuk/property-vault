import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generatePropertyVaultOpenApiDocument } from './system.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const outIndex = args.indexOf('--out');
  const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const document = generatePropertyVaultOpenApiDocument();
  const serializedDocument = `${JSON.stringify(document, null, 2)}\n`;

  if (checkOnly) {
    process.stdout.write('OpenAPI document generated successfully.\n');
    return;
  }

  if (outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), outPath);
    await mkdir(path.dirname(resolvedOutPath), { recursive: true });
    await writeFile(resolvedOutPath, serializedDocument, 'utf8');
    process.stdout.write(`Wrote OpenAPI document to ${resolvedOutPath}\n`);
    return;
  }

  process.stdout.write(serializedDocument);
}

void main();

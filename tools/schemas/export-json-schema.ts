import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RecordSchema } from './record.ts';

export async function exportRecordJsonSchema(outputPath = defaultOutputPath()): Promise<string> {
  const schema = zodToJsonSchema(RecordSchema, {
    name: 'PropertyVaultRecordV1',
    $refStrategy: 'root',
  });

  await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  return outputPath;
}

function defaultOutputPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'record.v1.json');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  exportRecordJsonSchema(process.argv[2]).then(
    (outputPath) => {
      console.log(outputPath);
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}

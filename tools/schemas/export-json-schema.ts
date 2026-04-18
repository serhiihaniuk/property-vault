import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportRecordJsonSchema } from '../../packages/vault/src/schemas/export-json-schema.ts';

export { exportRecordJsonSchema };

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

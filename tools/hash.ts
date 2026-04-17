import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export function sha256Buffer(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

export function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!isSha256Hex(normalized)) {
    throw new Error(`Invalid SHA-256 hash: ${value}`);
  }

  return normalized;
}

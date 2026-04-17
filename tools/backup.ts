import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256Buffer } from './hash.ts';
import { getVaultPaths, resolveRepoRoot } from './paths.ts';
import { init } from './vault.ts';

export type BackupManifestEntry = {
  path: string;
  size: number;
  sha256: string;
  modified_at: string;
};

export type BackupManifest = {
  version: 1;
  created_at: string;
  root_name: string;
  files: BackupManifestEntry[];
};

export type BackupCreateResult = {
  path: string;
  relativePath: string | null;
  files: number;
  bytes: number;
  manifest: BackupManifest;
};

export type BackupVerifyResult = {
  ok: boolean;
  path: string;
  files: number;
  errors: string[];
  manifest: BackupManifest | null;
};

type ZipEntryInput = {
  name: string;
  data: Buffer;
  modifiedAt: Date;
};

type ParsedZipEntry = {
  name: string;
  data: Buffer;
  crc32: number;
};

const MANIFEST_PATH = 'manifest.json';
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

export async function createBackup(
  dest: string,
  root = resolveRepoRoot(),
  now = new Date(),
): Promise<BackupCreateResult> {
  await init(root);

  const paths = getVaultPaths(root);
  const destinationDir = path.resolve(dest);
  await mkdir(destinationDir, { recursive: true });

  const files = await collectVaultFiles(root);
  const manifest: BackupManifest = {
    version: 1,
    created_at: now.toISOString(),
    root_name: path.basename(paths.root),
    files,
  };
  const entries: ZipEntryInput[] = [];

  entries.push({
    name: MANIFEST_PATH,
    data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    modifiedAt: now,
  });

  for (const file of files) {
    entries.push({
      name: file.path,
      data: await readFile(path.join(root, file.path)),
      modifiedAt: new Date(file.modified_at),
    });
  }

  const outputPath = path.join(destinationDir, `vault-${now.toISOString().slice(0, 10)}.zip`);
  const archive = buildZip(entries);
  await writeFile(outputPath, archive);

  return {
    path: outputPath,
    relativePath: toRepoRelativePathOrNull(root, outputPath),
    files: files.length,
    bytes: archive.byteLength,
    manifest,
  };
}

export async function verifyBackup(
  archivePath: string,
): Promise<BackupVerifyResult> {
  const resolvedPath = path.resolve(archivePath);
  const archive = await readFile(resolvedPath);
  const errors: string[] = [];
  let entries: ParsedZipEntry[] = [];
  let manifest: BackupManifest | null = null;

  try {
    entries = parseZip(archive);
  } catch (error) {
    return {
      ok: false,
      path: resolvedPath,
      files: 0,
      errors: [errorMessage(error)],
      manifest: null,
    };
  }

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const manifestEntry = byName.get(MANIFEST_PATH);

  if (!manifestEntry) {
    errors.push('Archive is missing manifest.json');
  } else {
    try {
      manifest = JSON.parse(manifestEntry.data.toString('utf8')) as BackupManifest;
      validateManifestShape(manifest);
    } catch (error) {
      errors.push(`Invalid manifest.json: ${errorMessage(error)}`);
      manifest = null;
    }
  }

  if (manifest) {
    for (const file of manifest.files) {
      const entry = byName.get(file.path);
      if (!entry) {
        errors.push(`Missing archive entry: ${file.path}`);
        continue;
      }

      if (entry.data.byteLength !== file.size) {
        errors.push(`Size mismatch for ${file.path}`);
      }

      const hash = sha256Buffer(entry.data);
      if (hash !== file.sha256) {
        errors.push(`SHA-256 mismatch for ${file.path}`);
      }
    }
  }

  for (const entry of entries) {
    if (crc32(entry.data) !== entry.crc32) {
      errors.push(`CRC-32 mismatch for ${entry.name}`);
    }
  }

  return {
    ok: errors.length === 0,
    path: resolvedPath,
    files: manifest?.files.length ?? 0,
    errors,
    manifest,
  };
}

async function collectVaultFiles(root: string): Promise<BackupManifestEntry[]> {
  const paths = getVaultPaths(root);
  const files: BackupManifestEntry[] = [];

  if (!(await pathExists(paths.vaultDir))) {
    return files;
  }

  await collectFilesRecursive(paths.vaultDir, root, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectFilesRecursive(
  directory: string,
  root: string,
  files: BackupManifestEntry[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFilesRecursive(filePath, root, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = toRepoRelativePath(root, filePath);
    const stats = await stat(filePath);
    const data = await readFile(filePath);

    files.push({
      path: relativePath,
      size: stats.size,
      sha256: sha256Buffer(data),
      modified_at: stats.mtime.toISOString(),
    });
  }
}

function buildZip(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const checksum = crc32(data);
    const dos = dateToDos(entry.modifiedAt);
    const local = Buffer.alloc(30 + name.byteLength);

    local.writeUInt32LE(ZIP_LOCAL_FILE_SIGNATURE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dos.time, 10);
    local.writeUInt16LE(dos.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.byteLength, 18);
    local.writeUInt32LE(data.byteLength, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, data);

    const central = Buffer.alloc(46 + name.byteLength);
    central.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_SIGNATURE, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dos.time, 12);
    central.writeUInt16LE(dos.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.byteLength, 20);
    central.writeUInt32LE(data.byteLength, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.byteLength + data.byteLength;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const centralSize = centralDirectory.byteLength;
  const end = Buffer.alloc(22);

  end.writeUInt32LE(ZIP_EOCD_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function parseZip(archive: Buffer): ParsedZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  let centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const entries: ParsedZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(centralOffset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP central directory');
    }

    const method = archive.readUInt16LE(centralOffset + 10);
    const crc = archive.readUInt32LE(centralOffset + 16);
    const compressedSize = archive.readUInt32LE(centralOffset + 20);
    const uncompressedSize = archive.readUInt32LE(centralOffset + 24);
    const nameLength = archive.readUInt16LE(centralOffset + 28);
    const extraLength = archive.readUInt16LE(centralOffset + 30);
    const commentLength = archive.readUInt16LE(centralOffset + 32);
    const localOffset = archive.readUInt32LE(centralOffset + 42);
    const name = archive
      .subarray(centralOffset + 46, centralOffset + 46 + nameLength)
      .toString('utf8');

    if (method !== 0) {
      throw new Error(`Unsupported ZIP compression method for ${name}: ${method}`);
    }

    if (compressedSize !== uncompressedSize) {
      throw new Error(`Compressed size mismatch for stored entry ${name}`);
    }

    if (archive.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_SIGNATURE) {
      throw new Error(`Invalid ZIP local file header for ${name}`);
    }

    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataOffset, dataOffset + uncompressedSize);

    entries.push({ name, data, crc32: crc });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const minimumOffset = Math.max(0, archive.byteLength - 65557);

  for (let offset = archive.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('Could not find ZIP end of central directory');
}

function validateManifestShape(value: BackupManifest): void {
  if (value.version !== 1 || !Array.isArray(value.files)) {
    throw new Error('Unsupported manifest format');
  }

  for (const file of value.files) {
    if (
      typeof file.path !== 'string' ||
      typeof file.size !== 'number' ||
      typeof file.sha256 !== 'string' ||
      typeof file.modified_at !== 'string'
    ) {
      throw new Error('Manifest file entry is malformed');
    }
  }
}

function crc32(data: Buffer): number {
  let value = 0xffffffff;

  for (const byte of data) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function dateToDos(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function toRepoRelativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function toRepoRelativePathOrNull(root: string, filePath: string): string | null {
  const relative = path.relative(root, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return relative.split(path.sep).join('/');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

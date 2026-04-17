import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBackup, verifyBackup } from './backup.ts';
import { registerDocument } from './vault.ts';

test('createBackup writes a zip archive with a manifest and verifiable hashes', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'backup document bytes', 'utf8');
    const registered = await registerDocument({ path: sourcePath }, fixture.root);

    const result = await createBackup(
      fixture.backups,
      fixture.root,
      new Date('2026-04-17T12:00:00.000Z'),
    );
    const verification = await verifyBackup(result.path);
    const documentEntry = result.manifest.files.find((file) =>
      file.path === `vault/documents/${registered.hash}.txt`,
    );

    assert.equal(path.basename(result.path), 'vault-2026-04-17.zip');
    assert.equal(result.files, result.manifest.files.length);
    assert.ok(result.files >= 3);
    assert.ok(documentEntry);
    assert.equal(documentEntry?.size, Buffer.byteLength('backup document bytes'));
    assert.equal(verification.ok, true);
    assert.equal(verification.files, result.files);
    assert.deepEqual(verification.errors, []);
  } finally {
    await fixture.remove();
  }
});

test('verifyBackup fails when archive bytes are tampered', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'backup document bytes', 'utf8');
    await registerDocument({ path: sourcePath }, fixture.root);

    const result = await createBackup(
      fixture.backups,
      fixture.root,
      new Date('2026-04-17T12:00:00.000Z'),
    );
    const archive = await readFile(result.path);
    const offset = archive.indexOf(Buffer.from('backup document bytes', 'utf8'));

    assert.notEqual(offset, -1);
    archive.write('X', offset, 'utf8');
    await writeFile(result.path, archive);

    const verification = await verifyBackup(result.path);

    assert.equal(verification.ok, false);
    assert.ok(verification.errors.some((error) => error.includes('SHA-256 mismatch')));
    assert.ok(verification.errors.some((error) => error.includes('CRC-32 mismatch')));
  } finally {
    await fixture.remove();
  }
});

async function createFixture(): Promise<{
  root: string;
  backups: string;
  remove: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dabrowskiego-backup-test-'));
  const backups = path.join(root, 'backups');

  return {
    root,
    backups,
    remove: async () => {
      const resolvedRoot = path.resolve(root);
      const resolvedTemp = path.resolve(os.tmpdir());
      const relative = path.relative(resolvedTemp, resolvedRoot);

      assert.ok(!relative.startsWith('..'));
      assert.ok(!path.isAbsolute(relative));

      await rm(resolvedRoot, { force: true, recursive: true });
    },
  };
}

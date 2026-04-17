import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openVaultDatabase } from './db.ts';
import { registerDocument, reindex, sql, validate } from './vault.ts';

test('registerDocument is idempotent for the same file path', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'same file bytes', 'utf8');

    const first = await registerDocument({ path: sourcePath }, fixture.root);
    const second = await registerDocument({ path: sourcePath }, fixture.root);
    const report = await validate(fixture.root);

    assert.equal(first.hash, second.hash);
    assert.equal(first.isNewDocument, true);
    assert.equal(first.isNewSource, true);
    assert.equal(second.isNewDocument, false);
    assert.equal(second.isNewSource, false);
    assert.equal(report.ok, true);
    assert.equal(report.counts.canonicalDocuments, 1);
    assert.equal(report.counts.sourceObservations, 1);
    assert.equal(report.counts.dbDocuments, 1);
    assert.equal(report.counts.dbSources, 1);
  } finally {
    await fixture.remove();
  }
});

test('registerDocument stores one document with multiple sources for identical bytes', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'notice-a.txt');
    const secondPath = path.join(fixture.root, 'notice-b.txt');
    await writeFile(firstPath, 'shared document bytes', 'utf8');
    await writeFile(secondPath, 'shared document bytes', 'utf8');

    const first = await registerDocument({ path: firstPath }, fixture.root);
    const second = await registerDocument({ path: secondPath }, fixture.root);
    const report = await validate(fixture.root);

    assert.equal(first.hash, second.hash);
    assert.equal(first.isNewDocument, true);
    assert.equal(second.isNewDocument, false);
    assert.equal(second.isNewSource, true);
    assert.equal(report.ok, true);
    assert.equal(report.counts.canonicalDocuments, 1);
    assert.equal(report.counts.sourceObservations, 2);
    assert.equal(report.counts.dbDocuments, 1);
    assert.equal(report.counts.dbSources, 2);
  } finally {
    await fixture.remove();
  }
});

test('reindex rebuilds document and source rows from canonical files', async () => {
  const fixture = await createFixture();

  try {
    const firstPath = path.join(fixture.root, 'notice-a.txt');
    const secondPath = path.join(fixture.root, 'notice-b.txt');
    await writeFile(firstPath, 'reindex document bytes', 'utf8');
    await writeFile(secondPath, 'reindex document bytes', 'utf8');

    await registerDocument({ path: firstPath }, fixture.root);
    await registerDocument({ path: secondPath }, fixture.root);

    const result = await reindex(fixture.root);
    const db = await openVaultDatabase(fixture.root);

    try {
      const documents = db.prepare('SELECT count(*) AS count FROM documents').get() as {
        count: number;
      };
      const sources = db.prepare('SELECT count(*) AS count FROM document_sources').get() as {
        count: number;
      };

      assert.equal(result.documentsIndexed, 1);
      assert.equal(result.sourcesIndexed, 2);
      assert.equal(result.sourcesSkipped, 0);
      assert.equal(documents.count, 1);
      assert.equal(sources.count, 2);
    } finally {
      db.close();
    }
  } finally {
    await fixture.remove();
  }
});

test('sql allows SELECT statements and rejects writes', async () => {
  const fixture = await createFixture();

  try {
    const sourcePath = path.join(fixture.root, 'notice.txt');
    await writeFile(sourcePath, 'query document bytes', 'utf8');
    await registerDocument({ path: sourcePath }, fixture.root);

    const rows = await sql<{ count: number }>(
      'SELECT count(*) AS count FROM documents',
      [],
      fixture.root,
    );

    assert.equal(rows[0]?.count, 1);
    await assert.rejects(
      () => sql('DELETE FROM documents', [], fixture.root),
      /only accepts SELECT/,
    );
  } finally {
    await fixture.remove();
  }
});

async function createFixture(): Promise<{ root: string; remove: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'property-vault-test-'));

  return {
    root,
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

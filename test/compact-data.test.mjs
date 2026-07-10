import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { compactJsonDirectory } from '../scripts/compact-data.mjs';

let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'ff14gils-compact-'));
});

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe('compactJsonDirectory', () => {
  it('配信JSONを再帰的にcompactし、JSON以外は変更しない', async () => {
    const nestedDirectory = join(temporaryDirectory, 'worlds');
    const indexPath = join(temporaryDirectory, 'worlds.json');
    const snapshotPath = join(nestedDirectory, 'hades.json');
    const textPath = join(temporaryDirectory, 'keep.txt');
    await mkdir(nestedDirectory);
    await writeFile(indexPath, '{\n  "defaultWorld": "Hades"\n}\n');
    await writeFile(snapshotPath, '{\n  "items": [\n    1,\n    2\n  ]\n}\n');
    await writeFile(textPath, 'keep\n');

    const result = await compactJsonDirectory(pathToFileURL(`${temporaryDirectory}/`));

    assert.deepEqual(result, { files: 2 });
    assert.equal(await readFile(indexPath, 'utf8'), '{"defaultWorld":"Hades"}');
    assert.equal(await readFile(snapshotPath, 'utf8'), '{"items":[1,2]}');
    assert.equal(await readFile(textPath, 'utf8'), 'keep\n');
  });
});

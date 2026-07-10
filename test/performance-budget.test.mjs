import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { describe, it } from 'node:test';

const FIRST_PARTY_BUDGET = 40 * 1024;
const MARKET_INITIAL_BUDGET = 64 * 1024;

describe('first-party performance budget', () => {
  it('route HTML/CSS/transitive ES modulesは40KiB gzip以下にする', async () => {
    const sourceNames = (await readdir(new URL('../src/', import.meta.url)))
      .filter((name) => name.endsWith('.js'));
    const files = [
      new URL('../index.html', import.meta.url),
      new URL('../styles.css', import.meta.url),
      ...sourceNames.map((name) => new URL(`../src/${name}`, import.meta.url)),
    ];
    const bytes = await gzipFilesIndividually(files);

    assert.ok(
      bytes <= FIRST_PARTY_BUDGET,
      `first-party gzip ${bytes} bytes exceeds ${FIRST_PARTY_BUDGET}`,
    );
  });

  it('world indexと既定snapshotを含むmarket初期転送見積は64KiB gzip以下にする', async () => {
    const worldIndexUrl = new URL('../data/worlds.json', import.meta.url);
    const worldIndex = JSON.parse(await readFile(worldIndexUrl, 'utf8'));
    const defaultWorld = worldIndex.worlds.find((world) => world.name === worldIndex.defaultWorld);
    const snapshotPath = defaultWorld?.periods?.[worldIndex.defaultPeriod] ?? defaultWorld?.path;
    assert.ok(snapshotPath, '既定snapshot pathが必要です');

    const sourceNames = (await readdir(new URL('../src/', import.meta.url)))
      .filter((name) => name.endsWith('.js'));
    const files = [
      new URL('../index.html', import.meta.url),
      new URL('../styles.css', import.meta.url),
      ...sourceNames.map((name) => new URL(`../src/${name}`, import.meta.url)),
      worldIndexUrl,
      new URL(`../${snapshotPath}`, import.meta.url),
    ];
    const bytes = await gzipFilesIndividually(files);

    assert.ok(
      bytes <= MARKET_INITIAL_BUDGET,
      `market initial gzip ${bytes} bytes exceeds ${MARKET_INITIAL_BUDGET}`,
    );
  });

  it('依存パッケージと外部fontを追加しない', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

    assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
    assert.equal(Object.keys(packageJson.devDependencies ?? {}).length, 0);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/i);
    assert.doesNotMatch(styles, /@import\s+url\([^)]*font/i);
  });
});

async function gzipFilesIndividually(urls) {
  const buffers = await Promise.all(urls.map((url) => readFile(url)));
  return buffers.reduce((total, buffer) => total + gzipSync(buffer).byteLength, 0);
}

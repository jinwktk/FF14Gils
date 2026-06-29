import { strict as assert } from 'node:assert';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('app data loading contract', () => {
  it('GitHub Pages上のUI配信対象は生成済みJSONだけを読み、Saddlebag APIへ直接POSTしない', async () => {
    const sources = await readBrowserSources();
    const joined = sources.map((source) => source.content).join('\n');

    assert.match(joined, /data\/worlds\.json/);
    assert.doesNotMatch(joined, /api\.saddlebagexchange\.com\/api\/ffxivmarketshare/);
    assert.doesNotMatch(joined, /method\s*:\s*['"]POST['"]/i);
  });

  it('ワールド選択UIを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(html, /data-world-select/);
  });

  it('Pages workflowはデプロイ前にテストを実行する', async () => {
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /run:\s*npm test/);
    assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('run: npm run fetch:data'));
  });
});

async function readBrowserSources() {
  const srcDir = new URL('../src/', import.meta.url);
  const entries = await readdir(srcDir);

  return Promise.all(
    entries
      .filter((entry) => entry.endsWith('.js'))
      .map(async (entry) => ({
        entry,
        content: await readFile(new URL(entry, srcDir), 'utf8'),
      })),
  );
}

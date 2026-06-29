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

  it('売上の集計期間を選択できる', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-period-select/);
    assert.match(html, /1日/);
    assert.match(html, /3日/);
    assert.match(html, /7日/);
    assert.match(html, /1か月/);
    assert.match(app, /periodSelect/);
    assert.match(app, /selectedPeriod/);
  });

  it('最終更新日時を一覧ヘッダーに表示する', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-updated-at/);
    assert.match(html, /最終更新/);
    assert.match(app, /updatedAt/);
  });

  it('ワールド選択はDCごとのカテゴリを描画する', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(app, /createElement\(['"]optgroup['"]\)/);
    assert.match(app, /dataCenter/);
  });

  it('列名クリックで一覧をソートできる', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-sort-button="name"/);
    assert.match(html, /data-sort-button="marketValue"/);
    assert.match(html, /data-sort-button="quantitySold"/);
    assert.match(html, /aria-sort="none"/);
    assert.match(app, /sortDirection/);
    assert.match(app, /aria-sort/);
  });

  it('操作しやすいダッシュボード構造を持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(html, /class="app-shell"/);
    assert.match(html, /class="dashboard-grid"/);
    assert.match(html, /class="[^"]*\bfilter-panel\b[^"]*"/);
    assert.match(html, /class="[^"]*\bresults-panel\b[^"]*"/);
    assert.match(html, /選んだワールドは次回も使えます/);
  });

  it('ダークデザインを使う', async () => {
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

    assert.match(styles, /color-scheme:\s*dark/);
    assert.match(styles, /--bg:\s*#[0-1][0-9a-f]{5}/i);
    assert.match(styles, /--surface:\s*#[0-2][0-9a-f]{5}/i);
    assert.match(styles, /--text:\s*#e/i);
  });

  it('重複する上部情報カードを表示しない', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.doesNotMatch(html, /class="metadata"/);
    assert.doesNotMatch(html, /class="summary-strip"/);
    assert.doesNotMatch(html, /data-world>/);
    assert.doesNotMatch(html, /data-time-period/);
    assert.doesNotMatch(html, /data-item-count/);
    assert.doesNotMatch(html, /data-total-market-value/);
    assert.doesNotMatch(html, /data-top-item/);
  });

  it('Pages workflowはデプロイ前にテストを実行する', async () => {
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /run:\s*npm test/);
    assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('run: npm run fetch:data'));
  });

  it('Pages workflowはAPIデータを10分ごとに更新する', async () => {
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /cron:\s*['"]3-59\/10 \* \* \* \*['"]/);
    assert.ok(workflow.indexOf('run: npm run fetch:data') < workflow.indexOf('run: npm run build'));
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

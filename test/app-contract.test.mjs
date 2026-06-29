import { strict as assert } from 'node:assert';
import { access, readdir, readFile } from 'node:fs/promises';
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

  it('OGPとSEO向けのメタ情報を持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(html, /<meta name="description" content="FF14のマーケット/);
    assert.match(html, /<link rel="canonical" href="https:\/\/jinwktk\.github\.io\/FF14Gils\/"/);
    assert.match(html, /<meta property="og:type" content="website"/);
    assert.match(html, /<meta property="og:title" content="FF14Gils/);
    assert.match(html, /<meta property="og:image" content="https:\/\/jinwktk\.github\.io\/FF14Gils\/assets\/og-image\.png"/);
    assert.match(html, /<meta property="og:image:width" content="1200"/);
    assert.match(html, /<meta property="og:image:height" content="630"/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(html, /<script type="application\/ld\+json">/);
  });

  it('Google検索向けのクロール設定とsitemap案内を持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
    const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

    assert.match(html, /<meta name="googlebot" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"/);
    assert.match(html, /<link rel="sitemap" type="application\/xml" title="Sitemap" href="https:\/\/jinwktk\.github\.io\/FF14Gils\/sitemap\.xml"/);
    assert.match(robots, /User-agent:\s*\*/);
    assert.match(robots, /Allow:\s*\//);
    assert.match(robots, /Sitemap:\s*https:\/\/jinwktk\.github\.io\/FF14Gils\/sitemap\.xml/);
    assert.match(sitemap, /<loc>https:\/\/jinwktk\.github\.io\/FF14Gils\/<\/loc>/);
  });

  it('Google Search ConsoleのHTML確認ファイルをPages配信対象に含める', async () => {
    const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    const verification = await readFile(
      new URL('../googled9f512eea3a99dc1.html', import.meta.url),
      'utf8',
    );

    assert.equal(verification.trim(), 'google-site-verification: googled9f512eea3a99dc1.html');
    assert.match(build, /'googled9f512eea3a99dc1\.html'/);
  });

  it('ヘッダーにKo-fiの支援リンクを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const icon = await readFile(new URL('../assets/ko-fi.svg', import.meta.url), 'utf8');

    assert.match(html, /class="kofi-link"/);
    assert.match(html, /href="https:\/\/ko-fi\.com\/jinwktk"/);
    assert.match(html, /aria-label="Ko-fiで支援する"/);
    assert.match(html, /assets\/ko-fi\.svg/);
    assert.match(icon, /<svg/);
    assert.match(icon, /Ko-fi/);
  });

  it('OGP画像と検索クローラー向けファイルを配信対象に含める', async () => {
    const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    const ogImage = await readFile(new URL('../assets/og-image.png', import.meta.url));

    await access(new URL('../assets/og-image.png', import.meta.url));
    await access(new URL('../robots.txt', import.meta.url));
    await access(new URL('../sitemap.xml', import.meta.url));
    assert.deepEqual(readPngSize(ogImage), { width: 1200, height: 630 });
    assert.match(build, /'assets'/);
    assert.match(build, /'robots\.txt'/);
    assert.match(build, /'sitemap\.xml'/);
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

  it('データ生成の既定カテゴリは全般にする', async () => {
    const script = await readFile(
      new URL('../scripts/fetch-marketshare.mjs', import.meta.url),
      'utf8',
    );

    assert.match(script, /FF14GILS_PRESET\s*\?\?\s*['"]all['"]/);
    assert.doesNotMatch(script, /FF14GILS_PRESET\s*\?\?\s*['"]housing['"]/);
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

function readPngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

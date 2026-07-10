import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('mobile-first UI contract', () => {
  it('skip link、コンパクトフィルタ、live results、段階表示UIを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(html, /<a class="skip-link" href="#main-content"/);
    assert.match(html, /<main id="main-content"/);
    assert.match(html, /data-filter-toggle[^>]+aria-expanded="false"[^>]+aria-controls="market-filter-fields"/s);
    assert.match(html, /id="market-filter-fields"[^>]+data-filter-fields[^>]+hidden/s);
    assert.match(html, /data-filter-summary/);
    assert.match(html, /data-results-status[^>]+aria-live="polite"/s);
    assert.match(html, /data-results-panel[^>]+aria-busy="true"/s);
    assert.match(html, /data-load-more/);
    assert.match(html, /class="market-results-table"/);
    assert.equal(html.match(/<tbody data-results>/g)?.length, 1);
  });

  it('初期24件、24件ずつの追加、入力変更時reset、market/ranking描画分離を固定する', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(app, /INITIAL_VISIBLE_ROWS\s*=\s*24/);
    assert.match(app, /ROWS_PER_PAGE\s*=\s*24/);
    assert.match(app, /visibleRowLimit:\s*INITIAL_VISIBLE_ROWS/);
    assert.match(app, /function resetVisibleRows\(\)/);
    assert.match(app, /function showMoreResults\(\)/);
    assert.match(app, /state\.visibleRowLimit \+= ROWS_PER_PAGE/);
    assert.match(app, /filteredItems\.slice\(0, state\.visibleRowLimit\)/);
    assert.match(app, /function renderMarketResults\(\)/);
    assert.match(app, /function renderWorldRanking\(\)/);

    const marketRender = functionSource(app, 'renderMarketResults', 'renderWorldRanking');
    assert.doesNotMatch(marketRender, /renderWorldRanking/);
    assert.doesNotMatch(app, /MAX_VISIBLE_ROWS\s*=\s*80/);
  });

  it('390pxで横スクロールを外し、44px操作・focus・reduced motionを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const mobile = styles.match(/@media \(max-width: 760px\)\s*\{[\s\S]*\}\s*$/)?.[0] ?? '';

    assert.match(styles, /\.skip-link/);
    assert.match(styles, /\.filter-toggle/);
    assert.match(styles, /\.load-more-button/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(mobile, /\.market-results-table\s*\{[^}]*min-width:\s*0/s);
    assert.match(mobile, /\.market-results-table tr\s*\{[^}]*display:\s*grid/s);
    assert.doesNotMatch(mobile, /thead\s*\{[^}]*display:\s*none/s);
    assert.match(mobile, /\.world-ranking-table\s*\{[^}]*min-width:\s*0/s);
    assert.match(mobile, /\.world-ranking-table tr\s*\{[^}]*display:\s*grid/s);
    assert.doesNotMatch(mobile, /\.world-ranking-table thead\s*\{[^}]*display:\s*none/s);
    assert.match(mobile, /td:nth-child\(1\):not\(\.empty-state\)/);
    assert.match(mobile, /min-height:\s*44px/);
    assert.match(
      app,
      /if \(!mobileMedia\.matches\) \{\s*setFilterExpanded\(true\);\s*return;\s*\}/s,
    );
    assert.match(html, /<h2 id="ranking-title" data-i18n="ranking\.title">/);
  });

  it('Analyticsはtag準備前のrouteだけをbufferし、自由入力値を送らない', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const joined = `${html}\n${app}`;

    assert.equal(html.match(/gtag\('event', 'page_view'/g)?.length, 1);
    assert.match(app, /source === 'direct'/);
    assert.match(app, /window\.ff14gilsAnalytics\?\.queueInitialPageView\?\./);
    assert.match(app, /window\.ff14gilsAnalytics\?\.queuePageView\?\./);
    assert.doesNotMatch(app, /\bgtag\s*\(/);
    assert.doesNotMatch(joined, /gtag\([^\n]*(search\.value|data-search)/);
    assert.doesNotMatch(app, /ff14gilsAnalytics[^\n]*(search\.value|data-search)/);
  });

  it('現在のsnapshot取得失敗時は前期間の行と更新時刻を残さない', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const handler = functionSource(app, 'handleSnapshotLoadError', 'populateLanguageSelect');

    assert.match(handler, /state\.items = \[\]/);
    assert.match(handler, /state\.currentGeneratedAt = ''/);
    assert.match(handler, /resetVisibleRows\(\)/);
    assert.match(handler, /renderUpdatedAt\(''\)/);
    assert.match(handler, /renderMarketResults\(\)/);
    assert.match(handler, /setError\(/);
  });

  it('静的heroと同じ文言を再代入せずLCP候補を描き直さない', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const metadataUpdate = functionSource(app, 'updateRouteMetadata', 'consumePendingRoute');

    assert.match(app, /function setTextContentIfChanged\(element, value\)/);
    assert.match(metadataUpdate, /setTextContentIfChanged\(elements\.heroTitle, routeDefinition\.meta\.heroTitle\)/);
    assert.doesNotMatch(metadataUpdate, /elements\.heroTitle\.textContent\s*=/);
  });
});

function functionSource(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}`, start + 1);

  assert.notEqual(start, -1, `${functionName} が見つかりません`);
  assert.notEqual(end, -1, `${nextFunctionName} が見つかりません`);

  return source.slice(start, end);
}

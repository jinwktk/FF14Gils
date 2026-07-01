import { strict as assert } from 'node:assert';
import { access, readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { translate } from '../src/i18n.js';

describe('app data loading contract', () => {
  it('GitHub Pages上のUI配信対象は生成済みJSONだけを読み、Saddlebag APIへ直接POSTしない', async () => {
    const sources = await readBrowserSources();
    const joined = sources.map((source) => source.content).join('\n');

    assert.match(joined, /data\/worlds\.json/);
    assert.doesNotMatch(joined, /api\.saddlebagexchange\.com\/api\/ffxivmarketshare/);
    assert.doesNotMatch(joined, /method\s*:\s*['"]POST['"]/i);
  });

  it('DC選択とワールド選択を分けたUIを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-dc-select/);
    assert.match(html, /data-world-select/);
    assert.ok(html.indexOf('data-dc-select') < html.indexOf('data-world-select'));
    assert.match(html, /data-i18n="ui\.dataCenterLabel"/);
    assert.match(app, /dcSelect/);
    assert.match(app, /populateDataCenterSelect/);
    assert.match(app, /listDataCenterGroupsForWorlds/);
    assert.match(app, /formatDataCenterGroupLabel/);
    assert.match(app, /filterWorldsByDataCenter/);
  });

  it('日本語と英語を切り替えるUIとi18n契約を持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /<html lang="ja">/);
    assert.match(html, /data-language-select/);
    assert.match(html, /<option value="ja">日本語<\/option>/);
    assert.match(html, /<option value="en">English<\/option>/);
    assert.match(html, /data-i18n="ui\.filterTitle"/);
    assert.match(html, /data-i18n="table\.marketValue"/);
    assert.match(app, /from '\.\/i18n\.js'/);
    assert.match(app, /languageSelect/);
    assert.match(app, /buildLanguagePreferenceCookie/);
    assert.match(app, /document\.documentElement\.lang/);
  });

  it('売上の集計期間を選択できる', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-period-select/);
    assert.match(html, /1日/);
    assert.match(html, /3日/);
    assert.match(html, /7日/);
    assert.doesNotMatch(html, /1か月/);
    assert.match(app, /periodSelect/);
    assert.match(app, /selectedPeriod/);
  });

  it('初期表示ワールドはHadesにする', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const i18n = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');
    const worlds = await readFile(new URL('../src/worlds.js', import.meta.url), 'utf8');
    const worldIndex = JSON.parse(
      await readFile(new URL('../data/worlds.json', import.meta.url), 'utf8'),
    );
    const marketshare = JSON.parse(
      await readFile(new URL('../data/marketshare.json', import.meta.url), 'utf8'),
    );

    assert.match(worlds, /DEFAULT_WORLD\s*=\s*['"]Hades['"]/);
    assert.equal(worldIndex.defaultWorld, 'Hades');
    assert.equal(marketshare.query.server, 'Hades');
    assert.match(html, /Hades初期表示/);
    assert.doesNotMatch(html, /Chocobo初期表示/);
    assert.match(i18n, /Hades初期表示/);
    assert.match(i18n, /Starts on Hades/);
  });

  it('グラフ画面は表示せず、ワールド売上ランキングを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const worldIndex = JSON.parse(
      await readFile(new URL('../data/worlds.json', import.meta.url), 'utf8'),
    );

    assert.doesNotMatch(html, /data-view-tab/);
    assert.doesNotMatch(html, /data-chart-panel/);
    assert.doesNotMatch(app, /createMoneyFlowSummary/);
    assert.doesNotMatch(styles, /\.view-tabs/);
    assert.doesNotMatch(styles, /\.bar-row/);
    assert.match(html, /data-spa-nav/);
    assert.doesNotMatch(html, /href="#\//);
    assert.match(html, /href="\.\/"/);
    assert.match(html, /href="\.\/ranking"/);
    assert.match(html, /href="\.\/legal"/);
    assert.match(html, /data-i18n="nav\.legal"/);
    assert.match(html, /data-nav-link="legal"/);
    assert.doesNotMatch(html, /class="site-footer"/);
    assert.doesNotMatch(styles, /\.site-footer/);
    assert.match(html, /data-page="market"/);
    assert.match(html, /data-page="ranking"/);
    assert.match(html, /data-page="legal"/);
    assert.match(html, /data-world-ranking-panel/);
    assert.match(html, /data-world-ranking/);
    assert.match(html, /data-ranking-period-select/);
    assert.match(html, /data-i18n="ranking\.region"[\s\S]*data-i18n="ranking\.dataCenter"/);
    assert.match(app, /routeFromPath/);
    assert.match(app, /navigateToPage/);
    assert.match(app, /legal:\s*'legal'/);
    assert.match(app, /script\?\.src/);
    assert.match(app, /if \(!storedRoute\) return '';/);
    assert.match(app, /pendingRoute \|\| routeFromPath/);
    assert.match(app, /pushState/);
    assert.match(app, /popstate/);
    assert.match(app, /renderWorldRanking/);
    assert.match(app, /formatWorldRegionLabel/);
    assert.match(app, /formatWorldRankingTopItem/);
    assert.match(app, /selectItemDisplayName/);
    assert.match(app, /worldRankingBody/);
    assert.match(app, /statePill\.textContent = stateLabel\(item\.state, state\.language\)/);
    assert.doesNotMatch(app, /const state = document\.createElement\('span'\);[\s\S]*stateLabel\(item\.state, state\.language\)/);
    assert.match(styles, /\.top-nav/);
    assert.doesNotMatch(styles, /\.top-nav\s*\{\s*position:\s*sticky/);
    assert.match(styles, /\.world-ranking/);
    assert.ok(Array.isArray(worldIndex.rankings?.['7d']));
    assert.ok(worldIndex.rankings['7d'].length > 0);
    assert.equal(typeof worldIndex.rankings['7d'][0].region, 'string');
    assert.match(String(worldIndex.rankings['7d'][0].totalMarketValue), /^\d+$/);
  });

  it('最終更新日時を一覧ヘッダーに表示する', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(html, /data-updated-at/);
    assert.match(html, /data-world-ranking-updated-at/);
    assert.match(html, /最終更新/);
    assert.match(app, /updatedAt/);
    assert.match(app, /worldRankingUpdatedAt/);
    assert.match(app, /formatUpdatedAtDate/);
    assert.match(app, /renderRankingUpdatedAt/);
    assert.match(app, /state\.worldIndex\.generatedAt/);
    assert.doesNotMatch(app, /timeZone:\s*['"]Asia\/Tokyo['"]/);
  });

  it('ワールド選択は選択中DCの候補だけを描画する', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const dataCenterSelectSource = functionSource(app, 'populateDataCenterSelect', 'populateWorldSelect');
    const worldSelectSource = functionSource(app, 'populateWorldSelect', 'populatePeriodSelect');

    assert.match(dataCenterSelectSource, /createElement\(['"]optgroup['"]\)/);
    assert.match(dataCenterSelectSource, /listDataCenterGroupsForWorlds/);
    assert.match(worldSelectSource, /filterWorldsByDataCenter/);
    assert.doesNotMatch(worldSelectSource, /optgroup/);
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
    assert.match(html, /class="top-nav"/);
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
    assert.match(sitemap, /<loc>https:\/\/jinwktk\.github\.io\/FF14Gils\/legal\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/jinwktk\.github\.io\/FF14Gils\/ranking\/<\/loc>/);
  });

  it('権利表記とデータ元を説明する公開ページを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const legal = await readFile(new URL('../legal.html', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

    assert.match(html, /href="\.\/legal"/);
    assert.match(html, /data-page="legal"/);
    assert.match(html, /class="results-panel legal-document"/);
    assert.match(html, /class="results-header legal-header"/);
    assert.match(html, /class="legal-section"/);
    assert.match(html, /<article class="results-panel legal-document" aria-labelledby="legal-title">/);
    assert.match(html, /<h2 id="legal-title" data-i18n="legal\.title">/);
    assert.match(html, /<section class="legal-section" aria-labelledby="legal-rights-title">/);
    assert.match(html, /<h3 id="legal-rights-title" data-i18n="legal\.rightsTitle">/);
    assert.doesNotMatch(html, /<section class="results-panel legal-document">/);
    assert.doesNotMatch(html, /<h2 data-i18n="legal\.rightsTitle">/);
    assert.doesNotMatch(html, /class="brand-block legal-hero"/);
    assert.doesNotMatch(html, /class="legal-panel"/);
    assert.doesNotMatch(styles, /\.legal-panel/);
    assert.doesNotMatch(styles, /\.legal-hero/);
    assert.match(styles, /\.legal-header > div\s*{[^}]*max-width:\s*none/s);
    assert.match(styles, /\.legal-content\s*{[^}]*max-width:\s*none/s);
    assert.match(styles, /\.legal-content\s*{[^}]*margin:\s*0/s);
    assert.match(styles, /\.legal-content\s*{[^}]*padding:\s*0 20px 12px/s);
    assert.match(styles, /\.legal-lead\s*{[^}]*max-width:\s*none/s);
    assert.match(styles, /\.legal-lead\s*{[^}]*margin:\s*0/s);
    assert.match(styles, /\.legal-lead\s*{[^}]*padding:\s*16px 20px 18px/s);
    assert.match(styles, /\.legal-lead\s*{[^}]*font-size:\s*1\.02rem/s);
    assert.match(styles, /\.legal-section\s*{[^}]*padding:\s*18px 0/s);
    assert.match(styles, /\.legal-section h3\s*{[^}]*font-size:\s*1\.08rem/s);
    assert.match(styles, /\.legal-section p,\s*\.legal-section dd\s*{[^}]*font-size:\s*0\.98rem/s);
    assert.match(styles, /\.legal-section p,\s*\.legal-section dd\s*{[^}]*line-height:\s*1\.82/s);
    assert.match(styles, /\.legal-section p,\s*\.legal-section dd\s*{[^}]*max-width:\s*88ch/s);
    assert.match(styles, /\.legal-note\s*{[^}]*padding:\s*12px 14px 12px 16px/s);
    assert.match(styles, /\.legal-note\s*{[^}]*border-left:\s*3px solid var\(--accent\)/s);
    assert.match(styles, /\.legal-note\s*{[^}]*background:\s*rgba\(57, 200, 189, 0\.08\)/s);
    assert.match(styles, /\.data-source-list\s*{[^}]*border-top:\s*1px solid var\(--line\)/s);
    assert.match(styles, /\.data-source-list\s*{[^}]*padding-top:\s*14px/s);
    assert.match(styles, /\.data-source-list div \+ div\s*{[^}]*border-top:\s*1px solid var\(--line\)/s);
    assert.doesNotMatch(styles, /\.data-source-list\s*{[^}]*max-width:\s*88ch/s);
    assert.doesNotMatch(styles, /\.data-source-list div\s*{[^}]*border-top:\s*1px solid var\(--line\)/s);
    assert.doesNotMatch(styles, /\.legal-content\s*{[^}]*max-width:\s*920px/s);
    assert.doesNotMatch(styles, /\.legal-lead\s*{[^}]*max-width:\s*920px/s);
    assert.match(styles, /@media \(max-width: 760px\)\s*{[\s\S]*\.legal-lead,\s*\.legal-content\s*{[^}]*padding-right:\s*16px/s);
    assert.match(styles, /@media \(max-width: 760px\)\s*{[\s\S]*\.legal-lead,\s*\.legal-content\s*{[^}]*padding-left:\s*16px/s);
    assert.match(html, /&copy; 2026 FF14Gils/);
    assert.match(html, /記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。/);
    assert.match(html, /Copyright \(C\) SQUARE ENIX CO\., LTD\. All Rights Reserved\./);
    assert.match(html, /非公式ファンサイト/);
    assert.match(html, /Saddlebag Exchange API/);
    assert.match(html, /Saddlebag Exchange API は内部的に Universalis API を利用する/);
    assert.match(html, /data-i18n="legal\.externalToolDataNotice"/);
    assert.match(html, /データ元には、外部ツールで入手したデータが含まれる場合があります。/);
    assert.equal(
      translate('en', 'legal.externalToolDataNotice'),
      'The data sources may include data obtained through external tools. FF14Gils does not control or guarantee the methods used to collect that data.',
    );
    assert.match(html, /XIVAPI v2/);
    assert.match(html, /説明文、アイコン、詳細なゲームデータは保存しません。/);
    assert.match(html, /Google Analytics 4/);
    assert.match(html, /個人を特定できる情報/);
    assert.match(html, /Cookie/);
    assert.match(html, /https:\/\/docs\.saddlebagexchange\.com\/docs/);
    assert.match(html, /https:\/\/v2\.xivapi\.com\/docs\/welcome\//);
    assert.match(html, /https:\/\/support\.jp\.square-enix\.com\/rule\.php\?id=5381&amp;la=0&amp;tag=users/);
    assert.match(html, /https:\/\/support\.jp\.square-enix\.com\/rule\.php\?id=5381&amp;la=0&amp;tag=authc/);
    assert.match(html, /https:\/\/marketingplatform\.google\.com\/about\/analytics\/terms\/jp\//);
    assert.match(legal, /sessionStorage\.setItem\('ff14gils_route', 'legal'\)/);
    assert.match(legal, /window\.location\.replace\(basePath\)/);
    assert.doesNotMatch(styles, /\.legal-shell/);
    assert.match(build, /'legal\.html'/);
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

  it('SPAのクリーンURL向け404フォールバックをPages配信対象に含める', async () => {
    const fallback = await readFile(new URL('../404.html', import.meta.url), 'utf8');
    const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

    assert.match(fallback, /sessionStorage\.setItem\('ff14gils_route'/);
    assert.match(fallback, /const projectBasePath = '\/FF14Gils\/'/);
    assert.match(fallback, /window\.location\.pathname\.includes\(projectBasePath\)/);
    assert.match(fallback, /\? projectBasePath\s*: '\/'/);
    assert.match(fallback, /location\.replace\(basePath\)/);
    assert.match(build, /'404\.html'/);
    assert.match(build, /const routeEntrypoints = \['ranking', 'legal'\]/);
    assert.match(build, /writeRouteEntrypoint\(route\)/);
    assert.match(build, /\.\.\/dist\/\$\{route\}\//);
    assert.match(build, /new URL\('index\.html', routeDir\)/);
    assert.match(build, /sessionStorage\.setItem\('ff14gils_route', '\$\{route\}'\)/);
  });

  it('Google Analytics 4の計測タグを持つ', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(
      html,
      /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-VH5GMQMZ34"><\/script>/,
    );
    assert.match(html, /window\.dataLayer = window\.dataLayer \|\| \[\];/);
    assert.match(html, /function gtag\(\)\{dataLayer\.push\(arguments\);\}/);
    assert.match(html, /gtag\('config', 'G-VH5GMQMZ34'\);/);
    assert.equal(html.match(/G-VH5GMQMZ34/g)?.length, 2);
  });

  it('Ko-fiの支援導線を公開UIから外す', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const i18n = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');

    assert.doesNotMatch(html, /class="kofi-link"/);
    assert.doesNotMatch(html, /ko-fi\.com/);
    assert.doesNotMatch(html, /"sameAs": \["https:\/\/ko-fi\.com\/jinnymeia"\]/);
    assert.doesNotMatch(html, /Ko-fiで支援する/);
    assert.doesNotMatch(html, /assets\/ko-fi\.svg/);
    assert.doesNotMatch(styles, /\.kofi-link/);
    assert.doesNotMatch(i18n, /kofiSupport/);
    await assert.rejects(access(new URL('../assets/ko-fi.svg', import.meta.url)), {
      code: 'ENOENT',
    });
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

  it('faviconファイルを配信対象に含める', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const build = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    const faviconSvg = await readFile(new URL('../assets/favicon.svg', import.meta.url), 'utf8');
    const favicon32 = await readFile(new URL('../assets/favicon-32.png', import.meta.url));
    const appleTouchIcon = await readFile(
      new URL('../assets/apple-touch-icon.png', import.meta.url),
    );
    const faviconIco = await readFile(new URL('../favicon.ico', import.meta.url));

    assert.match(html, /<link rel="icon" href="favicon\.ico" sizes="any"/);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/favicon\.svg"/);
    assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="assets\/favicon-32\.png"/);
    assert.match(html, /<link rel="apple-touch-icon" href="assets\/apple-touch-icon\.png"/);
    assert.match(faviconSvg, /<svg/);
    assert.match(faviconSvg, /FF14Gils/);
    assert.deepEqual(readPngSize(favicon32), { width: 32, height: 32 });
    assert.deepEqual(readPngSize(appleTouchIcon), { width: 180, height: 180 });
    assert.deepEqual(readIcoHeader(faviconIco), { reserved: 0, type: 1, count: 1 });
    assert.match(build, /'favicon\.ico'/);
    assert.match(build, /'assets'/);
  });

  it('Pages workflowはデプロイ前にテストを実行する', async () => {
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /run:\s*npm test/);
    assert.match(workflow, /run:\s*npm run build/);
    assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('run: npm run build'));
  });

  it('Pages workflowはAPIデータ更新イベントと通常デプロイを分離する', async () => {
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /repository_dispatch:\s+types:\s+\-\s*refresh-marketshare/);
    assert.match(workflow, /push:\s*[\s\S]*branches:/);
    assert.match(workflow, /cron:\s*['"]17 \* \* \* \*['"]/);
    assert.match(
      workflow,
      /- name: Fetch marketshare data\s+if:\s*\$\{\{\s*github\.event_name == 'schedule' \|\| github\.event_name == 'repository_dispatch'\s*\}\}\s+run:\s*npm run fetch:data/,
    );
    assert.match(
      workflow,
      /- name: Restore published data\s+if:\s*\$\{\{\s*github\.event_name != 'schedule' && github\.event_name != 'repository_dispatch'\s*\}\}\s+run:\s*npm run restore:published-data/,
    );
    assert.ok(workflow.indexOf('run: npm run fetch:data') < workflow.indexOf('run: npm run build'));
    assert.ok(
      workflow.indexOf('run: npm run build') < workflow.indexOf('run: npm run restore:published-data'),
    );
    assert.ok(
      workflow.indexOf('run: npm run restore:published-data') <
        workflow.indexOf('uses: actions/upload-pages-artifact@v3'),
    );
  });

  it('毎時データ更新は外部スケジューラからrepository_dispatchを送れる', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

    assert.equal(packageJson.scripts['dispatch:refresh'], 'node scripts/dispatch-refresh.mjs');
    assert.match(readme, /npm run dispatch:refresh/);
    assert.match(readme, /repository_dispatch: refresh-marketshare/);
    assert.match(readme, /FF14GILS_GITHUB_TOKEN/);
    assert.match(readme, /GITHUB_TOKEN/);
    assert.match(readme, /外部スケジューラ/);
    assert.match(readme, /GitHub Actions の schedule は補助/);
  });

  it('データ生成の既定カテゴリは全般にする', async () => {
    const script = await readFile(
      new URL('../scripts/fetch-marketshare.mjs', import.meta.url),
      'utf8',
    );

    assert.match(script, /FF14GILS_PRESET\s*\?\?\s*['"]all['"]/);
    assert.doesNotMatch(script, /FF14GILS_PRESET\s*\?\?\s*['"]housing['"]/);
  });

  it('データ生成スクリプトとREADMEはUniversalis API直利用を説明しない', async () => {
    const script = await readFile(
      new URL('../scripts/fetch-marketshare.mjs', import.meta.url),
      'utf8',
    );
    const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

    assert.doesNotMatch(script, /universalis\.app\/api/i);
    assert.doesNotMatch(script, /UNIVERSALIS/i);
    assert.doesNotMatch(script, /entriesWithin/i);
    assert.doesNotMatch(readme, /Universalis API/);
    assert.doesNotMatch(readme, /30 day history/i);
    assert.doesNotMatch(readme, /30d/);
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

function readIcoHeader(buffer) {
  return {
    reserved: buffer.readUInt16LE(0),
    type: buffer.readUInt16LE(2),
    count: buffer.readUInt16LE(4),
  };
}

function functionSource(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  return source.slice(start, end);
}

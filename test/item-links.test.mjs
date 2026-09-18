import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import {
  buildErionesSearchUrl,
  buildLodestoneItemUrl,
  loadLodestoneItemMap,
  loadOfficialTooltipScript,
} from '../src/item-links.js';

describe('item links', () => {
  it('対応表はpaint後のidleまで取得せず、再描画しても取得は一度だけ', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const start = app.indexOf('function scheduleItemLinkEnhancements()');
    const end = app.indexOf('function applyLodestoneTooltipAttributes()', start);
    const frames = [];
    const idle = [];
    let requests = 0;
    let loaders = 0;
    const context = vm.createContext({
      itemLinksLoading: false,
      lodestoneItemMap: null,
      elements: { tableBody: { querySelector: () => ({}) } },
      applyLodestoneTooltipAttributes() {},
      loadLodestoneItemMap() { requests += 1; return Promise.resolve({}); },
      loadOfficialTooltipScript() { loaders += 1; },
      window: {
        requestAnimationFrame(callback) { frames.push(callback); },
        requestIdleCallback(callback) { idle.push(callback); },
      },
    });
    vm.runInContext(app.slice(start, end), context);
    vm.runInContext('scheduleItemLinkEnhancements(); scheduleItemLinkEnhancements();', context);
    assert.equal(requests, 0);
    assert.equal(frames.length, 1);
    frames[0]();
    assert.equal(requests, 0);
    assert.equal(idle.length, 1);
    idle[0]();
    await Promise.resolve();
    assert.equal(requests, 1);
    assert.equal(loaders, 1);
  });

  const item = {
    itemId: '49751',
    nameJa: 'コスモエクスプローラー・スカーフ',
    nameEn: 'Cosmic Explorer Scarf',
  };

  it('ERIONESは独自IDへ直結せず、表示言語の正式名を検索する', () => {
    assert.equal(
      buildErionesSearchUrl(item, 'ja'),
      `https://eriones.com/search?i=${encodeURIComponent(item.nameJa)}`,
    );
    assert.equal(
      buildErionesSearchUrl(item, 'en'),
      `https://en.eriones.com/search?i=${encodeURIComponent(item.nameEn)}`,
    );
    assert.doesNotMatch(buildErionesSearchUrl(item, 'ja'), /49751/);
    assert.equal(
      buildErionesSearchUrl({ names: { en: 'Nested English Name' } }, 'ja'),
      'https://en.eriones.com/search?i=Nested%20English%20Name',
    );
    assert.equal(
      buildErionesSearchUrl({ names: { ja: '入れ子日本語名' } }, 'en'),
      `https://eriones.com/search?i=${encodeURIComponent('入れ子日本語名')}`,
    );
    assert.equal(buildErionesSearchUrl({ itemId: '49751' }, 'ja'), '');
  });

  it('Lodestoneの対応hashがある場合だけ言語別の公式URLを返す', () => {
    const hashes = { 49751: '01abc234def' };

    assert.equal(
      buildLodestoneItemUrl(item.itemId, hashes, 'ja'),
      'https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/01abc234def/',
    );
    assert.equal(
      buildLodestoneItemUrl(item.itemId, hashes, 'en'),
      'https://na.finalfantasyxiv.com/lodestone/playguide/db/item/01abc234def/',
    );
    assert.equal(buildLodestoneItemUrl('99999', hashes, 'ja'), '');
    assert.equal(buildLodestoneItemUrl(item.itemId, { 49751: 'INVALID' }, 'ja'), '');
  });

  it('Lodestone対応表は成功レスポンスのobjectだけを受け取る', async () => {
    const map = { 49751: '01abc234def' };
    const fetchOk = async () => ({ ok: true, json: async () => map });

    assert.equal(await loadLodestoneItemMap(fetchOk), map);
    await assert.rejects(
      loadLodestoneItemMap(async () => ({ ok: false, status: 404 })),
      /404/,
    );
    await assert.rejects(
      loadLodestoneItemMap(async () => ({ ok: true, json: async () => [] })),
      /object/,
    );
  });

  it('公式tooltip loaderはbodyへasyncで一度だけ追加する', () => {
    const scripts = [];
    const documentRef = {
      body: { append: (script) => scripts.push(script) },
      createElement: () => ({ dataset: {} }),
      querySelector: () => scripts[0] ?? null,
    };

    const first = loadOfficialTooltipScript(documentRef);
    const second = loadOfficialTooltipScript(documentRef);

    assert.equal(first, second);
    assert.equal(scripts.length, 1);
    assert.equal(first.async, true);
    assert.equal(
      first.src,
      'https://lds-img.finalfantasyxiv.com/pc/global/js/eorzeadb/loader.js?v3',
    );
  });

  it('一覧はUniversalisリンクを維持し、ERIONESアイコンと公式tooltip属性を追加する', async () => {
    const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const i18n = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');

    assert.match(app, /link\.href = safeUniversalisUrl\(item\.url\)/);
    assert.match(app, /link\.className = 'item-market-link'/);
    assert.match(app, /link\.classList\.add\('eorzeadb_link'\)/);
    assert.match(app, /link\.dataset\.itemId = String\(item\.itemId\)/);
    assert.match(app, /buildErionesSearchUrl\(item, state\.language\)/);
    assert.match(app, /ERIONES_ICON_URL/);
    assert.match(app, /scheduleItemLinkEnhancements\(\)/);
    assert.match(app, /buildLodestoneItemUrl\(link\.dataset\.itemId, lodestoneItemMap, state\.language\)/);
    assert.match(styles, /\.eriones-link\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
    assert.match(styles, /\.eriones-link img\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
    assert.match(i18n, /erionesLinkLabel:\s*'ERIONESで\{name\}を検索'/);
    assert.match(i18n, /erionesLinkLabel:\s*'Search \{name\} on ERIONES'/);
  });
});

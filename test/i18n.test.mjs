import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  buildLanguagePreferenceCookie,
  formatUpdatedAtDate,
  normalizeLanguage,
  resolvePreferredLanguage,
  selectItemDisplayName,
  translate,
} from '../src/i18n.js';

describe('i18n language preference', () => {
  it('既定言語は日本語にする', () => {
    assert.equal(DEFAULT_LANGUAGE, 'ja');
    assert.equal(resolvePreferredLanguage('', ''), 'ja');
  });

  it('保存済みの英語設定を優先する', () => {
    assert.equal(resolvePreferredLanguage(`${LANGUAGE_COOKIE_NAME}=en`, 'ja-JP'), 'en');
  });

  it('保存がない場合はブラウザ言語から日本語か英語を解決する', () => {
    assert.equal(resolvePreferredLanguage('', 'en-US'), 'en');
    assert.equal(resolvePreferredLanguage('', 'ja-JP'), 'ja');
    assert.equal(resolvePreferredLanguage('', 'fr-FR'), 'ja');
  });

  it('不正な言語値は日本語へフォールバックする', () => {
    assert.equal(normalizeLanguage('de'), 'ja');
    assert.equal(normalizeLanguage(''), 'ja');
  });

  it('選択した言語をCookieへ保存する文字列を作る', () => {
    assert.equal(
      buildLanguagePreferenceCookie('en'),
      `${LANGUAGE_COOKIE_NAME}=en; Max-Age=15552000; Path=/; SameSite=Lax`,
    );
  });
});

describe('translate', () => {
  it('日本語と英語のUI文言を返す', () => {
    assert.equal(translate('ja', 'ui.filterTitle'), '絞り込み');
    assert.equal(translate('en', 'ui.filterTitle'), 'Filters');
    assert.equal(translate('ja', 'ui.dataCenterLabel'), 'データセンター');
    assert.equal(translate('en', 'ui.dataCenterLabel'), 'Data center');
    assert.equal(translate('ja', 'ui.dataCenterSelect'), 'DCを選択');
    assert.equal(translate('en', 'ui.dataCenterSelect'), 'Select data center');
    assert.equal(translate('ja', 'dataCenterRegions.northAmerica'), '北米データセンター');
    assert.equal(translate('en', 'dataCenterRegions.northAmerica'), 'North American Data Centers');
    assert.equal(translate('ja', 'dataCenterRegions.europe'), '欧州データセンター');
    assert.equal(translate('en', 'dataCenterRegions.europe'), 'European Data Centers');
    assert.equal(translate('ja', 'dataCenterRegions.japan'), '日本データセンター');
    assert.equal(translate('en', 'dataCenterRegions.japan'), 'Japanese Data Centers');
    assert.equal(translate('ja', 'dataCenterRegions.oceania'), 'オセアニアデータセンター');
    assert.equal(translate('en', 'dataCenterRegions.oceania'), 'Oceanic Data Centers');
    assert.equal(translate('ja', 'view.charts'), 'グラフ');
    assert.equal(translate('en', 'view.charts'), 'Charts');
    assert.equal(translate('ja', 'chart.topSalesTitle'), '売上額トップ');
    assert.equal(translate('en', 'chart.topSalesTitle'), 'Top sales');
    assert.equal(translate('ja', 'chart.priceChangeTitle'), '価格変動');
    assert.equal(translate('en', 'chart.priceChangeTitle'), 'Price movement');
    assert.equal(translate('en', 'table.marketValue'), 'Sales');
    assert.match(translate('ja', 'meta.description'), /全DC/);
    assert.match(translate('en', 'meta.description'), /all data centers/);
  });

  it('件数などの値を埋め込める', () => {
    assert.equal(translate('ja', 'results.count', { count: '12' }), '12 件');
    assert.equal(translate('en', 'results.count', { count: '12' }), '12 items');
  });
});

describe('formatUpdatedAtDate', () => {
  const generatedAt = '2026-06-30T08:26:11.932Z';

  it('指定されたタイムゾーンで最終更新時刻を出し分ける', () => {
    const tokyo = formatUpdatedAtDate(generatedAt, 'ja', { timeZone: 'Asia/Tokyo' });
    const newYork = formatUpdatedAtDate(generatedAt, 'ja', {
      timeZone: 'America/New_York',
    });

    assert.notEqual(tokyo, newYork);
    assert.match(tokyo, /17:26/);
    assert.match(tokyo, /JST|GMT\+9/);
    assert.match(newYork, /04:26/);
    assert.match(newYork, /GMT-4|EDT/);
  });
});

describe('selectItemDisplayName', () => {
  const item = {
    name: 'ガーデン・パーティライト',
    nameJa: 'ガーデン・パーティライト',
    nameEn: 'Garden Mood Lighting',
  };

  it('日本語表示では日本語名を優先する', () => {
    assert.equal(selectItemDisplayName(item, 'ja'), 'ガーデン・パーティライト');
  });

  it('英語表示では英語名を優先する', () => {
    assert.equal(selectItemDisplayName(item, 'en'), 'Garden Mood Lighting');
  });
});

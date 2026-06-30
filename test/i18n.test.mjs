import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  buildLanguagePreferenceCookie,
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
    assert.equal(translate('en', 'table.marketValue'), 'Sales');
  });

  it('件数などの値を埋め込める', () => {
    assert.equal(translate('ja', 'results.count', { count: '12' }), '12 件');
    assert.equal(translate('en', 'results.count', { count: '12' }), '12 items');
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

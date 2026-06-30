import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildXivapiItemNameUrl,
  fetchItemNames,
  fetchJapaneseItemNames,
  normalizeXivapiLanguage,
} from '../scripts/item-name-api.mjs';

describe('buildXivapiItemNameUrl', () => {
  it('XIVAPI v2 の日本語アイテム名取得URLを作る', () => {
    assert.equal(
      buildXivapiItemNameUrl('51269'),
      'https://v2.xivapi.com/api/sheet/Item/51269?fields=Name&language=ja',
    );
  });

  it('XIVAPI v2 の取得言語を指定できる', () => {
    assert.equal(
      buildXivapiItemNameUrl('51269', { language: 'en' }),
      'https://v2.xivapi.com/api/sheet/Item/51269?fields=Name&language=en',
    );
    assert.equal(normalizeXivapiLanguage('fr'), 'fr');
    assert.equal(normalizeXivapiLanguage('invalid'), 'ja');
  });
});

describe('fetchItemNames', () => {
  it('重複IDをまとめ、XIVAPIのNameをID別に返す', async () => {
    const requestedUrls = [];
    const names = await fetchItemNames(['51269', '15157', '51269'], {
      fetchImpl: async (url) => {
        requestedUrls.push(url);
        const id = url.match(/Item\/(\d+)/)?.[1];

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            row_id: Number(id),
            fields: {
              Name: id === '51269' ? 'ガーデン・パーティライト' : 'ビーチチェア',
            },
          }),
        };
      },
    });

    assert.equal(requestedUrls.length, 2);
    assert.deepEqual(names, {
      15157: 'ビーチチェア',
      51269: 'ガーデン・パーティライト',
    });
  });

  it('既存の日本語名取得関数も互換維持する', async () => {
    const names = await fetchJapaneseItemNames(['51269'], {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          fields: { Name: 'ガーデン・パーティライト' },
        }),
      }),
    });

    assert.deepEqual(names, { 51269: 'ガーデン・パーティライト' });
  });
});

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  CATEGORY_PRESETS,
  assertMarketshareResponse,
  filterMarketshareItems,
  formatGil,
  normalizeMarketshareResponse,
  summarizeMarketshare,
} from '../src/marketshare.js';
import { buildMarketsharePayload } from '../scripts/marketshare-api.mjs';

const apiResponse = {
  data: [
    {
      avg: 1241611,
      itemID: '51269',
      marketValue: 39731558,
      median: 1230000,
      minPrice: 1290000,
      name: 'Garden Mood Lighting',
      npc_vendor_info: '',
      purchaseAmount: 32,
      quantitySold: 32,
      url: 'https://universalis.app/market/51269',
      percentChange: 3.9,
      state: 'stable',
    },
    {
      avg: 700000,
      itemID: '15157',
      marketValue: 2100000,
      median: 700000,
      minPrice: 0,
      name: 'Beach Chair',
      npc_vendor_info: '',
      purchaseAmount: 3,
      quantitySold: 3,
      url: 'https://universalis.app/market/15157',
      percentChange: 5351,
      state: 'out of stock',
    },
  ],
};

describe('buildMarketsharePayload', () => {
  it('Saddlebag Exchangeの必須パラメータに変換する', () => {
    const payload = buildMarketsharePayload({
      server: 'Carbuncle',
      timePeriod: '168',
      salesAmount: '3',
      averagePrice: '10000',
      preset: 'housing',
      sortBy: 'marketValue',
    });

    assert.deepEqual(payload, {
      server: 'Carbuncle',
      time_period: 168,
      sales_amount: 3,
      average_price: 10000,
      filters: CATEGORY_PRESETS.housing.filters,
      sort_by: 'marketValue',
    });
  });

  it('カスタムカテゴリIDを重複なしの数値配列にする', () => {
    const payload = buildMarketsharePayload({
      server: 'Chocobo',
      timePeriod: 24,
      salesAmount: 5,
      averagePrice: 5000,
      preset: 'custom',
      customFilters: '56, 65\n66 65',
      sortBy: 'quantitySold',
    });

    assert.deepEqual(payload.filters, [56, 65, 66]);
  });

  it('空のワールド名や不正な数値は送信前に拒否する', () => {
    assert.throws(
      () =>
        buildMarketsharePayload({
          server: '   ',
          timePeriod: '0',
          salesAmount: 'x',
          averagePrice: '10000',
          preset: 'housing',
          sortBy: 'marketValue',
        }),
      /server|timePeriod|salesAmount/,
    );
  });
});

describe('normalizeMarketshareResponse', () => {
  it('APIレスポンスをUIで扱いやすい金策アイテムに整形する', () => {
    const items = normalizeMarketshareResponse(apiResponse);

    assert.equal(items.length, 2);
    assert.equal(items[0].itemId, '51269');
    assert.equal(items[0].name, 'Garden Mood Lighting');
    assert.equal(items[0].hasListings, true);
    assert.equal(items[0].recommendationLevel, 'steady');
    assert.equal(items[1].hasListings, false);
    assert.equal(items[1].minPrice, null);
    assert.equal(items[1].recommendationLevel, 'needs-restock');
    assert.ok(items[1].opportunityScore > items[0].opportunityScore);
  });
});

describe('assertMarketshareResponse', () => {
  it('dataが配列ではないAPIレスポンスを拒否する', () => {
    assert.throws(() => assertMarketshareResponse({ error: 'bad shape' }), /data/);
  });

  it('最低限のitem schemaを満たさないレスポンスを拒否する', () => {
    assert.throws(
      () =>
        assertMarketshareResponse({
          data: [{ itemID: '1', name: '', marketValue: 100 }],
        }),
      /item schema/,
    );
  });

  it('nullや空文字のID・数値項目を拒否する', () => {
    assert.throws(
      () =>
        assertMarketshareResponse({
          data: [
            {
              itemID: null,
              name: 'Broken item',
              marketValue: null,
              quantitySold: '',
            },
          ],
        }),
      /item schema/,
    );
  });
});

describe('summarizeMarketshare', () => {
  it('合計市場規模、販売数、状態別件数を集計する', () => {
    const summary = summarizeMarketshare(normalizeMarketshareResponse(apiResponse));

    assert.equal(summary.itemCount, 2);
    assert.equal(summary.totalMarketValue, 41831558);
    assert.equal(summary.totalQuantitySold, 35);
    assert.equal(summary.stateCounts.stable, 1);
    assert.equal(summary.stateCounts['out of stock'], 1);
    assert.equal(summary.topItem.name, 'Garden Mood Lighting');
  });
});

describe('filterMarketshareItems', () => {
  it('検索語、状態、最低販売数で絞り込む', () => {
    const items = normalizeMarketshareResponse(apiResponse);
    const filtered = filterMarketshareItems(items, {
      search: 'garden',
      states: ['stable'],
      minQuantitySold: 10,
    });

    assert.deepEqual(
      filtered.map((item) => item.itemId),
      ['51269'],
    );
  });
});

describe('formatGil', () => {
  it('ギル表記を3桁区切りにする', () => {
    assert.equal(formatGil(39731558), '39,731,558 gil');
    assert.equal(formatGil(null), '-');
  });
});

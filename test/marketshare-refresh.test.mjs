import assert from 'node:assert/strict';
import { it } from 'node:test';
import { collectMarketshareResults, MAX_SNAPSHOT_AGE_MS } from '../scripts/marketshare-refresh.mjs';
import { createSnapshot } from '../src/marketshare.js';
import { SALES_PERIODS } from '../src/worlds.js';
import { SADDLEBAG_MARKETSHARE_ENDPOINT } from '../scripts/marketshare-api.mjs';

const now = Date.parse('2026-10-07T10:00:00Z');
const query = { salesAmount: 3, averagePrice: 10000, preset: 'all', sortBy: 'marketValue' };
const data = { data: [{ itemID: 1, name: 'Test item', marketValue: 20, quantitySold: 2 }] };
const periods = SALES_PERIODS.filter((period) => ['1d', '3d'].includes(period.key));
function cachedSnapshot() {
  return createSnapshot({
    query: { ...query, server: 'Diabolos', periodKey: '3d', periodLabel: '3日', timePeriod: 72, filters: [0] },
    response: data, source: SADDLEBAG_MARKETSHARE_ENDPOINT,
    generatedAt: now - 60 * 60 * 1000,
  });
}
function setup({ failures = Infinity, status = 520, error, snapshot = cachedSnapshot(), fallbackStatus = 200, responseData = data } = {}) {
  const calls = [];
  let failedCalls = 0;
  return { calls, options: {
    worlds: ['Diabolos', 'Lich'], periods, query, now, log: () => {},
    retryOptions: { retries: 2, baseDelayMs: 0, sleep: async () => {} },
    fetchImpl: async (url, init) => {
      const payload = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, payload });
      if (!payload) return { ok: fallbackStatus === 200, status: fallbackStatus, json: async () => snapshot };
      if (payload.server === 'Diabolos' && payload.time_period === 72 && ++failedCalls <= failures) {
        if (error) throw error;
        return { ok: false, status, statusText: '<none>' };
      }
      return { ok: true, json: async () => responseData };
    },
  }};
}
it('520 recovers within bounded retries without fallback', async () => {
  const { options, calls } = setup({ failures: 1 });
  const results = await collectMarketshareResults(options);
  assert.equal(results.length, 4);
  assert.equal(calls.length, 5);
  assert.ok(results.every((result) => result.apiResponse));
});
it('one world/period exhausted 520 reuses validated snapshot and updates the remaining pairs', async () => {
  const { options, calls } = setup();
  const results = await collectMarketshareResults(options);
  assert.equal(results.length, 4);
  assert.equal(results[1].snapshot.generatedAt, cachedSnapshot().generatedAt);
  assert.deepEqual(results[1].snapshot.items, cachedSnapshot().items);
  assert.equal(results[2].query.server, 'Lich');
  assert.equal(results[3].query.periodKey, '3d');
  assert.equal(calls.filter(({ payload }) => payload?.server === 'Diabolos' && payload.time_period === 72).length, 3);
  assert.ok(calls.find(({ url }) => url.endsWith('data/worlds/diabolos-3d.json')));
});
it('exhausted ECONNRESET also reuses a snapshot', async () => {
  const { options } = setup({ error: new TypeError('terminated', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) }) });
  assert.ok((await collectMarketshareResults(options))[1].snapshot);
});
it('permanent HTTP and programming errors never use fallback', async () => {
  for (const failure of [{ status: 400 }, { status: 401 }, { status: 404 }, { status: 501 }, { error: new TypeError('bad URL') }]) {
    const { options, calls } = setup(failure);
    await assert.rejects(collectMarketshareResults(options));
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ payload }) => payload));
  }
});
it('malformed JSON and invalid API schema fail without reuse', async () => {
  for (const invalid of [null, { data: [{ itemID: 1 }] }]) {
    const { options, calls } = setup({ failures: 0, responseData: invalid });
    await assert.rejects(collectMarketshareResults(options), /Invalid marketshare/);
    assert.equal(calls.length, 1);
  }
  const { options } = setup();
  options.fetchImpl = async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } });
  await assert.rejects(collectMarketshareResults(options), /bad JSON/);
});
it('missing, stale, future, malformed or mismatched published snapshots fail closed', async () => {
  const mutations = [
    (s) => { s.generatedAt = new Date(now - MAX_SNAPSHOT_AGE_MS - 1).toISOString(); },
    (s) => { s.generatedAt = new Date(now + 1).toISOString(); },
    (s) => { s.generatedAt = null; },
    (s) => { s.query.server = 'Lich'; },
    (s) => { s.query.periodKey = '7d'; },
    (s) => { s.query.averagePrice = 42; },
    (s) => { s.query.filters = [56]; },
    (s) => { s.source = 'https://example.test'; },
    (s) => { s.items = [{ itemId: 1 }]; },
  ];
  for (const mutate of mutations) {
    const snapshot = cachedSnapshot(); mutate(snapshot);
    await assert.rejects(collectMarketshareResults(setup({ snapshot }).options), /Cannot safely reuse/);
  }
  await assert.rejects(collectMarketshareResults(setup({ fallbackStatus: 404 }).options), /HTTP 404/);
});
it('an entirely reused update is not published', async () => {
  const { options } = setup();
  options.periods = [periods[1]]; options.worlds = ['Diabolos'];
  await assert.rejects(collectMarketshareResults(options), /No fresh marketshare/);
});

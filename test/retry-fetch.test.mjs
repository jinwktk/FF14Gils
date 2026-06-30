import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { fetchWithRetry } from '../scripts/retry-fetch.mjs';

describe('fetchWithRetry', () => {
  it('一時的なHTTPエラーはリトライして成功レスポンスを返す', async () => {
    const statuses = [504, 200];
    const calls = [];

    const response = await fetchWithRetry(
      'https://example.test/history',
      { headers: { 'user-agent': 'FF14Gils test' } },
      {
        retries: 2,
        baseDelayMs: 0,
        sleep: async () => {},
        fetchImpl: async (url, options) => {
          calls.push({ url, options });
          const status = statuses.shift();

          return {
            ok: status === 200,
            status,
            statusText: status === 200 ? 'OK' : 'Gateway Timeout',
          };
        },
      },
    );

    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://example.test/history');
    assert.equal(calls[0].options.headers['user-agent'], 'FF14Gils test');
  });

  it('恒久的なHTTPエラーはリトライしない', async () => {
    let calls = 0;

    const response = await fetchWithRetry(
      'https://example.test/history',
      {},
      {
        retries: 2,
        baseDelayMs: 0,
        sleep: async () => {},
        fetchImpl: async () => {
          calls += 1;

          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
          };
        },
      },
    );

    assert.equal(response.ok, false);
    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  });
});

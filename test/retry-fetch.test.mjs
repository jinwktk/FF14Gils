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

function bodyReset() {
  return new TypeError('terminated', {
    cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
  });
}

it('fetch成功後のJSON本文切断は新しいレスポンスで再試行する', async () => {
  let calls = 0;
  const delays = [];
  const init = { method: 'POST', body: '{"server":"Diabolos"}' };
  const result = await fetchWithRetry('https://example.test/marketshare', init, {
    retries: 3,
    baseDelayMs: 10,
    sleep: async (delay) => delays.push(delay),
    fetchImpl: async (url, options) => {
      assert.equal(options, init);
      const attempt = ++calls;
      return {
        ok: true,
        json: async () => {
          if (attempt < 3) throw bodyReset();
          return { data: [{ itemID: 1 }] };
        },
      };
    },
    readResponse: (response) => response.json(),
  });
  assert.deepEqual(result, { data: [{ itemID: 1 }] });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

it('本文切断が続く場合は上限で最後のエラーを返す', async () => {
  let calls = 0;
  const error = bodyReset();
  await assert.rejects(fetchWithRetry('https://example.test', {}, {
    retries: 2,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => { throw error; } };
    },
    readResponse: (response) => response.json(),
  }), (actual) => actual === error);
  assert.equal(calls, 3);
});

it('壊れたJSONや本文処理の通常エラーは再試行しない', async () => {
  for (const error of [new SyntaxError('Invalid JSON'), new Error('Invalid data')]) {
    let calls = 0;
    await assert.rejects(fetchWithRetry('https://example.test', {}, {
      retries: 3,
      sleep: async () => assert.fail('must not sleep'),
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, json: async () => { throw error; } };
      },
      readResponse: (response) => response.json(),
    }), (actual) => actual === error);
    assert.equal(calls, 1);
  }
});

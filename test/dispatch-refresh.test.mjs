import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildRepositoryDispatchRequest,
  dispatchRepositoryRefresh,
} from '../scripts/dispatch-refresh.mjs';

describe('repository dispatch refresh trigger', () => {
  it('既定ではFF14Gilsのrefresh-marketshareイベントを送る', () => {
    const request = buildRepositoryDispatchRequest({
      token: 'secret-token',
      now: new Date('2026-07-02T00:17:00.000Z'),
    });

    assert.equal(request.url, 'https://api.github.com/repos/jinwktk/FF14Gils/dispatches');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer secret-token');
    assert.equal(request.options.headers.Accept, 'application/vnd.github+json');
    assert.equal(request.options.headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.equal(request.options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(request.options.body), {
      event_type: 'refresh-marketshare',
      client_payload: {
        source: 'external-hourly-scheduler',
        requested_at: '2026-07-02T00:17:00.000Z',
      },
    });
  });

  it('対象リポジトリ、イベント名、送信元を環境変数で上書きできる', () => {
    const request = buildRepositoryDispatchRequest({
      env: {
        FF14GILS_GITHUB_REPOSITORY: 'owner/example',
        FF14GILS_DISPATCH_EVENT_TYPE: 'custom-refresh',
        FF14GILS_DISPATCH_SOURCE: 'windows-task-scheduler',
      },
      token: 'secret-token',
      now: new Date('2026-07-02T01:00:00.000Z'),
    });

    assert.equal(request.url, 'https://api.github.com/repos/owner/example/dispatches');
    assert.deepEqual(JSON.parse(request.options.body), {
      event_type: 'custom-refresh',
      client_payload: {
        source: 'windows-task-scheduler',
        requested_at: '2026-07-02T01:00:00.000Z',
      },
    });
  });

  it('GitHubの204応答を成功として扱う', async () => {
    const calls = [];
    const result = await dispatchRepositoryRefresh({
      env: { FF14GILS_GITHUB_TOKEN: 'secret-token' },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 204, text: async () => '' };
      },
      now: new Date('2026-07-02T02:00:00.000Z'),
    });

    assert.equal(result.status, 204);
    assert.equal(result.eventType, 'refresh-marketshare');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.github.com/repos/jinwktk/FF14Gils/dispatches');
  });

  it('失敗時のエラーにトークンを含めない', async () => {
    await assert.rejects(
      dispatchRepositoryRefresh({
        env: { GITHUB_TOKEN: 'secret-token' },
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          text: async () => 'Bad credentials for secret-token',
        }),
      }),
      (error) => {
        assert.match(error.message, /GitHub repository_dispatch failed: HTTP 401/);
        assert.doesNotMatch(error.message, /secret-token/);
        return true;
      },
    );
  });
});

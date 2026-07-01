import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  collectPublishedDataPaths,
  restorePublishedData,
} from '../scripts/restore-published-data.mjs';

describe('collectPublishedDataPaths', () => {
  it('worlds.jsonが参照する公開データパスを重複なしで集める', () => {
    const paths = collectPublishedDataPaths({
      worlds: [
        {
          path: 'data/worlds/chocobo.json',
          periods: {
            '1d': 'data/worlds/chocobo-1d.json',
            '3d': 'data/worlds/chocobo-3d.json',
            '7d': 'data/worlds/chocobo.json',
          },
        },
      ],
    });

    assert.deepEqual(paths, [
      'data/worlds.json',
      'data/marketshare.json',
      'data/worlds/chocobo.json',
      'data/worlds/chocobo-1d.json',
      'data/worlds/chocobo-3d.json',
    ]);
  });

  it('data配下以外のパスは拒否する', () => {
    assert.throws(
      () => collectPublishedDataPaths({ worlds: [{ path: '../secrets.json' }] }),
      /Unsafe published data path/,
    );
    assert.throws(
      () => collectPublishedDataPaths({ worlds: [{ path: 'https://example.com/data.json' }] }),
      /Unsafe published data path/,
    );
  });
});

describe('restorePublishedData', () => {
  it('公開済みworlds.jsonから参照されるJSONをdistへ復元する', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'ff14gils-dist-'));
    const baseUrl = 'https://example.test/FF14Gils/';
    const worldsJson = JSON.stringify({
      defaultWorld: 'Chocobo',
      defaultPeriod: '7d',
      worlds: [
        {
          name: 'Chocobo',
          path: 'data/worlds/chocobo.json',
          periods: {
            '1d': 'data/worlds/chocobo-1d.json',
            '7d': 'data/worlds/chocobo.json',
          },
        },
        {
          name: 'Hades',
          path: 'data/worlds/hades.json',
          periods: {
            '1d': 'data/worlds/hades-1d.json',
            '7d': 'data/worlds/hades.json',
          },
        },
      ],
    });
    const responses = new Map([
      [`${baseUrl}data/worlds.json`, worldsJson],
      [`${baseUrl}data/marketshare.json`, '{"server":"Chocobo"}'],
      [`${baseUrl}data/worlds/chocobo.json`, '{"period":"7d"}'],
      [`${baseUrl}data/worlds/chocobo-1d.json`, '{"period":"1d"}'],
      [`${baseUrl}data/worlds/hades.json`, '{"server":"Hades","period":"7d"}'],
      [`${baseUrl}data/worlds/hades-1d.json`, '{"server":"Hades","period":"1d"}'],
    ]);
    const requestedUrls = [];

    try {
      const result = await restorePublishedData({
        baseUrl,
        defaultWorld: 'Hades',
        distDir,
        fetchImpl: async (url) => {
          requestedUrls.push(url);
          return {
            ok: responses.has(url),
            status: responses.has(url) ? 200 : 404,
            text: async () => responses.get(url),
          };
        },
      });

      assert.equal(result.count, 6);
      assert.deepEqual(requestedUrls, [
        `${baseUrl}data/worlds.json`,
        `${baseUrl}data/worlds/hades.json`,
        `${baseUrl}data/worlds/chocobo.json`,
        `${baseUrl}data/worlds/chocobo-1d.json`,
        `${baseUrl}data/worlds/hades-1d.json`,
      ]);
      assert.equal(
        JSON.parse(await readFile(join(distDir, 'data/worlds.json'), 'utf8')).defaultWorld,
        'Hades',
      );
      assert.equal(
        await readFile(join(distDir, 'data/marketshare.json'), 'utf8'),
        '{"server":"Hades","period":"7d"}',
      );
      assert.equal(
        await readFile(join(distDir, 'data/worlds/chocobo-1d.json'), 'utf8'),
        '{"period":"1d"}',
      );
    } finally {
      await rm(distDir, { recursive: true, force: true });
    }
  });
});

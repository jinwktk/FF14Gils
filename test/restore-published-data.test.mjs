import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-dist-'));
    const distDir = join(root, 'dist');
    const bundledLodestonePath = join(root, 'assets', 'lodestone-items.json');
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
      [`${baseUrl}data/worlds/chocobo.json`, '{"period":"7d","items":[{"itemId":"1"}]}'],
      [`${baseUrl}data/worlds/chocobo-1d.json`, '{"period":"1d","items":[{"itemId":"1"}]}'],
      [`${baseUrl}data/worlds/hades.json`, '{"server":"Hades","period":"7d","items":[{"itemId":"2"}]}'],
      [`${baseUrl}data/worlds/hades-1d.json`, '{"server":"Hades","period":"1d","items":[{"itemId":"2"}]}'],
    ]);
    const requestedUrls = [];
    const requestOptions = [];
    const warnings = [];

    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(
        bundledLodestonePath,
        JSON.stringify({ 1: 'aaaaaaaaaaa', 2: 'bbbbbbbbbbb', 999: '99999999999' }),
      );
      const result = await restorePublishedData({
        baseUrl,
        defaultWorld: 'Hades',
        distDir,
        bundledLodestonePath,
        retries: 0,
        log: (message) => warnings.push(message),
        fetchImpl: async (url, options) => {
          requestedUrls.push(url);
          requestOptions.push(options);
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
        `${baseUrl}assets/lodestone-items.json`,
      ]);
      assert.equal(requestOptions.at(-1).signal instanceof AbortSignal, true);
      assert.equal(
        JSON.parse(await readFile(join(distDir, 'data/worlds.json'), 'utf8')).defaultWorld,
        'Hades',
      );
      assert.equal(
        await readFile(join(distDir, 'data/marketshare.json'), 'utf8'),
        '{"server":"Hades","period":"7d","items":[{"itemId":"2"}]}',
      );
      assert.equal(
        await readFile(join(distDir, 'data/worlds/chocobo-1d.json'), 'utf8'),
        '{"period":"1d","items":[{"itemId":"1"}]}',
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(distDir, 'assets/lodestone-items.json'), 'utf8')),
        { 1: 'aaaaaaaaaaa', 2: 'bbbbbbbbbbb' },
      );
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /HTTP 404/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('公開済み対応表の追加IDを同梱表へmergeして復元する', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-dist-'));
    const distDir = join(root, 'dist');
    const bundledLodestonePath = join(root, 'assets', 'lodestone-items.json');
    const baseUrl = 'https://example.test/FF14Gils/';
    const worldsJson = JSON.stringify({
      defaultWorld: 'Hades',
      defaultPeriod: '7d',
      worlds: [
        {
          name: 'Hades',
          path: 'data/worlds/hades.json',
          periods: { '7d': 'data/worlds/hades.json' },
        },
      ],
    });
    const responses = new Map([
      [`${baseUrl}data/worlds.json`, worldsJson],
      [`${baseUrl}data/worlds/hades.json`, '{"items":[{"itemId":"1"},{"itemId":"2"}]}'],
      [
        `${baseUrl}assets/lodestone-items.json`,
        JSON.stringify({ 1: 'aaaaaaaaaaa', 2: '22222222222' }),
      ],
    ]);

    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(bundledLodestonePath, JSON.stringify({ 1: '11111111111' }));

      const result = await restorePublishedData({
        baseUrl,
        distDir,
        bundledLodestonePath,
        retries: 0,
        fetchImpl: async (url) => ({
          ok: responses.has(url),
          status: responses.has(url) ? 200 : 404,
          text: async () => responses.get(url),
        }),
      });

      assert.equal(result.lodestoneItemCount, 2);
      assert.deepEqual(
        JSON.parse(await readFile(join(distDir, 'assets/lodestone-items.json'), 'utf8')),
        { 1: 'aaaaaaaaaaa', 2: '22222222222' },
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('公開済み対応表が不正でも市場データrestoreを止めず同梱表を維持する', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-dist-'));
    const distDir = join(root, 'dist');
    const bundledLodestonePath = join(root, 'assets', 'lodestone-items.json');
    const baseUrl = 'https://example.test/FF14Gils/';
    const warnings = [];
    const worldsJson = JSON.stringify({
      defaultWorld: 'Hades',
      defaultPeriod: '7d',
      worlds: [
        {
          name: 'Hades',
          path: 'data/worlds/hades.json',
          periods: { '7d': 'data/worlds/hades.json' },
        },
      ],
    });
    const responses = new Map([
      [`${baseUrl}data/worlds.json`, worldsJson],
      [`${baseUrl}data/worlds/hades.json`, '{"items":[{"itemId":"1"},{"itemId":"2"}]}'],
      [`${baseUrl}assets/lodestone-items.json`, '{"2":"invalid-hash"}'],
    ]);

    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(bundledLodestonePath, JSON.stringify({ 1: '11111111111' }));

      const result = await restorePublishedData({
        baseUrl,
        distDir,
        bundledLodestonePath,
        retries: 0,
        log: (message) => warnings.push(message),
        fetchImpl: async (url) => ({
          ok: responses.has(url),
          status: responses.has(url) ? 200 : 404,
          text: async () => responses.get(url),
        }),
      });

      assert.equal(result.count, 3);
      assert.equal(
        await readFile(join(distDir, 'data/marketshare.json'), 'utf8'),
        '{"items":[{"itemId":"1"},{"itemId":"2"}]}',
      );
      assert.deepEqual(
        JSON.parse(await readFile(join(distDir, 'assets/lodestone-items.json'), 'utf8')),
        { 1: '11111111111' },
      );
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /Published Lodestone item mapping restore skipped/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

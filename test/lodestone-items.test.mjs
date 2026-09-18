import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  LODESTONE_ITEM_ID_SOURCE,
  collectSnapshotItemIds,
  parseLodestoneItemIdMapping,
  updateLodestoneItemLinks,
} from '../scripts/lodestone-items.mjs';

describe('collectSnapshotItemIds', () => {
  it('snapshotのitemsに含まれる有効なitemIdだけを重複なしで集める', () => {
    assert.deepEqual(
      collectSnapshotItemIds([
        { items: [{ itemId: '46834' }, { itemId: 49751 }, { itemId: '' }] },
        { items: [{ itemId: '46834' }, { itemId: 'invalid' }] },
      ]),
      ['46834', '49751'],
    );
  });
});

describe('parseLodestoneItemIdMapping', () => {
  it('1始まりの行番号をitemIdとして11桁hexだけを抽出する', () => {
    assert.deepEqual(
      parseLodestoneItemIdMapping(
        ['aaaaaaaaaaa', 'bbbbbbbbbbb', '0123456789a', 'invalid-hash'].join('\n'),
        ['3', '1', '4'],
      ),
      {
        1: 'aaaaaaaaaaa',
        3: '0123456789a',
      },
    );
  });

  it('対象itemIdまで行がない不完全なmappingを拒否する', () => {
    assert.throws(
      () => parseLodestoneItemIdMapping('aaaaaaaaaaa', ['2']),
      /does not cover item ID 2/,
    );
  });
});

describe('updateLodestoneItemLinks', () => {
  it('全snapshotを読みbulk mappingを1回だけ取得して対象IDだけ保存する', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-lodestone-'));
    const worldsDir = join(root, 'data', 'worlds');
    const outputPath = join(root, 'assets', 'lodestone-items.json');
    const requestedUrls = [];
    const requestOptions = [];
    const mappingLines = Array.from({ length: 4 }, () => '');
    mappingLines[1] = 'bbbbbbbbbbb';
    mappingLines[3] = 'ddddddddddd';

    try {
      await mkdir(worldsDir, { recursive: true });
      await writeFile(
        join(worldsDir, 'hades.json'),
        JSON.stringify({ items: [{ itemId: '4' }, { itemId: '2' }] }),
      );
      await writeFile(
        join(worldsDir, 'chocobo.json'),
        JSON.stringify({ items: [{ itemId: '2' }] }),
      );

      const result = await updateLodestoneItemLinks({
        worldsDir,
        outputPath,
        fetchImpl: async (url, options) => {
          requestedUrls.push(url);
          requestOptions.push(options);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => mappingLines.join('\n'),
          };
        },
      });

      assert.deepEqual(result, { updated: true, itemCount: 2 });
      assert.deepEqual(requestedUrls, [LODESTONE_ITEM_ID_SOURCE]);
      assert.equal(requestOptions[0].signal instanceof AbortSignal, true);
      assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), {
        2: 'bbbbbbbbbbb',
        4: 'ddddddddddd',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('mapping取得失敗時は既存assetを保持して警告だけ返す', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-lodestone-'));
    const worldsDir = join(root, 'data', 'worlds');
    const outputPath = join(root, 'assets', 'lodestone-items.json');
    const warnings = [];

    try {
      await mkdir(worldsDir, { recursive: true });
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(join(worldsDir, 'hades.json'), JSON.stringify({ items: [{ itemId: '2' }] }));
      await writeFile(outputPath, '{"2":"existinghash"}\n');

      const result = await updateLodestoneItemLinks({
        worldsDir,
        outputPath,
        publishedFallbackBaseUrl: null,
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        }),
        log: (message) => warnings.push(message),
      });

      assert.deepEqual(result, { updated: false, itemCount: 0 });
      assert.equal(await readFile(outputPath, 'utf8'), '{"2":"existinghash"}\n');
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /Lodestone item mapping update skipped/);
      assert.doesNotMatch(warnings[0], /existinghash/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('bulk mapping取得失敗時は公開済み対応表をfallbackとして使う', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-lodestone-'));
    const outputPath = join(root, 'cache', 'custom-links.json');
    const publishedBaseUrl = 'https://example.test/FF14Gils/';
    const requestedUrls = [];

    try {
      await mkdir(join(root, 'cache'), { recursive: true });
      await writeFile(outputPath, JSON.stringify({ 1: '11111111111' }));

      const result = await updateLodestoneItemLinks({
        snapshots: [{ items: [{ itemId: '1' }, { itemId: '2' }] }],
        outputPath,
        publishedFallbackBaseUrl: publishedBaseUrl,
        log: () => {},
        fetchImpl: async (url) => {
          requestedUrls.push(url);

          if (url === LODESTONE_ITEM_ID_SOURCE) {
            return { ok: false, status: 503, statusText: 'Service Unavailable' };
          }

          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => JSON.stringify({ 2: '22222222222' }),
          };
        },
      });

      assert.deepEqual(result, { updated: false, itemCount: 2 });
      assert.deepEqual(requestedUrls, [
        LODESTONE_ITEM_ID_SOURCE,
        `${publishedBaseUrl}assets/lodestone-items.json`,
      ]);
      assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), {
        1: '11111111111',
        2: '22222222222',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('部分欠落時は既存の有効hashだけを補完し不正hashを保存しない', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ff14gils-lodestone-'));
    const outputPath = join(root, 'assets', 'lodestone-items.json');
    const warnings = [];

    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(
        outputPath,
        JSON.stringify({ 2: 'bbbbbbbbbbb', 3: 'not-a-hash', 99: '99999999999' }),
      );

      const result = await updateLodestoneItemLinks({
        snapshots: [{ items: [{ itemId: '1' }, { itemId: '2' }, { itemId: '3' }] }],
        outputPath,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => ['aaaaaaaaaaa', '', 'invalid-hash'].join('\n'),
        }),
        log: (message) => warnings.push(message),
      });

      assert.deepEqual(result, { updated: true, itemCount: 2 });
      assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), {
        1: 'aaaaaaaaaaa',
        2: 'bbbbbbbbbbb',
      });
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /omitted 2 current item IDs/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

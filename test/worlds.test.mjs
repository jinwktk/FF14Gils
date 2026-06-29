import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEFAULT_SALES_PERIOD,
  buildWorldSnapshotPath,
  buildWorldPeriodSnapshotPath,
  createWorldIndex,
  normalizeWorldIndex,
  parseWorldList,
  parseSalesPeriodList,
  resolveDefaultWorld,
  worldSlug,
} from '../src/worlds.js';

describe('worldSlug', () => {
  it('ワールド名を静的JSON用の安全なslugにする', () => {
    assert.equal(worldSlug('Carbuncle'), 'carbuncle');
    assert.equal(worldSlug('  Kujata  '), 'kujata');
    assert.equal(worldSlug('Materia Test'), 'materia-test');
  });
});

describe('parseWorldList', () => {
  it('カンマ・改行区切りのワールド一覧を重複なしにする', () => {
    assert.deepEqual(parseWorldList('Carbuncle, Chocobo\nFenrir,Carbuncle'), [
      'Carbuncle',
      'Chocobo',
      'Fenrir',
    ]);
  });
});

describe('createWorldIndex', () => {
  it('選択UIが使うworlds.json契約を生成する', () => {
    const index = createWorldIndex({
      worlds: ['Carbuncle', 'Chocobo'],
      defaultWorld: 'Chocobo',
      generatedAt: '2026-06-29T00:00:00.000Z',
    });

    assert.equal(index.defaultWorld, 'Chocobo');
    assert.deepEqual(index.worlds, [
      {
        name: 'Carbuncle',
        path: 'data/worlds/carbuncle.json',
        dataCenter: 'Elemental',
        periods: {
          '1d': 'data/worlds/carbuncle-1d.json',
          '3d': 'data/worlds/carbuncle-3d.json',
          '7d': 'data/worlds/carbuncle.json',
          '30d': 'data/worlds/carbuncle-30d.json',
        },
      },
      {
        name: 'Chocobo',
        path: 'data/worlds/chocobo.json',
        dataCenter: 'Mana',
        periods: {
          '1d': 'data/worlds/chocobo-1d.json',
          '3d': 'data/worlds/chocobo-3d.json',
          '7d': 'data/worlds/chocobo.json',
          '30d': 'data/worlds/chocobo-30d.json',
        },
      },
    ]);
    assert.equal(index.defaultPeriod, DEFAULT_SALES_PERIOD);
    assert.deepEqual(index.periods.map((period) => `${period.key}:${period.hours}`), [
      '1d:24',
      '3d:72',
      '7d:168',
      '30d:720',
    ]);
  });

  it('日本DCの並びをDCごとのカテゴリとして保持する', () => {
    const index = createWorldIndex({
      worlds: ['Aegis', 'Alexander', 'Hades', 'Shinryu'],
      generatedAt: '2026-06-29T00:00:00.000Z',
    });

    assert.deepEqual(
      index.worlds.map((world) => `${world.dataCenter}:${world.name}`),
      ['Elemental:Aegis', 'Gaia:Alexander', 'Mana:Hades', 'Meteor:Shinryu'],
    );
  });
});

describe('parseSalesPeriodList', () => {
  it('売上期間を重複なしで解決する', () => {
    assert.deepEqual(
      parseSalesPeriodList('1d, 7d\n30d,1d').map((period) => period.key),
      ['1d', '7d', '30d'],
    );
  });
});

describe('resolveDefaultWorld', () => {
  it('指定がない場合は既定ワールドを優先する', () => {
    assert.equal(resolveDefaultWorld(['Aegis', 'Carbuncle', 'Hades']), 'Hades');
  });

  it('環境変数で指定されたワールドが一覧にあればそれを優先する', () => {
    assert.equal(resolveDefaultWorld(['Aegis', 'Carbuncle', 'Chocobo'], 'Chocobo'), 'Chocobo');
  });
});

describe('normalizeWorldIndex', () => {
  it('古いworlds.jsonにもDC情報を補完する', () => {
    const index = normalizeWorldIndex({
      generatedAt: '2026-06-29T00:00:00.000Z',
      defaultWorld: 'Hades',
      worlds: [{ name: 'Hades', path: 'data/worlds/hades.json' }],
    });

    assert.deepEqual(index.worlds, [
      {
        name: 'Hades',
        path: 'data/worlds/hades.json',
        dataCenter: 'Mana',
        periods: {
          '1d': 'data/worlds/hades.json',
          '3d': 'data/worlds/hades.json',
          '7d': 'data/worlds/hades.json',
          '30d': 'data/worlds/hades.json',
        },
      },
    ]);
    assert.equal(index.defaultPeriod, DEFAULT_SALES_PERIOD);
  });
});

describe('buildWorldSnapshotPath', () => {
  it('ワールド別スナップショットの相対パスを返す', () => {
    assert.equal(buildWorldSnapshotPath('Shinryu'), 'data/worlds/shinryu.json');
  });
});

describe('buildWorldPeriodSnapshotPath', () => {
  it('7日は従来パスを使い、他期間は期間付きパスを返す', () => {
    assert.equal(buildWorldPeriodSnapshotPath('Hades', '7d'), 'data/worlds/hades.json');
    assert.equal(buildWorldPeriodSnapshotPath('Hades', '1d'), 'data/worlds/hades-1d.json');
    assert.equal(buildWorldPeriodSnapshotPath('Hades', '30d'), 'data/worlds/hades-30d.json');
  });
});

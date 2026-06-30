import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEFAULT_WORLDS,
  WORLD_DATA_CENTERS,
  WORLD_DATA_CENTER_REGIONS,
  DEFAULT_SALES_PERIOD,
  buildWorldSnapshotPath,
  buildWorldPeriodSnapshotPath,
  createWorldIndex,
  filterWorldsByDataCenter,
  listDataCenterGroupsForWorlds,
  listDataCentersForWorlds,
  normalizeWorldIndex,
  parseWorldList,
  parseSalesPeriodList,
  resolveDefaultWorld,
  resolveWorldDataCenter,
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

  it('未指定時は全DCのワールドを生成対象にする', () => {
    const worlds = parseWorldList('');

    assert.equal(worlds.length, 85);
    assert.ok(worlds.includes('Adamantoise'));
    assert.ok(worlds.includes('Cuchulainn'));
    assert.ok(worlds.includes('Phantom'));
    assert.ok(worlds.includes('Ravana'));
    assert.ok(worlds.includes('Hades'));
    assert.deepEqual(worlds, DEFAULT_WORLDS);
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
        },
      },
    ]);
    assert.equal(index.defaultPeriod, DEFAULT_SALES_PERIOD);
    assert.deepEqual(index.periods.map((period) => `${period.key}:${period.hours}`), [
      '1d:24',
      '3d:72',
      '7d:168',
    ]);
  });

  it('全リージョンのDCをカテゴリとして保持する', () => {
    const index = createWorldIndex({
      worlds: [
        'Adamantoise',
        'Balmung',
        'Rafflesia',
        'Excalibur',
        'Omega',
        'Alpha',
        'Ravana',
        'Aegis',
        'Alexander',
        'Hades',
        'Shinryu',
      ],
      generatedAt: '2026-06-29T00:00:00.000Z',
    });

    assert.deepEqual(
      index.worlds.map((world) => `${world.dataCenter}:${world.name}`),
      [
        'Aether:Adamantoise',
        'Crystal:Balmung',
        'Dynamis:Rafflesia',
        'Primal:Excalibur',
        'Chaos:Omega',
        'Light:Alpha',
        'Materia:Ravana',
        'Elemental:Aegis',
        'Gaia:Alexander',
        'Mana:Hades',
        'Meteor:Shinryu',
      ],
    );
  });

  it('公式Lodestoneの全DC構成を保持する', () => {
    assert.deepEqual(
      WORLD_DATA_CENTERS.map((dataCenter) => `${dataCenter.name}:${dataCenter.worlds.length}`),
      [
        'Aether:8',
        'Crystal:8',
        'Dynamis:8',
        'Primal:8',
        'Chaos:8',
        'Light:8',
        'Materia:5',
        'Elemental:8',
        'Gaia:8',
        'Mana:8',
        'Meteor:8',
      ],
    );
    assert.equal(resolveWorldDataCenter('Seraph'), 'Dynamis');
    assert.equal(resolveWorldDataCenter('Spriggan'), 'Chaos');
    assert.equal(resolveWorldDataCenter('Bismarck'), 'Materia');
  });
});

describe('parseSalesPeriodList', () => {
  it('売上期間を重複なしで解決する', () => {
    assert.deepEqual(
      parseSalesPeriodList('1d, 7d\n30d,1d').map((period) => period.key),
      ['1d', '7d'],
    );
  });
});

describe('data center helpers', () => {
  const worlds = [
    { name: 'Hades', dataCenter: 'Mana' },
    { name: 'Chocobo', dataCenter: 'Mana' },
    { name: 'Adamantoise', dataCenter: 'Aether' },
    { name: 'Excalibur', dataCenter: 'Primal' },
    { name: 'Omega', dataCenter: 'Chaos' },
    { name: 'Ravana', dataCenter: 'Materia' },
    { name: 'Custom', dataCenter: 'その他' },
  ];

  it('DCをリージョン別の表示順で列挙する', () => {
    assert.deepEqual(
      WORLD_DATA_CENTER_REGIONS.map((region) => `${region.key}:${region.dataCenters.join(',')}`),
      [
        'northAmerica:Aether,Primal,Crystal,Dynamis',
        'europe:Chaos,Light',
        'japan:Elemental,Gaia,Mana,Meteor',
        'oceania:Materia',
      ],
    );
    assert.deepEqual(listDataCentersForWorlds(worlds), [
      'Aether',
      'Primal',
      'Chaos',
      'Mana',
      'Materia',
      'その他',
    ]);
  });

  it('worlds.jsonに含まれるDCをリージョン別グループにする', () => {
    assert.deepEqual(listDataCenterGroupsForWorlds(worlds), [
      { key: 'northAmerica', dataCenters: ['Aether', 'Primal'] },
      { key: 'europe', dataCenters: ['Chaos'] },
      { key: 'japan', dataCenters: ['Mana'] },
      { key: 'oceania', dataCenters: ['Materia'] },
      { key: 'other', dataCenters: ['その他'] },
    ]);
  });

  it('選択したDCに属するワールドだけを返す', () => {
    assert.deepEqual(
      filterWorldsByDataCenter(worlds, 'Mana').map((world) => world.name),
      ['Hades', 'Chocobo'],
    );
    assert.deepEqual(
      filterWorldsByDataCenter(worlds, 'Aether').map((world) => world.name),
      ['Adamantoise'],
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
    assert.equal(buildWorldPeriodSnapshotPath('Hades', '30d'), 'data/worlds/hades.json');
  });
});

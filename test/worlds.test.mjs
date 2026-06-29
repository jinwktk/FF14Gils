import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildWorldSnapshotPath,
  createWorldIndex,
  parseWorldList,
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
      { name: 'Carbuncle', path: 'data/worlds/carbuncle.json' },
      { name: 'Chocobo', path: 'data/worlds/chocobo.json' },
    ]);
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

describe('buildWorldSnapshotPath', () => {
  it('ワールド別スナップショットの相対パスを返す', () => {
    assert.equal(buildWorldSnapshotPath('Shinryu'), 'data/worlds/shinryu.json');
  });
});

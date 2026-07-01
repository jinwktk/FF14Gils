import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  WORLD_COOKIE_NAME,
  buildWorldPreferenceCookie,
  readCookieValue,
  resolvePreferredWorld,
} from '../src/preferences.js';

const worldIndex = {
  defaultWorld: 'Hades',
  worlds: [
    { name: 'Carbuncle', path: 'data/worlds/carbuncle.json' },
    { name: 'Hades', path: 'data/worlds/hades.json' },
    { name: 'Chocobo', path: 'data/worlds/chocobo.json' },
  ],
};

describe('readCookieValue', () => {
  it('Cookie文字列からワールド名を取り出す', () => {
    assert.equal(
      readCookieValue(`theme=dark; ${WORLD_COOKIE_NAME}=Chocobo`, WORLD_COOKIE_NAME),
      'Chocobo',
    );
  });
});

describe('resolvePreferredWorld', () => {
  it('保存済みワールドが有効ならそれを優先する', () => {
    assert.equal(resolvePreferredWorld(worldIndex, `${WORLD_COOKIE_NAME}=Chocobo`), 'Chocobo');
  });

  it('保存済みワールドがない場合はHadesを初期表示にする', () => {
    assert.equal(resolvePreferredWorld(worldIndex, ''), 'Hades');
  });

  it('存在しない保存済みワールドは無視する', () => {
    assert.equal(resolvePreferredWorld(worldIndex, `${WORLD_COOKIE_NAME}=Missing`), 'Hades');
  });
});

describe('buildWorldPreferenceCookie', () => {
  it('選択したワールドをCookieへ保存する文字列を作る', () => {
    assert.equal(
      buildWorldPreferenceCookie('Chocobo'),
      `${WORLD_COOKIE_NAME}=Chocobo; Max-Age=15552000; Path=/; SameSite=Lax`,
    );
  });
});

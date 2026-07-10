import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  ROUTE_MANIFEST,
  ROUTE_NAMES,
  buildPagePath,
  getRouteDefinition,
  routeFromPath,
} from '../src/routes.js';
import { createRouteCoordinator } from '../src/route-coordinator.js';
import { createResourceCoordinator } from '../src/resource-coordinator.js';

describe('route manifest', () => {
  it('3つの公開ルートを末尾スラッシュ・固有メタ・必要リソースとともに定義する', () => {
    assert.deepEqual(ROUTE_NAMES, ['market', 'ranking', 'legal']);
    assert.equal(ROUTE_MANIFEST.market.path, '');
    assert.equal(ROUTE_MANIFEST.ranking.path, 'ranking/');
    assert.equal(ROUTE_MANIFEST.legal.path, 'legal/');
    assert.deepEqual(ROUTE_MANIFEST.market.resources, {
      snapshot: true,
      worldIndex: true,
    });
    assert.deepEqual(ROUTE_MANIFEST.ranking.resources, {
      snapshot: false,
      worldIndex: true,
    });
    assert.deepEqual(ROUTE_MANIFEST.legal.resources, {
      snapshot: false,
      worldIndex: false,
    });

    for (const language of ['ja', 'en']) {
      const titles = new Set();
      const descriptions = new Set();

      for (const route of ROUTE_NAMES) {
        const definition = getRouteDefinition(route, language);
        const meta = definition.meta;

        assert.equal(definition.section, route);
        assert.match(definition.absoluteUrl, /\/$/);
        assert.ok(meta.title.length > 10);
        assert.ok(meta.description.length > 30);
        assert.ok(meta.ogDescription.length > 20);
        assert.ok(meta.heroEyebrow.length > 2);
        assert.ok(meta.heroTitle.length > 4);
        assert.ok(meta.heroLead.length > 15);
        assert.ok(['WebApplication', 'CollectionPage', 'WebPage'].includes(meta.schemaType));
        assert.ok(meta.schemaName.length > 4);
        titles.add(meta.title);
        descriptions.add(meta.description);
      }

      assert.equal(titles.size, ROUTE_NAMES.length);
      assert.equal(descriptions.size, ROUTE_NAMES.length);
    }
  });

  it('path解決はslashless入力も受け付け、生成URLは常に末尾スラッシュにする', () => {
    assert.equal(routeFromPath('/FF14Gils/', '/FF14Gils/'), 'market');
    assert.equal(routeFromPath('/FF14Gils/ranking', '/FF14Gils/'), 'ranking');
    assert.equal(routeFromPath('/FF14Gils/ranking/', '/FF14Gils/'), 'ranking');
    assert.equal(routeFromPath('/FF14Gils/legal/', '/FF14Gils/'), 'legal');
    assert.equal(routeFromPath('/FF14Gils/unknown/', '/FF14Gils/'), 'market');
    assert.equal(buildPagePath('market', '/FF14Gils/'), '/FF14Gils/');
    assert.equal(buildPagePath('ranking', '/FF14Gils/'), '/FF14Gils/ranking/');
    assert.equal(buildPagePath('legal', '/FF14Gils/'), '/FF14Gils/legal/');
  });
});

describe('route coordinator', () => {
  it('direct初期化はhistoryを書かず、clickだけpushStateし、popstateも書かない', () => {
    const historyCalls = [];
    const transitions = [];
    const location = { pathname: '/FF14Gils/' };
    const coordinator = createRouteCoordinator({
      basePath: '/FF14Gils/',
      getPathname: () => location.pathname,
      history: {
        pushState(...args) {
          historyCalls.push(['pushState', ...args]);
        },
        replaceState(...args) {
          historyCalls.push(['replaceState', ...args]);
        },
      },
      onRoute(route, source) {
        transitions.push([route, source]);
      },
    });

    assert.equal(coordinator.initialize(), 'market');
    assert.deepEqual(historyCalls, []);
    assert.deepEqual(transitions, [['market', 'direct']]);

    assert.equal(coordinator.navigate('ranking'), 'ranking');
    assert.deepEqual(historyCalls, [
      ['pushState', {}, '', '/FF14Gils/ranking/'],
    ]);
    assert.deepEqual(transitions.at(-1), ['ranking', 'click']);

    location.pathname = '/FF14Gils/legal/';
    assert.equal(coordinator.handlePopState(), 'legal');
    assert.equal(historyCalls.length, 1);
    assert.deepEqual(transitions.at(-1), ['legal', 'popstate']);
  });
});

describe('resource coordinator', () => {
  it('同一resourceのin-flight requestを1回へまとめる', async () => {
    let calls = 0;
    let resolveRequest;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const coordinator = createResourceCoordinator(() => {
      calls += 1;
      return pending;
    });

    const first = coordinator.load('data/worlds.json');
    const second = coordinator.load('data/worlds.json');

    assert.strictEqual(first, second);
    assert.equal(calls, 1);
    resolveRequest({ worlds: [] });
    assert.deepEqual(await first, { worlds: [] });
    assert.deepEqual(await second, { worlds: [] });
  });

  it('routeとsnapshot選択の世代を分け、古い成功・失敗をcommitしない', async () => {
    const applied = [];
    const errors = [];
    const coordinator = createResourceCoordinator(async (path) => ({ path }));

    coordinator.beginRoute();
    const staleSelection = coordinator.beginSelection();
    const currentSelection = coordinator.beginSelection();

    assert.equal(coordinator.isCurrent(staleSelection), false);
    assert.equal(coordinator.isCurrent(currentSelection), true);
    assert.deepEqual(
      await coordinator.commit(staleSelection, Promise.resolve('old'), {
        onError: (error) => errors.push(error.message),
        onSuccess: (value) => applied.push(value),
      }),
      { applied: false, status: 'fulfilled' },
    );
    assert.deepEqual(applied, []);

    assert.deepEqual(
      await coordinator.commit(currentSelection, Promise.resolve('new'), {
        onError: (error) => errors.push(error.message),
        onSuccess: (value) => applied.push(value),
      }),
      { applied: true, status: 'fulfilled' },
    );
    assert.deepEqual(applied, ['new']);

    const staleError = coordinator.beginSelection();
    coordinator.beginSelection();
    assert.deepEqual(
      await coordinator.commit(staleError, Promise.reject(new Error('stale')), {
        onError: (error) => errors.push(error.message),
        onSuccess: (value) => applied.push(value),
      }),
      { applied: false, status: 'rejected' },
    );
    assert.deepEqual(errors, []);

    const routeToken = coordinator.beginRoute();
    assert.equal(coordinator.isCurrent(currentSelection), false);
    assert.equal(coordinator.isCurrent(routeToken), true);
  });
});

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, it } from 'node:test';

describe('delayed Google Analytics buffer', () => {
  it('初期URLを保持し、tag準備前のSPA遷移だけを順番に再送する', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const script = inlineAnalyticsScript(html);
    const windowListeners = new Map();
    const scriptListeners = new Map();
    const idleCallbacks = [];
    const appendedScripts = [];
    const sandbox = {
      Date,
      location: { href: 'https://jinwktk.github.io/FF14Gils/' },
      addEventListener(type, listener) {
        windowListeners.set(type, listener);
      },
      requestIdleCallback(callback, options) {
        idleCallbacks.push({ callback, options });
      },
      setTimeout(callback) {
        callback();
      },
    };
    sandbox.window = sandbox;
    sandbox.document = {
      title: 'root title',
      createElement(tagName) {
        const scriptElement = {
          tagName,
          addEventListener(type, listener) {
            scriptListeners.set(type, listener);
          },
        };
        return scriptElement;
      },
      head: {
        append(scriptElement) {
          appendedScripts.push(scriptElement);
        },
      },
    };

    vm.runInContext(script, vm.createContext(sandbox));
    const config = entries(sandbox.dataLayer).find((entry) => entry[0] === 'config');
    assert.equal(config?.[2]?.page_location, 'https://jinwktk.github.io/FF14Gils/');
    assert.equal(config?.[2]?.page_title, 'root title');

    sandbox.ff14gilsAnalytics.queuePageView({
      page_location: 'https://jinwktk.github.io/FF14Gils/ranking/',
      page_title: 'ranking title',
    });
    windowListeners.get('load')();
    assert.equal(idleCallbacks.length, 1);
    assert.deepEqual(idleCallbacks[0].options, { timeout: 2000 });
    idleCallbacks[0].callback();
    assert.equal(appendedScripts.length, 1);
    scriptListeners.get('load')();

    const earlyPageViews = entries(sandbox.dataLayer).filter(
      (entry) => entry[0] === 'event' && entry[1] === 'page_view',
    );
    assert.equal(earlyPageViews.length, 1);
    assert.equal(
      earlyPageViews[0][2].page_location,
      'https://jinwktk.github.io/FF14Gils/ranking/',
    );

    sandbox.ff14gilsAnalytics.queuePageView({
      page_location: 'https://jinwktk.github.io/FF14Gils/legal/',
      page_title: 'legal title',
    });
    assert.equal(
      entries(sandbox.dataLayer).filter(
        (entry) => entry[0] === 'event' && entry[1] === 'page_view',
      ).length,
      1,
    );
  });
});

function inlineAnalyticsScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const source = scripts.find((match) => match[1].includes('window.dataLayer'))?.[1];
  assert.ok(source, 'inline analytics scriptが必要です');
  return source;
}

function entries(dataLayer) {
  return dataLayer.map((entry) => Array.from(entry));
}

import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { before, describe, it } from 'node:test';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const routeFiles = {
  legal: new URL('../dist/legal/index.html', import.meta.url),
  market: new URL('../dist/index.html', import.meta.url),
  ranking: new URL('../dist/ranking/index.html', import.meta.url),
};
const htmlByRoute = new Map();

before(async () => {
  await execFileAsync(process.execPath, ['scripts/build.mjs'], { cwd: root });

  for (const [route, url] of Object.entries(routeFiles)) {
    htmlByRoute.set(route, await readFile(url, 'utf8'));
  }
});

describe('static-first route entrypoints', () => {
  it('各routeが固有title/description/OG/Twitter/canonical/JSON-LDを持つ', () => {
    const titles = new Set();
    const descriptions = new Set();

    for (const [route, html] of htmlByRoute) {
      const expectedUrl = route === 'market'
        ? 'https://jinwktk.github.io/FF14Gils/'
        : `https://jinwktk.github.io/FF14Gils/${route}/`;
      const title = textContent(html, 'title');
      const description = metaContent(html, 'name', 'description');

      titles.add(title);
      descriptions.add(description);
      assert.equal(linkHref(html, 'canonical'), expectedUrl);
      assert.equal(metaContent(html, 'property', 'og:url'), expectedUrl);
      assert.equal(metaContent(html, 'property', 'og:title'), title);
      assert.equal(metaContent(html, 'name', 'twitter:title'), title);
      assert.notEqual(metaContent(html, 'property', 'og:description'), '');
      assert.notEqual(metaContent(html, 'name', 'twitter:description'), '');

      const jsonLd = JSON.parse(
        html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}',
      );
      assert.equal(jsonLd.url, expectedUrl);
      assert.equal(jsonLd.name, title);
      assert.equal(jsonLd.description, description);
    }

    assert.equal(titles.size, 3);
    assert.equal(descriptions.size, 3);
  });

  it('JS実行前から対象sectionとroute heroだけを初期表示する', () => {
    for (const [route, html] of htmlByRoute) {
      assert.doesNotMatch(sectionOpening(html, route), /\bhidden\b/);

      for (const otherRoute of ['market', 'ranking', 'legal'].filter((item) => item !== route)) {
        assert.match(sectionOpening(html, otherRoute), /\bhidden\b/);
      }

      assert.notEqual(routeHeroText(html, 'title'), '');
      assert.notEqual(routeHeroText(html, 'lead'), '');
    }

    assert.equal(new Set([...htmlByRoute.values()].map((html) => routeHeroText(html, 'title'))).size, 3);
    assert.equal(new Set([...htmlByRoute.values()].map((html) => routeHeroText(html, 'lead'))).size, 3);
  });

  it('known route入口はsessionStorage bootstrapを使わず末尾スラッシュnavを出す', () => {
    for (const route of ['ranking', 'legal']) {
      const html = htmlByRoute.get(route);
      assert.doesNotMatch(html, /sessionStorage\.setItem\('ff14gils_route'/);
      assert.match(html, /<base href="\.\.\/" \/>/);
      assert.match(html, /href="\.\/ranking\/"/);
      assert.match(html, /href="\.\/legal\/"/);
    }
  });
});

function textContent(html, tagName) {
  return decodeHtml(html.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`))?.[1] ?? '');
}

function metaContent(html, attribute, value) {
  return decodeHtml(
    html.match(new RegExp(`<meta ${attribute}="${escapeRegExp(value)}" content="([^"]*)" \\/>`))?.[1] ?? '',
  );
}

function linkHref(html, rel) {
  return decodeHtml(html.match(new RegExp(`<link rel="${rel}" href="([^"]+)" \\/>`))?.[1] ?? '');
}

function sectionOpening(html, route) {
  const tags = html.match(/<section\b[^>]*>/gs) ?? [];
  return tags.find((tag) => tag.includes(`data-page="${route}"`)) ?? '';
}

function routeHeroText(html, field) {
  const tag = field === 'title' ? 'h1' : 'p';
  return decodeHtml(
    html.match(new RegExp(`<${tag}[^>]*data-route-hero-${field}[^>]*>([^<]+)</${tag}>`))?.[1]?.trim() ?? '',
  );
}

function decodeHtml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

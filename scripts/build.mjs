import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ROUTE_NAMES, getRouteDefinition } from '../src/routes.js';
import { compactJsonDirectory } from './compact-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const routeEntrypoints = ROUTE_NAMES.filter((route) => route !== 'market');
const entries = [
  '404.html',
  'index.html',
  'legal.html',
  'favicon.ico',
  'styles.css',
  'src',
  'data',
  'assets',
  'robots.txt',
  'sitemap.xml',
  'googled9f512eea3a99dc1.html',
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(`../dist/${entry}`, import.meta.url), {
    recursive: true,
  });
}

const sourceHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
await writeFile(new URL('../dist/index.html', import.meta.url), createRouteEntrypoint('market', sourceHtml));

for (const route of routeEntrypoints) {
  await writeRouteEntrypoint(route);
}

await compactJsonDirectory(new URL('../dist/data/', import.meta.url));

console.log(`Built GitHub Pages artifact at ${dist} from ${root}`);

function createRouteEntrypoint(route, html) {
  const definition = getRouteDefinition(route, 'ja');
  const { absoluteUrl, meta, section } = definition;

  if (route !== 'market') {
    html = addRouteBase(html);
  }

  html = setDocumentTitle(html, meta.title);
  html = setMetaContent(html, 'name', 'description', meta.description);
  html = setMetaContent(html, 'property', 'og:locale', meta.locale);
  html = setMetaContent(html, 'property', 'og:title', meta.title);
  html = setMetaContent(html, 'property', 'og:description', meta.ogDescription);
  html = setMetaContent(html, 'property', 'og:url', absoluteUrl);
  html = setMetaContent(html, 'name', 'twitter:title', meta.title);
  html = setMetaContent(html, 'name', 'twitter:description', meta.ogDescription);
  html = setLinkHref(html, 'canonical', absoluteUrl);
  html = setStructuredData(html, definition);
  html = setRouteHero(html, meta);
  html = setInitialSection(html, section);

  return normalizeNavigationHrefs(html);
}

async function writeRouteEntrypoint(route) {
  const routeDir = new URL(`../dist/${route}/`, import.meta.url);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL('index.html', routeDir), createRouteEntrypoint(route, html));
}

function addRouteBase(html) {
  if (/<base\s+href="\.\.\/"\s*\/>/.test(html)) {
    return html;
  }

  return html.replace(
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <base href="../" />',
  );
}

function setDocumentTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

function setMetaContent(html, attribute, value, content) {
  const pattern = new RegExp(
    `<meta ${attribute}="${escapeRegExp(value)}" content="[^"]*" \\/>`,
  );

  return html.replace(
    pattern,
    `<meta ${attribute}="${value}" content="${escapeHtmlAttribute(content)}" />`,
  );
}

function setLinkHref(html, rel, href) {
  const pattern = new RegExp(`<link rel="${escapeRegExp(rel)}" href="[^"]*" \\/>`);
  return html.replace(pattern, `<link rel="${rel}" href="${escapeHtmlAttribute(href)}" />`);
}

function setStructuredData(html, definition) {
  const { absoluteUrl, meta } = definition;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': meta.schemaType,
    name: meta.schemaName,
    url: absoluteUrl,
    description: meta.description,
    inLanguage: meta.inLanguage,
    image: 'https://jinwktk.github.io/FF14Gils/assets/og-image.png',
    sameAs: ['https://ko-fi.com/jinnymeia'],
  };

  if (meta.schemaType === 'WebApplication') {
    structuredData.applicationCategory = 'GameApplication';
    structuredData.operatingSystem = 'Web';
  }

  const serialized = JSON.stringify(structuredData, null, 2)
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');

  return html.replace(
    /    <script type="application\/ld\+json">[\s\S]*?    <\/script>/,
    `    <script type="application/ld+json">\n${serialized}\n    </script>`,
  );
}

function setRouteHero(html, meta) {
  html = setElementText(html, 'p', 'data-route-hero-eyebrow', meta.heroEyebrow);
  html = setElementText(html, 'h1', 'data-route-hero-title', meta.heroTitle);
  return setElementText(html, 'p', 'data-route-hero-lead', meta.heroLead);
}

function setElementText(html, tagName, marker, text) {
  const pattern = new RegExp(
    `<${tagName}([^>]*\\b${escapeRegExp(marker)}\\b[^>]*)>[\\s\\S]*?<\\/${tagName}>`,
  );

  return html.replace(pattern, `<${tagName}$1>${escapeHtml(text)}</${tagName}>`);
}

function setInitialSection(html, activeSection) {
  for (const section of ROUTE_NAMES) {
    const pattern = new RegExp(`<section\\b[^>]*\\bdata-page="${escapeRegExp(section)}"[^>]*>`, 's');
    html = html.replace(pattern, (openingTag) => setHiddenState(openingTag, section !== activeSection));
  }

  return html;
}

function setHiddenState(openingTag, hidden) {
  const withoutHidden = openingTag.replace(/\s+hidden(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/g, '');

  if (!hidden) {
    return withoutHidden;
  }

  return withoutHidden.replace(/>$/, ' hidden>');
}

function normalizeNavigationHrefs(html) {
  return html
    .replaceAll('href="./ranking"', 'href="./ranking/"')
    .replaceAll('href="./legal"', 'href="./legal/"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

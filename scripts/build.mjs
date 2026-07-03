import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const siteUrl = 'https://jinwktk.github.io/FF14Gils/';
const routeEntrypoints = ['ranking', 'legal'];
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

for (const route of routeEntrypoints) {
  await writeRouteEntrypoint(route);
}

console.log(`Built GitHub Pages artifact at ${dist} from ${root}`);

async function writeRouteEntrypoint(route) {
  const routeDir = new URL(`../dist/${route}/`, import.meta.url);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL('index.html', routeDir), createRouteEntrypoint(route, html));
}

function createRouteEntrypoint(route, html) {
  const routeUrl = routeUrlFor(route);
  html = addRouteBase(html);
  html = setRouteCanonical(html, routeUrl);
  html = setRouteOpenGraphUrl(html, routeUrl);

  return addRouteBootstrap(html, route);
}

function routeUrlFor(route) {
  return `${siteUrl}${route}/`;
}

function addRouteBase(html) {
  return html.replace(
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <base href="../" />',
  );
}

function setRouteCanonical(html, routeUrl) {
  return html.replace(
    /<link rel="canonical" href="[^"]+" \/>/,
    `<link rel="canonical" href="${routeUrl}" />`,
  );
}

function setRouteOpenGraphUrl(html, routeUrl) {
  return html.replace(
    /<meta property="og:url" content="[^"]+" \/>/,
    `<meta property="og:url" content="${routeUrl}" />`,
  );
}

function addRouteBootstrap(html, route) {
  return html.replace(
    '    <script type="module" src="src/app.js"></script>',
    `    <script>
      window.sessionStorage.setItem('ff14gils_route', '${route}');
    </script>
    <script type="module" src="src/app.js"></script>`,
  );
}

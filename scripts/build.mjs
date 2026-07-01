import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
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
  await mkdir(routeDir, { recursive: true });
  await writeFile(new URL('index.html', routeDir), createRouteEntrypoint(route));
}

function createRouteEntrypoint(route) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FF14Gils</title>
    <script>
      (() => {
        const projectBasePath = '/FF14Gils/';
        const basePath = window.location.pathname.includes(projectBasePath)
          ? projectBasePath
          : '/';

        window.sessionStorage.setItem('ff14gils_route', '${route}');
        window.location.replace(basePath);
      })();
    </script>
  </head>
  <body></body>
</html>
`;
}

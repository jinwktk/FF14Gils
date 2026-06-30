import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const entries = [
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

console.log(`Built GitHub Pages artifact at ${dist} from ${root}`);

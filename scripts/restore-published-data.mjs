import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_PUBLISHED_BASE_URL = 'https://jinwktk.github.io/FF14Gils/';

const defaultDistDir = fileURLToPath(new URL('../dist/', import.meta.url));

export function normalizePublishedBaseUrl(baseUrl = DEFAULT_PUBLISHED_BASE_URL) {
  const normalized = new URL(baseUrl);

  if (!normalized.pathname.endsWith('/')) {
    normalized.pathname += '/';
  }

  return normalized.href;
}

export function collectPublishedDataPaths(worldIndex) {
  const paths = new Set(['data/worlds.json', 'data/marketshare.json']);

  for (const world of worldIndex?.worlds ?? []) {
    addDataPath(paths, world.path);

    for (const periodPath of Object.values(world.periods ?? {})) {
      addDataPath(paths, periodPath);
    }
  }

  return [...paths];
}

export async function restorePublishedData({
  baseUrl = process.env.FF14GILS_PUBLISHED_BASE_URL ?? DEFAULT_PUBLISHED_BASE_URL,
  distDir = process.env.FF14GILS_DIST_DIR ?? defaultDistDir,
  fetchImpl = globalThis.fetch,
  concurrency = Number.parseInt(process.env.FF14GILS_RESTORE_CONCURRENCY ?? '8', 10),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available');
  }

  const normalizedBaseUrl = normalizePublishedBaseUrl(baseUrl);
  const worldsJsonPath = 'data/worlds.json';
  const worldsJson = await fetchPublishedText(fetchImpl, normalizedBaseUrl, worldsJsonPath);
  const worldIndex = JSON.parse(worldsJson);
  const paths = collectPublishedDataPaths(worldIndex);
  const textByPath = new Map([[worldsJsonPath, worldsJson]]);

  await mapWithConcurrency(paths, concurrency, async (path) => {
    const content = textByPath.get(path) ?? (await fetchPublishedText(fetchImpl, normalizedBaseUrl, path));
    await writeDistFile(distDir, path, content);
  });

  return { count: paths.length, paths };
}

function addDataPath(paths, path) {
  if (typeof path !== 'string') {
    return;
  }

  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');

  if (
    !normalized.startsWith('data/') ||
    normalized.includes('..') ||
    normalized.includes('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    throw new Error(`Unsafe published data path: ${path}`);
  }

  paths.add(normalized);
}

async function fetchPublishedText(fetchImpl, baseUrl, path) {
  const url = new URL(path, baseUrl).href;
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

async function writeDistFile(distDir, relativePath, content) {
  const distRoot = resolve(distDir);
  const target = resolve(distRoot, relativePath);

  if (target !== distRoot && !target.startsWith(`${distRoot}${sep}`)) {
    throw new Error(`Refusing to write outside dist: ${relativePath}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const workerCount = Math.max(1, Math.min(items.length, concurrency || 1));
  let index = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        await mapper(item);
      }
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await restorePublishedData();
  console.log(`Restored ${result.count} published data files into ${defaultDistDir}`);
}

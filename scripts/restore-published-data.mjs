import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fetchWithRetry } from './retry-fetch.mjs';
import { DEFAULT_SALES_PERIOD, DEFAULT_WORLD } from '../src/worlds.js';

export const DEFAULT_PUBLISHED_BASE_URL = 'https://jinwktk.github.io/FF14Gils/';

const defaultDistDir = fileURLToPath(new URL('../dist/', import.meta.url));
const defaultBundledLodestonePath = fileURLToPath(
  new URL('../assets/lodestone-items.json', import.meta.url),
);
const lodestoneAssetPath = 'assets/lodestone-items.json';
const lodestoneHashPattern = /^[0-9a-f]{11}$/i;

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
  defaultWorld = process.env.FF14GILS_DEFAULT_WORLD ?? DEFAULT_WORLD,
  distDir = process.env.FF14GILS_DIST_DIR ?? defaultDistDir,
  fetchImpl = globalThis.fetch,
  concurrency = Number.parseInt(process.env.FF14GILS_RESTORE_CONCURRENCY ?? '8', 10),
  retries = Number.parseInt(process.env.FF14GILS_RESTORE_RETRIES ?? '3', 10),
  retryDelayMs = Number.parseInt(process.env.FF14GILS_RESTORE_RETRY_DELAY_MS ?? '750', 10),
  lodestoneTimeoutMs = Number.parseInt(
    process.env.FF14GILS_LODESTONE_RESTORE_TIMEOUT_MS ?? '15000',
    10,
  ),
  bundledLodestonePath = defaultBundledLodestonePath,
  log = (message) => console.warn(message),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available');
  }

  const normalizedBaseUrl = normalizePublishedBaseUrl(baseUrl);
  const worldsJsonPath = 'data/worlds.json';
  const fetchOptions = { retries, retryDelayMs };
  const worldsJson = await fetchPublishedText(fetchImpl, normalizedBaseUrl, worldsJsonPath, fetchOptions);
  const worldIndex = JSON.parse(worldsJson);
  const normalizedWorldIndex = applyDefaultWorld(worldIndex, defaultWorld);
  const defaultSnapshotPath = resolveDefaultSnapshotPath(normalizedWorldIndex);
  const paths = collectPublishedDataPaths(worldIndex);
  const textByPath = new Map([
    [worldsJsonPath, `${JSON.stringify(normalizedWorldIndex, null, 2)}\n`],
  ]);
  const publishedItemIds = new Set();

  if (defaultSnapshotPath) {
    const defaultSnapshotText = await fetchPublishedText(
      fetchImpl,
      normalizedBaseUrl,
      defaultSnapshotPath,
      fetchOptions,
    );
    textByPath.set(defaultSnapshotPath, defaultSnapshotText);
    textByPath.set('data/marketshare.json', defaultSnapshotText);
  }

  await mapWithConcurrency(paths, concurrency, async (path) => {
    const content =
      textByPath.get(path) ??
      (await fetchPublishedText(fetchImpl, normalizedBaseUrl, path, fetchOptions));
    collectSnapshotItemIds(content, publishedItemIds);
    await writeDistFile(distDir, path, content);
  });

  const normalizedLodestoneTimeoutMs =
    Number.isFinite(lodestoneTimeoutMs) && lodestoneTimeoutMs >= 0
      ? lodestoneTimeoutMs
      : 15_000;
  const lodestoneItemCount = await restorePublishedLodestoneItems({
    baseUrl: normalizedBaseUrl,
    distDir,
    bundledLodestonePath,
    itemIds: publishedItemIds,
    fetchImpl,
    fetchOptions: {
      ...fetchOptions,
      signal: AbortSignal.timeout(normalizedLodestoneTimeoutMs),
    },
    log,
  });

  return { count: paths.length, paths, lodestoneItemCount };
}

export async function restorePublishedLodestoneItems({
  baseUrl,
  distDir,
  outputRelativePath = lodestoneAssetPath,
  bundledLodestonePath = defaultBundledLodestonePath,
  itemIds = new Set(),
  fetchImpl = globalThis.fetch,
  fetchOptions = {},
  log = (message) => console.warn(message),
}) {
  const bundledMapping = await readBundledLodestoneMapping(bundledLodestonePath, log);
  let publishedMapping = {};

  try {
    const publishedText = await fetchPublishedText(
      fetchImpl,
      baseUrl,
      lodestoneAssetPath,
      fetchOptions,
    );
    publishedMapping = parseLodestoneMapping(publishedText, { strict: true });
  } catch (error) {
    log(`Published Lodestone item mapping restore skipped: ${safeErrorMessage(error)}`);
  }

  const mergedMapping = Object.fromEntries(
    Object.entries({ ...bundledMapping, ...publishedMapping })
      .filter(([itemId]) => itemIds.size === 0 || itemIds.has(itemId))
      .sort(([left], [right]) => Number(left) - Number(right)),
  );

  await writeDistFile(
    distDir,
    outputRelativePath,
    `${JSON.stringify(mergedMapping, null, 2)}\n`,
  );

  return Object.keys(mergedMapping).length;
}

export function applyDefaultWorld(worldIndex, defaultWorld = DEFAULT_WORLD) {
  const worlds = Array.isArray(worldIndex?.worlds) ? worldIndex.worlds : [];
  const resolvedDefaultWorld = worlds.some((world) => world?.name === defaultWorld)
    ? defaultWorld
    : worldIndex?.defaultWorld;

  return {
    ...worldIndex,
    defaultWorld: resolvedDefaultWorld,
  };
}

export function resolveDefaultSnapshotPath(worldIndex) {
  const defaultWorld = worldIndex?.defaultWorld;
  const defaultPeriod = worldIndex?.defaultPeriod ?? DEFAULT_SALES_PERIOD;
  const world = Array.isArray(worldIndex?.worlds)
    ? worldIndex.worlds.find((entry) => entry?.name === defaultWorld)
    : null;

  return world?.periods?.[defaultPeriod] ?? world?.path ?? '';
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

async function fetchPublishedText(
  fetchImpl,
  baseUrl,
  path,
  { retries, retryDelayMs, signal } = {},
) {
  const url = new URL(path, baseUrl).href;
  const response = await fetchWithRetry(url, { signal }, {
    fetchImpl,
    retries,
    baseDelayMs: retryDelayMs,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

function collectSnapshotItemIds(content, itemIds) {
  try {
    const snapshot = JSON.parse(content);

    for (const item of Array.isArray(snapshot?.items) ? snapshot.items : []) {
      const itemId = normalizeItemId(item?.itemId ?? item?.itemID);
      if (itemId) itemIds.add(itemId);
    }
  } catch {
    // The restore contract remains byte-for-byte for published data files.
  }
}

async function readBundledLodestoneMapping(path, log) {
  try {
    return parseLodestoneMapping(await readFile(path, 'utf8'), { strict: false });
  } catch (error) {
    log(`Bundled Lodestone item mapping unavailable: ${safeErrorMessage(error)}`);
    return {};
  }
}

function parseLodestoneMapping(text, { strict }) {
  const mapping = JSON.parse(text);

  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error('Lodestone item mapping must be an object');
  }

  const normalized = {};

  for (const [rawItemId, rawHash] of Object.entries(mapping)) {
    const itemId = normalizeItemId(rawItemId);
    const hash = String(rawHash ?? '');

    if (!itemId || !lodestoneHashPattern.test(hash)) {
      if (strict) {
        throw new Error(`Lodestone item mapping contains an invalid entry for ${rawItemId}`);
      }
      continue;
    }

    normalized[itemId] = hash.toLowerCase();
  }

  return normalized;
}

function normalizeItemId(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return '';

  const itemId = Number(text);
  return Number.isSafeInteger(itemId) && itemId > 0 ? String(itemId) : '';
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
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

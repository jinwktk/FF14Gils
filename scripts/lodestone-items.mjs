import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DEFAULT_PUBLISHED_BASE_URL,
  normalizePublishedBaseUrl,
  restorePublishedLodestoneItems,
} from './restore-published-data.mjs';

export const LODESTONE_ITEM_ID_SOURCE =
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt';

const defaultWorldsDir = fileURLToPath(new URL('../data/worlds/', import.meta.url));
const defaultOutputPath = fileURLToPath(
  new URL('../assets/lodestone-items.json', import.meta.url),
);
const LODESTONE_HASH_PATTERN = /^[0-9a-f]{11}$/i;

export function collectSnapshotItemIds(snapshots) {
  return [...new Set(
    snapshots
      .flatMap((snapshot) => (Array.isArray(snapshot?.items) ? snapshot.items : []))
      .map((item) => normalizeItemId(item?.itemId ?? item?.itemID))
      .filter(Boolean),
  )].sort((left, right) => Number(left) - Number(right));
}

export function parseLodestoneItemIdMapping(text, itemIds) {
  if (typeof text !== 'string') {
    throw new TypeError('Lodestone item mapping must be text');
  }

  const normalizedIds = normalizeItemIds(itemIds);
  const lines = text.split(/\r?\n/);
  const maxItemId = Math.max(0, ...normalizedIds.map(Number));

  if (maxItemId > lines.length) {
    throw new Error(`Lodestone item mapping does not cover item ID ${maxItemId}`);
  }

  return Object.fromEntries(
    normalizedIds.flatMap((itemId) => {
      const hash = lines[Number(itemId) - 1]?.trim() ?? '';
      return LODESTONE_HASH_PATTERN.test(hash) ? [[itemId, hash.toLowerCase()]] : [];
    }),
  );
}

export async function updateLodestoneItemLinks({
  snapshots,
  worldsDir = defaultWorldsDir,
  outputPath = defaultOutputPath,
  sourceUrl = LODESTONE_ITEM_ID_SOURCE,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
  publishedFallbackBaseUrl = DEFAULT_PUBLISHED_BASE_URL,
  log = (message) => console.warn(message),
} = {}) {
  let itemIds = [];

  try {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch is not available');
    }

    const resolvedSnapshots = snapshots ?? (await readWorldSnapshots(worldsDir));
    itemIds = collectSnapshotItemIds(resolvedSnapshots);

    if (itemIds.length === 0) {
      throw new Error('no valid item IDs were found in world snapshots');
    }

    const response = await fetchImpl(sourceUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`source returned HTTP ${response.status} ${response.statusText ?? ''}`.trim());
    }

    const fetchedMapping = parseLodestoneItemIdMapping(await response.text(), itemIds);
    const fetchedCount = Object.keys(fetchedMapping).length;

    if (fetchedCount === 0) {
      throw new Error('source did not contain any valid hashes for current item IDs');
    }

    const existingMapping = await readValidMappingIfExists(outputPath);
    const mergedMapping = Object.fromEntries(
      itemIds.flatMap((itemId) => {
        const hash = fetchedMapping[itemId] ?? existingMapping[itemId];
        return LODESTONE_HASH_PATTERN.test(hash ?? '') ? [[itemId, hash.toLowerCase()]] : [];
      }),
    );
    const missingCount = itemIds.length - fetchedCount;

    if (missingCount > 0) {
      log(
        `Lodestone item mapping omitted ${missingCount} current item IDs; retained valid cached hashes when available`,
      );
    }

    await writeJsonAtomically(outputPath, mergedMapping);
    return { updated: true, itemCount: Object.keys(mergedMapping).length };
  } catch (error) {
    log(`Lodestone item mapping update skipped: ${toSafeErrorMessage(error)}`);

    if (publishedFallbackBaseUrl && itemIds.length > 0) {
      try {
        const itemCount = await restorePublishedLodestoneItems({
          baseUrl: normalizePublishedBaseUrl(publishedFallbackBaseUrl),
          distDir: dirname(outputPath),
          outputRelativePath: basename(outputPath),
          bundledLodestonePath: outputPath,
          itemIds: new Set(itemIds),
          fetchImpl: (url, init = {}) =>
            fetchImpl(url, {
              ...init,
              signal: AbortSignal.timeout(timeoutMs),
            }),
          fetchOptions: { retries: 0, retryDelayMs: 0 },
          log,
        });

        return { updated: false, itemCount };
      } catch (fallbackError) {
        log(`Published Lodestone item mapping fallback failed: ${toSafeErrorMessage(fallbackError)}`);
      }
    }

    return { updated: false, itemCount: 0 };
  }
}

async function readWorldSnapshots(worldsDir) {
  const entries = await readdir(worldsDir, { withFileTypes: true });
  const snapshotNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    snapshotNames.map(async (name) =>
      JSON.parse(await readFile(new URL(name, pathToFileURL(`${worldsDir}/`)), 'utf8')),
    ),
  );
}

async function readValidMappingIfExists(path) {
  try {
    const mapping = JSON.parse(await readFile(path, 'utf8'));

    return Object.fromEntries(
      Object.entries(mapping ?? {}).flatMap(([itemId, hash]) => {
        const normalizedItemId = normalizeItemId(itemId);
        return normalizedItemId && LODESTONE_HASH_PATTERN.test(hash ?? '')
          ? [[normalizedItemId, String(hash).toLowerCase()]]
          : [];
      }),
    );
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

function normalizeItemIds(itemIds) {
  return [...new Set([...itemIds].map(normalizeItemId).filter(Boolean))].sort(
    (left, right) => Number(left) - Number(right),
  );
}

function normalizeItemId(itemId) {
  const value = String(itemId ?? '').trim();

  if (!/^\d+$/.test(value)) return '';

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? String(number) : '';
}

function toSafeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function writeJsonAtomically(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(`${path}.tmp`, path);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await updateLodestoneItemLinks();
  process.exitCode = result.updated ? 0 : 1;

  if (result.updated) {
    console.log(`Wrote ${result.itemCount} Lodestone item links to ${defaultOutputPath}`);
  }
}

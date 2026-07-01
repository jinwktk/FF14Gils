import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertMarketshareResponse,
  createSnapshot,
} from '../src/marketshare.js';
import {
  DEFAULT_SALES_PERIOD,
  buildWorldPeriodSnapshotPath,
  createWorldIndex,
  createWorldRankings,
  parseWorldList,
  parseSalesPeriodList,
  resolveDefaultWorld,
} from '../src/worlds.js';
import {
  buildMarketsharePayload,
  SADDLEBAG_MARKETSHARE_ENDPOINT,
} from './marketshare-api.mjs';
import {
  fetchItemNames,
  normalizeItemIds,
  normalizeXivapiLanguage,
} from './item-name-api.mjs';
import { fetchWithRetry } from './retry-fetch.mjs';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const outputPath = fileURLToPath(new URL('../data/marketshare.json', import.meta.url));
const itemNameLanguage = normalizeXivapiLanguage(
  process.env.FF14GILS_ITEM_NAME_LANGUAGE ?? 'ja',
);
const itemNameCachePath = fileURLToPath(
  new URL(`../data/item-names-${itemNameLanguage}.json`, import.meta.url),
);
const worldsDir = fileURLToPath(new URL('../data/worlds/', import.meta.url));
const worldIndexPath = fileURLToPath(new URL('../data/worlds.json', import.meta.url));
const retryOptions = {
  retries: Number(process.env.FF14GILS_FETCH_RETRIES ?? 3),
  baseDelayMs: Number(process.env.FF14GILS_FETCH_RETRY_DELAY_MS ?? 1000),
};
const worlds = parseWorldList(process.env.FF14GILS_WORLDS);
const periods = parseSalesPeriodList(process.env.FF14GILS_PERIODS);
const query = {
  salesAmount: process.env.FF14GILS_SALES_AMOUNT ?? 3,
  averagePrice: process.env.FF14GILS_AVERAGE_PRICE ?? 10000,
  preset: process.env.FF14GILS_PRESET ?? 'all',
  sortBy: process.env.FF14GILS_SORT_BY ?? 'marketValue',
  customFilters: process.env.FF14GILS_CUSTOM_FILTERS ?? '',
};
const defaultWorld = resolveDefaultWorld(worlds, process.env.FF14GILS_SERVER);

const marketshareResults = [];

for (const world of worlds) {
  for (const period of periods) {
    const result = await fetchWorldMarketshare(world, period);
    marketshareResults.push(result);
    console.log(
      `Fetched ${result.apiResponse.data.length} marketshare items for ${world} (${period.label})`,
    );
  }
}

const itemNames = await resolveItemNames(marketshareResults);
const snapshots = marketshareResults.map(({ apiResponse, query: snapshotQuery }) =>
  createSnapshot({
    query: snapshotQuery,
    response: apiResponse,
    source: SADDLEBAG_MARKETSHARE_ENDPOINT,
    itemNames,
    itemNameLanguage,
  }),
);

await mkdir(dataDir, { recursive: true });
await mkdir(worldsDir, { recursive: true });
await writeJsonAtomically(itemNameCachePath, itemNames);

for (const snapshot of snapshots) {
  await writeJsonAtomically(
    fileURLToPath(
      new URL(
        `../${buildWorldPeriodSnapshotPath(snapshot.query.server, snapshot.query.periodKey)}`,
        import.meta.url,
      ),
    ),
    snapshot,
  );
}

const defaultSnapshot =
  snapshots.find(
    (snapshot) =>
      snapshot.query.server === defaultWorld &&
      snapshot.query.periodKey === DEFAULT_SALES_PERIOD,
  ) ?? snapshots.find((snapshot) => snapshot.query.server === defaultWorld) ?? snapshots[0];
await writeJsonAtomically(outputPath, defaultSnapshot);
await writeJsonAtomically(
  worldIndexPath,
  createWorldIndex({
    worlds,
    defaultWorld: defaultSnapshot.query.server,
    periods,
    defaultPeriod: DEFAULT_SALES_PERIOD,
    rankings: createWorldRankings(snapshots),
    generatedAt: new Date(),
  }),
);

console.log(
  `Wrote ${snapshots.length} period snapshots. Default: ${defaultSnapshot.query.server} (${defaultSnapshot.query.periodKey})`,
);

async function fetchWorldMarketshare(world, period) {
  const payload = buildMarketsharePayload({
    ...query,
    server: world,
    timePeriod: period.hours,
  });
  const response = await fetchWithRetry(
    SADDLEBAG_MARKETSHARE_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'FF14Gils GitHub Pages data fetcher',
      },
      body: JSON.stringify(payload),
    },
    retryOptions,
  );

  if (!response.ok) {
    throw new Error(
      `Saddlebag Exchange API failed for ${world}: ${response.status} ${response.statusText}`,
    );
  }

  const apiResponse = await response.json();
  assertMarketshareResponse(apiResponse);

  return {
    query: {
      ...query,
      server: world,
      periodKey: period.key,
      periodLabel: period.label,
      timePeriod: payload.time_period,
      salesAmount: payload.sales_amount,
      averagePrice: payload.average_price,
      filters: payload.filters,
      sortBy: payload.sort_by,
    },
    apiResponse,
  };
}

async function resolveItemNames(results) {
  const itemIds = normalizeItemIds(
    results.flatMap(({ apiResponse }) =>
      apiResponse.data.map((item) => item.itemID ?? item.itemId),
    ),
  );
  const cachedNames = await readJsonIfExists(itemNameCachePath);
  const missingIds = itemIds.filter((itemId) => !cachedNames[itemId]);

  if (missingIds.length > 0) {
    console.log(
      `Fetching ${missingIds.length} ${itemNameLanguage} item names from XIVAPI`,
    );
  }

  const fetchedNames = await fetchItemNames(missingIds, {
    language: itemNameLanguage,
    log: (message) => console.warn(message),
  });
  const itemNames = Object.fromEntries(
    Object.entries({ ...cachedNames, ...fetchedNames })
      .filter(([itemId]) => itemIds.includes(itemId))
      .sort(([left], [right]) => Number(left) - Number(right)),
  );

  console.log(`Resolved ${Object.keys(itemNames).length} ${itemNameLanguage} item names`);

  return itemNames;
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeJsonAtomically(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(`${path}.tmp`, path);
}

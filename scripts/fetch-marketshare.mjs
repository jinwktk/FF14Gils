import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
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
  SADDLEBAG_MARKETSHARE_ENDPOINT,
} from './marketshare-api.mjs';
import {
  fetchItemNames,
  normalizeItemIds,
  normalizeXivapiLanguage,
} from './item-name-api.mjs';
import { updateLodestoneItemLinks } from './lodestone-items.mjs';
import { collectMarketshareResults } from './marketshare-refresh.mjs';

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

const marketshareResults = await collectMarketshareResults({
  worlds, periods, query, retryOptions,
});
const itemNames = await resolveItemNames(marketshareResults);
const snapshots = marketshareResults.map(({ snapshot, apiResponse, query: snapshotQuery }) =>
  snapshot ?? createSnapshot({
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

const lodestoneLinks = await updateLodestoneItemLinks({ snapshots });

console.log(
  `Wrote ${snapshots.length} period snapshots. Default: ${defaultSnapshot.query.server} (${defaultSnapshot.query.periodKey})`,
);
if (lodestoneLinks.updated) {
  console.log(`Wrote ${lodestoneLinks.itemCount} Lodestone item links`);
}

async function resolveItemNames(results) {
  const itemIds = normalizeItemIds(
    results.flatMap(({ apiResponse, snapshot }) =>
      (snapshot?.items ?? apiResponse.data).map((item) => item.itemID ?? item.itemId),
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

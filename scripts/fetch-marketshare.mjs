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
  parseWorldList,
  parseSalesPeriodList,
  resolveDefaultWorld,
  resolveSalesPeriod,
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
const UNIVERSALIS_HISTORY_ENDPOINT = 'https://universalis.app/api/v2/history';
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
  const worldResults = new Map();
  const saddlebagPeriods = periods.filter((period) => period.key !== '30d');
  const needsMonthlySeed =
    periods.some((period) => period.key === '30d') && !saddlebagPeriods.some((period) => period.key === DEFAULT_SALES_PERIOD);

  if (needsMonthlySeed) {
    saddlebagPeriods.push(resolveSalesPeriod(DEFAULT_SALES_PERIOD));
  }

  for (const period of saddlebagPeriods) {
    const result = await fetchWorldMarketshare(world, period);
    worldResults.set(period.key, result);
    if (periods.some((requestedPeriod) => requestedPeriod.key === period.key)) {
      marketshareResults.push(result);
    }
    console.log(
      `Fetched ${result.apiResponse.data.length} marketshare items for ${world} (${period.label})`,
    );
  }

  const monthlyPeriod = periods.find((period) => period.key === '30d');
  if (monthlyPeriod) {
    const monthlyResult = await fetchMonthlyHistoryMarketshare(
      world,
      monthlyPeriod,
      worldResults.get(DEFAULT_SALES_PERIOD),
    );
    marketshareResults.push(monthlyResult);
    console.log(
      `Aggregated ${monthlyResult.apiResponse.data.length} monthly history items for ${world}`,
    );
  }
}

const itemNames = await resolveItemNames(marketshareResults);
const snapshots = marketshareResults.map(({ apiResponse, query: snapshotQuery }) =>
  createSnapshot({
    query: snapshotQuery,
    response: apiResponse,
    source:
      snapshotQuery.periodKey === '30d'
        ? `${SADDLEBAG_MARKETSHARE_ENDPOINT} + ${UNIVERSALIS_HISTORY_ENDPOINT}`
        : SADDLEBAG_MARKETSHARE_ENDPOINT,
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

async function fetchMonthlyHistoryMarketshare(world, period, seedResult) {
  if (!seedResult) {
    throw new Error(`Monthly history seed is missing for ${world}`);
  }

  const itemIds = normalizeItemIds(
    seedResult.apiResponse.data.map((item) => item.itemID ?? item.itemId),
  );
  if (itemIds.length === 0) {
    return {
      query: {
        ...seedResult.query,
        periodKey: period.key,
        periodLabel: period.label,
        timePeriod: period.hours,
      },
      apiResponse: { data: [] },
    };
  }

  const historyUrl = new URL(
    `${UNIVERSALIS_HISTORY_ENDPOINT}/${encodeURIComponent(world)}/${itemIds.join(',')}`,
  );
  historyUrl.searchParams.set('entriesWithin', String(period.hours * 60 * 60));

  const response = await fetchWithRetry(
    historyUrl,
    {
      headers: {
        'user-agent': 'FF14Gils GitHub Pages data fetcher',
      },
    },
    retryOptions,
  );

  if (!response.ok) {
    throw new Error(
      `Universalis history API failed for ${world}: ${response.status} ${response.statusText}`,
    );
  }

  const history = await response.json();
  const historyItems = history.items ?? { [history.itemID]: history };
  const seedItems = new Map(
    seedResult.apiResponse.data.map((item) => [String(item.itemID ?? item.itemId), item]),
  );
  const minimumSales = Number(seedResult.query.salesAmount) || 0;
  const minimumAveragePrice = Number(seedResult.query.averagePrice) || 0;
  const data = itemIds
    .map((itemId) => createMonthlyMarketshareItem(seedItems.get(itemId), historyItems[itemId]))
    .filter(
      (item) =>
        item &&
        Number(item.quantitySold) >= minimumSales &&
        Number(item.avg) >= minimumAveragePrice,
    )
    .sort((left, right) => Number(right.marketValue) - Number(left.marketValue));

  return {
    query: {
      ...seedResult.query,
      periodKey: period.key,
      periodLabel: period.label,
      timePeriod: period.hours,
    },
    apiResponse: { data },
  };
}

function createMonthlyMarketshareItem(seedItem, historyItem) {
  if (!seedItem) return null;

  const entries = Array.isArray(historyItem?.entries) ? historyItem.entries : [];
  const sortedEntries = [...entries].sort(
    (left, right) => toFiniteNumber(left.timestamp) - toFiniteNumber(right.timestamp),
  );
  const quantitySold = entries.reduce((total, entry) => total + toFiniteNumber(entry.quantity), 0);
  const marketValue = entries.reduce(
    (total, entry) =>
      total + toFiniteNumber(entry.pricePerUnit) * toFiniteNumber(entry.quantity),
    0,
  );
  const prices = entries
    .map((entry) => toFiniteNumber(entry.pricePerUnit))
    .filter((price) => price > 0)
    .sort((left, right) => left - right);
  const avg = quantitySold > 0 ? marketValue / quantitySold : 0;
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const oldestPrice = toFiniteNumber(sortedEntries[0]?.pricePerUnit);
  const newestPrice = toFiniteNumber(sortedEntries.at(-1)?.pricePerUnit);
  const percentChange =
    oldestPrice > 0 ? ((newestPrice - oldestPrice) / oldestPrice) * 100 : 0;

  return {
    ...seedItem,
    avg,
    marketValue,
    median,
    percentChange,
    purchaseAmount: entries.length,
    quantitySold,
    state: resolveMonthlyState(percentChange, quantitySold),
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

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function resolveMonthlyState(percentChange, quantitySold) {
  if (quantitySold <= 0) return 'out of stock';
  if (percentChange >= 80) return 'spiking';
  if (percentChange >= 15) return 'increasing';
  if (percentChange <= -10) return 'decreasing';

  return 'stable';
}

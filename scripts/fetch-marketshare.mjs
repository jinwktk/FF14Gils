import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertMarketshareResponse,
  createSnapshot,
} from '../src/marketshare.js';
import {
  createWorldIndex,
  parseWorldList,
  resolveDefaultWorld,
  worldSlug,
} from '../src/worlds.js';
import {
  buildMarketsharePayload,
  SADDLEBAG_MARKETSHARE_ENDPOINT,
} from './marketshare-api.mjs';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const outputPath = fileURLToPath(new URL('../data/marketshare.json', import.meta.url));
const worldsDir = fileURLToPath(new URL('../data/worlds/', import.meta.url));
const worldIndexPath = fileURLToPath(new URL('../data/worlds.json', import.meta.url));
const worlds = parseWorldList(process.env.FF14GILS_WORLDS);
const query = {
  timePeriod: process.env.FF14GILS_TIME_PERIOD ?? 168,
  salesAmount: process.env.FF14GILS_SALES_AMOUNT ?? 3,
  averagePrice: process.env.FF14GILS_AVERAGE_PRICE ?? 10000,
  preset: process.env.FF14GILS_PRESET ?? 'housing',
  sortBy: process.env.FF14GILS_SORT_BY ?? 'marketValue',
  customFilters: process.env.FF14GILS_CUSTOM_FILTERS ?? '',
};
const defaultWorld = resolveDefaultWorld(worlds, process.env.FF14GILS_SERVER);

const snapshots = [];

for (const world of worlds) {
  const snapshot = await fetchWorldSnapshot(world);
  snapshots.push(snapshot);
  console.log(`Fetched ${snapshot.items.length} marketshare items for ${world}`);
}

await mkdir(dataDir, { recursive: true });
await mkdir(worldsDir, { recursive: true });

for (const snapshot of snapshots) {
  await writeJsonAtomically(
    fileURLToPath(new URL(`../data/worlds/${worldSlug(snapshot.query.server)}.json`, import.meta.url)),
    snapshot,
  );
}

const defaultSnapshot =
  snapshots.find((snapshot) => snapshot.query.server === defaultWorld) ?? snapshots[0];
await writeJsonAtomically(outputPath, defaultSnapshot);
await writeJsonAtomically(
  worldIndexPath,
  createWorldIndex({
    worlds,
    defaultWorld: defaultSnapshot.query.server,
    generatedAt: new Date(),
  }),
);

console.log(
  `Wrote ${snapshots.length} world snapshots. Default: ${defaultSnapshot.query.server}`,
);

async function fetchWorldSnapshot(world) {
  const payload = buildMarketsharePayload({ ...query, server: world });
  const response = await fetch(SADDLEBAG_MARKETSHARE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'FF14Gils GitHub Pages data fetcher',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Saddlebag Exchange API failed for ${world}: ${response.status} ${response.statusText}`,
    );
  }

  const apiResponse = await response.json();
  assertMarketshareResponse(apiResponse);

  return createSnapshot({
    query: {
      ...query,
      server: world,
      timePeriod: payload.time_period,
      salesAmount: payload.sales_amount,
      averagePrice: payload.average_price,
      filters: payload.filters,
      sortBy: payload.sort_by,
    },
    response: apiResponse,
    source: SADDLEBAG_MARKETSHARE_ENDPOINT,
  });
}

async function writeJsonAtomically(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(`${path}.tmp`, path);
}

import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertMarketshareResponse,
  createSnapshot,
} from '../src/marketshare.js';
import {
  buildMarketsharePayload,
  SADDLEBAG_MARKETSHARE_ENDPOINT,
} from './marketshare-api.mjs';

const outputPath = fileURLToPath(new URL('../data/marketshare.json', import.meta.url));
const query = {
  server: process.env.FF14GILS_SERVER ?? 'Carbuncle',
  timePeriod: process.env.FF14GILS_TIME_PERIOD ?? 168,
  salesAmount: process.env.FF14GILS_SALES_AMOUNT ?? 3,
  averagePrice: process.env.FF14GILS_AVERAGE_PRICE ?? 10000,
  preset: process.env.FF14GILS_PRESET ?? 'housing',
  sortBy: process.env.FF14GILS_SORT_BY ?? 'marketValue',
  customFilters: process.env.FF14GILS_CUSTOM_FILTERS ?? '',
};

const payload = buildMarketsharePayload(query);
const response = await fetch(SADDLEBAG_MARKETSHARE_ENDPOINT, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'user-agent': 'FF14Gils GitHub Pages data fetcher',
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  throw new Error(`Saddlebag Exchange API failed: ${response.status} ${response.statusText}`);
}

const apiResponse = await response.json();
assertMarketshareResponse(apiResponse);
const snapshot = createSnapshot({
  query: {
    ...query,
    timePeriod: payload.time_period,
    salesAmount: payload.sales_amount,
    averagePrice: payload.average_price,
    filters: payload.filters,
    sortBy: payload.sort_by,
  },
  response: apiResponse,
  source: SADDLEBAG_MARKETSHARE_ENDPOINT,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(`${outputPath}.tmp`, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await rename(`${outputPath}.tmp`, outputPath);

console.log(
  `Wrote ${snapshot.items.length} marketshare items for ${snapshot.query.server} to ${outputPath}`,
);

import { assertMarketshareResponse, summarizeMarketshare } from '../src/marketshare.js';
import { buildWorldPeriodSnapshotPath } from '../src/worlds.js';
import {
  buildMarketsharePayload, buildMarketshareRequestHeaders,
  normalizeMarketshareApiResponse, SADDLEBAG_MARKETSHARE_ENDPOINT,
} from './marketshare-api.mjs';
import {
  DEFAULT_RETRY_STATUSES, fetchWithRetry, isTransientNetworkError,
} from './retry-fetch.mjs';
import { DEFAULT_PUBLISHED_BASE_URL } from './restore-published-data.mjs';

// Hourly updates may reuse up to six hours of data, without renewing its timestamp.
export const MAX_SNAPSHOT_AGE_MS = 6 * 60 * 60 * 1000;

export async function collectMarketshareResults({
  worlds, periods, query, retryOptions = {}, fetchImpl = globalThis.fetch,
  publishedBaseUrl = DEFAULT_PUBLISHED_BASE_URL, now = () => Date.now(),
  log = (message) => console.warn(message),
}) {
  const results = [];
  for (const world of worlds) {
    for (const period of periods) {
      const payload = buildMarketsharePayload({ ...query, server: world, timePeriod: period.hours });
      const snapshotQuery = {
        server: world, periodKey: period.key, periodLabel: period.label,
        timePeriod: payload.time_period, salesAmount: payload.sales_amount,
        averagePrice: payload.average_price, preset: query.preset,
        sortBy: payload.sort_by, filters: payload.filters,
      };
      let apiResponse;
      try {
        const { response, data } = await fetchWithRetry(SADDLEBAG_MARKETSHARE_ENDPOINT, {
          method: 'POST', headers: buildMarketshareRequestHeaders(), body: JSON.stringify(payload),
        }, {
          ...retryOptions, fetchImpl,
          readResponse: async (response) => ({
            response, data: response.ok ? await response.json() : undefined,
          }),
        });
        if (!response.ok) {
          throw Object.assign(new Error(
            `Saddlebag Exchange API failed for ${world} (${period.key}): ${response.status} ${response.statusText}`,
          ), { status: response.status });
        }
        apiResponse = normalizeMarketshareApiResponse(data);
        assertMarketshareResponse(apiResponse);
      } catch (error) {
        if (!DEFAULT_RETRY_STATUSES.has(error.status) && !isTransientNetworkError(error)) throw error;
        const path = buildWorldPeriodSnapshotPath(world, period.key);
        try {
          const snapshot = await fetchWithRetry(new URL(path, publishedBaseUrl).href, {}, {
            ...retryOptions, fetchImpl,
            readResponse: async (response) => {
              if (!response.ok) throw new Error(`Published snapshot unavailable: HTTP ${response.status}`);
              return response.json();
            },
          });
          validateReusableSnapshot(snapshot, snapshotQuery, typeof now === 'function' ? now() : now);
          results.push({ snapshot: { ...snapshot, summary: summarizeMarketshare(snapshot.items) } });
          log(`::warning::Reused ${world} (${period.key}) snapshot from ${snapshot.generatedAt}: ${error.message}`);
        } catch (fallbackError) {
          throw new Error(`Cannot safely reuse ${world} (${period.key}): ${fallbackError.message}`, { cause: error });
        }
        continue;
      }
      results.push({ query: snapshotQuery, apiResponse });
      log(`Fetched ${apiResponse.data.length} marketshare items for ${world} (${period.label})`);
    }
  }
  if (results.length && results.every((result) => result.snapshot)) {
    throw new Error('No fresh marketshare data obtained; refusing to publish an entirely reused update');
  }
  return results;
}

export function validateReusableSnapshot(snapshot, query, now) {
  const timestamp = typeof snapshot?.generatedAt === 'string' ? Date.parse(snapshot.generatedAt) : NaN;
  const age = now - timestamp;
  if (!Number.isFinite(age) || age < 0 || age > MAX_SNAPSHOT_AGE_MS) {
    throw new Error('Published snapshot is stale or has an invalid timestamp');
  }
  if (snapshot.source !== SADDLEBAG_MARKETSHARE_ENDPOINT ||
      Object.keys(query).some((key) => JSON.stringify(snapshot.query?.[key]) !== JSON.stringify(query[key]))) {
    throw new Error('Published snapshot source or query does not match');
  }
  assertMarketshareResponse({ data: snapshot.items });
}

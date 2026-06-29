import { CATEGORY_PRESETS, SORT_OPTIONS } from '../src/marketshare.js';

export const SADDLEBAG_MARKETSHARE_ENDPOINT =
  'https://api.saddlebagexchange.com/api/ffxivmarketshare';

export function buildMarketsharePayload({
  server,
  timePeriod,
  salesAmount,
  averagePrice,
  preset = 'all',
  customFilters = '',
  sortBy = 'marketValue',
}) {
  const errors = [];
  const normalizedServer = String(server ?? '').trim();
  const normalizedTimePeriod = toPositiveInteger(timePeriod);
  const normalizedSalesAmount = toPositiveInteger(salesAmount);
  const normalizedAveragePrice = toNonNegativeInteger(averagePrice);
  const normalizedSortBy = SORT_OPTIONS.has(sortBy) ? sortBy : null;
  const filters =
    preset === 'custom'
      ? parseFilterIds(customFilters)
      : CATEGORY_PRESETS[preset]?.filters;

  if (!normalizedServer) errors.push('server');
  if (normalizedTimePeriod === null) errors.push('timePeriod');
  if (normalizedSalesAmount === null) errors.push('salesAmount');
  if (normalizedAveragePrice === null) errors.push('averagePrice');
  if (!filters?.length) errors.push('filters');
  if (!normalizedSortBy) errors.push('sortBy');

  if (errors.length > 0) {
    throw new Error(`Invalid marketshare parameters: ${errors.join(', ')}`);
  }

  return {
    server: normalizedServer,
    time_period: normalizedTimePeriod,
    sales_amount: normalizedSalesAmount,
    average_price: normalizedAveragePrice,
    filters: [...filters],
    sort_by: normalizedSortBy,
  };
}

function parseFilterIds(value) {
  const ids = String(value)
    .split(/[\s,]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((number) => Number.isInteger(number));

  return [...new Set(ids)];
}

function toPositiveInteger(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;

  return number;
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;

  return number;
}

export const CATEGORY_PRESETS = {
  housing: {
    label: 'ハウジング',
    filters: [56, 65, 66, 67, 68, 69, 70, 71, 72, 81, 82],
  },
  materials: {
    label: '素材',
    filters: [47, 48, 49, 50, 51, 52, 53, 54, 55],
  },
  consumables: {
    label: '薬・食事',
    filters: [43, 44, 45, 46],
  },
  collectibles: {
    label: 'ミニオン・譜面・登録品',
    filters: [75, 80, 90],
  },
  all: {
    label: 'すべて',
    filters: [0],
  },
};

export const SORT_OPTIONS = new Set([
  'avg',
  'marketValue',
  'median',
  'purchaseAmount',
  'quantitySold',
  'percentChange',
]);

export function normalizeMarketshareResponse(response) {
  assertMarketshareResponse(response);
  const rawItems = response.data;

  return rawItems.map((item) => {
    const minPrice = toFiniteNumber(item.minPrice);
    const normalizedMinPrice = minPrice && minPrice > 0 ? minPrice : null;
    const state = String(item.state || 'unknown').trim() || 'unknown';
    const nameEn = normalizeText(item.name) || 'Unknown Item';
    const nameJa = normalizeText(item.nameJa ?? item.name_ja);
    const normalized = {
      avg: toFiniteNumber(item.avg) ?? 0,
      itemId: String(item.itemID ?? item.itemId ?? ''),
      marketValue: toFiniteNumber(item.marketValue) ?? 0,
      median: toFiniteNumber(item.median) ?? 0,
      minPrice: normalizedMinPrice,
      name: nameJa || nameEn,
      nameEn,
      nameJa,
      npcVendorInfo: String(item.npc_vendor_info ?? item.npcVendorInfo ?? ''),
      percentChange: toFiniteNumber(item.percentChange) ?? 0,
      purchaseAmount: toFiniteNumber(item.purchaseAmount) ?? 0,
      quantitySold: toFiniteNumber(item.quantitySold) ?? 0,
      state,
      url: String(item.url ?? ''),
    };

    normalized.hasListings = normalized.minPrice !== null;
    normalized.recommendationLevel = getRecommendationLevel(normalized);
    normalized.opportunityScore = calculateOpportunityScore(normalized);

    return normalized;
  });
}

export function summarizeMarketshare(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const stateCounts = {};
  let totalMarketValue = 0;
  let totalQuantitySold = 0;
  let topItem = null;

  for (const item of safeItems) {
    totalMarketValue += item.marketValue;
    totalQuantitySold += item.quantitySold;
    stateCounts[item.state] = (stateCounts[item.state] ?? 0) + 1;

    if (!topItem || item.marketValue > topItem.marketValue) {
      topItem = item;
    }
  }

  return {
    itemCount: safeItems.length,
    totalMarketValue,
    totalQuantitySold,
    stateCounts,
    topItem,
  };
}

export function filterMarketshareItems(
  items,
  { search = '', states = [], minQuantitySold = 0, sortBy = 'marketValue' } = {},
) {
  const normalizedSearch = search.trim().toLowerCase();
  const stateSet = new Set(states.filter(Boolean));
  const minimumSales = Number(minQuantitySold) || 0;
  const sortKey = getSortKey(sortBy);

  return [...items]
    .filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        [item.name, item.nameJa, item.nameEn]
          .filter(Boolean)
          .some((name) => name.toLowerCase().includes(normalizedSearch)) ||
        item.itemId.includes(normalizedSearch);
      const matchesState = stateSet.size === 0 || stateSet.has(item.state);
      const matchesSales = item.quantitySold >= minimumSales;

      return matchesSearch && matchesState && matchesSales;
    })
    .sort((a, b) => b[sortKey] - a[sortKey]);
}

export function formatGil(value) {
  const number = toFiniteNumber(value);
  if (number === null) return '-';

  return `${Math.round(number).toLocaleString('ja-JP')} ギル`;
}

export function formatNumber(value) {
  const number = toFiniteNumber(value);
  if (number === null) return '-';

  return Math.round(number).toLocaleString('en-US');
}

export function stateLabel(state) {
  const labels = {
    decreasing: '値下がり',
    increasing: '上昇中',
    'out of stock': '在庫なし',
    spiking: '急騰',
    stable: '安定',
    unknown: '不明',
  };

  return labels[state] ?? labels.unknown;
}

export function assertMarketshareResponse(response) {
  if (!Array.isArray(response?.data)) {
    throw new Error('Invalid marketshare response: data must be an array');
  }

  for (const [index, item] of response.data.entries()) {
    const hasRequiredFields =
      item &&
      isNonEmptyValue(item.itemID ?? item.itemId) &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      isNumericValue(item.marketValue) &&
      isNumericValue(item.quantitySold);

    if (!hasRequiredFields) {
      throw new Error(`Invalid marketshare item schema at index ${index}`);
    }
  }
}

export function createSnapshot({
  query,
  response,
  source,
  itemNames = {},
  generatedAt = new Date(),
}) {
  const items = normalizeMarketshareResponse(response).map((item) =>
    localizeMarketshareItem(item, itemNames),
  );
  const summary = summarizeMarketshare(items);

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    source,
    query: {
      server: query.server,
      timePeriod: query.timePeriod,
      salesAmount: query.salesAmount,
      averagePrice: query.averagePrice,
      preset: query.preset,
      sortBy: query.sortBy,
      filters: query.filters,
    },
    summary,
    items,
  };
}

export function localizeMarketshareItem(item, itemNames = {}) {
  const nameJa = lookupItemName(itemNames, item.itemId) || item.nameJa;
  const nameEn = item.nameEn || item.name;

  return {
    ...item,
    name: nameJa || item.name,
    nameEn,
    nameJa,
  };
}

function calculateOpportunityScore(item) {
  const velocity = item.quantitySold * 10;
  const value = Math.log10(Math.max(item.marketValue, 1)) * 12;
  const scarcity = item.hasListings ? 0 : 300;
  const trend = Math.max(Math.min(item.percentChange, 200), -50) / 4;

  return Math.round((velocity + value + scarcity + trend) * 10) / 10;
}

function getRecommendationLevel(item) {
  if (!item.hasListings || item.state === 'out of stock') return 'needs-restock';
  if (item.state === 'spiking' || item.percentChange >= 80) return 'hot';
  if (item.state === 'increasing' || item.percentChange >= 15) return 'rising';
  return 'steady';
}

function getSortKey(sortBy) {
  if (sortBy === 'opportunityScore') return 'opportunityScore';
  if (SORT_OPTIONS.has(sortBy)) return sortBy;
  return 'marketValue';
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return number;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function lookupItemName(itemNames, itemId) {
  if (!itemId) return '';

  const value =
    itemNames instanceof Map
      ? itemNames.get(String(itemId))
      : itemNames[String(itemId)];

  return normalizeText(value);
}

function isNonEmptyValue(value) {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function isNumericValue(value) {
  return isNonEmptyValue(value) && Number.isFinite(Number(value));
}

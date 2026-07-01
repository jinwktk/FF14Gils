import {
  localeForLanguage,
  normalizeLanguage,
  translate,
} from './i18n.js';

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
  'minPrice',
  'name',
  'purchaseAmount',
  'quantitySold',
  'percentChange',
  'state',
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
  {
    search = '',
    states = [],
    minQuantitySold = 0,
    sortBy = 'marketValue',
    sortDirection = 'desc',
  } = {},
) {
  const normalizedSearch = search.trim().toLowerCase();
  const stateSet = new Set(states.filter(Boolean));
  const minimumSales = Number(minQuantitySold) || 0;
  const sortKey = getSortKey(sortBy);
  const direction = sortDirection === 'asc' ? 'asc' : 'desc';

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
    .sort((a, b) => compareMarketshareItems(a, b, sortKey, direction));
}

export function formatGil(value, language = 'ja') {
  const number = toFiniteNumber(value);
  if (number === null) return '-';

  const normalizedLanguage = normalizeLanguage(language);
  return `${Math.round(number).toLocaleString(localeForLanguage(normalizedLanguage))} ${translate(normalizedLanguage, 'format.gilUnit')}`;
}

export function formatNumber(value, language = 'ja') {
  const number = toFiniteNumber(value);
  if (number === null) return '-';

  return Math.round(number).toLocaleString(localeForLanguage(language));
}

export function stateLabel(state, language = 'ja') {
  const key = stateTranslationKey(state);
  const label = translate(language, `states.${key}`);

  return label === `states.${key}` ? translate(language, 'states.unknown') : label;
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
  itemNameLanguage = 'ja',
  generatedAt = new Date(),
}) {
  const items = normalizeMarketshareResponse(response).map((item) =>
    localizeMarketshareItem(item, itemNames, itemNameLanguage),
  );
  const summary = summarizeMarketshare(items);

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    source,
    query: {
      server: query.server,
      periodKey: query.periodKey,
      periodLabel: query.periodLabel,
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

export function localizeMarketshareItem(item, itemNames = {}, itemNameLanguage = 'ja') {
  const normalizedItemNameLanguage = normalizeItemNameLanguage(itemNameLanguage);
  const localizedName = lookupItemName(itemNames, item.itemId);
  const nameEn =
    normalizedItemNameLanguage === 'en'
      ? localizedName || item.nameEn || item.name
      : item.nameEn || item.name;
  const nameJa =
    normalizedItemNameLanguage === 'ja'
      ? localizedName || item.nameJa
      : item.nameJa;
  const names = {
    ...(item.names ?? {}),
    en: nameEn,
  };

  if (nameJa) names.ja = nameJa;
  if (localizedName) names[normalizedItemNameLanguage] = localizedName;

  return {
    ...item,
    name: nameJa || item.name,
    nameEn,
    nameJa,
    names,
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

function compareMarketshareItems(a, b, sortKey, direction) {
  const modifier = direction === 'asc' ? 1 : -1;
  const valueA = a[sortKey];
  const valueB = b[sortKey];
  const aMissing = valueA === null || valueA === undefined || valueA === '';
  const bMissing = valueB === null || valueB === undefined || valueB === '';

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof valueA === 'string' || typeof valueB === 'string') {
    return String(valueA).localeCompare(String(valueB), 'ja-JP') * modifier;
  }

  const numberA = Number(valueA);
  const numberB = Number(valueB);

  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return (numberA - numberB) * modifier;
  }

  return String(valueA).localeCompare(String(valueB), 'ja-JP') * modifier;
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

function stateTranslationKey(state) {
  const key = String(state || 'unknown')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
    .replace(/[^a-z0-9_]/g, '');

  return key || 'unknown';
}

function normalizeItemNameLanguage(language) {
  const value = String(language ?? '').trim().toLowerCase().split(/[-_]/)[0];

  return ['ja', 'en', 'fr', 'de'].includes(value) ? value : 'ja';
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

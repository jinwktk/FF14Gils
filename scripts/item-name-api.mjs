export const XIVAPI_ITEM_ENDPOINT = 'https://v2.xivapi.com/api/sheet/Item';
export const SUPPORTED_XIVAPI_LANGUAGES = ['ja', 'en', 'fr', 'de'];

const DEFAULT_LANGUAGE = 'ja';
const DEFAULT_CONCURRENCY = 8;
const RETRY_DELAYS_MS = [500, 1500];

export function buildXivapiItemNameUrl(itemId, { language = DEFAULT_LANGUAGE } = {}) {
  const normalizedItemId = normalizeItemId(itemId);
  if (!normalizedItemId) {
    throw new Error('itemId must be numeric');
  }

  const url = new URL(`${XIVAPI_ITEM_ENDPOINT}/${normalizedItemId}`);
  url.searchParams.set('fields', 'Name');
  url.searchParams.set('language', normalizeXivapiLanguage(language));

  return url.toString();
}

export async function fetchItemNames(
  itemIds,
  {
    concurrency = DEFAULT_CONCURRENCY,
    fetchImpl = fetch,
    language = DEFAULT_LANGUAGE,
    log = () => {},
  } = {},
) {
  const ids = normalizeItemIds(itemIds);
  const results = {};
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, ids.length));

  async function worker() {
    while (nextIndex < ids.length) {
      const id = ids[nextIndex];
      nextIndex += 1;

      try {
        const name = await fetchItemName(id, { fetchImpl, language });
        if (name) {
          results[id] = name;
        }
      } catch (error) {
        log(`XIVAPI item name failed for ${id}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));

  return Object.fromEntries(
    Object.entries(results).sort(([left], [right]) => Number(left) - Number(right)),
  );
}

export function fetchJapaneseItemNames(itemIds, options = {}) {
  return fetchItemNames(itemIds, { ...options, language: DEFAULT_LANGUAGE });
}

export function normalizeXivapiLanguage(language) {
  const value = String(language ?? '').trim().toLowerCase().split(/[-_]/)[0];

  return SUPPORTED_XIVAPI_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

export function normalizeItemIds(itemIds) {
  return [
    ...new Set(
      [...itemIds]
        .map((itemId) => normalizeItemId(itemId))
        .filter(Boolean),
    ),
  ].sort((left, right) => Number(left) - Number(right));
}

async function fetchItemName(itemId, { fetchImpl, language }) {
  const url = buildXivapiItemNameUrl(itemId, { language });

  for (const [attempt, delayMs] of [0, ...RETRY_DELAYS_MS].entries()) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          'user-agent': 'FF14Gils item name fetcher',
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const name = typeof data?.fields?.Name === 'string' ? data.fields.Name.trim() : '';

      if (!name) {
        throw new Error('Name is empty');
      }

      return name;
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }

      await delay(delayMs);
    }
  }

  return '';
}

function normalizeItemId(itemId) {
  const value = String(itemId ?? '').trim();
  return /^\d+$/.test(value) ? value : '';
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

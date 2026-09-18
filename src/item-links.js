import { normalizeLanguage } from './i18n.js';

export const ERIONES_ICON_URL = new URL('../assets/eriones.ico', import.meta.url).href;

export function buildErionesSearchUrl(item, language = 'ja') {
  const japaneseName = String(item?.names?.ja ?? item?.nameJa ?? '').trim();
  const englishName = String(item?.names?.en ?? item?.nameEn ?? '').trim();
  const preferEnglish = normalizeLanguage(language) === 'en';
  const english = preferEnglish ? Boolean(englishName) : !japaneseName && Boolean(englishName);
  const name = english ? englishName : japaneseName;

  return name
    ? `https://${english ? 'en.' : ''}eriones.com/search?i=${encodeURIComponent(name)}`
    : '';
}

export function buildLodestoneItemUrl(itemId, itemMap, language = 'ja') {
  const hash = itemMap?.[String(itemId)];
  if (!/^[0-9a-f]{11}$/.test(hash ?? '')) return '';

  const region = normalizeLanguage(language) === 'en' ? 'na' : 'jp';
  return `https://${region}.finalfantasyxiv.com/lodestone/playguide/db/item/${hash}/`;
}

export async function loadLodestoneItemMap(fetchImpl = fetch) {
  const response = await fetchImpl(new URL('../assets/lodestone-items.json', import.meta.url));
  if (!response.ok) throw new Error(`Item map: ${response.status}`);

  const itemMap = await response.json();
  if (!itemMap || typeof itemMap !== 'object' || Array.isArray(itemMap)) {
    throw new Error('Lodestone item map must be an object');
  }
  return itemMap;
}

export function loadOfficialTooltipScript(documentRef = document) {
  const current = documentRef.querySelector('script[data-eorzeadb-loader]');
  if (current) return current;

  const script = documentRef.createElement('script');
  script.src = 'https://lds-img.finalfantasyxiv.com/pc/global/js/eorzeadb/loader.js?v3';
  script.async = true;
  script.dataset.eorzeadbLoader = '';
  documentRef.body.append(script);
  return script;
}

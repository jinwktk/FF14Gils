import { readCookieValue } from './preferences.js';

export const DEFAULT_LANGUAGE = 'ja';
export const LANGUAGE_COOKIE_NAME = 'ff14gils_language';
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const SUPPORTED_LANGUAGES = ['ja', 'en'];

const TRANSLATIONS = {
  ja: {
    format: {
      gilUnit: 'ギル',
    },
    meta: {
      title: 'FF14Gils | FF14 マーケット金策',
      description:
        'FF14のマーケット売上、相場、販売数から、全DCの金策候補を探せるダークテーマのマーケットダッシュボードです。',
      ogDescription:
        'マーケットの売れ行きと相場から、売りやすい金策候補を探せます。Hades初期表示、全DC対応。',
      imageAlt: 'FF14Gilsのマーケット金策ダッシュボード画像',
      locale: 'ja_JP',
      inLanguage: 'ja-JP',
    },
    periods: {
      '1d': '1日',
      '3d': '3日',
      '7d': '7日',
      '30d': '1か月',
    },
    recommendations: {
      candidate: '候補',
      hot: '高騰',
      needsRestock: '補充候補',
      rising: '上昇',
      steady: '堅調',
    },
    results: {
      count: '{count} 件',
    },
    sort: {
      avg: '平均価格',
      marketValue: '売上額',
      minPrice: '最安値',
      name: 'アイテム名',
      opportunityScore: 'おすすめ度',
      percentChange: '価格変動',
      quantitySold: '売れた数',
      state: '状態',
    },
    states: {
      decreasing: '値下がり',
      increasing: '上昇中',
      out_of_stock: '在庫なし',
      spiking: '急騰',
      stable: '安定',
      unknown: '不明',
    },
    table: {
      avg: '平均価格',
      item: 'アイテム',
      marketValue: '売上額',
      minPrice: '最安値',
      percentChange: '価格変動',
      quantitySold: '売れた数',
      rank: '順位',
      state: '状態',
    },
    ui: {
      emptyState: '条件に一致するアイテムがありません。',
      eyebrow: 'FF14 マーケット金策',
      filterHelp: '選んだワールドは次回も使えます。',
      filterKicker: '条件',
      filterPanelLabel: '絞り込み',
      filterTitle: '絞り込み',
      itemSearch: 'アイテム検索',
      kofiSupport: 'Ko-fiで支援する',
      languageLabel: '表示言語',
      languageSelect: '表示言語を選択',
      lead: 'マーケットの売れ行きと相場から、売りやすい金策候補を探せます。',
      loadError: 'データを読み込めませんでした: {message}',
      minQuantity: '最低販売数',
      missingContract: 'JSON契約が不足しています: {keys}',
      otherDataCenter: 'その他',
      periodLabel: '集計期間',
      periodSelect: '売上の集計期間',
      resultsKicker: '一覧',
      resultsLabel: '金策候補',
      resultsTitle: '金策候補',
      searchLabel: 'アイテム検索',
      searchPlaceholder: '日本語名・英語名・ID',
      sortLabel: '並び替え',
      stateLegend: '状態',
      updatedAt: '最終更新 {datetime}',
      updatedAtUnknown: '最終更新 -',
      worldLabel: 'ワールド',
      worldSelect: 'ワールドを選択',
      itemsNotArray: 'items が配列ではありません',
    },
  },
  en: {
    format: {
      gilUnit: 'gil',
    },
    meta: {
      title: 'FF14Gils | FF14 Market Profit Dashboard',
      description:
        'A dark market dashboard for finding profitable Final Fantasy XIV items from sales, prices, and purchase volume across all data centers.',
      ogDescription:
        'Find easier-to-sell market opportunities from sales volume and price trends. Starts on Hades and supports all data centers.',
      imageAlt: 'FF14Gils market profit dashboard image',
      locale: 'en_US',
      inLanguage: 'en-US',
    },
    periods: {
      '1d': '1 day',
      '3d': '3 days',
      '7d': '7 days',
      '30d': '1 month',
    },
    recommendations: {
      candidate: 'Candidate',
      hot: 'Hot',
      needsRestock: 'Restock',
      rising: 'Rising',
      steady: 'Steady',
    },
    results: {
      count: '{count} items',
    },
    sort: {
      avg: 'Average price',
      marketValue: 'Sales',
      minPrice: 'Lowest price',
      name: 'Item name',
      opportunityScore: 'Recommendation',
      percentChange: 'Price change',
      quantitySold: 'Sold',
      state: 'State',
    },
    states: {
      decreasing: 'Decreasing',
      increasing: 'Increasing',
      out_of_stock: 'Out of stock',
      spiking: 'Spiking',
      stable: 'Stable',
      unknown: 'Unknown',
    },
    table: {
      avg: 'Average price',
      item: 'Item',
      marketValue: 'Sales',
      minPrice: 'Lowest price',
      percentChange: 'Price change',
      quantitySold: 'Sold',
      rank: 'Rank',
      state: 'State',
    },
    ui: {
      emptyState: 'No items match the current filters.',
      eyebrow: 'FF14 market profit',
      filterHelp: 'Your selected world will be remembered next time.',
      filterKicker: 'Filters',
      filterPanelLabel: 'Filters',
      filterTitle: 'Filters',
      itemSearch: 'Item search',
      kofiSupport: 'Support on Ko-fi',
      languageLabel: 'Language',
      languageSelect: 'Select language',
      lead: 'Find easier-to-sell market opportunities from recent sales and prices.',
      loadError: 'Could not load data: {message}',
      minQuantity: 'Minimum sold',
      missingContract: 'JSON contract is missing: {keys}',
      otherDataCenter: 'Other',
      periodLabel: 'Sales period',
      periodSelect: 'Select sales period',
      resultsKicker: 'Results',
      resultsLabel: 'Profit candidates',
      resultsTitle: 'Profit candidates',
      searchLabel: 'Item search',
      searchPlaceholder: 'Japanese name, English name, or ID',
      sortLabel: 'Sort',
      stateLegend: 'State',
      updatedAt: 'Updated {datetime}',
      updatedAtUnknown: 'Updated -',
      worldLabel: 'World',
      worldSelect: 'Select world',
      itemsNotArray: 'items is not an array',
    },
  },
};

export function normalizeLanguage(language) {
  return parseLanguage(language) ?? DEFAULT_LANGUAGE;
}

export function resolvePreferredLanguage(cookieString = '', browserLanguage = '') {
  const savedLanguage = parseLanguage(readCookieValue(cookieString, LANGUAGE_COOKIE_NAME));
  if (savedLanguage) return savedLanguage;

  return parseLanguage(browserLanguage) ?? DEFAULT_LANGUAGE;
}

export function buildLanguagePreferenceCookie(language) {
  return [
    `${LANGUAGE_COOKIE_NAME}=${encodeURIComponent(normalizeLanguage(language))}`,
    `Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ');
}

export function translate(language, key, values = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const template =
    getTranslationValue(TRANSLATIONS[normalizedLanguage], key) ??
    getTranslationValue(TRANSLATIONS[DEFAULT_LANGUAGE], key) ??
    key;

  return String(template).replace(/\{(\w+)\}/g, (_, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : `{${name}}`,
  );
}

export function localeForLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'en-US' : 'ja-JP';
}

export function selectItemDisplayName(item, language = DEFAULT_LANGUAGE) {
  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage === 'en') {
    return normalizeText(item?.nameEn) || normalizeText(item?.name) || normalizeText(item?.nameJa);
  }

  return normalizeText(item?.nameJa) || normalizeText(item?.name) || normalizeText(item?.nameEn);
}

export function selectItemAlternateName(item, language = DEFAULT_LANGUAGE) {
  const normalizedLanguage = normalizeLanguage(language);
  const displayName = selectItemDisplayName(item, normalizedLanguage);
  const alternateName =
    normalizedLanguage === 'en'
      ? normalizeText(item?.nameJa)
      : normalizeText(item?.nameEn);

  return alternateName && alternateName !== displayName ? alternateName : '';
}

export function periodLabel(periodKey, language = DEFAULT_LANGUAGE, fallback = '') {
  const translated = translate(language, `periods.${periodKey}`);

  return translated === `periods.${periodKey}` ? fallback : translated;
}

export function recommendationLabel(level, language = DEFAULT_LANGUAGE) {
  const key = {
    hot: 'hot',
    'needs-restock': 'needsRestock',
    rising: 'rising',
    steady: 'steady',
  }[level] ?? 'candidate';

  return translate(language, `recommendations.${key}`);
}

function parseLanguage(language) {
  const value = String(language ?? '').trim().toLowerCase().split(/[-_]/)[0];

  return SUPPORTED_LANGUAGES.includes(value) ? value : null;
}

function getTranslationValue(source, key) {
  return String(key)
    .split('.')
    .reduce((current, part) => current?.[part], source);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

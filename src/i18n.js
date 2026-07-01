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
    dataCenterRegions: {
      europe: '欧州データセンター',
      japan: '日本データセンター',
      northAmerica: '北米データセンター',
      oceania: 'オセアニアデータセンター',
      other: 'その他のデータセンター',
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
    nav: {
      label: 'メインナビゲーション',
      legal: '権利表記とデータ',
      market: '金策候補',
      ranking: 'ワールドランキング',
    },
    legal: {
      andText: 'と',
      copyright: '© 2026 FF14Gils',
      dataHandlingBrowser:
        '利用者のブラウザは、GitHub Pages で配信される生成済み JSON を読み込みます。ブラウザから外部 API へ直接 POST する処理はありません。',
      dataHandlingChanges:
        '外部データ元の仕様や利用条件は変更される可能性があります。権利者様または API 提供元から問題の指摘があった場合は、該当機能の停止またはサイト公開停止を行います。',
      dataHandlingDisclaimer:
        '上記の確認内容は 2026-06-30 時点の公開情報に基づきます。法的な助言ではなく、運用上の確認メモです。',
      dataHandlingTitle: 'データの扱い',
      ffxivMaterialUsage: 'ファイナルファンタジーXIV 著作物利用条件',
      ffxivTermsIntro: 'FINAL FANTASY XIV の利用は、',
      ffxivTermsOutro:
        'の対象です。FF14Gils はゲームクライアント、アカウント、プレイ操作へ接続せず、RMT、BOT、外部ツールによる自動操作を目的としません。',
      ffxivTermsTitle: 'FINAL FANTASY XIV の利用条件',
      ffxivUserAgreement: 'ファイナルファンタジーXIV 利用規約',
      externalToolDataNotice:
        'データ元には、外部ツールで入手したデータが含まれる場合があります。FF14Gils は、その取得方法を管理または保証しません。',
      gaIntro: 'アクセス状況の把握だけに利用します。',
      gaTerms: 'Google Analytics 利用規約',
      gaText:
        'に従い、Cookie 等を利用する場合があります。FF14Gils から Google Analytics へ個人を特定できる情報は送信しません。',
      gaTitle: 'Google Analytics 4',
      label: '権利表記とデータについて',
      lead: 'FF14Gils は FINAL FANTASY XIV の非公式ファンサイトです。',
      publicDocs: '公開ドキュメント',
      rightsTitle: '権利表記',
      saddlebagDocs:
        'では、Saddlebag Exchange API は内部的に Universalis API を利用すると説明されているため、過剰な取得にならないように順次取得、短いリトライ、キャッシュ済み JSON の静的配信を前提にします。',
      saddlebagIntro: '1日、3日、7日のマーケット集計候補を取得するために利用します。',
      saddlebagTitle: 'Saddlebag Exchange API',
      sourcesTitle: '利用しているデータ元',
      squareEnixCopyright: 'Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.',
      title: '権利表記とデータについて',
      trademarks:
        '記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。',
      unofficialText:
        'FF14Gils は SQUARE ENIX CO., LTD. による公式サービスではありません。FINAL FANTASY XIV に関する名称、データ、画像、その他の権利は SQUARE ENIX CO., LTD. に帰属します。',
      unofficialTitle: '非公式サイトについて',
      xivapiText:
        'に従い、アイテム名の取得だけに利用します。説明文、アイコン、詳細なゲームデータは保存しません。',
      xivapiTitle: 'XIVAPI v2',
    },
    periods: {
      '1d': '1日',
      '3d': '3日',
      '7d': '7日',
    },
    recommendations: {
      candidate: '候補',
      hot: '高騰',
      needsRestock: '補充候補',
      rising: '上昇',
      steady: '堅調',
    },
    ranking: {
      dataCenter: 'DC',
      help:
        '生成済みスナップショットの売上合計で全ワールドを並べています。ワールド名を選ぶと金策候補画面へ移動します。',
      items: '件数',
      kicker: 'ランキング',
      label: 'ワールド売上ランキング',
      rank: '順位',
      region: 'リージョン',
      sales: '売上額',
      sold: '販売数',
      title: 'ワールド売上ランキング',
      topItem: '売上上位',
      world: 'ワールド',
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
      dataCenterLabel: 'データセンター',
      dataCenterSelect: 'DCを選択',
      emptyState: '条件に一致するアイテムがありません。',
      eyebrow: 'FF14 マーケット金策',
      filterHelp: 'DCを選ぶとワールド候補を絞れます。選んだワールドは次回も使えます。',
      filterKicker: '条件',
      filterPanelLabel: '絞り込み',
      filterTitle: '絞り込み',
      itemSearch: 'アイテム検索',
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
    dataCenterRegions: {
      europe: 'European Data Centers',
      japan: 'Japanese Data Centers',
      northAmerica: 'North American Data Centers',
      oceania: 'Oceanic Data Centers',
      other: 'Other Data Centers',
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
    nav: {
      label: 'Main navigation',
      legal: 'Rights and data',
      market: 'Candidates',
      ranking: 'World ranking',
    },
    legal: {
      andText: 'and the',
      copyright: '© 2026 FF14Gils',
      dataHandlingBrowser:
        'The browser reads generated JSON served by GitHub Pages. It does not POST directly to external APIs.',
      dataHandlingChanges:
        'External data sources, specifications, and terms may change. If a rights holder or API provider reports an issue, the affected feature or the public site may be stopped.',
      dataHandlingDisclaimer:
        'This note is based on public information checked on June 30, 2026. It is an operational note, not legal advice.',
      dataHandlingTitle: 'Data handling',
      ffxivMaterialUsage: 'FINAL FANTASY XIV Material Usage License',
      ffxivTermsIntro: 'Use of FINAL FANTASY XIV is subject to the',
      ffxivTermsOutro:
        '. FF14Gils does not connect to the game client, accounts, or player actions, and is not intended for RMT, bots, or automated play tools.',
      ffxivTermsTitle: 'FINAL FANTASY XIV terms',
      ffxivUserAgreement: 'FINAL FANTASY XIV User Agreement',
      externalToolDataNotice:
        'The data sources may include data obtained through external tools. FF14Gils does not control or guarantee the methods used to collect that data.',
      gaIntro: 'Used only to understand page views. The',
      gaTerms: 'Google Analytics Terms of Service',
      gaText:
        'may involve cookies. FF14Gils does not send personally identifiable information to Google Analytics.',
      gaTitle: 'Google Analytics 4',
      label: 'Rights and data',
      lead: 'FF14Gils is an unofficial FINAL FANTASY XIV fan site.',
      publicDocs: 'public documentation',
      rightsTitle: 'Rights notice',
      saddlebagDocs:
        'explains that the Saddlebag Exchange API internally uses the Universalis API, so FF14Gils uses sequential fetching, short retries, and static delivery of cached JSON to avoid excessive requests.',
      saddlebagIntro: 'Used to fetch 1-day, 3-day, and 7-day market aggregate candidates. The',
      saddlebagTitle: 'Saddlebag Exchange API',
      sourcesTitle: 'Data sources',
      squareEnixCopyright: 'Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.',
      title: 'Rights and data',
      trademarks:
        'Company names, product names, system names, and other names listed here are trademarks or registered trademarks of their respective owners.',
      unofficialText:
        'FF14Gils is not an official service by SQUARE ENIX CO., LTD. Names, data, images, and other rights related to FINAL FANTASY XIV belong to SQUARE ENIX CO., LTD.',
      unofficialTitle: 'About this unofficial site',
      xivapiText:
        'is used as the reference, and FF14Gils only fetches item names. It does not store descriptions, icons, or detailed game data.',
      xivapiTitle: 'XIVAPI v2',
    },
    periods: {
      '1d': '1 day',
      '3d': '3 days',
      '7d': '7 days',
    },
    recommendations: {
      candidate: 'Candidate',
      hot: 'Hot',
      needsRestock: 'Restock',
      rising: 'Rising',
      steady: 'Steady',
    },
    ranking: {
      dataCenter: 'DC',
      help:
        'Worlds are ranked by total sales from generated snapshots. Choose a world name to open its candidate list.',
      items: 'Items',
      kicker: 'Ranking',
      label: 'World sales ranking',
      rank: 'Rank',
      region: 'Region',
      sales: 'Sales',
      sold: 'Sold',
      title: 'World sales ranking',
      topItem: 'Top item',
      world: 'World',
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
      dataCenterLabel: 'Data center',
      dataCenterSelect: 'Select data center',
      emptyState: 'No items match the current filters.',
      eyebrow: 'FF14 market profit',
      filterHelp: 'Choose a data center to narrow the world list. Your selected world will be remembered next time.',
      filterKicker: 'Filters',
      filterPanelLabel: 'Filters',
      filterTitle: 'Filters',
      itemSearch: 'Item search',
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

export function formatUpdatedAtDate(value, language = DEFAULT_LANGUAGE, { timeZone } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };

  if (timeZone) {
    options.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat(localeForLanguage(language), options).format(date);
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

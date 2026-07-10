const SITE_URL = 'https://jinwktk.github.io/FF14Gils/';

export const ROUTE_NAMES = Object.freeze(['market', 'ranking', 'legal']);

export const ROUTE_MANIFEST = deepFreeze({
  market: {
    section: 'market',
    path: '',
    absoluteUrl: SITE_URL,
    resources: {
      snapshot: true,
      worldIndex: true,
    },
    meta: {
      ja: {
        title: 'FF14Gils | FF14 マーケット金策・相場検索',
        description:
          'FF14のマーケット売上・相場・販売数をワールド別に比較し、全DCから売りやすい金策候補を探せる軽量ダッシュボードです。',
        ogDescription:
          'FF14の売上データと相場から、いま売りやすいマーケット金策候補をワールド別に探せます。',
        heroEyebrow: 'FF14 マーケット金策',
        heroTitle: 'FF14のマーケット金策を、売上データで見つける',
        heroLead:
          '販売数と売上額、価格変動をまとめて比較し、選んだワールドで売りやすい候補をすばやく絞り込めます。',
        schemaType: 'WebApplication',
        locale: 'ja_JP',
        inLanguage: 'ja-JP',
      },
      en: {
        title: 'FF14Gils | FFXIV Market Profit and Price Search',
        description:
          'Compare Final Fantasy XIV market sales, prices, and purchase volume by World to find practical profit opportunities across every data center.',
        ogDescription:
          'Find practical FFXIV market profit opportunities by comparing recent sales, prices, and price movement for each World.',
        heroEyebrow: 'FFXIV market profit',
        heroTitle: 'Find FFXIV market opportunities from real sales data',
        heroLead:
          'Compare sales volume, total value, and price movement to quickly narrow down items that are easier to sell on your selected World.',
        schemaType: 'WebApplication',
        locale: 'en_US',
        inLanguage: 'en-US',
      },
    },
  },
  ranking: {
    section: 'ranking',
    path: 'ranking/',
    absoluteUrl: `${SITE_URL}ranking/`,
    resources: {
      snapshot: false,
      worldIndex: true,
    },
    meta: {
      ja: {
        title: 'FF14 ワールド売上ランキング | FF14Gils',
        description:
          'FF14の全DC・全ワールドをマーケット売上額、販売数、上位アイテムで比較できるワールド売上ランキングです。1日・3日・7日の期間を切り替えられます。',
        ogDescription:
          'FF14の全ワールドをマーケット売上額と販売数で比較し、金策候補を探すワールドを見つけられます。',
        heroEyebrow: '全DC ワールド比較',
        heroTitle: 'マーケットが活発なワールドを比較する',
        heroLead:
          '生成済みデータから全ワールドの売上額と販売数を並べ、期間ごとのマーケット動向をひと目で比較できます。',
        schemaType: 'CollectionPage',
        locale: 'ja_JP',
        inLanguage: 'ja-JP',
      },
      en: {
        title: 'FFXIV World Sales Ranking | FF14Gils',
        description:
          'Compare every FFXIV World by market sales value, units sold, and top items, with ranking periods for the latest one, three, or seven days.',
        ogDescription:
          'Compare FFXIV Worlds by market sales and purchase volume to choose where to explore profitable items.',
        heroEyebrow: 'All data centers',
        heroTitle: 'Compare the most active FFXIV market Worlds',
        heroLead:
          'Review generated sales value and purchase volume rankings across every World, then open the market candidates that matter to you.',
        schemaType: 'CollectionPage',
        locale: 'en_US',
        inLanguage: 'en-US',
      },
    },
  },
  legal: {
    section: 'legal',
    path: 'legal/',
    absoluteUrl: `${SITE_URL}legal/`,
    resources: {
      snapshot: false,
      worldIndex: false,
    },
    meta: {
      ja: {
        title: '権利表記・データの扱い | FF14Gils',
        description:
          'FF14Gilsの権利表記、非公式ファンサイトとしての位置づけ、マーケットデータの取得元、Google Analytics 4とKo-fiの扱いを説明します。',
        ogDescription:
          'FF14Gilsの権利表記、データ元、アクセス解析、任意支援サービスの扱いを確認できます。',
        heroEyebrow: '透明性と運用方針',
        heroTitle: '権利表記とデータの扱い',
        heroLead:
          '非公式ファンサイトとしての位置づけと、外部データ・アクセス解析・任意支援サービスの扱いを説明します。',
        schemaType: 'WebPage',
        locale: 'ja_JP',
        inLanguage: 'ja-JP',
      },
      en: {
        title: 'Rights and Data Handling | FF14Gils',
        description:
          'Read the FF14Gils rights notice, unofficial fan-site status, market data sources, and how Google Analytics 4 and Ko-fi are handled.',
        ogDescription:
          'Review the FF14Gils rights notice, data sources, analytics practices, and optional support service handling.',
        heroEyebrow: 'Transparency and policy',
        heroTitle: 'Rights notice and data handling',
        heroLead:
          'Learn how this unofficial fan site handles external market data, analytics, intellectual property notices, and optional support services.',
        schemaType: 'WebPage',
        locale: 'en_US',
        inLanguage: 'en-US',
      },
    },
  },
});

export function getRouteDefinition(route, language = 'ja') {
  const routeName = normalizeRouteName(route);
  const normalizedLanguage = normalizeLanguage(language);
  const definition = ROUTE_MANIFEST[routeName];
  const meta = definition.meta[normalizedLanguage];

  return {
    section: definition.section,
    path: definition.path,
    absoluteUrl: definition.absoluteUrl,
    resources: definition.resources,
    meta: {
      ...meta,
      schemaName: meta.title,
    },
    language: normalizedLanguage,
  };
}

export function routeFromPath(pathname, basePath = '/') {
  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedPathname = normalizePathname(pathname);
  const baseWithoutTrailingSlash = normalizedBasePath === '/'
    ? '/'
    : normalizedBasePath.slice(0, -1);

  let relativePath;
  if (normalizedPathname === baseWithoutTrailingSlash) {
    relativePath = '';
  } else if (normalizedPathname.startsWith(normalizedBasePath)) {
    relativePath = normalizedPathname.slice(normalizedBasePath.length);
  } else {
    return 'market';
  }

  const normalizedRelativePath = relativePath.replace(/^\/+|\/+$/g, '');
  const match = ROUTE_NAMES.find(
    (route) => ROUTE_MANIFEST[route].path.replace(/\/$/, '') === normalizedRelativePath,
  );

  return match ?? 'market';
}

export function buildPagePath(route, basePath = '/') {
  const routeName = normalizeRouteName(route);
  return `${normalizeBasePath(basePath)}${ROUTE_MANIFEST[routeName].path}`;
}

function normalizeRouteName(route) {
  return ROUTE_NAMES.includes(route) ? route : 'market';
}

function normalizeLanguage(language) {
  return String(language ?? '').trim().toLowerCase().split(/[-_]/)[0] === 'en' ? 'en' : 'ja';
}

function normalizeBasePath(basePath) {
  const value = String(basePath ?? '/').trim();
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function normalizePathname(pathname) {
  const value = String(pathname ?? '/').split(/[?#]/, 1)[0];
  return value.startsWith('/') ? value : `/${value}`;
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const nestedValue of Object.values(value)) {
    if (nestedValue && typeof nestedValue === 'object' && !Object.isFrozen(nestedValue)) {
      deepFreeze(nestedValue);
    }
  }
  return value;
}

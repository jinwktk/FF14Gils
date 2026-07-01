export const DEFAULT_WORLD = 'Hades';
export const DEFAULT_SALES_PERIOD = '7d';

export const SALES_PERIODS = [
  { key: '1d', label: '1日', hours: 24 },
  { key: '3d', label: '3日', hours: 72 },
  { key: '7d', label: '7日', hours: 168 },
];

const SALES_PERIOD_BY_KEY = new Map(SALES_PERIODS.map((period) => [period.key, period]));

export const WORLD_DATA_CENTERS = [
  {
    name: 'Aether',
    worlds: [
      'Adamantoise',
      'Cactuar',
      'Faerie',
      'Gilgamesh',
      'Jenova',
      'Midgardsormr',
      'Sargatanas',
      'Siren',
    ],
  },
  {
    name: 'Crystal',
    worlds: [
      'Balmung',
      'Brynhildr',
      'Coeurl',
      'Diabolos',
      'Goblin',
      'Malboro',
      'Mateus',
      'Zalera',
    ],
  },
  {
    name: 'Dynamis',
    worlds: [
      'Cuchulainn',
      'Golem',
      'Halicarnassus',
      'Kraken',
      'Maduin',
      'Marilith',
      'Rafflesia',
      'Seraph',
    ],
  },
  {
    name: 'Primal',
    worlds: [
      'Behemoth',
      'Excalibur',
      'Exodus',
      'Famfrit',
      'Hyperion',
      'Lamia',
      'Leviathan',
      'Ultros',
    ],
  },
  {
    name: 'Chaos',
    worlds: [
      'Cerberus',
      'Louisoix',
      'Moogle',
      'Omega',
      'Phantom',
      'Ragnarok',
      'Sagittarius',
      'Spriggan',
    ],
  },
  {
    name: 'Light',
    worlds: [
      'Alpha',
      'Lich',
      'Odin',
      'Phoenix',
      'Raiden',
      'Shiva',
      'Twintania',
      'Zodiark',
    ],
  },
  {
    name: 'Materia',
    worlds: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'],
  },
  {
    name: 'Elemental',
    worlds: ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'],
  },
  {
    name: 'Gaia',
    worlds: ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'],
  },
  {
    name: 'Mana',
    worlds: ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'],
  },
  {
    name: 'Meteor',
    worlds: ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'],
  },
];

export const WORLD_DATA_CENTER_REGIONS = [
  {
    key: 'northAmerica',
    dataCenters: ['Aether', 'Primal', 'Crystal', 'Dynamis'],
  },
  {
    key: 'europe',
    dataCenters: ['Chaos', 'Light'],
  },
  {
    key: 'japan',
    dataCenters: ['Elemental', 'Gaia', 'Mana', 'Meteor'],
  },
  {
    key: 'oceania',
    dataCenters: ['Materia'],
  },
];

export const DEFAULT_WORLDS = WORLD_DATA_CENTERS.flatMap((dataCenter) => dataCenter.worlds);

const WORLD_DATA_CENTER_BY_NAME = new Map(
  WORLD_DATA_CENTERS.flatMap((dataCenter) =>
    dataCenter.worlds.map((world) => [world.toLowerCase(), dataCenter.name]),
  ),
);
const WORLD_DATA_CENTER_REGION_BY_NAME = new Map(
  WORLD_DATA_CENTER_REGIONS.flatMap((region) =>
    region.dataCenters.map((dataCenter) => [dataCenter, region.key]),
  ),
);

export function worldSlug(world) {
  return String(world ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildWorldSnapshotPath(world) {
  return `data/worlds/${worldSlug(world)}.json`;
}

export function buildWorldPeriodSnapshotPath(world, periodKey = DEFAULT_SALES_PERIOD) {
  const period = resolveSalesPeriod(periodKey);
  if (period.key === DEFAULT_SALES_PERIOD) {
    return buildWorldSnapshotPath(world);
  }

  return `data/worlds/${worldSlug(world)}-${period.key}.json`;
}

export function resolveWorldDataCenter(world) {
  const key = String(world ?? '').trim().toLowerCase();

  return WORLD_DATA_CENTER_BY_NAME.get(key) ?? 'その他';
}

export function resolveDataCenterRegion(dataCenter) {
  const key = String(dataCenter ?? '').trim();

  return WORLD_DATA_CENTER_REGION_BY_NAME.get(key) ?? 'other';
}

export function listDataCentersForWorlds(worlds) {
  return listDataCenterGroupsForWorlds(worlds).flatMap((group) => group.dataCenters);
}

export function listDataCenterGroupsForWorlds(worlds) {
  const worldList = Array.isArray(worlds) ? worlds : [];
  const availableDataCenters = new Set(
    worldList
      .map((world) =>
        String(world?.dataCenter ?? resolveWorldDataCenter(world?.name))
          .trim(),
      )
      .filter(Boolean),
  );
  const groups = WORLD_DATA_CENTER_REGIONS
    .map((region) => ({
      key: region.key,
      dataCenters: region.dataCenters.filter((dataCenter) =>
        availableDataCenters.has(dataCenter),
      ),
    }))
    .filter((region) => region.dataCenters.length > 0);
  const extras = [...availableDataCenters]
    .filter((dataCenter) => !WORLD_DATA_CENTER_REGION_BY_NAME.has(dataCenter))
    .sort((a, b) => a.localeCompare(b));

  if (extras.length > 0) {
    groups.push({ key: 'other', dataCenters: extras });
  }

  return groups;
}

export function filterWorldsByDataCenter(worlds, dataCenter) {
  const worldList = Array.isArray(worlds) ? worlds : [];
  const selectedDataCenter = String(dataCenter ?? '').trim();
  if (!selectedDataCenter) return [...worldList];

  const filteredWorlds = worldList.filter(
    (world) =>
      String(world?.dataCenter ?? resolveWorldDataCenter(world?.name)).trim() ===
      selectedDataCenter,
  );

  return filteredWorlds.length > 0 ? filteredWorlds : [...worldList];
}

export function resolveSalesPeriod(periodKey) {
  const key = String(periodKey ?? '').trim().toLowerCase();

  return SALES_PERIOD_BY_KEY.get(key) ?? SALES_PERIOD_BY_KEY.get(DEFAULT_SALES_PERIOD);
}

export function parseSalesPeriodList(value) {
  if (!value) return cloneSalesPeriods();

  const uniquePeriods = new Map();
  String(value)
    .split(/[\s,]+/)
    .map((periodKey) => SALES_PERIOD_BY_KEY.get(periodKey.trim().toLowerCase()))
    .filter(Boolean)
    .forEach((period) => uniquePeriods.set(period.key, { ...period }));

  return uniquePeriods.size > 0 ? [...uniquePeriods.values()] : cloneSalesPeriods();
}

export function parseWorldList(value) {
  if (!value) return [...DEFAULT_WORLDS];

  const worlds = String(value)
    .split(/[\n,]+/)
    .map((world) => world.trim())
    .filter(Boolean);

  return [...new Set(worlds)];
}

export function createWorldIndex({
  worlds,
  defaultWorld = DEFAULT_WORLD,
  periods = SALES_PERIODS,
  defaultPeriod = DEFAULT_SALES_PERIOD,
  rankings = {},
  generatedAt = new Date(),
}) {
  const normalizedPeriods = normalizePeriods(periods);
  const normalizedDefaultPeriod = normalizedPeriods.some((period) => period.key === defaultPeriod)
    ? defaultPeriod
    : DEFAULT_SALES_PERIOD;

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    defaultWorld,
    defaultPeriod: normalizedDefaultPeriod,
    periods: normalizedPeriods,
    rankings: normalizeWorldRankings(rankings),
    worlds: worlds.map((world) => ({
      name: world,
      path: buildWorldSnapshotPath(world),
      dataCenter: resolveWorldDataCenter(world),
      periods: createPeriodPathMap(world, normalizedPeriods),
    })),
  };
}

export function createWorldRankings(snapshots) {
  const rankings = {};
  const snapshotList = Array.isArray(snapshots) ? snapshots : [];

  for (const snapshot of snapshotList) {
    const world = String(snapshot?.query?.server ?? '').trim();
    if (!world) continue;

    const period = resolveSalesPeriod(snapshot?.query?.periodKey);
    const summary = snapshot?.summary ?? {};
    const topItem = summary.topItem ?? {};
    const topItemNameJa = String(
      topItem.nameJa ?? topItem.names?.ja ?? topItem.name ?? topItem.nameEn ?? '',
    );
    const topItemNameEn = String(
      topItem.nameEn ?? topItem.names?.en ?? topItem.name ?? topItem.nameJa ?? '',
    );
    const dataCenter = resolveWorldDataCenter(world);
    const row = {
      name: world,
      dataCenter,
      region: resolveDataCenterRegion(dataCenter),
      periodKey: period.key,
      path: buildWorldPeriodSnapshotPath(world, period.key),
      totalMarketValue: normalizeRankingNumber(summary.totalMarketValue),
      totalQuantitySold: normalizeRankingNumber(summary.totalQuantitySold),
      itemCount: normalizeRankingNumber(summary.itemCount),
      topItemId: String(topItem.itemId ?? ''),
      topItemName: String(topItem.name ?? topItemNameJa ?? topItemNameEn ?? ''),
      topItemNameJa,
      topItemNameEn,
    };

    rankings[period.key] ??= [];
    rankings[period.key].push(row);
  }

  return normalizeWorldRankings(rankings);
}

export function resolveDefaultWorld(worlds, requestedWorld = DEFAULT_WORLD) {
  const requested = String(requestedWorld ?? '').trim();
  const availableWorlds = Array.isArray(worlds) ? worlds : [];

  if (requested && availableWorlds.includes(requested)) {
    return requested;
  }

  if (availableWorlds.includes(DEFAULT_WORLD)) {
    return DEFAULT_WORLD;
  }

  return availableWorlds[0] ?? DEFAULT_WORLD;
}

export function normalizeWorldIndex(index, fallbackPath = 'data/marketshare.json') {
  const periods = normalizePeriods(index?.periods);
  const defaultPeriod =
    index?.defaultPeriod && periods.some((period) => period.key === index.defaultPeriod)
      ? index.defaultPeriod
      : DEFAULT_SALES_PERIOD;
  const worlds = Array.isArray(index?.worlds)
    ? index.worlds.filter((world) => world?.name && world?.path)
      .map((world) => ({
        ...world,
        dataCenter: world.dataCenter ?? resolveWorldDataCenter(world.name),
        periods: normalizeWorldPeriodPaths(world, periods),
      }))
    : [];

  if (worlds.length === 0) {
    const fallbackWorld = {
      name: DEFAULT_WORLD,
      path: fallbackPath,
      dataCenter: resolveWorldDataCenter(DEFAULT_WORLD),
    };

    return {
      generatedAt: null,
      defaultWorld: DEFAULT_WORLD,
      defaultPeriod,
      periods,
      rankings: {},
      worlds: [{ ...fallbackWorld, periods: normalizeWorldPeriodPaths(fallbackWorld, periods) }],
    };
  }

  return {
    generatedAt: index.generatedAt ?? null,
    defaultWorld: index.defaultWorld ?? worlds[0].name,
    defaultPeriod,
    periods,
    rankings: normalizeWorldRankings(index.rankings),
    worlds,
  };
}

function normalizePeriods(periods) {
  const sourcePeriods = Array.isArray(periods) && periods.length > 0 ? periods : SALES_PERIODS;
  const normalized = new Map();

  sourcePeriods
    .map((period) => SALES_PERIOD_BY_KEY.get(String(period?.key ?? '').trim().toLowerCase()))
    .filter(Boolean)
    .forEach((period) => normalized.set(period.key, { ...period }));

  return normalized.size > 0 ? [...normalized.values()] : cloneSalesPeriods();
}

function createPeriodPathMap(world, periods) {
  return Object.fromEntries(
    periods.map((period) => [period.key, buildWorldPeriodSnapshotPath(world, period.key)]),
  );
}

function normalizeWorldPeriodPaths(world, periods) {
  const providedPeriods =
    world?.periods && typeof world.periods === 'object' ? world.periods : {};

  return Object.fromEntries(
    periods.map((period) => [
      period.key,
      providedPeriods[period.key] ??
        (period.key === DEFAULT_SALES_PERIOD
          ? world.path
          : world.path),
    ]),
  );
}

function normalizeWorldRankings(rankings) {
  if (!rankings || typeof rankings !== 'object') return {};

  return Object.fromEntries(
    Object.entries(rankings)
      .map(([periodKey, rows]) => [
        resolveSalesPeriod(periodKey).key,
        normalizeRankingRows(rows),
      ])
      .filter(([, rows]) => rows.length > 0),
  );
}

function normalizeRankingRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row?.name)
    .map((row) => {
      const name = String(row.name).trim();
      const dataCenter = row.dataCenter ?? resolveWorldDataCenter(name);

      const topItemName = String(row.topItemName ?? '');

      return {
        name,
        dataCenter,
        region: row.region ?? resolveDataCenterRegion(dataCenter),
        periodKey: resolveSalesPeriod(row.periodKey).key,
        path: row.path ?? buildWorldPeriodSnapshotPath(name, row.periodKey),
        totalMarketValue: normalizeRankingNumber(row.totalMarketValue),
        totalQuantitySold: normalizeRankingNumber(row.totalQuantitySold),
        itemCount: normalizeRankingNumber(row.itemCount),
        topItemId: String(row.topItemId ?? ''),
        topItemName,
        topItemNameJa: String(row.topItemNameJa ?? topItemName),
        topItemNameEn: String(row.topItemNameEn ?? topItemName),
      };
    })
    .sort((a, b) => {
      const valueDifference = b.totalMarketValue - a.totalMarketValue;
      if (valueDifference !== 0) return valueDifference;

      return a.name.localeCompare(b.name);
    });
}

function normalizeRankingNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? Math.round(number) : 0;
}

function cloneSalesPeriods() {
  return SALES_PERIODS.map((period) => ({ ...period }));
}

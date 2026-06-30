export const DEFAULT_WORLD = 'Hades';
export const DEFAULT_SALES_PERIOD = '7d';

export const SALES_PERIODS = [
  { key: '1d', label: '1日', hours: 24 },
  { key: '3d', label: '3日', hours: 72 },
  { key: '7d', label: '7日', hours: 168 },
  { key: '30d', label: '1か月', hours: 720 },
];

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

export const DEFAULT_WORLDS = WORLD_DATA_CENTERS.flatMap((dataCenter) => dataCenter.worlds);

const WORLD_DATA_CENTER_BY_NAME = new Map(
  WORLD_DATA_CENTERS.flatMap((dataCenter) =>
    dataCenter.worlds.map((world) => [world.toLowerCase(), dataCenter.name]),
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

export function listDataCentersForWorlds(worlds) {
  const worldList = Array.isArray(worlds) ? worlds : [];
  const availableDataCenters = new Set(
    worldList
      .map((world) =>
        String(world?.dataCenter ?? resolveWorldDataCenter(world?.name))
          .trim(),
      )
      .filter(Boolean),
  );
  const officialOrder = WORLD_DATA_CENTERS
    .map((dataCenter) => dataCenter.name)
    .filter((dataCenter) => availableDataCenters.has(dataCenter));
  const extras = [...availableDataCenters]
    .filter((dataCenter) => !officialOrder.includes(dataCenter))
    .sort((a, b) => a.localeCompare(b));

  return [...officialOrder, ...extras];
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

  return SALES_PERIODS.find((period) => period.key === key) ??
    SALES_PERIODS.find((period) => period.key === DEFAULT_SALES_PERIOD);
}

export function parseSalesPeriodList(value) {
  if (!value) return SALES_PERIODS.map((period) => ({ ...period }));

  const periods = String(value)
    .split(/[\s,]+/)
    .map(resolveSalesPeriod)
    .filter(Boolean);
  const uniquePeriods = new Map(periods.map((period) => [period.key, { ...period }]));

  return [...uniquePeriods.values()];
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
    worlds: worlds.map((world) => ({
      name: world,
      path: buildWorldSnapshotPath(world),
      dataCenter: resolveWorldDataCenter(world),
      periods: createPeriodPathMap(world, normalizedPeriods),
    })),
  };
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
      worlds: [{ ...fallbackWorld, periods: normalizeWorldPeriodPaths(fallbackWorld, periods) }],
    };
  }

  return {
    generatedAt: index.generatedAt ?? null,
    defaultWorld: index.defaultWorld ?? worlds[0].name,
    defaultPeriod,
    periods,
    worlds,
  };
}

function normalizePeriods(periods) {
  const sourcePeriods = Array.isArray(periods) && periods.length > 0 ? periods : SALES_PERIODS;
  const normalized = sourcePeriods
    .map((period) => ({
      key: String(period?.key ?? '').trim(),
      label: String(period?.label ?? '').trim(),
      hours: Number(period?.hours),
    }))
    .filter((period) => period.key && period.label && Number.isInteger(period.hours));

  return normalized.length > 0
    ? normalized
    : SALES_PERIODS.map((period) => ({ ...period }));
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

export const DEFAULT_WORLD = 'Carbuncle';

export const DEFAULT_WORLDS = [
  'Aegis',
  'Atomos',
  'Carbuncle',
  'Garuda',
  'Gungnir',
  'Kujata',
  'Tonberry',
  'Typhon',
  'Alexander',
  'Bahamut',
  'Durandal',
  'Fenrir',
  'Ifrit',
  'Ridill',
  'Tiamat',
  'Ultima',
  'Anima',
  'Asura',
  'Chocobo',
  'Hades',
  'Ixion',
  'Masamune',
  'Pandaemonium',
  'Titan',
  'Belias',
  'Mandragora',
  'Ramuh',
  'Shinryu',
  'Unicorn',
  'Valefor',
  'Yojimbo',
  'Zeromus',
];

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
  generatedAt = new Date(),
}) {
  return {
    generatedAt: new Date(generatedAt).toISOString(),
    defaultWorld,
    worlds: worlds.map((world) => ({
      name: world,
      path: buildWorldSnapshotPath(world),
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
  const worlds = Array.isArray(index?.worlds)
    ? index.worlds.filter((world) => world?.name && world?.path)
    : [];

  if (worlds.length === 0) {
    return {
      generatedAt: null,
      defaultWorld: DEFAULT_WORLD,
      worlds: [{ name: DEFAULT_WORLD, path: fallbackPath }],
    };
  }

  return {
    generatedAt: index.generatedAt ?? null,
    defaultWorld: index.defaultWorld ?? worlds[0].name,
    worlds,
  };
}

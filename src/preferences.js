export const WORLD_COOKIE_NAME = 'ff14gils_world';
export const WORLD_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function readCookieValue(cookieString, name) {
  const targetName = `${encodeURIComponent(name)}=`;
  const cookies = String(cookieString ?? '').split(';');

  for (const cookie of cookies) {
    const entry = cookie.trim();
    if (!entry.startsWith(targetName)) continue;

    return decodeURIComponent(entry.slice(targetName.length));
  }

  return '';
}

export function resolvePreferredWorld(worldIndex, cookieString = '') {
  const worlds = Array.isArray(worldIndex?.worlds) ? worldIndex.worlds : [];
  const availableWorlds = new Set(worlds.map((world) => world.name));
  const savedWorld = readCookieValue(cookieString, WORLD_COOKIE_NAME);

  if (savedWorld && availableWorlds.has(savedWorld)) {
    return savedWorld;
  }

  if (worldIndex?.defaultWorld && availableWorlds.has(worldIndex.defaultWorld)) {
    return worldIndex.defaultWorld;
  }

  return worlds[0]?.name ?? '';
}

export function buildWorldPreferenceCookie(world) {
  return [
    `${WORLD_COOKIE_NAME}=${encodeURIComponent(String(world ?? ''))}`,
    `Max-Age=${WORLD_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ');
}

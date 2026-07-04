import {
  filterMarketshareItems,
  formatGil,
  formatNumber,
  stateLabel,
} from './marketshare.js';
import {
  buildLanguagePreferenceCookie,
  formatUpdatedAtDate,
  periodLabel,
  recommendationLabel,
  resolvePreferredLanguage,
  selectItemAlternateName,
  selectItemDisplayName,
  translate,
} from './i18n.js';
import {
  buildWorldPreferenceCookie,
  resolvePreferredWorld,
} from './preferences.js';
import {
  filterWorldsByDataCenter,
  listDataCenterGroupsForWorlds,
  listDataCentersForWorlds,
  normalizeWorldIndex,
  resolveDataCenterRegion,
} from './worlds.js';

const DEFAULT_DATA_PATH = 'data/marketshare.json';
const WORLD_INDEX_PATH = 'data/worlds.json';
const MAX_VISIBLE_ROWS = 80;
const MAX_VISIBLE_WORLD_RANKS = 12;
const PAGE_ROUTES = new Set(['market', 'ranking', 'legal']);
const PAGE_PATHS = {
  legal: 'legal',
  market: '',
  ranking: 'ranking',
};
const ROUTE_ABSOLUTE_URLS = {
  legal: 'https://jinwktk.github.io/FF14Gils/legal/',
  market: 'https://jinwktk.github.io/FF14Gils/',
  ranking: 'https://jinwktk.github.io/FF14Gils/ranking/',
};
const ROUTE_SESSION_KEY = 'ff14gils_route';
const APP_BASE_PATH = resolveAppBasePath();
const KOFI_WIDGET_SCRIPT_URL = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
const KOFI_WIDGET_POSITION_CSS = `
  .floatingchat-container-wrap,
  .floatingchat-container {
    position: fixed !important;
    left: auto !important;
    right: 18px !important;
    bottom: 18px !important;
    z-index: 30 !important;
    width: 88px !important;
    height: 56px !important;
    max-width: calc(100vw - 28px) !important;
    border-radius: 999px !important;
    overflow: hidden !important;
    transform-origin: right bottom;
  }

  .floatingchat-container-wrap [class*="donateButton"],
  .floatingchat-container [class*="donateButton"],
  .floatingchat-container-wrap-mobi [class*="donateButton"] {
    min-height: 44px !important;
    border: 1px solid rgba(255, 224, 149, 0.42) !important;
    border-radius: 7px !important;
    background: var(--gold) !important;
    color: #111114 !important;
    box-shadow: 0 12px 28px rgba(244, 189, 80, 0.18) !important;
    font-family: inherit !important;
    font-weight: 900 !important;
    letter-spacing: 0 !important;
  }

  .floatingchat-container-wrap [class*="donateButton"]:hover,
  .floatingchat-container [class*="donateButton"]:hover,
  .floatingchat-container-wrap-mobi [class*="donateButton"]:hover {
    background: #ffd46e !important;
  }

  .floatingchat-container-wrap [class*="donateButton"] img,
  .floatingchat-container [class*="donateButton"] img,
  .floatingchat-container-wrap-mobi [class*="donateButton"] img {
    width: 22px !important;
    height: 22px !important;
    border-radius: 6px !important;
  }

  .floatingchat-container-wrap-mobi {
    left: auto !important;
    right: 18px !important;
    bottom: 18px !important;
    width: 88px !important;
    height: 56px !important;
    border-radius: 999px !important;
    overflow: hidden !important;
    transform-origin: right bottom;
  }

  .floatingchat-container-mobi {
    width: 88px !important;
    height: 56px !important;
  }

  .floating-chat-kofi-popup-iframe,
  .floating-chat-kofi-popup-iframe-mobi,
  .floatingchat-container-wrap iframe {
    left: auto !important;
    right: 18px !important;
    bottom: 86px !important;
    max-width: calc(100vw - 28px) !important;
  }

  @media (max-width: 620px) {
    body {
      --kofi-mobile-right: max(10px, calc(100vw - 390px));
    }

    .floatingchat-container-wrap,
    .floatingchat-container,
    .floatingchat-container-wrap-mobi {
      left: auto !important;
      right: var(--kofi-mobile-right) !important;
      bottom: 10px !important;
      transform: scale(0.86);
    }

    .floating-chat-kofi-popup-iframe,
    .floating-chat-kofi-popup-iframe-mobi {
      left: auto !important;
      right: var(--kofi-mobile-right) !important;
      bottom: 74px !important;
    }

    .floatingchat-container-wrap .kofi-button-text,
    .floatingchat-container-wrap-mobi .kofi-button-text,
    .floatingchat-container .kofi-button-text,
    .floatingchat-container-wrap [class*="donateButton"] span,
    .floatingchat-container-wrap-mobi [class*="donateButton"] span,
    .floatingchat-container [class*="donateButton"] span {
      display: none !important;
    }
  }
`;

const elements = {
  error: document.querySelector('[data-error]'),
  languageSelect: document.querySelector('[data-language-select]'),
  minQuantitySold: document.querySelector('[data-min-quantity]'),
  minQuantityValue: document.querySelector('[data-min-quantity-value]'),
  navLinks: [...document.querySelectorAll('[data-nav-link]')],
  pages: [...document.querySelectorAll('[data-page]')],
  periodSelect: document.querySelector('[data-period-select]'),
  rankingPeriodSelect: document.querySelector('[data-ranking-period-select]'),
  resultCount: document.querySelector('[data-result-count]'),
  search: document.querySelector('[data-search]'),
  sortBy: document.querySelector('[data-sort-by]'),
  sortButtons: [...document.querySelectorAll('[data-sort-button]')],
  stateFilters: [...document.querySelectorAll('[data-state-filter]')],
  tableBody: document.querySelector('[data-results]'),
  updatedAt: document.querySelector('[data-updated-at]'),
  worldRankingBody: document.querySelector('[data-world-ranking]'),
  worldRankingUpdatedAt: document.querySelector('[data-world-ranking-updated-at]'),
  worldRankingPanel: document.querySelector('[data-world-ranking-panel]'),
  dcSelect: document.querySelector('[data-dc-select]'),
  worldSelect: document.querySelector('[data-world-select]'),
};

const state = {
  activePage: 'market',
  currentGeneratedAt: '',
  items: [],
  language: 'ja',
  snapshots: new Map(),
  sortBy: 'opportunityScore',
  sortDirection: 'desc',
  worldIndex: normalizeWorldIndex(null),
};
let kofiWidgetScheduled = false;

init();

async function init() {
  try {
    state.language = resolvePreferredLanguage(document.cookie, navigator.language);
    setError('');
    populateLanguageSelect();
    applyLanguage();
    state.worldIndex = await loadWorldIndex();
    populateDataCenterSelect();
    populateWorldSelect();
    populatePeriodSelect();
    bindControls();
    applyRouteFromLocation();
    await loadSelectedSnapshot();
  } catch (error) {
    setError(translate(state.language, 'ui.loadError', { message: error.message }));
  } finally {
    void scheduleKofiWidget();
  }
}

async function loadWorldIndex() {
  try {
    const response = await fetch(WORLD_INDEX_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return normalizeWorldIndex(await response.json(), DEFAULT_DATA_PATH);
  } catch {
    return normalizeWorldIndex(null, DEFAULT_DATA_PATH);
  }
}

async function loadSnapshot(path) {
  if (state.snapshots.has(path)) {
    return state.snapshots.get(path);
  }

  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const snapshot = await response.json();
  validateSnapshot(snapshot);
  state.snapshots.set(path, snapshot);
  return snapshot;
}

function bindControls() {
  window.addEventListener('popstate', applyRouteFromLocation);
  updateNavigationHrefs();

  for (const link of elements.navLinks) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigateToPage(link.dataset.navLink);
    });
  }

  elements.languageSelect.addEventListener('change', () => {
    state.language = elements.languageSelect.value;
    document.cookie = buildLanguagePreferenceCookie(state.language);
    const selectedDataCenter = elements.dcSelect.value;
    const selectedWorld = elements.worldSelect.value;
    applyLanguage();
    populateDataCenterSelect(selectedDataCenter);
    populateWorldSelect(selectedWorld);
    populatePeriodSelect(elements.periodSelect.value);
    renderUpdatedAt(state.currentGeneratedAt);
    render();
  });

  elements.dcSelect.addEventListener('change', () => {
    populateWorldSelect();
    document.cookie = buildWorldPreferenceCookie(elements.worldSelect.value);
    void loadSelectedSnapshot();
  });

  elements.worldSelect.addEventListener('change', () => {
    const dataCenter = resolveDataCenterForWorld(elements.worldSelect.value);
    if (dataCenter) {
      elements.dcSelect.value = dataCenter;
    }
    document.cookie = buildWorldPreferenceCookie(elements.worldSelect.value);
    void loadSelectedSnapshot();
  });
  elements.periodSelect.addEventListener('change', () => {
    syncSelectedPeriod(elements.periodSelect.value);
    void loadSelectedSnapshot();
  });
  elements.rankingPeriodSelect.addEventListener('change', () => {
    syncSelectedPeriod(elements.rankingPeriodSelect.value);
    void loadSelectedSnapshot();
  });
  elements.search.addEventListener('input', render);
  elements.sortBy.addEventListener('change', () => {
    state.sortBy = elements.sortBy.value;
    state.sortDirection = defaultSortDirection(state.sortBy);
    updateSortIndicators();
    render();
  });
  elements.minQuantitySold.addEventListener('input', () => {
    elements.minQuantityValue.textContent = elements.minQuantitySold.value;
    render();
  });

  for (const button of elements.sortButtons) {
    button.addEventListener('click', () => {
      const nextSortBy = button.dataset.sortButton;
      if (!nextSortBy) return;

      if (state.sortBy === nextSortBy) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = nextSortBy;
        state.sortDirection = defaultSortDirection(nextSortBy);
      }

      elements.sortBy.value = state.sortBy;
      updateSortIndicators();
      render();
    });
  }

  for (const checkbox of elements.stateFilters) {
    checkbox.addEventListener('change', render);
  }

  updateSortIndicators();
}

function updateNavigationHrefs() {
  for (const link of elements.navLinks) {
    link.href = buildPageUrl(link.dataset.navLink);
  }
}

function applyRouteFromLocation() {
  const pendingRoute = consumePendingRoute();
  const route = pendingRoute || routeFromPath(window.location.pathname);

  if (pendingRoute) {
    window.history.replaceState({}, '', buildPageUrl(route));
  }

  setActivePage(route);
}

function navigateToPage(page) {
  const route = PAGE_ROUTES.has(page) ? page : 'market';
  const url = buildPageUrl(route);

  if (window.location.pathname === url) {
    setActivePage(route);
    return;
  }

  window.history.pushState({}, '', url);
  setActivePage(route);
}

function setActivePage(page) {
  state.activePage = PAGE_ROUTES.has(page) ? page : 'market';

  for (const pageElement of elements.pages) {
    pageElement.hidden = pageElement.dataset.page !== state.activePage;
  }

  for (const link of elements.navLinks) {
    const isActive = link.dataset.navLink === state.activePage;

    link.dataset.active = String(isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }

  updateRouteMetadata();
}

function routeFromPath(pathname) {
  const relativePath = normalizeRoutePath(
    pathname.startsWith(APP_BASE_PATH)
      ? pathname.slice(APP_BASE_PATH.length)
      : pathname.replace(/^\/+/, ''),
  );

  return PAGE_ROUTES.has(relativePath) ? relativePath : 'market';
}

function buildPageUrl(page) {
  const route = PAGE_ROUTES.has(page) ? page : 'market';

  return `${APP_BASE_PATH}${PAGE_PATHS[route]}`;
}

function updateRouteMetadata() {
  const routeMeta = {
    url: ROUTE_ABSOLUTE_URLS[state.activePage] ?? ROUTE_ABSOLUTE_URLS.market,
  };

  setCanonicalHref(routeMeta.url);
  setMetaProperty('og:url', routeMeta.url);
}

function consumePendingRoute() {
  try {
    const storedRoute = window.sessionStorage.getItem(ROUTE_SESSION_KEY);
    window.sessionStorage.removeItem(ROUTE_SESSION_KEY);
    if (!storedRoute) return '';

    const route = normalizeRoutePath(storedRoute);
    return PAGE_ROUTES.has(route) ? route : '';
  } catch {
    return '';
  }
}

function normalizeRoutePath(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^legal\.html$/, 'legal')
    .replace(/^index\.html$/, '')
    || 'market';
}

function resolveAppBasePath() {
  const script = document.querySelector('script[type="module"][src$="src/app.js"]');
  const scriptSource = script?.src || script?.getAttribute('src') || 'src/app.js';
  const scriptUrl = new URL(scriptSource, window.location.href);
  const basePath = scriptUrl.pathname.replace(/src\/app\.js$/, '');

  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

async function loadSelectedSnapshot() {
  const option = state.worldIndex.worlds.find(
    (world) => world.name === elements.worldSelect.value,
  );
  const selectedPeriod = elements.periodSelect.value || state.worldIndex.defaultPeriod;
  const path = option?.periods?.[selectedPeriod] ?? option?.path ?? DEFAULT_DATA_PATH;

  try {
    elements.dcSelect.disabled = true;
    elements.worldSelect.disabled = true;
    elements.periodSelect.disabled = true;
    setError('');
    const snapshot = await loadSnapshot(path);
    state.items = snapshot.items ?? [];
    state.currentGeneratedAt = snapshot.generatedAt;
    renderUpdatedAt(snapshot.generatedAt);
    render();
  } catch (error) {
    setError(translate(state.language, 'ui.loadError', { message: error.message }));
  } finally {
    elements.dcSelect.disabled = false;
    elements.worldSelect.disabled = false;
    elements.periodSelect.disabled = false;
  }
}

function populateLanguageSelect() {
  elements.languageSelect.value = state.language;
}

function populateDataCenterSelect(selectedDataCenter = '') {
  const fragment = document.createDocumentFragment();
  const preferredWorld = resolvePreferredWorld(state.worldIndex, document.cookie);
  const preferredDataCenter = normalizeSelectedDataCenter(
    selectedDataCenter || resolveDataCenterForWorld(preferredWorld),
  );

  for (const group of listDataCenterGroupsForWorlds(state.worldIndex.worlds)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = formatDataCenterGroupLabel(group.key);

    for (const dataCenter of group.dataCenters) {
      const option = document.createElement('option');
      option.value = dataCenter;
      option.textContent = formatDataCenterLabel(dataCenter);
      option.selected = dataCenter === preferredDataCenter;
      optgroup.append(option);
    }

    fragment.append(optgroup);
  }

  elements.dcSelect.replaceChildren(fragment);
  elements.dcSelect.value = preferredDataCenter;
}

function populateWorldSelect(selectedWorld = '') {
  const fragment = document.createDocumentFragment();
  const selectedDataCenter = normalizeSelectedDataCenter(
    elements.dcSelect.value || resolveDataCenterForWorld(selectedWorld),
  );
  const worlds = filterWorldsByDataCenter(state.worldIndex.worlds, selectedDataCenter);
  const availableWorlds = new Set(worlds.map((world) => world.name));
  const preferredWorld =
    selectedWorld || resolvePreferredWorld(state.worldIndex, document.cookie);
  const selectedWorldName = availableWorlds.has(preferredWorld)
    ? preferredWorld
    : worlds[0]?.name ?? state.worldIndex.worlds[0]?.name ?? '';

  for (const world of worlds) {
    const option = document.createElement('option');
    option.value = world.name;
    option.textContent = world.name;
    option.selected = world.name === selectedWorldName;
    fragment.append(option);
  }

  elements.worldSelect.replaceChildren(fragment);
  elements.worldSelect.value = selectedWorldName;
}

function populatePeriodSelect(selectedPeriod = state.worldIndex.defaultPeriod) {
  replacePeriodOptions(elements.periodSelect, selectedPeriod);
  replacePeriodOptions(elements.rankingPeriodSelect, selectedPeriod);
}

function replacePeriodOptions(select, selectedPeriod) {
  const fragment = document.createDocumentFragment();

  for (const period of state.worldIndex.periods) {
    const option = document.createElement('option');
    option.value = period.key;
    option.textContent = periodLabel(period.key, state.language, period.label);
    option.selected = period.key === selectedPeriod;
    fragment.append(option);
  }

  select.replaceChildren(fragment);
  select.value = selectedPeriod;
}

function syncSelectedPeriod(selectedPeriod) {
  elements.periodSelect.value = selectedPeriod;
  elements.rankingPeriodSelect.value = selectedPeriod;
}

function render() {
  const selectedStates = elements.stateFilters
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  const filteredItems = filterMarketshareItems(state.items, {
    search: elements.search.value,
    states: selectedStates,
    minQuantitySold: elements.minQuantitySold.value,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
  });

  elements.resultCount.textContent = translate(state.language, 'results.count', {
    count: formatNumber(filteredItems.length, state.language),
  });
  renderWorldRanking();
  elements.tableBody.replaceChildren(
    ...filteredItems.slice(0, MAX_VISIBLE_ROWS).map(renderRow),
  );

  if (filteredItems.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty-state';
    cell.textContent = translate(state.language, 'ui.emptyState');
    row.append(cell);
    elements.tableBody.append(row);
  }
}

function renderWorldRanking() {
  const selectedPeriod = elements.periodSelect.value || state.worldIndex.defaultPeriod;
  const rankings = state.worldIndex.rankings?.[selectedPeriod] ?? [];
  const rows = rankings.slice(0, MAX_VISIBLE_WORLD_RANKS);

  elements.worldRankingPanel.hidden = rows.length === 0;
  elements.rankingPeriodSelect.value = selectedPeriod;
  renderRankingUpdatedAt(state.worldIndex.generatedAt);
  elements.worldRankingBody.replaceChildren(...rows.map(renderWorldRankingRow));
}

function renderWorldRankingRow(entry, index) {
  const row = document.createElement('tr');
  if (entry.name === elements.worldSelect.value) {
    row.dataset.current = 'true';
  }

  row.append(
    createCell(String(index + 1), 'rank'),
    createWorldRankingWorldCell(entry),
    createCell(formatWorldRegionLabel(entry.region, entry.dataCenter)),
    createCell(formatDataCenterLabel(entry.dataCenter)),
    createCell(formatGil(entry.totalMarketValue, state.language)),
    createCell(formatNumber(entry.totalQuantitySold, state.language)),
    createCell(formatNumber(entry.itemCount, state.language)),
    createCell(formatWorldRankingTopItem(entry)),
  );

  return row;
}

function formatWorldRankingTopItem(entry) {
  return selectItemDisplayName(
    {
      name: entry.topItemName,
      nameJa: entry.topItemNameJa,
      nameEn: entry.topItemNameEn,
    },
    state.language,
  ) || '-';
}

function createWorldRankingWorldCell(entry) {
  const cell = document.createElement('td');
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'world-ranking-button';
  button.textContent = entry.name;
  button.addEventListener('click', () => {
    elements.dcSelect.value = entry.dataCenter;
    populateWorldSelect(entry.name);
    document.cookie = buildWorldPreferenceCookie(entry.name);
    navigateToPage('market');
    void loadSelectedSnapshot();
  });

  cell.append(button);
  return cell;
}

function renderUpdatedAt(value) {
  const text = formatUpdatedAtDate(value, state.language);

  elements.updatedAt.textContent = text
    ? translate(state.language, 'ui.updatedAt', { datetime: text })
    : translate(state.language, 'ui.updatedAtUnknown');
}

function renderRankingUpdatedAt(value) {
  const text = formatUpdatedAtDate(value, state.language);

  elements.worldRankingUpdatedAt.textContent = text
    ? translate(state.language, 'ui.updatedAt', { datetime: text })
    : translate(state.language, 'ui.updatedAtUnknown');
}

function resolveDataCenterForWorld(worldName) {
  return state.worldIndex.worlds.find((world) => world.name === worldName)?.dataCenter ?? '';
}

function normalizeSelectedDataCenter(dataCenter) {
  const dataCenters = listDataCentersForWorlds(state.worldIndex.worlds);

  return dataCenters.includes(dataCenter) ? dataCenter : dataCenters[0] ?? '';
}

function formatDataCenterLabel(dataCenter) {
  const otherDataCenter = translate(state.language, 'ui.otherDataCenter');

  return dataCenter === 'その他' ? otherDataCenter : dataCenter;
}

function formatDataCenterGroupLabel(regionKey) {
  return translate(state.language, `dataCenterRegions.${regionKey}`);
}

function formatWorldRegionLabel(regionKey, dataCenter) {
  return formatDataCenterGroupLabel(regionKey || resolveDataCenterRegion(dataCenter));
}

function renderRow(item, index) {
  const row = document.createElement('tr');
  const itemRecommendationLabel = recommendationLabel(
    item.recommendationLevel,
    state.language,
  );
  const percentChange = Number.isFinite(item.percentChange)
    ? item.percentChange.toFixed(2)
    : '0.00';

  row.append(
    createCell(String(index + 1), 'rank'),
    createItemCell(item),
    createCell(formatGil(item.marketValue, state.language)),
    createCell(formatGil(item.avg, state.language)),
    createCell(formatGil(item.minPrice, state.language)),
    createCell(formatNumber(item.quantitySold, state.language)),
    createCell(`${percentChange}%`, item.percentChange >= 0 ? 'positive' : 'negative'),
    createStateCell(item, itemRecommendationLabel),
  );

  return row;
}

function createCell(text, className = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;

  return cell;
}

function createItemCell(item) {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = safeUniversalisUrl(item.url);
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = selectItemDisplayName(item, state.language);

  const alternateName = selectItemAlternateName(item, state.language);
  if (alternateName) {
    link.title = alternateName;
  }

  const id = document.createElement('span');
  id.className = 'item-id';
  id.textContent = `#${item.itemId}`;

  cell.append(link, id);
  return cell;
}

function createStateCell(item, recommendationLabel) {
  const cell = document.createElement('td');
  const statePill = document.createElement('span');
  statePill.classList.add('state-pill', `state-${sanitizeClassName(item.state)}`);
  statePill.textContent = stateLabel(item.state, state.language);

  const recommendation = document.createElement('span');
  recommendation.className = 'recommendation';
  recommendation.textContent = recommendationLabel;

  cell.append(statePill, recommendation);
  return cell;
}

function validateSnapshot(snapshot) {
  const requiredKeys = ['generatedAt', 'source', 'query', 'summary', 'items'];
  const missingKeys = requiredKeys.filter((key) => !(key in snapshot));

  if (missingKeys.length > 0) {
    throw new Error(
      translate(state.language, 'ui.missingContract', {
        keys: missingKeys.join(', '),
      }),
    );
  }

  if (!Array.isArray(snapshot.items)) {
    throw new Error(translate(state.language, 'ui.itemsNotArray'));
  }
}

function setError(message) {
  elements.error.hidden = !message;
  elements.error.textContent = message;
}

function updateSortIndicators() {
  for (const button of elements.sortButtons) {
    const header = button.closest('th');
    const indicator = button.querySelector('.sort-indicator');
    const isActive = button.dataset.sortButton === state.sortBy;
    const ariaSort = isActive
      ? state.sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';

    header?.setAttribute('aria-sort', ariaSort);
    button.dataset.active = String(isActive);
    button.dataset.direction = isActive ? state.sortDirection : 'none';
    if (indicator) {
      indicator.textContent = isActive
        ? state.sortDirection === 'asc'
          ? '↑'
          : '↓'
        : '↕';
    }
  }
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.title = translate(state.language, 'meta.title');
  setMetaContent('description', translate(state.language, 'meta.description'));
  setMetaContent('twitter:title', translate(state.language, 'meta.title'));
  setMetaContent('twitter:description', translate(state.language, 'meta.description'));
  setMetaProperty('og:locale', translate(state.language, 'meta.locale'));
  setMetaProperty('og:title', translate(state.language, 'meta.title'));
  setMetaProperty('og:description', translate(state.language, 'meta.ogDescription'));
  setMetaProperty('og:image:alt', translate(state.language, 'meta.imageAlt'));
  updateJsonLdLanguage();

  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = translate(state.language, element.dataset.i18n);
  }

  for (const element of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':');
      if (attribute && key) {
        element.setAttribute(attribute, translate(state.language, key));
      }
    }
  }
}

function setMetaContent(name, content) {
  document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', content);
}

function setMetaProperty(property, content) {
  document.querySelector(`meta[property="${property}"]`)?.setAttribute('content', content);
}

function setCanonicalHref(href) {
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', href);
}

function updateJsonLdLanguage() {
  const script = document.querySelector('script[type="application/ld+json"]');
  if (!script) return;

  try {
    const data = JSON.parse(script.textContent);
    data.description = translate(state.language, 'meta.description');
    data.inLanguage = translate(state.language, 'meta.inLanguage');
    script.textContent = `${JSON.stringify(data, null, 2)}\n`;
  } catch {
    // Keep the static JSON-LD if a browser extension or manual edit breaks parsing.
  }
}

function installKofiWidgetStyles() {
  const style = document.getElementById('kofi-widget-position-style') ?? document.createElement('style');
  style.id = 'kofi-widget-position-style';
  style.textContent = KOFI_WIDGET_POSITION_CSS;
  document.head.append(style);
}

function drawKofiWidget() {
  try {
    window.kofiWidgetOverlay?.draw?.('jinnymeia', {
      'type': 'floating-chat',
      'floating-chat.donateButton.text': ' ',
      'floating-chat.donateButton.background-color': '#f4bd50',
      'floating-chat.donateButton.text-color': '#111114',
    });
  } catch {
    // Keep the support widget isolated from the market dashboard.
  } finally {
    window.setTimeout(installKofiWidgetStyles, 0);
  }
}

function scheduleKofiWidget() {
  if (kofiWidgetScheduled || document.querySelector(`script[src="${KOFI_WIDGET_SCRIPT_URL}"]`)) return;
  kofiWidgetScheduled = true;
  installKofiWidgetStyles();

  const loadScript = () => {
    const script = document.createElement('script');
    script.src = KOFI_WIDGET_SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', drawKofiWidget, { once: true });
    script.addEventListener('error', installKofiWidgetStyles, { once: true });
    document.body.append(script);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadScript, { timeout: 1200 });
    return;
  }

  window.setTimeout(loadScript, 160);
}

function defaultSortDirection(sortBy) {
  return ['name', 'state'].includes(sortBy) ? 'asc' : 'desc';
}

function safeUniversalisUrl(value) {
  const text = String(value);
  if (!/^https:\/\/universalis\.app\/market\/\d+$/.test(text)) {
    return '#';
  }

  return text;
}

function sanitizeClassName(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(' ', '-')
    .replace(/[^a-z0-9_-]/g, '');
}

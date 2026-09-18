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
import {
  ROUTE_NAMES,
  buildPagePath,
  getRouteDefinition,
} from './routes.js';
import { createRouteCoordinator } from './route-coordinator.js';
import { createResourceCoordinator } from './resource-coordinator.js';
import {
  ERIONES_ICON_URL,
  buildErionesSearchUrl,
  buildLodestoneItemUrl,
  loadLodestoneItemMap,
  loadOfficialTooltipScript,
} from './item-links.js';

const DEFAULT_DATA_PATH = 'data/marketshare.json';
const WORLD_INDEX_PATH = 'data/worlds.json';
const INITIAL_VISIBLE_ROWS = 24;
const ROWS_PER_PAGE = 24;
const MAX_VISIBLE_WORLD_RANKS = 12;
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
  filterFields: document.querySelector('[data-filter-fields]'),
  filterSummary: document.querySelector('[data-filter-summary]'),
  filterToggle: document.querySelector('[data-filter-toggle]'),
  filterToggleLabel: document.querySelector('[data-filter-toggle-label]'),
  error: document.querySelector('[data-error]'),
  heroEyebrow: document.querySelector('[data-route-hero-eyebrow]'),
  heroLead: document.querySelector('[data-route-hero-lead]'),
  heroTitle: document.querySelector('[data-route-hero-title]'),
  languageSelect: document.querySelector('[data-language-select]'),
  loadMore: document.querySelector('[data-load-more]'),
  minQuantitySold: document.querySelector('[data-min-quantity]'),
  minQuantityValue: document.querySelector('[data-min-quantity-value]'),
  navLinks: [...document.querySelectorAll('[data-nav-link]')],
  pages: [...document.querySelectorAll('[data-page]')],
  periodSelect: document.querySelector('[data-period-select]'),
  rankingPeriodSelect: document.querySelector('[data-ranking-period-select]'),
  resultsPanel: document.querySelector('[data-results-panel]'),
  resultsStatus: document.querySelector('[data-results-status]'),
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
  visibleRowLimit: INITIAL_VISIBLE_ROWS,
  worldIndex: normalizeWorldIndex(null),
  worldIndexReady: false,
};
let kofiWidgetScheduled = false;
let kofiWidgetFrameObserver = null;
let observedKofiWidgetOverlay = null;
let filterDisclosureTouched = false;
let itemLinksLoading = false;
let lodestoneItemMap = null;

const resourceCoordinator = createResourceCoordinator(loadJsonResource);
const routeCoordinator = createRouteCoordinator({
  basePath: APP_BASE_PATH,
  getPathname: () => window.location.pathname,
  history: window.history,
  beforeHistoryChange: (route) => {
    updateRouteMetadata(route);
  },
  onRoute: (route, source) => {
    void activateRoute(route, source);
  },
});

init();

function init() {
  try {
    freezeDocumentIconUrls();
    state.language = resolvePreferredLanguage(document.cookie, navigator.language);
    setError('');
    populateLanguageSelect();
    bindControls();
    initializeFilterDisclosure();

    const pendingRoute = consumePendingRoute();
    if (pendingRoute) {
      window.history.replaceState({}, '', buildPagePath(pendingRoute, APP_BASE_PATH));
    }

    routeCoordinator.initialize();
    applyLanguage();
  } catch (error) {
    setError(translate(state.language, 'ui.loadError', { message: error.message }));
  } finally {
    void scheduleKofiWidget();
  }
}

function freezeDocumentIconUrls() {
  for (const link of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
    link.href = link.href;
  }
}

async function loadJsonResource(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function ensureWorldIndex(token) {
  if (state.worldIndexReady) return true;

  const result = await resourceCoordinator.commit(
    token,
    resourceCoordinator.load(WORLD_INDEX_PATH),
    {
      onSuccess: (worldIndex) => applyWorldIndex(worldIndex),
      onError: () => applyWorldIndex(null),
    },
  );

  return result.applied && state.worldIndexReady;
}

function applyWorldIndex(worldIndex) {
  const selectedDataCenter = elements.dcSelect.value;
  const selectedWorld = elements.worldSelect.value;
  const selectedPeriod = state.worldIndexReady ? elements.periodSelect.value : '';

  state.worldIndex = normalizeWorldIndex(worldIndex, DEFAULT_DATA_PATH);
  state.worldIndexReady = true;
  populateDataCenterSelect(selectedDataCenter);
  populateWorldSelect(selectedWorld);
  populatePeriodSelect(selectedPeriod || state.worldIndex.defaultPeriod);
  updateFilterSummary();
}

async function loadSnapshot(path) {
  if (state.snapshots.has(path)) {
    return state.snapshots.get(path);
  }

  const snapshot = await resourceCoordinator.load(path);
  validateSnapshot(snapshot);
  state.snapshots.set(path, snapshot);
  return snapshot;
}

function bindControls() {
  window.addEventListener('popstate', routeCoordinator.handlePopState);
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
    if (state.worldIndexReady) {
      populateDataCenterSelect(selectedDataCenter);
      populateWorldSelect(selectedWorld);
      populatePeriodSelect(elements.periodSelect.value);
    }
    renderUpdatedAt(state.currentGeneratedAt);
    renderActivePage();
  });

  elements.dcSelect.addEventListener('change', () => {
    populateWorldSelect();
    document.cookie = buildWorldPreferenceCookie(elements.worldSelect.value);
    resetVisibleRows();
    updateFilterSummary();
    void loadSelectedSnapshot();
  });

  elements.worldSelect.addEventListener('change', () => {
    const dataCenter = resolveDataCenterForWorld(elements.worldSelect.value);
    if (dataCenter) {
      elements.dcSelect.value = dataCenter;
    }
    document.cookie = buildWorldPreferenceCookie(elements.worldSelect.value);
    resetVisibleRows();
    updateFilterSummary();
    void loadSelectedSnapshot();
  });
  elements.periodSelect.addEventListener('change', () => {
    syncSelectedPeriod(elements.periodSelect.value);
    resetVisibleRows();
    updateFilterSummary();
    void loadSelectedSnapshot();
  });
  elements.rankingPeriodSelect.addEventListener('change', () => {
    syncSelectedPeriod(elements.rankingPeriodSelect.value);
    renderWorldRanking();
  });
  elements.search.addEventListener('input', () => {
    resetVisibleRows();
    renderMarketResults();
  });
  elements.sortBy.addEventListener('change', () => {
    state.sortBy = elements.sortBy.value;
    state.sortDirection = defaultSortDirection(state.sortBy);
    resetVisibleRows();
    updateSortIndicators();
    renderMarketResults();
  });
  elements.minQuantitySold.addEventListener('input', () => {
    elements.minQuantityValue.textContent = elements.minQuantitySold.value;
    resetVisibleRows();
    renderMarketResults();
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
      resetVisibleRows();
      updateSortIndicators();
      renderMarketResults();
    });
  }

  for (const checkbox of elements.stateFilters) {
    checkbox.addEventListener('change', () => {
      resetVisibleRows();
      renderMarketResults();
    });
  }

  elements.loadMore?.addEventListener('click', showMoreResults);
  elements.filterToggle?.addEventListener('click', () => {
    filterDisclosureTouched = true;
    setFilterExpanded(elements.filterToggle.getAttribute('aria-expanded') !== 'true');
  });

  updateSortIndicators();
}

function initializeFilterDisclosure() {
  const mobileMedia = window.matchMedia('(max-width: 760px)');
  const syncDisclosure = () => {
    if (!mobileMedia.matches) {
      setFilterExpanded(true);
      return;
    }

    if (!filterDisclosureTouched) setFilterExpanded(false);
  };

  syncDisclosure();
  mobileMedia.addEventListener?.('change', syncDisclosure);
}

function setFilterExpanded(expanded) {
  if (!elements.filterToggle || !elements.filterFields) return;

  elements.filterToggle.setAttribute('aria-expanded', String(expanded));
  elements.filterFields.hidden = !expanded;
  elements.filterToggle.dataset.expanded = String(expanded);
  if (elements.filterToggleLabel) {
    elements.filterToggleLabel.textContent = translate(
      state.language,
      expanded ? 'ui.filterToggleCollapse' : 'ui.filterToggleExpand',
    );
  }
}

function updateNavigationHrefs() {
  for (const link of elements.navLinks) {
    link.href = buildPagePath(link.dataset.navLink, APP_BASE_PATH);
  }
}

function navigateToPage(page) {
  routeCoordinator.navigate(page);
}

function setActivePage(page) {
  state.activePage = ROUTE_NAMES.includes(page) ? page : 'market';

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

function updateRouteMetadata(route = state.activePage) {
  const routeDefinition = getRouteDefinition(route, state.language);

  document.title = routeDefinition.meta.title;
  setMetaContent('description', routeDefinition.meta.description);
  setMetaContent('twitter:title', routeDefinition.meta.title);
  setMetaContent('twitter:description', routeDefinition.meta.ogDescription);
  setMetaProperty('og:locale', routeDefinition.meta.locale);
  setMetaProperty('og:title', routeDefinition.meta.title);
  setMetaProperty('og:description', routeDefinition.meta.ogDescription);
  setCanonicalHref(routeDefinition.absoluteUrl);
  setMetaProperty('og:url', routeDefinition.absoluteUrl);
  setTextContentIfChanged(elements.heroEyebrow, routeDefinition.meta.heroEyebrow);
  setTextContentIfChanged(elements.heroTitle, routeDefinition.meta.heroTitle);
  setTextContentIfChanged(elements.heroLead, routeDefinition.meta.heroLead);
  updateJsonLd(routeDefinition);
}

function setTextContentIfChanged(element, value) {
  if (!element || element.textContent === value) return;
  element.textContent = value;
}

function consumePendingRoute() {
  try {
    const storedRoute = window.sessionStorage.getItem(ROUTE_SESSION_KEY);
    window.sessionStorage.removeItem(ROUTE_SESSION_KEY);
    if (!storedRoute) return '';

    const route = normalizeRoutePath(storedRoute);
    return ROUTE_NAMES.includes(route) ? route : '';
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

async function activateRoute(route, source = 'direct') {
  const routeToken = resourceCoordinator.beginRoute();
  const shouldQueueAnalyticsPageView = source !== 'direct' && state.activePage !== route;
  setActivePage(route);
  if (source === 'direct') {
    queueInitialGoogleAnalyticsPageView();
  } else if (shouldQueueAnalyticsPageView) {
    queuePendingGoogleAnalyticsPageView();
  }
  const routeDefinition = getRouteDefinition(route, state.language);

  if (!routeDefinition.resources.worldIndex) {
    setResultsLoading(false);
    return;
  }

  const worldIndexReady = await ensureWorldIndex(routeToken);
  if (!worldIndexReady || !resourceCoordinator.isCurrent(routeToken)) return;

  if (route === 'ranking') {
    renderWorldRanking();
    return;
  }

  if (routeDefinition.resources.snapshot) {
    await loadSelectedSnapshot();
  }
}

function queueInitialGoogleAnalyticsPageView() {
  window.ff14gilsAnalytics?.queueInitialPageView?.({
    page_location: window.location.href,
    page_referrer: document.referrer,
    page_title: document.title,
  });
}

function queuePendingGoogleAnalyticsPageView() {
  window.ff14gilsAnalytics?.queuePageView?.({
    page_location: window.location.href,
    page_title: document.title,
  });
}

async function loadSelectedSnapshot() {
  if (state.activePage !== 'market' || !state.worldIndexReady) return;

  const option = state.worldIndex.worlds.find(
    (world) => world.name === elements.worldSelect.value,
  );
  const selectedPeriod = elements.periodSelect.value || state.worldIndex.defaultPeriod;
  const path = option?.periods?.[selectedPeriod] ?? option?.path ?? DEFAULT_DATA_PATH;
  const selectionToken = resourceCoordinator.beginSelection();

  try {
    elements.dcSelect.disabled = true;
    elements.worldSelect.disabled = true;
    elements.periodSelect.disabled = true;
    setError('');
    setResultsLoading(true);
    await resourceCoordinator.commit(selectionToken, loadSnapshot(path), {
      onSuccess: (snapshot) => {
        state.items = snapshot.items ?? [];
        state.currentGeneratedAt = snapshot.generatedAt;
        resetVisibleRows();
        renderUpdatedAt(snapshot.generatedAt);
        renderMarketResults();
      },
      onError: handleSnapshotLoadError,
    });
  } finally {
    if (resourceCoordinator.isCurrent(selectionToken)) {
      elements.dcSelect.disabled = false;
      elements.worldSelect.disabled = false;
      elements.periodSelect.disabled = false;
      setResultsLoading(false);
    }
  }
}

function handleSnapshotLoadError(error) {
  state.items = [];
  state.currentGeneratedAt = '';
  resetVisibleRows();
  renderUpdatedAt('');
  renderMarketResults();
  setError(translate(state.language, 'ui.loadError', { message: error.message }));
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

function renderActivePage() {
  if (state.activePage === 'market') {
    renderMarketResults();
    return;
  }

  if (state.activePage === 'ranking') {
    renderWorldRanking();
  }
}

function resetVisibleRows() {
  state.visibleRowLimit = INITIAL_VISIBLE_ROWS;
}

function showMoreResults() {
  state.visibleRowLimit += ROWS_PER_PAGE;
  renderMarketResults();
}

function setResultsLoading(loading) {
  elements.resultsPanel?.setAttribute('aria-busy', String(loading));
  if (loading && elements.resultsStatus) {
    elements.resultsStatus.textContent = translate(state.language, 'ui.resultsTitle');
  }
}

function updateFilterSummary() {
  if (!elements.filterSummary) return;

  const world = elements.worldSelect.value || state.worldIndex.defaultWorld;
  const period = elements.periodSelect.value || state.worldIndex.defaultPeriod;
  elements.filterSummary.textContent = `${translate(state.language, 'ui.filterSummary')}: ${world} · ${periodLabel(period, state.language)}`;
}

function renderMarketResults() {
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

  elements.tableBody.replaceChildren(
    ...filteredItems.slice(0, state.visibleRowLimit).map(renderRow),
  );

  const visibleCount = Math.min(filteredItems.length, state.visibleRowLimit);
  if (elements.resultsStatus) {
    elements.resultsStatus.textContent = translate(state.language, 'results.showing', {
      total: formatNumber(filteredItems.length, state.language),
      visible: formatNumber(visibleCount, state.language),
    });
  }
  if (elements.loadMore) {
    elements.loadMore.hidden = visibleCount >= filteredItems.length;
    elements.loadMore.textContent = translate(state.language, 'results.loadMore', {
      count: formatNumber(
        Math.min(ROWS_PER_PAGE, filteredItems.length - visibleCount),
        state.language,
      ),
    });
  }

  if (filteredItems.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty-state';
    cell.textContent = translate(state.language, 'ui.emptyState');
    row.append(cell);
    elements.tableBody.append(row);
  }

  scheduleItemLinkEnhancements();
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
    createCell(String(index + 1), 'rank', 'ranking.rank'),
    createWorldRankingWorldCell(entry),
    createCell(formatWorldRegionLabel(entry.region, entry.dataCenter), '', 'ranking.region'),
    createCell(formatDataCenterLabel(entry.dataCenter), '', 'ranking.dataCenter'),
    createCell(formatGil(entry.totalMarketValue, state.language), '', 'ranking.sales'),
    createCell(formatNumber(entry.totalQuantitySold, state.language), '', 'ranking.sold'),
    createCell(formatNumber(entry.itemCount, state.language), '', 'ranking.items'),
    createCell(formatWorldRankingTopItem(entry), '', 'ranking.topItem'),
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
  cell.dataset.label = translate(state.language, 'ranking.world');
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'world-ranking-button';
  button.textContent = entry.name;
  button.addEventListener('click', () => {
    elements.dcSelect.value = entry.dataCenter;
    populateWorldSelect(entry.name);
    document.cookie = buildWorldPreferenceCookie(entry.name);
    navigateToPage('market');
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
    createCell(String(index + 1), 'rank', 'table.rank'),
    createItemCell(item),
    createCell(formatGil(item.marketValue, state.language), '', 'table.marketValue'),
    createCell(formatGil(item.avg, state.language), '', 'table.avg'),
    createCell(formatGil(item.minPrice, state.language), '', 'table.minPrice'),
    createCell(formatNumber(item.quantitySold, state.language), '', 'table.quantitySold'),
    createCell(
      `${percentChange}%`,
      item.percentChange >= 0 ? 'positive' : 'negative',
      'table.percentChange',
    ),
    createStateCell(item, itemRecommendationLabel),
  );

  return row;
}

function createCell(text, className = '', labelKey = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  if (labelKey) cell.dataset.label = translate(state.language, labelKey);
  cell.textContent = text;

  return cell;
}

function createItemCell(item) {
  const cell = document.createElement('td');
  cell.dataset.label = translate(state.language, 'table.item');
  const link = document.createElement('a');
  link.href = safeUniversalisUrl(item.url);
  link.className = 'item-market-link';
  link.dataset.itemId = String(item.itemId);
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = selectItemDisplayName(item, state.language);

  const alternateName = selectItemAlternateName(item, state.language);
  if (alternateName) {
    link.title = alternateName;
  }

  const linkRow = document.createElement('span');
  linkRow.className = 'item-link-row';
  linkRow.append(link);

  const erionesUrl = buildErionesSearchUrl(item, state.language);
  if (erionesUrl) {
    const erionesLink = document.createElement('a');
    const erionesLabel = translate(state.language, 'ui.erionesLinkLabel', {
      name: link.textContent,
    });
    const erionesIcon = document.createElement('img');
    erionesLink.href = erionesUrl;
    erionesLink.className = 'eriones-link';
    erionesLink.target = '_blank';
    erionesLink.rel = 'noreferrer';
    erionesLink.title = erionesLabel;
    erionesLink.setAttribute('aria-label', erionesLabel);
    erionesIcon.src = ERIONES_ICON_URL;
    erionesIcon.alt = '';
    erionesLink.append(erionesIcon);
    linkRow.append(erionesLink);
  }

  const id = document.createElement('span');
  id.className = 'item-id';
  id.textContent = `#${item.itemId}`;

  cell.append(linkRow, id);
  return cell;
}

function scheduleItemLinkEnhancements() {
  applyLodestoneTooltipAttributes();
  if (itemLinksLoading || !elements.tableBody.querySelector('.item-market-link')) return;

  itemLinksLoading = true;
  window.requestAnimationFrame(() => {
    const load = () => loadLodestoneItemMap().then((itemMap) => {
      lodestoneItemMap = itemMap;
      applyLodestoneTooltipAttributes();
      loadOfficialTooltipScript();
    }).catch(() => {});
    if (window.requestIdleCallback) window.requestIdleCallback(load, { timeout: 2000 });
    else window.setTimeout(load, 0);
  });
}

function applyLodestoneTooltipAttributes() {
  if (!lodestoneItemMap) return;

  for (const link of elements.tableBody.querySelectorAll('.item-market-link')) {
    const url = buildLodestoneItemUrl(link.dataset.itemId, lodestoneItemMap, state.language);
    if (!url) continue;
    link.classList.add('eorzeadb_link');
    link.dataset.ldstHref = url;
  }
}

function createStateCell(item, recommendationLabel) {
  const cell = document.createElement('td');
  cell.dataset.label = translate(state.language, 'table.state');
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
  setMetaProperty('og:image:alt', translate(state.language, 'meta.imageAlt'));

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

  updateRouteMetadata();
  updateFilterSummary();
  setFilterExpanded(elements.filterToggle?.getAttribute('aria-expanded') !== 'false');
  labelKofiWidgetFrames();
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

function updateJsonLd(routeDefinition) {
  const script = document.querySelector('script[type="application/ld+json"]');
  if (!script) return;

  try {
    const data = JSON.parse(script.textContent);
    data['@type'] = routeDefinition.meta.schemaType;
    data.name = routeDefinition.meta.schemaName;
    data.url = routeDefinition.absoluteUrl;
    data.description = routeDefinition.meta.description;
    data.inLanguage = routeDefinition.meta.inLanguage;
    if (routeDefinition.meta.schemaType === 'WebApplication') {
      data.applicationCategory = 'GameApplication';
      data.operatingSystem = 'Web';
    } else {
      delete data.applicationCategory;
      delete data.operatingSystem;
    }
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

function labelKofiWidgetFrames() {
  for (const frame of document.querySelectorAll('[id^="kofi-widget-overlay"] iframe')) {
    frame.title = translate(state.language, 'ui.kofiSupport');
  }
}

function observeKofiWidgetFrames() {
  const overlay = document.querySelector('[id^="kofi-widget-overlay"]');
  if (!overlay) return;

  labelKofiWidgetFrames();
  if (overlay === observedKofiWidgetOverlay || !('MutationObserver' in window)) return;

  kofiWidgetFrameObserver?.disconnect();
  observedKofiWidgetOverlay = overlay;
  kofiWidgetFrameObserver = new MutationObserver(labelKofiWidgetFrames);
  kofiWidgetFrameObserver.observe(overlay, { childList: true, subtree: true });
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
    window.setTimeout(observeKofiWidgetFrames, 0);
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

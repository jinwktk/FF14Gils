import {
  createMoneyFlowSummary,
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
} from './worlds.js';

const DEFAULT_DATA_PATH = 'data/marketshare.json';
const WORLD_INDEX_PATH = 'data/worlds.json';
const MAX_VISIBLE_ROWS = 80;
const MAX_VISIBLE_CHART_ITEMS = 8;

const elements = {
  chartPanel: document.querySelector('[data-chart-panel]'),
  error: document.querySelector('[data-error]'),
  languageSelect: document.querySelector('[data-language-select]'),
  minQuantitySold: document.querySelector('[data-min-quantity]'),
  minQuantityValue: document.querySelector('[data-min-quantity-value]'),
  moneyAverage: document.querySelector('[data-money-average]'),
  moneyItems: document.querySelector('[data-money-items]'),
  moneyQuantity: document.querySelector('[data-money-quantity]'),
  moneyTotal: document.querySelector('[data-money-total]'),
  periodSelect: document.querySelector('[data-period-select]'),
  priceChangeChart: document.querySelector('[data-price-change-chart]'),
  resultCount: document.querySelector('[data-result-count]'),
  salesChart: document.querySelector('[data-sales-chart]'),
  search: document.querySelector('[data-search]'),
  sortBy: document.querySelector('[data-sort-by]'),
  sortButtons: [...document.querySelectorAll('[data-sort-button]')],
  stateFilters: [...document.querySelectorAll('[data-state-filter]')],
  stateChart: document.querySelector('[data-state-chart]'),
  tableBody: document.querySelector('[data-results]'),
  tablePanel: document.querySelector('[data-table-panel]'),
  updatedAt: document.querySelector('[data-updated-at]'),
  viewTabs: [...document.querySelectorAll('[data-view-tab]')],
  dcSelect: document.querySelector('[data-dc-select]'),
  worldSelect: document.querySelector('[data-world-select]'),
};

const state = {
  activeView: 'table',
  currentGeneratedAt: '',
  items: [],
  language: 'ja',
  snapshots: new Map(),
  sortBy: 'opportunityScore',
  sortDirection: 'desc',
  worldIndex: normalizeWorldIndex(null),
};

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
    await loadSelectedSnapshot();
  } catch (error) {
    setError(translate(state.language, 'ui.loadError', { message: error.message }));
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
  for (const tab of elements.viewTabs) {
    tab.addEventListener('click', () => {
      setActiveView(tab.dataset.viewTab);
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
  setActiveView(state.activeView);
}

function setActiveView(view) {
  state.activeView = view === 'charts' ? 'charts' : 'table';
  elements.tablePanel.hidden = state.activeView !== 'table';
  elements.chartPanel.hidden = state.activeView !== 'charts';

  for (const tab of elements.viewTabs) {
    const isActive = tab.dataset.viewTab === state.activeView;

    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    tab.dataset.active = String(isActive);
  }
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
  const fragment = document.createDocumentFragment();

  for (const period of state.worldIndex.periods) {
    const option = document.createElement('option');
    option.value = period.key;
    option.textContent = periodLabel(period.key, state.language, period.label);
    option.selected = period.key === selectedPeriod;
    fragment.append(option);
  }

  elements.periodSelect.replaceChildren(fragment);
  elements.periodSelect.value = selectedPeriod;
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
  renderTable(filteredItems);
  renderCharts(filteredItems);
}

function renderTable(filteredItems) {
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

function renderCharts(filteredItems) {
  const summary = createMoneyFlowSummary(filteredItems, {
    limit: MAX_VISIBLE_CHART_ITEMS,
  });

  elements.moneyTotal.textContent = formatGil(summary.totalMarketValue, state.language);
  elements.moneyQuantity.textContent = formatNumber(
    summary.totalQuantitySold,
    state.language,
  );
  elements.moneyAverage.textContent = formatGil(
    summary.averageMarketValuePerItem,
    state.language,
  );
  elements.moneyItems.textContent = formatNumber(filteredItems.length, state.language);

  renderBarChart(
    elements.salesChart,
    summary.topSales.map((item) => ({
      label: selectItemDisplayName(item, state.language),
      value: item.marketValue,
      valueText: formatGil(item.marketValue, state.language),
    })),
  );
  renderBarChart(
    elements.stateChart,
    summary.salesByState.map((entry) => ({
      label: stateLabel(entry.state, state.language),
      value: entry.marketValue,
      valueText: formatGil(entry.marketValue, state.language),
      detailText: translate(state.language, 'results.count', {
        count: formatNumber(entry.itemCount, state.language),
      }),
    })),
  );
  renderBarChart(
    elements.priceChangeChart,
    summary.topPriceChanges.map((item) => ({
      label: selectItemDisplayName(item, state.language),
      value: item.percentChange,
      valueText: `${formatPercent(item.percentChange)}%`,
      detailText: formatGil(item.marketValue, state.language),
    })),
    { signed: true },
  );
}

function renderBarChart(container, rows, { signed = false } = {}) {
  container.replaceChildren();

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state chart-empty';
    empty.textContent = translate(state.language, 'chart.noData');
    container.append(empty);
    return;
  }

  const maxValue = Math.max(...rows.map((row) => Math.abs(Number(row.value) || 0)), 1);

  for (const row of rows) {
    const value = Number(row.value) || 0;
    const width = Math.max((Math.abs(value) / maxValue) * 100, 2);
    const item = document.createElement('div');
    const header = document.createElement('div');
    const label = document.createElement('span');
    const valueLabel = document.createElement('span');
    const track = document.createElement('div');
    const bar = document.createElement('span');

    item.className = 'bar-row';
    if (signed) {
      item.classList.add(value < 0 ? 'bar-row-negative' : 'bar-row-positive');
    }

    header.className = 'bar-row-header';
    label.className = 'bar-label';
    label.textContent = row.label;
    valueLabel.className = 'bar-value';
    valueLabel.textContent = row.valueText;

    track.className = 'bar-track';
    bar.className = 'bar-fill';
    bar.style.width = `${width}%`;

    header.append(label, valueLabel);
    track.append(bar);
    item.append(header, track);

    if (row.detailText) {
      const detail = document.createElement('span');
      detail.className = 'bar-detail';
      detail.textContent = row.detailText;
      item.append(detail);
    }

    container.append(item);
  }
}

function renderUpdatedAt(value) {
  const text = formatUpdatedAtDate(value, state.language);

  elements.updatedAt.textContent = text
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
  const state = document.createElement('span');
  state.classList.add('state-pill', `state-${sanitizeClassName(item.state)}`);
  state.textContent = stateLabel(item.state, state.language);

  const recommendation = document.createElement('span');
  recommendation.className = 'recommendation';
  recommendation.textContent = recommendationLabel;

  cell.append(state, recommendation);
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

function defaultSortDirection(sortBy) {
  return ['name', 'state'].includes(sortBy) ? 'asc' : 'desc';
}

function formatPercent(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
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

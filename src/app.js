import {
  filterMarketshareItems,
  formatGil,
  formatNumber,
  stateLabel,
} from './marketshare.js';
import {
  buildWorldPreferenceCookie,
  resolvePreferredWorld,
} from './preferences.js';
import { normalizeWorldIndex } from './worlds.js';

const DEFAULT_DATA_PATH = 'data/marketshare.json';
const WORLD_INDEX_PATH = 'data/worlds.json';
const MAX_VISIBLE_ROWS = 80;

const elements = {
  error: document.querySelector('[data-error]'),
  minQuantitySold: document.querySelector('[data-min-quantity]'),
  minQuantityValue: document.querySelector('[data-min-quantity-value]'),
  periodSelect: document.querySelector('[data-period-select]'),
  resultCount: document.querySelector('[data-result-count]'),
  search: document.querySelector('[data-search]'),
  sortBy: document.querySelector('[data-sort-by]'),
  sortButtons: [...document.querySelectorAll('[data-sort-button]')],
  stateFilters: [...document.querySelectorAll('[data-state-filter]')],
  tableBody: document.querySelector('[data-results]'),
  updatedAt: document.querySelector('[data-updated-at]'),
  worldSelect: document.querySelector('[data-world-select]'),
};

const state = {
  items: [],
  snapshots: new Map(),
  sortBy: 'opportunityScore',
  sortDirection: 'desc',
  worldIndex: normalizeWorldIndex(null),
};

init();

async function init() {
  try {
    setError('');
    state.worldIndex = await loadWorldIndex();
    populateWorldSelect();
    populatePeriodSelect();
    bindControls();
    await loadSelectedSnapshot();
  } catch (error) {
    setError(`データを読み込めませんでした: ${error.message}`);
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
  elements.worldSelect.addEventListener('change', () => {
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
}

async function loadSelectedSnapshot() {
  const option = state.worldIndex.worlds.find(
    (world) => world.name === elements.worldSelect.value,
  );
  const selectedPeriod = elements.periodSelect.value || state.worldIndex.defaultPeriod;
  const path = option?.periods?.[selectedPeriod] ?? option?.path ?? DEFAULT_DATA_PATH;

  try {
    elements.worldSelect.disabled = true;
    elements.periodSelect.disabled = true;
    setError('');
    const snapshot = await loadSnapshot(path);
    state.items = snapshot.items ?? [];
    renderUpdatedAt(snapshot.generatedAt);
    render();
  } catch (error) {
    setError(`データを読み込めませんでした: ${error.message}`);
  } finally {
    elements.worldSelect.disabled = false;
    elements.periodSelect.disabled = false;
  }
}

function populateWorldSelect() {
  const fragment = document.createDocumentFragment();
  const preferredWorld = resolvePreferredWorld(state.worldIndex, document.cookie);
  const groups = new Map();

  for (const world of state.worldIndex.worlds) {
    const option = document.createElement('option');
    option.value = world.name;
    option.textContent = world.name;
    option.selected = world.name === preferredWorld;

    const dataCenter = world.dataCenter ?? 'その他';
    if (!groups.has(dataCenter)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = dataCenter === 'その他' ? dataCenter : `${dataCenter} DC`;
      groups.set(dataCenter, optgroup);
      fragment.append(optgroup);
    }

    groups.get(dataCenter).append(option);
  }

  elements.worldSelect.replaceChildren(fragment);
  elements.worldSelect.value = preferredWorld;
}

function populatePeriodSelect() {
  const fragment = document.createDocumentFragment();

  for (const period of state.worldIndex.periods) {
    const option = document.createElement('option');
    option.value = period.key;
    option.textContent = period.label;
    option.selected = period.key === state.worldIndex.defaultPeriod;
    fragment.append(option);
  }

  elements.periodSelect.replaceChildren(fragment);
  elements.periodSelect.value = state.worldIndex.defaultPeriod;
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

  elements.resultCount.textContent = `${formatNumber(filteredItems.length)} 件`;
  elements.tableBody.replaceChildren(
    ...filteredItems.slice(0, MAX_VISIBLE_ROWS).map(renderRow),
  );

  if (filteredItems.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty-state';
    cell.textContent = '条件に一致するアイテムがありません。';
    row.append(cell);
    elements.tableBody.append(row);
  }
}

function renderUpdatedAt(value) {
  const date = new Date(value);
  const text = Number.isNaN(date.getTime())
    ? '-'
    : new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Tokyo',
      }).format(date);

  elements.updatedAt.textContent = `最終更新 ${text}`;
}

function renderRow(item, index) {
  const row = document.createElement('tr');
  const recommendationLabel = {
    hot: '高騰',
    'needs-restock': '補充候補',
    rising: '上昇',
    steady: '堅調',
  }[item.recommendationLevel] ?? '候補';
  const percentChange = Number.isFinite(item.percentChange)
    ? item.percentChange.toFixed(2)
    : '0.00';

  row.append(
    createCell(String(index + 1), 'rank'),
    createItemCell(item),
    createCell(formatGil(item.marketValue)),
    createCell(formatGil(item.avg)),
    createCell(formatGil(item.minPrice)),
    createCell(formatNumber(item.quantitySold)),
    createCell(`${percentChange}%`, item.percentChange >= 0 ? 'positive' : 'negative'),
    createStateCell(item, recommendationLabel),
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
  link.textContent = item.name;
  if (item.nameEn && item.nameEn !== item.name) {
    link.title = item.nameEn;
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
  state.textContent = stateLabel(item.state);

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
    throw new Error(`JSON契約が不足しています: ${missingKeys.join(', ')}`);
  }

  if (!Array.isArray(snapshot.items)) {
    throw new Error('items が配列ではありません');
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

import {
  filterMarketshareItems,
  formatGil,
  formatNumber,
  stateLabel,
  summarizeMarketshare,
} from './marketshare.js';

const DATA_PATH = 'data/marketshare.json';
const MAX_VISIBLE_ROWS = 80;

const elements = {
  averagePrice: document.querySelector('[data-average-price]'),
  category: document.querySelector('[data-category]'),
  error: document.querySelector('[data-error]'),
  generatedAt: document.querySelector('[data-generated-at]'),
  itemCount: document.querySelector('[data-item-count]'),
  minQuantitySold: document.querySelector('[data-min-quantity]'),
  minQuantityValue: document.querySelector('[data-min-quantity-value]'),
  resultCount: document.querySelector('[data-result-count]'),
  search: document.querySelector('[data-search]'),
  sortBy: document.querySelector('[data-sort-by]'),
  stateFilters: [...document.querySelectorAll('[data-state-filter]')],
  tableBody: document.querySelector('[data-results]'),
  timePeriod: document.querySelector('[data-time-period]'),
  topItem: document.querySelector('[data-top-item]'),
  totalMarketValue: document.querySelector('[data-total-market-value]'),
  totalQuantitySold: document.querySelector('[data-total-quantity-sold]'),
  world: document.querySelector('[data-world]'),
};

const state = {
  items: [],
  query: null,
};

init();

async function init() {
  try {
    setError('');
    const snapshot = await loadSnapshot();
    state.items = snapshot.items ?? [];
    state.query = snapshot.query ?? {};
    renderMetadata(snapshot);
    renderSummary(snapshot.summary ?? summarizeMarketshare(state.items));
    render();
    bindControls();
  } catch (error) {
    setError(`データを読み込めませんでした: ${error.message}`);
  }
}

async function loadSnapshot() {
  const response = await fetch(DATA_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const snapshot = await response.json();
  validateSnapshot(snapshot);
  return snapshot;
}

function bindControls() {
  elements.search.addEventListener('input', render);
  elements.sortBy.addEventListener('change', render);
  elements.minQuantitySold.addEventListener('input', () => {
    elements.minQuantityValue.textContent = elements.minQuantitySold.value;
    render();
  });

  for (const checkbox of elements.stateFilters) {
    checkbox.addEventListener('change', render);
  }
}

function render() {
  const selectedStates = elements.stateFilters
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  const filteredItems = filterMarketshareItems(state.items, {
    search: elements.search.value,
    states: selectedStates,
    minQuantitySold: elements.minQuantitySold.value,
    sortBy: elements.sortBy.value,
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

function renderMetadata(snapshot) {
  const query = snapshot.query ?? {};
  elements.world.textContent = query.server ?? '-';
  elements.timePeriod.textContent = query.timePeriod
    ? `${query.timePeriod} 時間`
    : '-';
  elements.averagePrice.textContent = formatGil(query.averagePrice);
  elements.category.textContent = query.preset ?? '-';
  elements.generatedAt.textContent = snapshot.generatedAt
    ? new Intl.DateTimeFormat('ja-JP', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(snapshot.generatedAt))
    : '-';
}

function renderSummary(summary) {
  elements.itemCount.textContent = formatNumber(summary.itemCount);
  elements.totalMarketValue.textContent = formatGil(summary.totalMarketValue);
  elements.totalQuantitySold.textContent = formatNumber(summary.totalQuantitySold);
  elements.topItem.textContent = summary.topItem?.name ?? '-';
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

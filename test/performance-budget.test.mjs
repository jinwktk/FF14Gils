import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { before, describe, it } from 'node:test';
import {
  PERFORMANCE_BUDGETS,
  measurePerformanceBudget,
} from '../scripts/check-performance-budget.mjs';

let measurement;

before(async () => {
  measurement = await measurePerformanceBudget(new URL('../', import.meta.url));
});

describe('first-party performance budget', () => {
  it('route HTML/CSS/transitive ES modulesは40KiB gzip以下にする', async () => {
    assert.ok(
      measurement.firstPartyBytes <= PERFORMANCE_BUDGETS.firstParty,
      `first-party gzip ${measurement.firstPartyBytes} bytes exceeds ${PERFORMANCE_BUDGETS.firstParty}`,
    );
  });

  it('world indexと既定snapshotを含むmarket初期転送見積は64KiB gzip以下にする', async () => {
    assert.ok(
      measurement.marketInitialBytes <= PERFORMANCE_BUDGETS.marketInitial,
      `market initial gzip ${measurement.marketInitialBytes} bytes exceeds ${PERFORMANCE_BUDGETS.marketInitial}`,
    );
  });

  it('依存パッケージと外部fontを追加しない', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

    assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
    assert.equal(Object.keys(packageJson.devDependencies ?? {}).length, 0);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/i);
    assert.doesNotMatch(styles, /@import\s+url\([^)]*font/i);
  });

  it('完成したdistをデータ準備後にCIで再検査する', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const workflow = await readFile(
      new URL('../.github/workflows/pages.yml', import.meta.url),
      'utf8',
    );
    const buildIndex = workflow.indexOf('name: Build static site');
    const restoreIndex = workflow.indexOf('name: Restore published data');
    const optimizeIndex = workflow.indexOf('name: Optimize static JSON');
    const verifyIndex = workflow.indexOf('name: Verify performance budget');

    assert.equal(
      packageJson.scripts?.['check:performance'],
      'node scripts/check-performance-budget.mjs dist',
    );
    assert.equal(
      packageJson.scripts?.['optimize:data'],
      'node scripts/compact-data.mjs dist/data',
    );
    assert.ok(buildIndex >= 0);
    assert.ok(restoreIndex > buildIndex);
    assert.ok(optimizeIndex > restoreIndex);
    assert.ok(verifyIndex > optimizeIndex);
    assert.match(workflow.slice(optimizeIndex), /run: npm run optimize:data/);
    assert.match(workflow.slice(verifyIndex), /run: npm run check:performance/);
  });
});

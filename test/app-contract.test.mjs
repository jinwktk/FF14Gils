import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('app data loading contract', () => {
  it('GitHub Pages上のUIは生成済みJSONだけを読み、Saddlebag APIへ直接POSTしない', async () => {
    const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

    assert.match(source, /data\/marketshare\.json/);
    assert.doesNotMatch(source, /api\.saddlebagexchange\.com\/api\/ffxivmarketshare/);
    assert.doesNotMatch(source, /method\s*:\s*['"]POST['"]/i);
  });
});

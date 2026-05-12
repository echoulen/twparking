import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCatalog, writeCatalog } from './catalogCache.js';
import { catalogCachePath } from './paths.js';

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-cat-'));
});

describe('catalogCache', () => {
  it('returns null when missing', async () => {
    expect(await readCatalog('台北')).toBeNull();
  });

  it('roundtrip with stale=false when fresh', async () => {
    await writeCatalog('台北', [{ city: '台北', id: 'A', name: '某A' }]);
    const c = await readCatalog('台北');
    expect(c?.lots).toHaveLength(1);
    expect(c?.stale).toBe(false);
  });

  it('marks stale when older than 7 days', async () => {
    await writeCatalog('台北', [{ city: '台北', id: 'A', name: '某A' }]);
    const path = catalogCachePath('台北');
    const obj = JSON.parse(await readFile(path, 'utf8'));
    obj.fetchedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(path, JSON.stringify(obj));
    const c = await readCatalog('台北');
    expect(c?.stale).toBe(true);
  });

  it('returns null on city mismatch', async () => {
    await writeCatalog('台北', [{ city: '台北', id: 'A', name: '某A' }]);
    const path = catalogCachePath('台北');
    const obj = JSON.parse(await readFile(path, 'utf8'));
    obj.city = '新北';
    await writeFile(path, JSON.stringify(obj));
    expect(await readCatalog('台北')).toBeNull();
  });
});

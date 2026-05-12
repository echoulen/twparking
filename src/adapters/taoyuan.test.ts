import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adapter } from './taoyuan.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '../../fixtures/桃園/all.json'), 'utf8');

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response(raw, { status: 200 })),
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Taoyuan adapter', () => {
  it('fetchCatalog normalizes 3 lots with totalSpace and parkId', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots).toHaveLength(3);
    const byId = Object.fromEntries(lots.map((l) => [l.id, l]));
    expect(byId['P-BD-001']).toMatchObject({
      city: '桃園',
      name: '大湳公有停車場(桃交)',
      totalSpaces: 207,
    });
  });

  it('fetchAvailability returns surplusSpace as number', async () => {
    const all = await adapter.fetchAvailability();
    const byId = Object.fromEntries(all.map((a) => [a.id, a.availableSpaces]));
    expect(byId).toEqual({ 'P-BD-001': 12, 'P-BD-002': 90, 'P-BD-003': 11 });
  });

  it('fetchAvailability filters by lotIds', async () => {
    const subset = await adapter.fetchAvailability(['P-BD-003']);
    expect(subset).toHaveLength(1);
    expect(subset[0]?.availableSpaces).toBe(11);
  });
});

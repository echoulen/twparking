import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adapter } from './ntpc.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../../fixtures/新北');
const catalogRaw = readFileSync(join(fixturesDir, 'catalog.json'), 'utf8');
const availabilityRaw = readFileSync(join(fixturesDir, 'availability.json'), 'utf8');

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn((url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : (url as URL).toString();
    const isCatalog = u.includes('B1464EF0');
    return Promise.resolve(
      new Response(isCatalog ? catalogRaw : availabilityRaw, { status: 200 }),
    );
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('New Taipei adapter', () => {
  it('fetchCatalog normalizes 3 lots with TOTALCAR parsed', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots).toHaveLength(3);
    const byId = Object.fromEntries(lots.map((l) => [l.id, l]));
    expect(byId['010056']).toMatchObject({
      city: '新北',
      name: '遠東百貨停車場',
      totalSpaces: 453,
    });
  });

  it('fetchAvailability returns AVAILABLECAR as number', async () => {
    const all = await adapter.fetchAvailability();
    const byId = Object.fromEntries(all.map((a) => [a.id, a.availableSpaces]));
    expect(byId).toEqual({ '010001': 87, '010056': 45, '060040': 12 });
  });

  it('fetchAvailability filters by lotIds', async () => {
    const subset = await adapter.fetchAvailability(['010001']);
    expect(subset).toHaveLength(1);
    expect(subset[0]?.id).toBe('010001');
  });
});

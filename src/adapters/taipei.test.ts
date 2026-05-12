import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adapter } from './taipei.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../../fixtures/台北');
const catalogRaw = readFileSync(join(fixturesDir, 'catalog.json'), 'utf8');
const availabilityRaw = readFileSync(join(fixturesDir, 'availability.json'), 'utf8');

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn((url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : (url as URL).toString();
    const body = u.includes('alldesc') ? catalogRaw : availabilityRaw;
    return Promise.resolve(new Response(body, { status: 200 }));
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Taipei adapter', () => {
  it('fetchCatalog normalizes ParkingLot[]', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots).toHaveLength(3);
    expect(lots[0]).toMatchObject({
      city: '台北',
      id: 'TPE0001',
      name: '建國假日花市地下停車場',
      totalSpaces: 200,
    });
    expect(lots[2]?.name).toBe('台北101購物中心');
  });

  it('fetchAvailability returns realtime data', async () => {
    const all = await adapter.fetchAvailability();
    expect(all).toHaveLength(3);
    expect(all[1]).toMatchObject({
      city: '台北',
      id: 'TPE0002',
      availableSpaces: 285,
    });
  });

  it('fetchAvailability filters by lotIds', async () => {
    const subset = await adapter.fetchAvailability(['TPE0001', 'TPE0003']);
    expect(subset.map((a) => a.id)).toEqual(['TPE0001', 'TPE0003']);
  });
});

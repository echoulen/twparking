import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adapter } from './taichung.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '../../fixtures/台中/all.json'), 'utf8');

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response(raw, { status: 200 })),
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Taichung adapter', () => {
  it('fetchCatalog flattens ParkingLots into ParkingLot[]', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots.length).toBeGreaterThan(0);
    const first = lots[0]!;
    expect(first.city).toBe('台中');
    expect(first.id).toBe('1204');
    expect(first.name).toContain('中央公園');
    expect(first.totalSpaces).toBe(401);
  });

  it('fetchAvailability returns AvailableCar as number with parsed time', async () => {
    const all = await adapter.fetchAvailability();
    const first = all.find((a) => a.id === '1204');
    expect(first?.availableSpaces).toBe(371);
    expect(first?.updatedAt.toISOString()).toBe('2026-05-12T18:06:38.000Z');
  });

  it('fetchAvailability filters by lotIds', async () => {
    const subset = await adapter.fetchAvailability(['3098']);
    expect(subset).toHaveLength(1);
    expect(subset[0]?.availableSpaces).toBe(687);
  });
});

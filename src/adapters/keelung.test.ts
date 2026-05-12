import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adapter, parseRows } from './keelung.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '../../fixtures/基隆/page.html'), 'utf8');

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })),
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Keelung adapter', () => {
  it('parseRows extracts name, available, updatedAt', () => {
    const rows = parseRows(html);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ name: '基隆東岸停車場', available: 416 });
    expect(rows[0]!.updatedAt.toISOString()).toBe('2026-05-12T18:00:00.000Z');
  });

  it('fetchCatalog returns ParkingLot[] with name as id', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots[0]).toMatchObject({
      city: '基隆',
      id: '基隆東岸停車場',
      name: '基隆東岸停車場',
    });
  });

  it('fetchAvailability filters by lotIds', async () => {
    const subset = await adapter.fetchAvailability(['信二停車場']);
    expect(subset).toHaveLength(1);
    expect(subset[0]?.availableSpaces).toBe(287);
  });
});

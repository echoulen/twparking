import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchTickViews } from './fetchTickViews.js';
import { writeCatalog } from '../storage/catalogCache.js';
import { CITY_ADAPTERS } from '../adapters/index.js';

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-tick-'));
});

describe('fetchTickViews', () => {
  it('groups refs by city, joins catalog name, and reports per-city errors', async () => {
    await writeCatalog('基隆', [
      { city: '基隆', id: '信二停車場', name: '信二停車場', totalSpaces: 100 },
    ]);
    const spy = vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const result = await fetchTickViews([{ city: '基隆', id: '信二停車場' }]);

    expect(result.cityFetchErrors.size).toBe(0);
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({
      city: '基隆',
      id: '信二停車場',
      name: '信二停車場',
      totalSpaces: 100,
      availability: { availableSpaces: 25 },
    });
    spy.mockRestore();
  });

  it('records cityFetchErrors and surfaces fetchError on each view when adapter throws', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: 'X', name: 'X' }]);
    const spy = vi
      .spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability')
      .mockRejectedValue(new Error('boom'));

    const result = await fetchTickViews([{ city: '基隆', id: 'X' }]);

    expect(result.cityFetchErrors.has('基隆')).toBe(true);
    expect(result.views[0]?.fetchError).toBe('boom');
    spy.mockRestore();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addFavourite,
  readFavourites,
  removeFavourite,
  writeFavourites,
} from './favourites.js';

beforeEach(async () => {
  process.env.XDG_CONFIG_HOME = await mkdtemp(join(tmpdir(), 'twp-fav-'));
});

describe('favourites', () => {
  it('returns empty when file missing', async () => {
    expect(await readFavourites()).toEqual([]);
  });

  it('add then list', async () => {
    const r = await addFavourite({ city: '台北', id: 'A1' });
    expect(r.added).toBe(true);
    expect(await readFavourites()).toEqual([{ city: '台北', id: 'A1' }]);
  });

  it('add ignores duplicates', async () => {
    await addFavourite({ city: '台北', id: 'A1' });
    const r = await addFavourite({ city: '台北', id: 'A1' });
    expect(r.added).toBe(false);
  });

  it('remove existing', async () => {
    await writeFavourites([
      { city: '台北', id: 'A1' },
      { city: '新北', id: 'B2' },
    ]);
    const r = await removeFavourite({ city: '台北', id: 'A1' });
    expect(r.removed).toBe(true);
    expect(await readFavourites()).toEqual([{ city: '新北', id: 'B2' }]);
  });

  it('remove non-existent returns false', async () => {
    const r = await removeFavourite({ city: '台北', id: 'nope' });
    expect(r.removed).toBe(false);
  });
});

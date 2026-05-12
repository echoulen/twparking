import { readFile, access } from 'node:fs/promises';
import { atomicWriteJson } from '../util/atomicWrite.js';
import { favouritesPath } from './paths.js';
import type { City } from '../adapters/types.js';

export interface FavouriteRef {
  city: City;
  id: string;
}

interface FavouritesFile {
  version: 1;
  lots: FavouriteRef[];
}

export async function readFavourites(): Promise<FavouriteRef[]> {
  try {
    await access(favouritesPath());
  } catch {
    return [];
  }
  const text = await readFile(favouritesPath(), 'utf8');
  const parsed = JSON.parse(text) as FavouritesFile;
  if (parsed.version !== 1) {
    process.stderr.write(
      `warning: unknown favourites version ${parsed.version}, treating as empty\n`,
    );
    return [];
  }
  return parsed.lots;
}

export async function writeFavourites(lots: FavouriteRef[]): Promise<void> {
  const data: FavouritesFile = { version: 1, lots };
  await atomicWriteJson(favouritesPath(), data);
}

export async function addFavourite(ref: FavouriteRef): Promise<{ added: boolean }> {
  const current = await readFavourites();
  if (current.some((l) => l.city === ref.city && l.id === ref.id)) {
    return { added: false };
  }
  await writeFavourites([...current, ref]);
  return { added: true };
}

export async function removeFavourite(ref: FavouriteRef): Promise<{ removed: boolean }> {
  const current = await readFavourites();
  const next = current.filter((l) => !(l.city === ref.city && l.id === ref.id));
  if (next.length === current.length) return { removed: false };
  await writeFavourites(next);
  return { removed: true };
}

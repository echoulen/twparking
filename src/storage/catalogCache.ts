import { readFile, access } from 'node:fs/promises';
import { atomicWriteJson } from '../util/atomicWrite.js';
import { catalogCachePath } from './paths.js';
import type { City, ParkingLot } from '../adapters/types.js';

interface CatalogCacheFile {
  version: 1;
  city: City;
  fetchedAt: string;
  lots: ParkingLot[];
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedCatalog {
  lots: ParkingLot[];
  fetchedAt: Date;
  stale: boolean;
}

export async function readCatalog(city: City): Promise<CachedCatalog | null> {
  const path = catalogCachePath(city);
  try {
    await access(path);
  } catch {
    return null;
  }
  const text = await readFile(path, 'utf8');
  const parsed = JSON.parse(text) as CatalogCacheFile;
  if (parsed.version !== 1 || parsed.city !== city) return null;
  const fetchedAt = new Date(parsed.fetchedAt);
  return {
    lots: parsed.lots,
    fetchedAt,
    stale: Date.now() - fetchedAt.getTime() > TTL_MS,
  };
}

export async function writeCatalog(city: City, lots: ParkingLot[]): Promise<void> {
  const data: CatalogCacheFile = {
    version: 1,
    city,
    fetchedAt: new Date().toISOString(),
    lots,
  };
  await atomicWriteJson(catalogCachePath(city), data);
}

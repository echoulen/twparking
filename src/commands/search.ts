import { CITIES, type City } from '../adapters/types.js';
import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog, writeCatalog } from '../storage/catalogCache.js';
import { fuzzyScore } from '../util/fuzzy.js';

export interface SearchOptions {
  city?: City;
  json?: boolean;
}

interface Hit {
  city: City;
  id: string;
  name: string;
  address?: string;
  score: number;
}

export async function runSearch(keyword: string, opts: SearchOptions): Promise<number> {
  const targets: City[] = opts.city ? [opts.city] : [...CITIES];
  const allHits: Hit[] = [];
  const errors: string[] = [];

  for (const city of targets) {
    let cached = await readCatalog(city);
    if (!cached || cached.stale) {
      try {
        const lots = await CITY_ADAPTERS[city].fetchCatalog();
        await writeCatalog(city, lots);
        cached = { lots, fetchedAt: new Date(), stale: false };
      } catch (err) {
        errors.push(`${city}: ${(err as Error).message}`);
        if (!cached) continue;
      }
    }
    for (const lot of cached.lots) {
      const haystack = `${lot.name} ${lot.address ?? ''}`;
      const score = fuzzyScore(haystack, keyword);
      if (score >= 0) {
        const hit: Hit = { city, id: lot.id, name: lot.name, score };
        if (lot.address !== undefined) hit.address = lot.address;
        allHits.push(hit);
      }
    }
  }

  allHits.sort((a, b) => b.score - a.score);

  for (const e of errors) process.stderr.write(`warning: ${e}\n`);

  if (opts.json) {
    const json = allHits.map(({ score: _s, ...rest }) => rest);
    process.stdout.write(JSON.stringify(json, null, 2) + '\n');
  } else {
    if (allHits.length === 0) {
      process.stdout.write(`no match for "${keyword}"\n`);
    }
    for (const h of allHits) {
      const addr = h.address ? `  (${h.address})` : '';
      process.stdout.write(`${h.city}:${h.id}\t${h.name}${addr}\n`);
    }
  }

  return errors.length === targets.length ? 1 : 0;
}

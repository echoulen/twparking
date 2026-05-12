import { CITIES, type City } from '../adapters/types.js';
import { CITY_ADAPTERS } from '../adapters/index.js';
import { writeCatalog } from '../storage/catalogCache.js';

export async function runRefresh(city?: City): Promise<number> {
  const targets: City[] = city ? [city] : [...CITIES];
  let fail = 0;
  for (const c of targets) {
    try {
      const lots = await CITY_ADAPTERS[c].fetchCatalog();
      await writeCatalog(c, lots);
      process.stdout.write(`refreshed ${c}: ${lots.length} lots\n`);
    } catch (err) {
      process.stderr.write(`warning: ${c} refresh failed: ${(err as Error).message}\n`);
      fail++;
    }
  }
  return fail === targets.length ? 1 : 0;
}

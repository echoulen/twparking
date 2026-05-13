import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog } from '../storage/catalogCache.js';
import type { Availability, City, LotView, ParkingLot } from '../adapters/types.js';

export interface FetchTickResult {
  views: LotView[];
  cityFetchErrors: Set<City>;
}

export async function fetchTickViews(
  refs: ReadonlyArray<{ city: City; id: string }>,
): Promise<FetchTickResult> {
  const groups = new Map<City, string[]>();
  for (const r of refs) {
    const arr = groups.get(r.city) ?? [];
    arr.push(r.id);
    groups.set(r.city, arr);
  }

  const catalogByCity = new Map<City, ParkingLot[]>();
  for (const city of groups.keys()) {
    const c = await readCatalog(city);
    if (c) catalogByCity.set(city, c.lots);
  }

  const cityFetchErrors = new Set<City>();
  const tickResults = await Promise.all(
    Array.from(groups.entries()).map(async ([city, ids]) => {
      try {
        const av = await CITY_ADAPTERS[city].fetchAvailability(ids);
        return { city, ids, av, err: null as string | null };
      } catch (err) {
        cityFetchErrors.add(city);
        return { city, ids, av: [] as Availability[], err: (err as Error).message };
      }
    }),
  );

  const views: LotView[] = [];
  for (const { city, ids, av, err } of tickResults) {
    const catalog = catalogByCity.get(city) ?? [];
    for (const id of ids) {
      const lot = catalog.find((l) => l.id === id);
      const a = av.find((x) => x.id === id);
      const view: LotView = {
        city,
        id,
        name: lot?.name ?? `(unknown ${id})`,
      };
      if (lot?.totalSpaces !== undefined) view.totalSpaces = lot.totalSpaces;
      if (a) view.availability = a;
      if (err) view.fetchError = err;
      else if (av.length > 0 && !a) view.fetchError = 'lot not in availability response';
      views.push(view);
    }
  }

  return { views, cityFetchErrors };
}

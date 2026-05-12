import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog } from '../storage/catalogCache.js';
import { readFavourites } from '../storage/favourites.js';
import type { Availability, City, LotView, ParkingLot } from '../adapters/types.js';
import { CURSOR_HOME_CLEAR, renderScreen } from '../render/watchScreen.js';

export interface WatchOptions {
  intervalSec: number;
  override?: Array<{ city: City; id: string }>;
}

export async function runWatch(opts: WatchOptions): Promise<number> {
  const refs = opts.override ?? (await readFavourites());
  if (refs.length === 0) {
    process.stderr.write('no favourites; use `twparking add` first.\n');
    return 1;
  }

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

  const failCount = new Map<City, number>();
  let stopped = false;
  const onSig = () => {
    stopped = true;
  };
  process.on('SIGINT', onSig);

  while (!stopped) {
    const tickStart = Date.now();
    const tickResults = await Promise.all(
      Array.from(groups.entries()).map(async ([city, ids]) => {
        try {
          const av = await CITY_ADAPTERS[city].fetchAvailability(ids);
          failCount.set(city, 0);
          return { city, ids, av, err: null as string | null };
        } catch (err) {
          failCount.set(city, (failCount.get(city) ?? 0) + 1);
          return { city, ids, av: [] as Availability[], err: (err as Error).message };
        }
      }),
    );

    const tickViews: LotView[] = [];
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
        tickViews.push(view);
      }
    }

    const persistentFailures = Array.from(failCount.entries())
      .filter(([, n]) => n >= 5)
      .map(([c]) => c);

    const frame =
      CURSOR_HOME_CLEAR +
      renderScreen({
        now: new Date(),
        intervalSec: opts.intervalSec,
        views: tickViews,
        width: process.stdout.columns ?? 100,
        persistentFailures,
      });
    process.stdout.write(frame);

    if (stopped) break;
    const elapsed = Date.now() - tickStart;
    const wait = Math.max(0, opts.intervalSec * 1000 - elapsed);
    await sleep(wait);
  }

  process.off('SIGINT', onSig);
  process.stderr.write('\nstopped.\n');
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

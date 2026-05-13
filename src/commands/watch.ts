import { fetchTickViews } from './fetchTickViews.js';
import { readFavourites } from '../storage/favourites.js';
import type { City } from '../adapters/types.js';
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

  const failCount = new Map<City, number>();
  let stopped = false;
  const onSig = () => {
    stopped = true;
  };
  process.on('SIGINT', onSig);

  while (!stopped) {
    const tickStart = Date.now();
    const { views, cityFetchErrors } = await fetchTickViews(refs);

    const seenCities = new Set<City>();
    for (const v of views) seenCities.add(v.city);
    for (const city of seenCities) {
      if (cityFetchErrors.has(city)) {
        failCount.set(city, (failCount.get(city) ?? 0) + 1);
      } else {
        failCount.set(city, 0);
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
        views,
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

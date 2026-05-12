import { CITIES, type City } from '../adapters/types.js';
import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog, writeCatalog } from '../storage/catalogCache.js';
import { addFavourite, readFavourites, removeFavourite } from '../storage/favourites.js';
import { fuzzyScore } from '../util/fuzzy.js';

function parseRef(arg: string): { city: City; rest: string } {
  const idx = arg.indexOf(':');
  if (idx <= 0) throw new Error(`invalid ref "${arg}", expected 城市:停車場ID或名稱`);
  const cityStr = arg.slice(0, idx);
  if (!(CITIES as readonly string[]).includes(cityStr)) {
    throw new Error(`unknown city "${cityStr}"`);
  }
  return { city: cityStr as City, rest: arg.slice(idx + 1) };
}

export async function runAdd(arg: string): Promise<number> {
  let parsed: { city: City; rest: string };
  try {
    parsed = parseRef(arg);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }
  const { city, rest } = parsed;

  let cached = await readCatalog(city);
  if (!cached || cached.stale) {
    try {
      const lots = await CITY_ADAPTERS[city].fetchCatalog();
      await writeCatalog(city, lots);
      cached = { lots, fetchedAt: new Date(), stale: false };
    } catch (err) {
      process.stderr.write(`failed to fetch ${city} catalog: ${(err as Error).message}\n`);
      return 1;
    }
  }

  const byId = cached.lots.find((l) => l.id === rest);
  if (byId) {
    const r = await addFavourite({ city, id: rest });
    process.stdout.write(
      r.added
        ? `added ${city}:${rest} ${byId.name}\n`
        : `already in favourites: ${city}:${rest}\n`,
    );
    return 0;
  }

  const matches = cached.lots
    .map((l) => ({ l, s: fuzzyScore(l.name, rest) }))
    .filter((m) => m.s >= 0)
    .sort((a, b) => b.s - a.s);

  if (matches.length === 0) {
    process.stderr.write(`no match for "${rest}" in ${city}\n`);
    return 1;
  }
  if (matches.length > 1) {
    process.stderr.write(`multiple matches in ${city}, please use a precise ID:\n`);
    for (const m of matches.slice(0, 20)) {
      process.stderr.write(`  ${city}:${m.l.id}\t${m.l.name}\n`);
    }
    return 1;
  }

  const only = matches[0]!.l;
  const r = await addFavourite({ city, id: only.id });
  process.stdout.write(
    r.added
      ? `added ${city}:${only.id} ${only.name}\n`
      : `already in favourites: ${city}:${only.id}\n`,
  );
  return 0;
}

export async function runList(json: boolean): Promise<number> {
  const favs = await readFavourites();
  if (json) {
    process.stdout.write(JSON.stringify(favs, null, 2) + '\n');
    return 0;
  }
  if (favs.length === 0) {
    process.stdout.write('no favourites; use `twparking add` first.\n');
    return 0;
  }
  for (const f of favs) {
    const cached = await readCatalog(f.city);
    const lot = cached?.lots.find((l) => l.id === f.id);
    const name = lot?.name ?? '(unknown — run `twparking refresh`)';
    process.stdout.write(`${f.city}:${f.id}\t${name}\n`);
  }
  return 0;
}

export async function runRemove(arg: string): Promise<number> {
  let parsed: { city: City; rest: string };
  try {
    parsed = parseRef(arg);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }
  const { city, rest } = parsed;
  const r = await removeFavourite({ city, id: rest });
  process.stdout.write(r.removed ? `removed ${city}:${rest}\n` : `not found: ${city}:${rest}\n`);
  return r.removed ? 0 : 1;
}

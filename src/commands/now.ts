import type { City, LotView } from '../adapters/types.js';
import { fetchTickViews } from './fetchTickViews.js';
import { renderTable } from '../render/watchScreen.js';

export interface NowOptions {
  json: boolean;
}

interface NowJsonRow {
  city: City;
  id: string;
  name: string;
  totalSpaces: number | null;
  availableSpaces: number | null;
  updatedAt: string | null;
  fetchError: string | null;
}

export async function runNow(
  refs: ReadonlyArray<{ city: City; id: string }>,
  opts: NowOptions,
): Promise<number> {
  if (refs.length === 0) {
    process.stderr.write('no lots specified\n');
    return 1;
  }

  const { views } = await fetchTickViews(refs);

  if (opts.json) {
    process.stdout.write(JSON.stringify(views.map(toJsonRow), null, 2) + '\n');
  } else {
    const out = renderTable(views, process.stdout.columns ?? 100);
    process.stdout.write(out + '\n');
  }

  return views.every((v) => v.fetchError !== undefined) ? 1 : 0;
}

function toJsonRow(v: LotView): NowJsonRow {
  return {
    city: v.city,
    id: v.id,
    name: v.name,
    totalSpaces: v.totalSpaces ?? null,
    availableSpaces: v.availability?.availableSpaces ?? null,
    updatedAt: v.availability?.updatedAt.toISOString() ?? null,
    fetchError: v.fetchError ?? null,
  };
}

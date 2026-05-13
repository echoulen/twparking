#!/usr/bin/env node
import { createRequire } from 'node:module';
import { cac } from 'cac';
import { CITIES, type City } from './adapters/types.js';

const pkg = createRequire(import.meta.url)('../package.json') as { version: string };
import { runSearch } from './commands/search.js';
import { runAdd, runList, runRemove } from './commands/favourites.js';
import { runRefresh } from './commands/refresh.js';
import { runWatch } from './commands/watch.js';

const cli = cac('twparking');

cli
  .command('search <keyword>', 'fuzzy search parking lots across cities')
  .option('--city <city>', 'limit to one city (台北|新北|基隆|桃園|台中)')
  .option('--json', 'JSON output')
  .action(async (keyword: string, opts: { city?: string; json?: boolean }) => {
    const city = assertCityOrUndefined(opts.city);
    process.exitCode = await runSearch(keyword, {
      ...(city !== undefined && { city }),
      ...(opts.json !== undefined && { json: opts.json }),
    });
  });

cli.command('add <ref>', 'add a parking lot to favourites, e.g. 台北:信義公務中心').action(
  async (ref: string) => {
    process.exitCode = await runAdd(ref);
  },
);

cli
  .command('list', 'list favourites')
  .option('--json', 'JSON output')
  .action(async (opts: { json?: boolean }) => {
    process.exitCode = await runList(!!opts.json);
  });

cli.command('remove <ref>', 'remove a favourite, e.g. 台北:TPE0002').action(async (ref: string) => {
  process.exitCode = await runRemove(ref);
});

cli
  .command('refresh', 'force refresh catalog cache')
  .option('--city <city>', 'only one city')
  .action(async (opts: { city?: string }) => {
    const city = assertCityOrUndefined(opts.city);
    process.exitCode = await runRefresh(city);
  });

cli
  .command('watch [...refs]', 'watch favourites (or given refs) every N seconds')
  .option('--interval <sec>', 'refresh interval in seconds', { default: 60 })
  .action(async (refs: string[], opts: { interval: number | string }) => {
    const override = refs.length ? refs.map(parseRefOrExit) : undefined;
    const intervalSec = Number(opts.interval);
    if (!Number.isFinite(intervalSec) || intervalSec < 1) {
      process.stderr.write(`invalid --interval "${opts.interval}"\n`);
      process.exit(2);
    }
    process.exitCode = await runWatch({
      intervalSec,
      ...(override !== undefined && { override }),
    });
  });

cli.help();
cli.version(pkg.version);
cli.parse();

function assertCityOrUndefined(c: unknown): City | undefined {
  if (c === undefined) return undefined;
  if (typeof c !== 'string' || !(CITIES as readonly string[]).includes(c)) {
    process.stderr.write(`unknown city "${String(c)}". must be one of: ${CITIES.join(', ')}\n`);
    process.exit(2);
  }
  return c as City;
}

function parseRefOrExit(arg: string): { city: City; id: string } {
  const i = arg.indexOf(':');
  if (i <= 0) {
    process.stderr.write(`invalid ref "${arg}"\n`);
    process.exit(2);
  }
  const city = arg.slice(0, i);
  const id = arg.slice(i + 1);
  if (!(CITIES as readonly string[]).includes(city)) {
    process.stderr.write(`unknown city "${city}"\n`);
    process.exit(2);
  }
  return { city: city as City, id };
}

# twparking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 從零搭出 `twparking` CLI 的 v0.1：跨五城市搜尋、favourites 管理、line-refresh watch。

**Architecture:** TypeScript ESM monorepo-free single package。CityAdapter interface + 5 個 adapter；commands 透過 storage / adapter index 取資料；render 純函式產生 watch 畫面字串；cli.ts 用 cac 分派。

**Tech Stack:** Node 20+、TypeScript、cac、kleur、string-width、vitest、tsx、pnpm。

---

## File Structure（先在腦中鎖定，後續任務逐步建立）

```
twparking/
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ tsconfig.build.json
├─ vitest.config.ts
├─ .gitignore
├─ .prettierrc.json
├─ .eslintrc.cjs
├─ README.md
├─ src/
│  ├─ cli.ts                          # cac 入口
│  ├─ commands/
│  │  ├─ search.ts
│  │  ├─ favourites.ts                # add / list / remove
│  │  ├─ watch.ts
│  │  └─ refresh.ts
│  ├─ adapters/
│  │  ├─ types.ts
│  │  ├─ taipei.ts
│  │  ├─ ntpc.ts
│  │  ├─ keelung.ts
│  │  ├─ taoyuan.ts
│  │  ├─ taichung.ts
│  │  └─ index.ts
│  ├─ storage/
│  │  ├─ paths.ts                     # XDG 路徑解析
│  │  ├─ favourites.ts
│  │  └─ catalogCache.ts
│  ├─ render/
│  │  └─ watchScreen.ts
│  └─ util/
│     ├─ fetchJson.ts
│     ├─ fuzzy.ts
│     └─ atomicWrite.ts
├─ test/
│  └─ ...                             # 每個 src 模組對應一個 .test.ts
├─ fixtures/
│  ├─ 台北/catalog.json
│  ├─ 台北/availability.json
│  ├─ 新北/...
│  └─ ...
└─ scripts/
   └─ smoke.ts                        # smoke:<城市> 用
```

每個 adapter 約 80 行內：fetchCatalog → fetch → 解析 → 正規化；fetchAvailability 同理。

---

## Task 1: 專案 bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `.gitignore`, `.prettierrc.json`, `.eslintrc.cjs`

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "twparking",
  "version": "0.1.0",
  "description": "CLI 查台北/新北/基隆/桃園/台中 即時停車格剩餘量",
  "type": "module",
  "bin": { "twparking": "dist/cli.js" },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p tsconfig.build.json && chmod +x dist/cli.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "smoke": "tsx scripts/smoke.ts"
  },
  "dependencies": {
    "cac": "^6.7.14",
    "kleur": "^4.1.5",
    "string-width": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  },
  "publishConfig": { "access": "public" },
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/echoulen/twparking.git" }
}
```

- [ ] **Step 2: tsconfig.json + tsconfig.build.json**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "test/**/*", "scripts/**/*"]
}
```

`tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 3: vitest.config.ts + .gitignore + prettier + eslint**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.DS_Store
*.log
coverage/
```

`.prettierrc.json`:
```json
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

`.eslintrc.cjs`:
```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist', 'node_modules'],
  rules: {},
};
```

- [ ] **Step 4: pnpm install**

Run: `pnpm install`
Expected: lockfile 產生、無錯誤

- [ ] **Step 5: 確認 typecheck 通過（空專案）**

Run: `pnpm typecheck`
Expected: 通過（src/ 還沒檔案）

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "chore: bootstrap typescript project skeleton"
```

---

## Task 2: util/atomicWrite + util/fetchJson

**Files:**
- Create: `src/util/atomicWrite.ts`, `src/util/atomicWrite.test.ts`, `src/util/fetchJson.ts`, `src/util/fetchJson.test.ts`

- [ ] **Step 1: atomicWrite.ts**

```ts
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, path);
}
```

- [ ] **Step 2: atomicWrite.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { atomicWriteJson } from './atomicWrite.js';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('atomicWriteJson', () => {
  it('writes JSON and leaves no tmp behind', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'twp-'));
    const target = join(dir, 'nested/foo.json');
    await atomicWriteJson(target, { hello: 'world' });
    const text = await readFile(target, 'utf8');
    expect(JSON.parse(text)).toEqual({ hello: 'world' });
    const remains = await readdir(join(dir, 'nested'));
    expect(remains).toEqual(['foo.json']);
  });
});
```

Run: `pnpm test src/util/atomicWrite.test.ts`
Expected: PASS

- [ ] **Step 3: fetchJson.ts**

```ts
const DEFAULT_TIMEOUT_MS = 10_000;

export class FetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number;
  userAgent?: string;
  retries?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = 'twparking', retries = 1, headers = {} } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json', ...headers },
        signal: ac.signal,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          lastError = new FetchError(`HTTP ${res.status}`);
          await sleep(200 * (attempt + 1));
          continue;
        }
        throw new FetchError(`HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryable(err)) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw err instanceof FetchError ? err : new FetchError(`fetch failed: ${url}`, err);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new FetchError('unknown fetch error');
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (err instanceof TypeError) return true; // network error
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: fetchJson.test.ts**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, FetchError } from './fetchJson.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('fetchJson', () => {
  it('returns parsed JSON on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ a: 1 }), { status: 200 }));
    await expect(fetchJson('https://x/y')).resolves.toEqual({ a: 1 });
  });

  it('retries once on 500 then succeeds', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = mock;
    await expect(fetchJson('https://x/y', { retries: 1 })).resolves.toEqual({ ok: true });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('throws FetchError on 4xx without retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(fetchJson('https://x/y')).rejects.toBeInstanceOf(FetchError);
  });
});
```

Run: `pnpm test src/util/fetchJson.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/util
git commit -m "feat(util): atomicWriteJson and fetchJson with retry"
```

---

## Task 3: util/fuzzy

**Files:**
- Create: `src/util/fuzzy.ts`, `src/util/fuzzy.test.ts`

- [ ] **Step 1: fuzzy.ts**

```ts
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]『』「」]/g, '');
}

export function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  // 全部字元都要按順序出現在 haystack 內
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
}

export function fuzzyScore(haystack: string, needle: string): number {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return 0;
  const idx = h.indexOf(n);
  if (idx >= 0) return 1000 - idx;       // 連續子字串：分數最高、越早出現越高
  if (!fuzzyMatch(haystack, needle)) return -1;
  return 100;                             // 分散字元：固定中等分
}
```

- [ ] **Step 2: fuzzy.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyScore } from './fuzzy.js';

describe('fuzzyMatch', () => {
  it('matches substring case-insensitive', () => {
    expect(fuzzyMatch('信義公務中心停車場', '信義')).toBe(true);
  });
  it('matches in-order chars', () => {
    expect(fuzzyMatch('台北101購物中心', '101心')).toBe(true);
  });
  it('rejects unordered chars', () => {
    expect(fuzzyMatch('台北101', '101台')).toBe(false);
  });
  it('strips punctuation and brackets', () => {
    expect(fuzzyMatch('松山（東）停車場', '松山東')).toBe(true);
  });
});

describe('fuzzyScore', () => {
  it('substring scores higher than scattered', () => {
    expect(fuzzyScore('信義公務中心', '信義')).toBeGreaterThan(
      fuzzyScore('信公心義', '信義'),
    );
  });
  it('returns -1 for no match', () => {
    expect(fuzzyScore('松山', '基隆')).toBe(-1);
  });
});
```

Run: `pnpm test src/util/fuzzy.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/util/fuzzy.ts src/util/fuzzy.test.ts
git commit -m "feat(util): fuzzy name match utility"
```

---

## Task 4: adapters/types.ts

**Files:**
- Create: `src/adapters/types.ts`

- [ ] **Step 1: types.ts**

```ts
export const CITIES = ['台北', '新北', '基隆', '桃園', '台中'] as const;
export type City = (typeof CITIES)[number];

export interface ParkingLot {
  city: City;
  id: string;
  name: string;
  address?: string;
  totalSpaces?: number;
  lat?: number;
  lng?: number;
}

export interface Availability {
  city: City;
  id: string;
  availableSpaces: number;
  updatedAt: Date;
}

export interface LotView extends ParkingLot {
  availability?: Availability;
  fetchError?: string;
}

export interface CityAdapter {
  city: City;
  fetchCatalog(): Promise<ParkingLot[]>;
  fetchAvailability(lotIds?: string[]): Promise<Availability[]>;
}

export class AdapterError extends Error {
  constructor(public readonly city: City, message: string, public readonly cause?: unknown) {
    super(`[${city}] ${message}`);
    this.name = 'AdapterError';
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/adapters/types.ts
git commit -m "feat(adapters): shared types and AdapterError"
```

---

## Task 5: storage/paths.ts + storage/favourites.ts

**Files:**
- Create: `src/storage/paths.ts`, `src/storage/favourites.ts`, `src/storage/favourites.test.ts`

- [ ] **Step 1: paths.ts**

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP = 'twparking';

function xdg(envName: string, fallback: string): string {
  return process.env[envName] ?? join(homedir(), fallback);
}

export function configDir(): string {
  return join(xdg('XDG_CONFIG_HOME', '.config'), APP);
}

export function cacheDir(): string {
  return join(xdg('XDG_CACHE_HOME', '.cache'), APP);
}

export function favouritesPath(): string {
  return join(configDir(), 'favourites.json');
}

export function catalogCachePath(city: string): string {
  return join(cacheDir(), `lots-${city}.json`);
}
```

- [ ] **Step 2: favourites.ts**

```ts
import { readFile, access } from 'node:fs/promises';
import { atomicWriteJson } from '../util/atomicWrite.js';
import { favouritesPath } from './paths.js';
import type { City } from '../adapters/types.js';

export interface FavouriteRef { city: City; id: string }
interface FavouritesFile { version: 1; lots: FavouriteRef[] }

const EMPTY: FavouritesFile = { version: 1, lots: [] };

export async function readFavourites(): Promise<FavouriteRef[]> {
  try {
    await access(favouritesPath());
  } catch {
    return [];
  }
  const text = await readFile(favouritesPath(), 'utf8');
  const parsed = JSON.parse(text) as FavouritesFile;
  if (parsed.version !== 1) {
    process.stderr.write(`warning: unknown favourites version ${parsed.version}, treating as empty\n`);
    return [];
  }
  return parsed.lots;
}

export async function writeFavourites(lots: FavouriteRef[]): Promise<void> {
  await atomicWriteJson(favouritesPath(), { version: 1, lots } satisfies FavouritesFile);
}

export async function addFavourite(ref: FavouriteRef): Promise<{ added: boolean }> {
  const current = await readFavourites();
  if (current.some((l) => l.city === ref.city && l.id === ref.id)) return { added: false };
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
```

- [ ] **Step 3: favourites.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFavourites, addFavourite, removeFavourite, writeFavourites } from './favourites.js';

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'twp-fav-'));
  process.env.XDG_CONFIG_HOME = tmp;
});

describe('favourites', () => {
  it('returns empty when file missing', async () => {
    expect(await readFavourites()).toEqual([]);
  });
  it('add then list', async () => {
    const r = await addFavourite({ city: '台北', id: 'A1' });
    expect(r.added).toBe(true);
    expect(await readFavourites()).toEqual([{ city: '台北', id: 'A1' }]);
  });
  it('add ignores duplicates', async () => {
    await addFavourite({ city: '台北', id: 'A1' });
    const r = await addFavourite({ city: '台北', id: 'A1' });
    expect(r.added).toBe(false);
  });
  it('remove existing', async () => {
    await writeFavourites([{ city: '台北', id: 'A1' }, { city: '新北', id: 'B2' }]);
    const r = await removeFavourite({ city: '台北', id: 'A1' });
    expect(r.removed).toBe(true);
    expect(await readFavourites()).toEqual([{ city: '新北', id: 'B2' }]);
  });
});
```

Run: `pnpm test src/storage/favourites.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/storage
git commit -m "feat(storage): paths and favourites read/write/add/remove"
```

---

## Task 6: storage/catalogCache.ts

**Files:**
- Create: `src/storage/catalogCache.ts`, `src/storage/catalogCache.test.ts`

- [ ] **Step 1: catalogCache.ts**

```ts
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
```

- [ ] **Step 2: catalogCache.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCatalog, writeCatalog } from './catalogCache.js';

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-cat-'));
});

describe('catalogCache', () => {
  it('returns null when missing', async () => {
    expect(await readCatalog('台北')).toBeNull();
  });
  it('roundtrip with stale=false when fresh', async () => {
    await writeCatalog('台北', [{ city: '台北', id: 'A', name: '某A' }]);
    const c = await readCatalog('台北');
    expect(c?.lots).toHaveLength(1);
    expect(c?.stale).toBe(false);
  });
  it('marks stale when older than 7 days', async () => {
    await writeCatalog('台北', [{ city: '台北', id: 'A', name: '某A' }]);
    // 直接覆寫 fetchedAt
    const { readFile, writeFile } = await import('node:fs/promises');
    const { catalogCachePath } = await import('./paths.js');
    const path = catalogCachePath('台北');
    const obj = JSON.parse(await readFile(path, 'utf8'));
    obj.fetchedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(path, JSON.stringify(obj));
    const c = await readCatalog('台北');
    expect(c?.stale).toBe(true);
  });
});
```

Run: `pnpm test src/storage/catalogCache.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/storage/catalogCache.ts src/storage/catalogCache.test.ts
git commit -m "feat(storage): catalog cache with 7-day TTL"
```

---

## Task 7-11: City Adapters（台北 / 新北 / 基隆 / 桃園 / 台中）

每個 adapter 都遵循以下流程，差異只在 endpoint URL 與 schema 對應：

### 通用流程（每個 adapter task 都跑一次）

- [ ] **Step A: 驗證實際 endpoint**

執行 curl 抓 catalog 與 availability 兩支 API，把回應存到 `fixtures/<城市>/catalog.json` 與 `fixtures/<城市>/availability.json`。

- [ ] **Step B: 寫 adapter.test.ts，TDD**

```ts
// 範本
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { adapter } from './<city>.js';

const catalogRaw = readFileSync('fixtures/<城市>/catalog.json', 'utf8');
const availabilityRaw = readFileSync('fixtures/<城市>/availability.json', 'utf8');

beforeEach(() => {
  globalThis.fetch = vi.fn((url: string) => {
    const body = url.includes('catalog-keyword') ? catalogRaw : availabilityRaw;
    return Promise.resolve(new Response(body, { status: 200 }));
  }) as typeof fetch;
});

describe('<city> adapter', () => {
  it('fetchCatalog normalizes ParkingLot[]', async () => {
    const lots = await adapter.fetchCatalog();
    expect(lots.length).toBeGreaterThan(0);
    expect(lots[0]).toMatchObject({ city: '<城市>', id: expect.any(String), name: expect.any(String) });
  });
  it('fetchAvailability normalizes Availability[] and filters by ids', async () => {
    const all = await adapter.fetchAvailability();
    expect(all.length).toBeGreaterThan(0);
    const subset = await adapter.fetchAvailability([all[0]!.id]);
    expect(subset).toHaveLength(1);
  });
});
```

- [ ] **Step C: 實作 adapter（範本）**

```ts
import { fetchJson } from '../util/fetchJson.js';
import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '<城市>' as const;
const CATALOG_URL = 'https://...';
const AVAILABILITY_URL = 'https://...';

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const raw = await fetchJson<unknown>(CATALOG_URL);
      return normalizeCatalog(raw);
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const raw = await fetchJson<unknown>(AVAILABILITY_URL);
      const all = normalizeAvailability(raw);
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

function normalizeCatalog(raw: unknown): ParkingLot[] { /* adapter-specific */ }
function normalizeAvailability(raw: unknown): Availability[] { /* adapter-specific */ }
```

- [ ] **Step D: Run test，確認綠燈**

Run: `pnpm test src/adapters/<city>.test.ts`

- [ ] **Step E: Commit**

```
git add src/adapters/<city>.ts src/adapters/<city>.test.ts fixtures/<城市>
git commit -m "feat(adapters): <city> catalog + availability"
```

對五城市各跑一次：台北 / 新北 / 基隆 / 桃園 / 台中。

### 已知 API 線索（實作時以實際 curl 為準）

| 城市 | catalog endpoint 線索 | availability 線索 |
|---|---|---|
| 台北 | `https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json` 或 `data.taipei` dataset API | `https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json` |
| 新北 | `https://data.ntpc.gov.tw/api/datasets/<...>/json`（路外公共停車場資訊） | `https://data.ntpc.gov.tw/api/datasets/<...>/json`（即時剩餘） |
| 基隆 | `https://data.klcg.gov.tw/dataset/<...>` | `https://data.klcg.gov.tw/dataset/<...>` |
| 桃園 | `https://data.tycg.gov.tw/api/v1/rest/datastore/<resource_id>` | 同上不同 resource |
| 台中 | `https://datacenter.taichung.gov.tw/swagger/OpenData/<...>` | 同上不同 endpoint |

---

## Task 12: adapters/index.ts

**Files:**
- Create: `src/adapters/index.ts`

- [ ] **Step 1: index.ts**

```ts
import { adapter as taipei } from './taipei.js';
import { adapter as ntpc } from './ntpc.js';
import { adapter as keelung } from './keelung.js';
import { adapter as taoyuan } from './taoyuan.js';
import { adapter as taichung } from './taichung.js';
import { CITIES, type City, type CityAdapter } from './types.js';

export const CITY_ADAPTERS: Record<City, CityAdapter> = {
  台北: taipei,
  新北: ntpc,
  基隆: keelung,
  桃園: taoyuan,
  台中: taichung,
};

export function getAdapter(city: City): CityAdapter {
  return CITY_ADAPTERS[city];
}

export { CITIES };
export type { City, CityAdapter };
```

- [ ] **Step 2: Commit**

```
git add src/adapters/index.ts
git commit -m "feat(adapters): CITY_ADAPTERS registry"
```

---

## Task 13: render/watchScreen.ts

**Files:**
- Create: `src/render/watchScreen.ts`, `src/render/watchScreen.test.ts`

- [ ] **Step 1: watchScreen.ts**

```ts
import stringWidth from 'string-width';
import type { LotView } from '../adapters/types.js';

const LOW_THRESHOLD = 10;

export interface RenderInput {
  now: Date;
  intervalSec: number;
  views: LotView[];
  width: number;          // terminal columns
  persistentFailures?: string[];   // city names with consecutive failures
}

export function renderScreen(input: RenderInput): string {
  const { now, intervalSec, views, width, persistentFailures = [] } = input;
  const header = renderHeader(now, intervalSec, persistentFailures);
  const table = renderTable(views, width);
  return `${header}\n\n${table}\n`;
}

function renderHeader(now: Date, sec: number, failures: string[]): string {
  const ts = formatNow(now);
  const fail = failures.length ? ` · (${failures.join(', ')} 持續失敗)` : '';
  return `twparking · ${ts} · refresh every ${sec}s · Ctrl+C to stop${fail}`;
}

function formatNow(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const COLS = ['城市', '停車場', '剩餘 / 總數', '更新時間', '狀態'] as const;

function renderTable(views: LotView[], termWidth: number): string {
  const rows = views.map(rowOf);
  const allRows = [COLS.slice(), ...rows];
  const widths = COLS.map((_, i) =>
    Math.max(...allRows.map((r) => stringWidth(r[i] ?? ''))),
  );
  // 留 2 格欄間距；若超出 termWidth 就縮「停車場」欄
  const sep = '  ';
  const totalFixed = widths.reduce((a, b) => a + b, 0) + sep.length * (widths.length - 1);
  if (totalFixed > termWidth) {
    const overflow = totalFixed - termWidth;
    widths[1] = Math.max(8, widths[1]! - overflow);
  }
  return allRows.map((r) => r.map((cell, i) => padCell(cell ?? '', widths[i]!)).join(sep)).join('\n');
}

function padCell(text: string, w: number): string {
  const tw = stringWidth(text);
  if (tw === w) return text;
  if (tw < w) return text + ' '.repeat(w - tw);
  // truncate（按字元、不按字寬精確切；先簡單做）
  let acc = '';
  let used = 0;
  for (const ch of text) {
    const cw = stringWidth(ch);
    if (used + cw > w - 1) break;
    acc += ch;
    used += cw;
  }
  return acc + '…' + ' '.repeat(Math.max(0, w - stringWidth(acc) - 1));
}

function rowOf(v: LotView): string[] {
  const city = v.city;
  const name = v.name;
  const remaining = v.availability ? String(v.availability.availableSpaces) : '─';
  const total = v.totalSpaces ? String(v.totalSpaces) : '─';
  const occ = v.availability ? `${remaining} / ${total}` : `${remaining}`;
  const ts = v.availability ? formatTime(v.availability.updatedAt) : '─';
  let status = '';
  if (v.fetchError) status = `✗ fetch error: ${v.fetchError}`;
  else if (v.availability && v.availability.availableSpaces <= LOW_THRESHOLD) status = '⚠ 將滿';
  return [city, name, occ, ts, status];
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const CURSOR_HOME_CLEAR = '\x1b[H\x1b[J';
```

- [ ] **Step 2: watchScreen.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { renderScreen } from './watchScreen.js';

const fixedNow = new Date('2026-05-13T21:43:11+08:00');

describe('renderScreen', () => {
  it('snapshot: mixed normal + low + error rows', () => {
    const out = renderScreen({
      now: fixedNow,
      intervalSec: 60,
      width: 120,
      views: [
        { city: '台北', id: 'A1', name: '信義公務中心', totalSpaces: 250, availability: { city: '台北', id: 'A1', availableSpaces: 12, updatedAt: new Date('2026-05-13T21:42:38+08:00') } },
        { city: '台北', id: 'B2', name: '101 購物中心', totalSpaces: 1843, availability: { city: '台北', id: 'B2', availableSpaces: 3, updatedAt: new Date('2026-05-13T21:42:40+08:00') } },
        { city: '桃園', id: 'C3', name: '中路停車場', fetchError: 'timeout' },
      ],
    });
    expect(out).toMatchSnapshot();
  });
});
```

Run: `pnpm test src/render/watchScreen.test.ts`
Expected: snapshot 建立、PASS

- [ ] **Step 3: Commit**

```
git add src/render
git commit -m "feat(render): watch screen layout with low/error status"
```

---

## Task 14: commands/search.ts

**Files:**
- Create: `src/commands/search.ts`

- [ ] **Step 1: search.ts**

```ts
import { CITIES, type City } from '../adapters/types.js';
import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog, writeCatalog } from '../storage/catalogCache.js';
import { fuzzyScore, normalize } from '../util/fuzzy.js';

export interface SearchOptions {
  city?: City;
  json?: boolean;
}

interface Hit { city: City; id: string; name: string; address?: string; score: number }

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
      const score = fuzzyScore(lot.name + ' ' + (lot.address ?? ''), keyword);
      if (score >= 0) allHits.push({ city, id: lot.id, name: lot.name, address: lot.address, score });
    }
  }
  allHits.sort((a, b) => b.score - a.score);
  for (const e of errors) process.stderr.write(`warning: ${e}\n`);
  if (opts.json) {
    process.stdout.write(JSON.stringify(allHits.map(({ score, ...rest }) => rest), null, 2) + '\n');
  } else {
    if (allHits.length === 0) {
      process.stdout.write(`no match for "${keyword}"\n`);
    }
    for (const h of allHits) {
      process.stdout.write(`${h.city}:${h.id}\t${h.name}${h.address ? '  (' + h.address + ')' : ''}\n`);
    }
  }
  return errors.length === targets.length ? 1 : 0;
}
```

- [ ] **Step 2: Commit**（暫不寫單元測試；adapter 層已測，integration 走真實 CLI smoke）

```
git add src/commands/search.ts
git commit -m "feat(commands): search across cities with catalog cache"
```

---

## Task 15: commands/favourites.ts (add / list / remove)

**Files:**
- Create: `src/commands/favourites.ts`

- [ ] **Step 1: favourites.ts**

```ts
import { CITIES, type City } from '../adapters/types.js';
import { CITY_ADAPTERS } from '../adapters/index.js';
import { readCatalog, writeCatalog } from '../storage/catalogCache.js';
import { addFavourite, readFavourites, removeFavourite } from '../storage/favourites.js';
import { fuzzyMatch, fuzzyScore } from '../util/fuzzy.js';

function parseRef(arg: string): { city: City; rest: string } {
  const idx = arg.indexOf(':');
  if (idx <= 0) throw new Error(`invalid ref "${arg}", expected 城市:停車場ID或名稱`);
  const city = arg.slice(0, idx) as City;
  if (!CITIES.includes(city)) throw new Error(`unknown city "${city}"`);
  return { city, rest: arg.slice(idx + 1) };
}

export async function runAdd(arg: string): Promise<number> {
  const { city, rest } = parseRef(arg);
  let cached = await readCatalog(city);
  if (!cached || cached.stale) {
    const lots = await CITY_ADAPTERS[city].fetchCatalog();
    await writeCatalog(city, lots);
    cached = { lots, fetchedAt: new Date(), stale: false };
  }
  const byId = cached.lots.find((l) => l.id === rest);
  if (byId) {
    const r = await addFavourite({ city, id: rest });
    process.stdout.write(r.added ? `added ${city}:${rest} ${byId.name}\n` : `already in favourites: ${city}:${rest}\n`);
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
    for (const m of matches.slice(0, 20)) process.stderr.write(`  ${city}:${m.l.id}\t${m.l.name}\n`);
    return 1;
  }
  const only = matches[0]!.l;
  const r = await addFavourite({ city, id: only.id });
  process.stdout.write(r.added ? `added ${city}:${only.id} ${only.name}\n` : `already in favourites: ${city}:${only.id}\n`);
  return 0;
}

export async function runList(json: boolean): Promise<number> {
  const favs = await readFavourites();
  if (json) { process.stdout.write(JSON.stringify(favs, null, 2) + '\n'); return 0; }
  if (favs.length === 0) { process.stdout.write('no favourites; use `twparking add` first.\n'); return 0; }
  for (const f of favs) {
    const cached = await readCatalog(f.city);
    const lot = cached?.lots.find((l) => l.id === f.id);
    process.stdout.write(`${f.city}:${f.id}\t${lot?.name ?? '(unknown — run `twparking refresh`)'}\n`);
  }
  return 0;
}

export async function runRemove(arg: string): Promise<number> {
  const { city, rest } = parseRef(arg);
  const r = await removeFavourite({ city, id: rest });
  process.stdout.write(r.removed ? `removed ${city}:${rest}\n` : `not found: ${city}:${rest}\n`);
  return r.removed ? 0 : 1;
}
```

- [ ] **Step 2: Commit**

```
git add src/commands/favourites.ts
git commit -m "feat(commands): favourites add/list/remove"
```

---

## Task 16: commands/refresh.ts

**Files:**
- Create: `src/commands/refresh.ts`

- [ ] **Step 1: refresh.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```
git add src/commands/refresh.ts
git commit -m "feat(commands): refresh catalog cache per city"
```

---

## Task 17: commands/watch.ts

**Files:**
- Create: `src/commands/watch.ts`

- [ ] **Step 1: watch.ts**

```ts
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

  // 預載 catalog 以取得 name / total
  const catalogByCity = new Map<City, ParkingLot[]>();
  for (const city of groups.keys()) {
    const c = await readCatalog(city);
    if (c) catalogByCity.set(city, c.lots);
  }

  const failCount = new Map<City, number>();
  let stopped = false;
  const onSig = () => { stopped = true; };
  process.on('SIGINT', onSig);

  while (!stopped) {
    const tickStart = Date.now();
    const tickViews: LotView[] = [];
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
    for (const { city, ids, av, err } of tickResults) {
      const catalog = catalogByCity.get(city) ?? [];
      for (const id of ids) {
        const lot = catalog.find((l) => l.id === id);
        const a = av.find((x) => x.id === id);
        tickViews.push({
          city,
          id,
          name: lot?.name ?? `(unknown ${id})`,
          totalSpaces: lot?.totalSpaces,
          availability: a,
          fetchError: err ?? (av.length && !a ? 'lot not in availability response' : undefined),
        });
      }
    }
    const persistentFailures = Array.from(failCount.entries())
      .filter(([, n]) => n >= 5)
      .map(([c]) => c);
    const frame = CURSOR_HOME_CLEAR + renderScreen({
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
    await new Promise<void>((r) => setTimeout(r, wait));
  }
  process.off('SIGINT', onSig);
  process.stderr.write('\nstopped.\n');
  return 0;
}
```

- [ ] **Step 2: Commit**

```
git add src/commands/watch.ts
git commit -m "feat(commands): watch loop with grouped fetch and persistent-fail tracking"
```

---

## Task 18: cli.ts entrypoint

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: cli.ts**

```ts
#!/usr/bin/env node
import { cac } from 'cac';
import { CITIES, type City } from './adapters/types.js';
import { runSearch } from './commands/search.js';
import { runAdd, runList, runRemove } from './commands/favourites.js';
import { runRefresh } from './commands/refresh.js';
import { runWatch } from './commands/watch.js';

const cli = cac('twparking');

cli.command('search <keyword>', 'fuzzy search parking lots across cities')
  .option('--city <city>', 'limit to one city (台北|新北|基隆|桃園|台中)')
  .option('--json', 'JSON output')
  .action(async (keyword: string, opts: { city?: City; json?: boolean }) => {
    assertCityOrUndefined(opts.city);
    process.exitCode = await runSearch(keyword, opts);
  });

cli.command('add <ref>', 'add a parking lot to favourites, e.g. 台北:信義公務中心')
  .action(async (ref: string) => { process.exitCode = await runAdd(ref); });

cli.command('list', 'list favourites')
  .option('--json', 'JSON output')
  .action(async (opts: { json?: boolean }) => { process.exitCode = await runList(!!opts.json); });

cli.command('remove <ref>', 'remove a favourite, e.g. 台北:A12345')
  .action(async (ref: string) => { process.exitCode = await runRemove(ref); });

cli.command('refresh', 'force refresh catalog cache')
  .option('--city <city>', 'only one city')
  .action(async (opts: { city?: City }) => {
    assertCityOrUndefined(opts.city);
    process.exitCode = await runRefresh(opts.city);
  });

cli.command('watch [...refs]', 'watch favourites (or given refs) every N seconds')
  .option('--interval <sec>', 'refresh interval in seconds', { default: 60 })
  .action(async (refs: string[], opts: { interval: number }) => {
    const override = refs.length ? refs.map(parseRefOrThrow) : undefined;
    process.exitCode = await runWatch({ intervalSec: Number(opts.interval), override });
  });

cli.help();
cli.version('0.1.0');
cli.parse();

function assertCityOrUndefined(c: unknown): asserts c is City | undefined {
  if (c === undefined) return;
  if (typeof c !== 'string' || !(CITIES as readonly string[]).includes(c)) {
    process.stderr.write(`unknown city "${String(c)}". must be one of: ${CITIES.join(', ')}\n`);
    process.exit(2);
  }
}

function parseRefOrThrow(arg: string): { city: City; id: string } {
  const i = arg.indexOf(':');
  if (i <= 0) { process.stderr.write(`invalid ref "${arg}"\n`); process.exit(2); }
  const city = arg.slice(0, i);
  const id = arg.slice(i + 1);
  if (!(CITIES as readonly string[]).includes(city)) {
    process.stderr.write(`unknown city "${city}"\n`); process.exit(2);
  }
  return { city: city as City, id };
}
```

- [ ] **Step 2: Smoke test build**

Run: `pnpm build && node dist/cli.js --help`
Expected: 印出 cac 的 help、有所有 subcommand

- [ ] **Step 3: Commit**

```
git add src/cli.ts
git commit -m "feat(cli): cac entry point with all subcommands"
```

---

## Task 19: README + 最終驗證

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**（中英混雜、給未來自己 / 別人讀）

```markdown
# twparking

CLI 查台北 / 新北 / 基隆 / 桃園 / 台中 五個城市的即時停車格剩餘量。

## Install

\`\`\`
pnpm add -g twparking
# or one-shot
pnpm dlx twparking search 信義
\`\`\`

## Usage

\`\`\`
twparking search <關鍵字> [--city 台北|新北|基隆|桃園|台中] [--json]
twparking add <城市>:<停車場ID或名稱>
twparking list [--json]
twparking remove <城市>:<停車場ID>
twparking refresh [--city <城市>]
twparking watch [--interval 60] [<城市>:<停車場ID> ...]
\`\`\`

## Data sources

各城市官方 open data，每 adapter 對應一支 catalog endpoint 與一支 availability endpoint。

## Develop

\`\`\`
pnpm install
pnpm dev search 信義
pnpm test
pnpm build
\`\`\`

## License

MIT
```

- [ ] **Step 2: 全套驗證**

```
pnpm lint || true   # eslint 可能還沒設好 rules，但跑得起來
pnpm typecheck
pnpm test
pnpm build
node dist/cli.js --help
```

Expected: typecheck / test / build 全綠

- [ ] **Step 3: Commit**

```
git add README.md
git commit -m "docs: README with install / usage / dev"
```

---

## Task 20: Push to main

- [ ] **Step 1: Push**

```
git push origin main
```

Expected: 用 echoulen credential 推上 `https://github.com/echoulen/twparking`

---

## Out of Scope（v0.1 之外）

- 通知（macOS / Telegram / 閾值）
- TUI fzf-style picker
- watch JSON 輸出
- daemon 模式
- single-binary 打包
- 趨勢圖 / 歷史儲存

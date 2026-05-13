# twparking Claude Code Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現有的 `twparking` CLI 包成 Claude Code plugin（4 個 slash commands + 1 個 skill），並讓本 repo 同時當 marketplace；新增 `twparking now` CLI 子命令給 plugin 使用。

**Architecture:** 同 repo 既是 npm 套件、Claude Code plugin、Claude Code marketplace。Plugin 不重新實作邏輯，全部 delegate 給 CLI。CLI 抽出 `fetchTickViews` 共用 helper，給 `watch` 跟新加的 `now` 一起用。

**Tech Stack:** Node 20+、TypeScript、cac、vitest、Claude Code plugin spec（`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`）。

---

## File Structure

```
twparking/
├─ src/
│  ├─ commands/
│  │  ├─ fetchTickViews.ts        # 新增：共用 fetch+compose helper
│  │  ├─ fetchTickViews.test.ts   # 新增：helper 測試
│  │  ├─ now.ts                   # 新增：one-shot subcommand
│  │  ├─ now.test.ts              # 新增：JSON 輸出契約測試
│  │  └─ watch.ts                 # 改：用 fetchTickViews
│  ├─ render/
│  │  └─ watchScreen.ts           # 改：export renderTable
│  └─ cli.ts                      # 改：註冊 now subcommand
├─ .claude-plugin/
│  ├─ plugin.json                 # 新增
│  └─ marketplace.json            # 新增
├─ commands/
│  ├─ parking-search.md           # 新增
│  ├─ parking-status.md           # 新增
│  ├─ parking-add.md              # 新增
│  └─ parking-list.md             # 新增
├─ skills/
│  └─ twparking/
│     └─ SKILL.md                 # 新增
├─ package.json                   # 改：bump 0.2.0
└─ README.md                      # 改：加 plugin 安裝說明
```

---

## Task 1: 抽出 `fetchTickViews` 共用 helper（TDD）

**Files:**
- Create: `src/commands/fetchTickViews.ts`
- Create: `src/commands/fetchTickViews.test.ts`
- Modify: `src/commands/watch.ts`

- [ ] **Step 1: 寫 failing test**

`src/commands/fetchTickViews.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchTickViews } from './fetchTickViews.js';
import { writeCatalog } from '../storage/catalogCache.js';
import { CITY_ADAPTERS } from '../adapters/index.js';

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-tick-'));
});

describe('fetchTickViews', () => {
  it('groups refs by city, joins catalog name, and reports per-city errors', async () => {
    await writeCatalog('基隆', [
      { city: '基隆', id: '信二停車場', name: '信二停車場', totalSpaces: 100 },
    ]);
    const spy = vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const result = await fetchTickViews([{ city: '基隆', id: '信二停車場' }]);

    expect(result.cityFetchErrors.size).toBe(0);
    expect(result.views).toHaveLength(1);
    expect(result.views[0]).toMatchObject({
      city: '基隆',
      id: '信二停車場',
      name: '信二停車場',
      totalSpaces: 100,
      availability: { availableSpaces: 25 },
    });
    spy.mockRestore();
  });

  it('records cityFetchErrors and surfaces fetchError on each view when adapter throws', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: 'X', name: 'X' }]);
    const spy = vi
      .spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability')
      .mockRejectedValue(new Error('boom'));

    const result = await fetchTickViews([{ city: '基隆', id: 'X' }]);

    expect(result.cityFetchErrors.has('基隆')).toBe(true);
    expect(result.views[0]?.fetchError).toBe('boom');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test，確認 FAIL**

Run: `pnpm test src/commands/fetchTickViews.test.ts`
Expected: FAIL with "Cannot find module './fetchTickViews.js'"

- [ ] **Step 3: 實作 `fetchTickViews.ts`**

```ts
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
```

- [ ] **Step 4: Run test，確認 PASS**

Run: `pnpm test src/commands/fetchTickViews.test.ts`
Expected: 2 PASS

- [ ] **Step 5: 改寫 `watch.ts` 用 helper**

整個檔案改成：

```ts
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
```

- [ ] **Step 6: Typecheck + 全套測試確認 watch 沒壞**

Run: `pnpm typecheck && pnpm test`
Expected: 全綠（既有 watchScreen.test.ts + 新的 fetchTickViews.test.ts 都過）

- [ ] **Step 7: Manual smoke watch**

Run: `timeout 3 pnpm dev watch --interval 60 基隆:信二停車場 2>&1 | tail -5`
Expected: 看到表格輸出、stopped. 字樣

- [ ] **Step 8: Commit**

```bash
git add src/commands/fetchTickViews.ts src/commands/fetchTickViews.test.ts src/commands/watch.ts
git commit -m "refactor(commands): extract fetchTickViews shared helper"
```

---

## Task 2: 在 `render/watchScreen.ts` export `renderTable`

**Files:**
- Modify: `src/render/watchScreen.ts`

- [ ] **Step 1: 把 `renderTable` 從 private 改成 export**

把 `src/render/watchScreen.ts` 第 31 行 `function renderTable(...)` 改成 `export function renderTable(...)`。其他不動。

- [ ] **Step 2: Typecheck + 既有測試**

Run: `pnpm typecheck && pnpm test src/render/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/render/watchScreen.ts
git commit -m "refactor(render): export renderTable for one-shot consumers"
```

---

## Task 3: 新增 `twparking now <refs...> [--json]` 子命令（TDD）

**Files:**
- Create: `src/commands/now.ts`
- Create: `src/commands/now.test.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: 寫 failing test**

`src/commands/now.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNow } from './now.js';
import { writeCatalog } from '../storage/catalogCache.js';
import { CITY_ADAPTERS } from '../adapters/index.js';

let stdoutBuf = '';
let stderrBuf = '';
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), 'twp-now-'));
  stdoutBuf = '';
  stderrBuf = '';
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutBuf += String(chunk);
    return true;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderrBuf += String(chunk);
    return true;
  });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe('runNow', () => {
  it('emits empty-ref error and exit 1 when no refs given', async () => {
    const code = await runNow([], { json: false });
    expect(code).toBe(1);
    expect(stderrBuf).toContain('no lots specified');
  });

  it('--json: emits structured array with iso updatedAt', async () => {
    await writeCatalog('基隆', [
      { city: '基隆', id: '信二停車場', name: '信二停車場', totalSpaces: 100 },
    ]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const code = await runNow([{ city: '基隆', id: '信二停車場' }], { json: true });

    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutBuf);
    expect(parsed).toEqual([
      {
        city: '基隆',
        id: '信二停車場',
        name: '信二停車場',
        totalSpaces: 100,
        availableSpaces: 25,
        updatedAt: '2026-05-13T03:23:00.000Z',
        fetchError: null,
      },
    ]);
  });

  it('text mode: emits the table with city/name/availability columns', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: '信二停車場', name: '信二停車場' }]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockResolvedValue([
      {
        city: '基隆',
        id: '信二停車場',
        availableSpaces: 25,
        updatedAt: new Date('2026-05-13T03:23:00Z'),
      },
    ]);

    const code = await runNow([{ city: '基隆', id: '信二停車場' }], { json: false });

    expect(code).toBe(0);
    expect(stdoutBuf).toContain('信二停車場');
    expect(stdoutBuf).toContain('25');
    expect(stdoutBuf).not.toContain('\x1b['); // no cursor escape
    expect(stdoutBuf).not.toContain('refresh every'); // no watch header
  });

  it('returns exit 1 when every view has fetchError', async () => {
    await writeCatalog('基隆', [{ city: '基隆', id: 'X', name: 'X' }]);
    vi.spyOn(CITY_ADAPTERS['基隆'], 'fetchAvailability').mockRejectedValue(new Error('down'));

    const code = await runNow([{ city: '基隆', id: 'X' }], { json: true });

    expect(code).toBe(1);
  });
});
```

- [ ] **Step 2: Run test，確認 FAIL**

Run: `pnpm test src/commands/now.test.ts`
Expected: FAIL with "Cannot find module './now.js'"

- [ ] **Step 3: 實作 `src/commands/now.ts`**

```ts
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
```

- [ ] **Step 4: Run test，確認 4/4 PASS**

Run: `pnpm test src/commands/now.test.ts`
Expected: 4 PASS

- [ ] **Step 5: 註冊 cli.ts**

在 `src/cli.ts` 的 `cli.command('watch ...')` 區塊「之前」插入：

```ts
cli
  .command('now <ref> [...refs]', 'one-shot fetch availability for given lots')
  .option('--json', 'JSON output')
  .action(async (ref: string, refs: string[], opts: { json?: boolean }) => {
    const all = [ref, ...refs].map(parseRefOrExit);
    process.exitCode = await runNow(all, { json: !!opts.json });
  });
```

並在檔案頂端 import 區補：

```ts
import { runNow } from './commands/now.js';
```

- [ ] **Step 6: Smoke test 真網路抓一次**

Run: `pnpm dev now 基隆:信二停車場 --json`
Expected: 印出 JSON 陣列、含 `availableSpaces` 數字、無 ANSI 碼

Run: `pnpm dev now 基隆:信二停車場`
Expected: 印出表格、無 cursor escape、無 "refresh every" 字樣

- [ ] **Step 7: 全套測試 + typecheck + build**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全綠

- [ ] **Step 8: Commit**

```bash
git add src/commands/now.ts src/commands/now.test.ts src/cli.ts
git commit -m "feat(cli): add 'now' subcommand for one-shot availability query"
```

---

## Task 4: Bump CLI 0.2.0 並 release（會發布到 npm）

⚠️ **這一 Task 會把 0.2.0 永久發布到 npm registry，發完不能撤回相同版號。** 確認 Task 1-3 都過再做。

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 改 version**

把 `package.json` 的 `"version": "0.1.2"` 改成 `"version": "0.2.0"`。

- [ ] **Step 2: Commit + push**

```bash
git add package.json
git commit -m "chore: bump to 0.2.0 for 'now' subcommand"
git push origin main
```

> 如果 push 失敗顯示 NextDriveBot 權限不足，跑：
> `gh auth switch --hostname github.com --user echoulen`
> 再 push 一次。

- [ ] **Step 3: 開 GitHub release 觸發 publish workflow**

```bash
gh release create v0.2.0 --title "v0.2.0" --generate-notes
```

- [ ] **Step 4: 等 workflow 跑完**

```bash
sleep 5 && gh run list --workflow=publish.yml --limit 1
gh run watch <run-id> --exit-status
```

Expected: 全綠、`pnpm publish` 成功

- [ ] **Step 5: 驗證 npm 上能裝、`now` 能跑**

```bash
cd /tmp && pnpm dlx twparking@0.2.0 now 基隆:信二停車場 --json
```

Expected: JSON 陣列、含 `availableSpaces`

---

## Task 5: 寫 plugin manifest

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: 寫 plugin.json**

```json
{
  "name": "twparking",
  "version": "0.1.0",
  "description": "查台北/新北/基隆/桃園/台中即時停車格剩餘量",
  "author": {
    "name": "echoulen"
  },
  "license": "MIT",
  "homepage": "https://github.com/echoulen/twparking"
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(plugin): add Claude Code plugin manifest"
```

---

## Task 6: 寫 4 個 slash commands

**Files:**
- Create: `commands/parking-search.md`
- Create: `commands/parking-status.md`
- Create: `commands/parking-add.md`
- Create: `commands/parking-list.md`

- [ ] **Step 1: `commands/parking-search.md`**

````markdown
---
description: 跨台北/新北/基隆/桃園/台中模糊搜尋停車場
argument-hint: <關鍵字> [--city 台北|新北|基隆|桃園|台中]
allowed-tools: Bash
---

User 給的搜尋輸入：`$ARGUMENTS`

請執行：

```bash
npx -y twparking@latest search $ARGUMENTS --json
```

把結果整理成中文短表格給使用者，每行格式：`城市:ID  名稱`。
- 沒 hit 時直接回「沒找到符合的停車場」、不要瞎猜
- 有超過 30 筆時、只列前 30 筆並告訴使用者還有幾筆
- 不要再去 `cat`/`grep` 任何檔案，CLI 給的就是全部資訊
````

- [ ] **Step 2: `commands/parking-status.md`**

````markdown
---
description: 查一或多個停車場的即時剩餘量（一次性）
argument-hint: <city>:<id> [<city>:<id> ...]
allowed-tools: Bash
---

User 要查的停車場：`$ARGUMENTS`

請執行：

```bash
npx -y twparking@latest now $ARGUMENTS --json
```

JSON 是一個 array，每個元素有 `city / id / name / totalSpaces / availableSpaces / updatedAt / fetchError`。

整理成中文表格回給使用者：
| 城市 | 停車場 | 剩餘 / 總數 | 更新時間 | 狀態 |

- `availableSpaces` ≤ 10 標「⚠ 將滿」
- `fetchError` 不是 null 標「✗ 抓取失敗: <message>」
- `totalSpaces` 是 null 顯示 `─`
- `updatedAt` 轉成 Asia/Taipei 的 HH:MM:SS
````

- [ ] **Step 3: `commands/parking-add.md`**

````markdown
---
description: 把停車場加進 favourites
argument-hint: <city>:<名稱或 id>
allowed-tools: Bash
---

User 要加的 ref：`$ARGUMENTS`

請執行：

```bash
npx -y twparking@latest add $ARGUMENTS
```

把 stdout/stderr 直接轉述給使用者：
- 成功時顯示「已加入 <city>:<id> <name>」
- 已存在時顯示「已在 favourites 中」
- 多個匹配時、把候選清單給使用者選
- 找不到時告訴使用者
````

- [ ] **Step 4: `commands/parking-list.md`**

````markdown
---
description: 列出 favourites
allowed-tools: Bash
---

請執行：

```bash
npx -y twparking@latest list --json
```

JSON 是一個 array、每個元素有 `city / id`。

- 空陣列時告知「目前沒有 favourites，請用 /parking-add 加入」
- 有資料時用中文清單列出，格式：`城市:ID`
````

- [ ] **Step 5: Commit**

```bash
git add commands/
git commit -m "feat(plugin): add 4 slash commands wrapping the CLI"
```

---

## Task 7: 寫 skill

**Files:**
- Create: `skills/twparking/SKILL.md`

- [ ] **Step 1: SKILL.md**

```markdown
---
name: twparking
description: 查台北/新北/基隆/桃園/台中即時停車格剩餘量。Use when user asks about Taiwan parking lot availability, looks for a specific lot, or wants to monitor favourites.
---

# twparking

CLI tool for Taiwan real-time parking data across 5 cities.

## When to use
- 使用者問「附近哪裡有空位」「XX 停車場現在剩幾位」
- 需要查/監控 favourite lots
- 模糊搜尋停車場名稱

## Install
`npm i -g twparking` 或直接 `npx -y twparking@latest ...`

## Subcommands cheat sheet
| Command | 用途 | Agent flag |
|---|---|---|
| `search <keyword> [--city X]` | 跨城市模糊搜 | `--json` |
| `now <refs...>` | 一次性拿剩餘量 | `--json` |
| `watch <refs...>` | TUI 監控 loop | **不要在 agent context 用** |
| `add <ref>` | 加進 favourites | — |
| `list` | 列 favourites | `--json` |
| `remove <ref>` | 移除 favourite | — |
| `refresh [--city X]` | 強制更新 catalog cache | — |

## Cities
台北 / 新北 / 基隆 / 桃園 / 台中

## Ref 格式
`<city>:<id>` — 例如 `基隆:信二停車場` 或 `台北:TPE0334`。

## Gotchas
- 基隆 adapter 走 HTML scraping，**沒有** address/district 欄位 → 不能依「區」查
- 各城市資料更新頻率不同，updatedAt 偶爾會明顯偏舊
- `watch` 是 TUI 長期 loop；agent 千萬不要直接呼叫，要單次查就用 `now`
- catalog cache 7 天 TTL；查不到新蓋的停車場可以建議使用者跑 `refresh`
- `now` 跟 `search` 都支援 `--json`、agent 一律帶 flag、之後再渲染給人看

## Slash commands
本 plugin 提供 `/parking-search`, `/parking-status`, `/parking-add`, `/parking-list` 對應 `search/now/add/list`。如果使用者沒明確下指令、可自行決定要不要呼叫 CLI。
```

- [ ] **Step 2: Commit**

```bash
git add skills/twparking/SKILL.md
git commit -m "feat(plugin): add skill teaching Claude when/how to use twparking"
```

---

## Task 8: 寫 marketplace manifest

**Files:**
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: marketplace.json**

```json
{
  "name": "echoulen-twparking",
  "owner": {
    "name": "echoulen",
    "url": "https://github.com/echoulen"
  },
  "plugins": [
    {
      "name": "twparking",
      "source": ".",
      "description": "查台灣即時停車格剩餘量"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): expose this repo as a Claude Code marketplace"
```

---

## Task 9: README 加 plugin 安裝段落

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 的「License」段落「之前」插入新段**

```markdown
## Use as a Claude Code plugin

本 repo 同時是一個 Claude Code marketplace、可直接安裝：

\`\`\`
/plugin marketplace add echoulen/twparking
/plugin install twparking@echoulen-twparking
\`\`\`

裝完之後可用 slash commands：

- `/parking-search <關鍵字> [--city <城市>]` — 模糊搜尋
- `/parking-status <城市>:<id> [...]` — 一次性查剩餘量
- `/parking-add <城市>:<名稱或 id>` — 加進 favourites
- `/parking-list` — 列 favourites

或直接用自然語言問 Claude，它會透過 skill 自動呼叫 CLI。

底層仍依賴本 npm 套件、首次呼叫會自動 `npx -y twparking@latest`，要長期使用建議：

\`\`\`
npm i -g twparking
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README plugin install + slash commands section"
```

---

## Task 10: Local 安裝驗證 + push

**Files:** —（驗證任務、不改檔案）

- [ ] **Step 1: Push 累積的 commits**

```bash
git push origin main
```

> 如果 push 失敗顯示 NextDriveBot 權限不足，跑 `gh auth switch --hostname github.com --user echoulen` 再 push。

- [ ] **Step 2: 在 Claude Code 裡用 local path 安裝測試**

在 Claude Code 裡執行：

```
/plugin marketplace add /Users/carlosli/work/twparking
/plugin install twparking@echoulen-twparking
```

Expected: 兩個指令都成功

- [ ] **Step 3: 跑 4 個 slash commands、各驗證一次**

```
/parking-search 信義 --city 台北
/parking-status 基隆:信二停車場
/parking-list
/parking-add 基隆:信二停車場
```

Expected：
- search 回中文表格
- status 回單行剩餘量、無 ANSI 碼
- list 回現有 favourites
- add 成功 / 已存在訊息

- [ ] **Step 4: 驗證 skill 自動觸發**

在 Claude Code 裡用自然語言問：「基隆信二停車場現在還有位嗎？」

Expected: Claude 自動呼叫 `npx twparking now ...`、回中文剩餘量

- [ ] **Step 5: 從 marketplace URL 安裝測試（end-user 模擬）**

新開一個 session：

```
/plugin marketplace add echoulen/twparking
/plugin install twparking@echoulen-twparking
/parking-status 基隆:信二停車場
```

Expected: 從 GitHub raw 抓得到 marketplace.json、成功安裝、status 跑出來

---

## Out of Scope（v0.1 plugin 之外）

- MCP server 形式（之後若需要再加）
- Plugin 自己的 hooks / agents
- Marketplace 收第二個 plugin
- 通知 / 桌面提醒
- Plugin 的 i18n
- `now` 的 `--watch` 模式（已經有 `watch` 了）
- `now` 的非 favourite 預設模式（refs 必須明確指定）

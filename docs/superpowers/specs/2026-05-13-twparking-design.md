# twparking — 設計文件

- **日期**：2026-05-13
- **狀態**：Draft（待 plan 階段）
- **作者**：colorbestfish 與 Claude（brainstorming 共筆）

## 概要

`twparking` 是一支終端 CLI，提供台北 / 新北 / 基隆 / 桃園 / 台中 五個城市公有停車場「即時剩餘車格」的查詢與監控功能。預期使用情境：

- 從常用停車場挑出幾座加入 favourites
- 出門前在終端跑 `twparking watch`，每 60 秒重整一次畫面，看哪幾座還有空位

## 目標與非目標

**目標（MVP，v0.1）**：

1. 五個城市的官方 open data 串接、輸出正規化資料
2. `search` 跨城市模糊搜尋停車場名稱
3. favourites 管理（add / list / remove）
4. `watch` 模式：line refresh、每 N 秒重整顯示 favourites 即時車位
5. `refresh` 強制重抓目錄快取
6. `search` / `list` 支援 `--json` 給 scripting

**非目標（MVP 不做、留給後續版本）**：

- 通知（macOS / Telegram / 閾值告警）
- TUI（fzf 風格 picker、htop 風格全螢幕）
- 背景 daemon
- 趨勢圖、歷史儲存
- 路邊停車格、機車格、身障格細分

## 使用者介面

執行檔名稱：**`twparking`**。

```
twparking search <關鍵字>               # 跨五城模糊搜尋（讀目錄快取）
  [--city 台北|新北|基隆|桃園|台中]
  [--json]

twparking add <城市>:<停車場ID或名稱>    # 例：twparking add 台北:信義公務中心
twparking list                          # 列出 favourites
twparking remove <城市>:<停車場ID>

twparking watch                         # 監控 favourites（line refresh）
  [--interval <秒>]                     # 預設 60
  [<城市>:<停車場ID> ...]               # 提供時暫時覆蓋 favourites

twparking refresh [--city <城市>]       # 強制重抓目錄快取
```

設計約定：

- 城市代號為繁中字串：**台北 / 新北 / 基隆 / 桃園 / 台中**，在 CLI args、config、cache、輸出全部一致
- `<城市>:<…>` 用半形冒號分隔；含引號自行依 shell 套：`twparking add "台北:信義公務中心"`
- `add` 傳名稱模糊比對到多筆 → stderr 印候選 ID 清單、exit 1，請使用者改用精確 ID
- `search` 預設跨五城市；`--city` 限定單一城市
- `search` / `list` 支援 `--json`（`watch` MVP 不支援 JSON）
- watch 用 cursor-home + clear-to-end-of-screen，不開 alternate screen；Ctrl+C 結束

## 架構

### 模組結構

```
src/
├─ cli.ts                 # cac 入口，解析 args → 分派到 commands
├─ commands/
│  ├─ search.ts
│  ├─ favourites.ts       # add / list / remove
│  ├─ watch.ts
│  └─ refresh.ts
├─ adapters/
│  ├─ types.ts            # CityAdapter interface + ParkingLot / Availability 型別
│  ├─ taipei.ts
│  ├─ ntpc.ts             # 新北
│  ├─ keelung.ts
│  ├─ taoyuan.ts
│  ├─ taichung.ts
│  └─ index.ts            # CITY_ADAPTERS 映射：'台北' → taipeiAdapter
├─ storage/
│  ├─ favourites.ts       # 讀寫 ~/.config/twparking/favourites.json
│  └─ catalogCache.ts     # 讀寫 ~/.cache/twparking/lots-<城市>.json + TTL
├─ render/
│  └─ watchScreen.ts      # 算欄寬、ANSI clear、組出每幀畫面
└─ util/
   ├─ fetchJson.ts        # 共用 HTTP（timeout / retry / UA / error）
   ├─ fuzzy.ts            # 名稱模糊比對
   └─ logger.ts
```

### CityAdapter interface

```ts
interface CityAdapter {
  city: '台北' | '新北' | '基隆' | '桃園' | '台中';
  fetchCatalog(): Promise<ParkingLot[]>;
  fetchAvailability(lotIds?: string[]): Promise<Availability[]>;
}
```

- 每個 adapter 自己處理該城市 API 的怪癖（auth、schema、編碼），對外只回正規化型別
- 新增/移除城市只動 `adapters/` 與 `index.ts`
- commands 永不直接 import 單一城市 adapter；走 `CITY_ADAPTERS[city]`
- adapter 不做 console 輸出；錯誤一律 throw `AdapterError(city, cause)`，呼叫端決定如何顯示

### 資料模型

```ts
interface ParkingLot {
  city: '台北' | '新北' | '基隆' | '桃園' | '台中';
  id: string;            // adapter 內保留原 API ID，跨城市不保證唯一
  name: string;
  address?: string;
  totalSpaces?: number;
  lat?: number;
  lng?: number;
}

interface Availability {
  city: ParkingLot['city'];
  id: string;
  availableSpaces: number;
  updatedAt: Date;       // API 給的 timestamp；沒給則用 fetch 完成時間
}

interface LotView extends ParkingLot {
  availability?: Availability;
  fetchError?: string;
}

interface FavouritesFile {
  version: 1;
  lots: Array<{ city: ParkingLot['city']; id: string }>;
}

interface CatalogCacheFile {
  version: 1;
  city: ParkingLot['city'];
  fetchedAt: string;     // ISO timestamp
  lots: ParkingLot[];
}
```

- `city + id` 為跨城唯一鍵；不自造 global ID 以避免 adapter 互相耦合
- `availableSpaces` 必需，其他欄位可選；不強迫所有城市 API 都提供 `totalSpaces`
- 所有檔案格式帶 `version: 1`，未來 schema 升級可判斷與遷移
- 讀到未知版本：catalog cache 視同失效重抓；favourites 印警告請使用者手動處理

## 資料來源

> 本節為設計階段假設。每個 adapter 第一支 commit 必須附上實際呼叫過的 endpoint URL 與一筆 sample response 證據（在 `fixtures/<城市>/` 下），plan 階段會把這個列為驗證步驟。

| 城市 | 來源 | 認證 | 備註 |
|---|---|---|---|
| 台北 | `data.taipei.gov.tw` 停車場剩餘車位 + 停車場資訊 | 無 | 兩支 API：catalog + 即時 |
| 新北 | `data.ntpc.gov.tw` 路外公共停車場資訊 + 即時剩餘 | 無 | 同上分兩支 |
| 基隆 | `data.klcg.gov.tw` 停車場資訊 / 剩餘車位 | 無 | 部分停車場無即時資料 |
| 桃園 | `opendata.tycg.gov.tw` 停車場資訊 + 即時 | 無 | 路外為主 |
| 台中 | `datacenter.taichung.gov.tw` 停車場資料 | 無 | catalog 完整、即時較不穩定 |

### Adapter 約定

- `fetchCatalog()`：呼叫該城市「停車場資訊」端點，正規化成 `ParkingLot[]`
- `fetchAvailability(lotIds?)`：呼叫「即時剩餘」端點，回 `Availability[]`
  - API 不支援按 ID 過濾 → 抓全城後在 adapter 內依 `lotIds` 過濾
  - 支援按 ID 查 → 優先用
- HTTP 一律走 `util/fetchJson`：UA = `twparking/<version>`、timeout 10s、5xx / network error 自動 retry 1 次（指數退避）
- 任何錯誤 throw `AdapterError(city, cause)`

### 錯誤策略

- **watch 模式**：單城市那一輪失敗 → 該城市 favourites 顯示 `fetchError`、其他城市正常更新、下一輪重試
- **search / refresh**：單城市失敗 → stderr 印警告、其他城市照常、exit 0；全部失敗才 exit 1
- 連續 5 輪同一城市失敗 → watch 標題列加 `(<城市> 持續失敗)` 提示

## 儲存佈局

依 XDG Base Directory：

```
~/.config/twparking/
└─ favourites.json           # 使用者狀態

~/.cache/twparking/
├─ lots-台北.json
├─ lots-新北.json
├─ lots-基隆.json
├─ lots-桃園.json
└─ lots-台中.json
```

- 檔名直接用中文，與 CLI 對外的城市代號一致
- 寫入用 atomic write（寫 `.tmp` → `rename`）避免 Ctrl+C 中斷檔案損毀
- catalog cache TTL **7 天**，過期由下次需要的 command 透明重抓
- 兩個目錄都是 lazy create（第一次寫入時 `mkdir -p`）
- 尊重 `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` 環境變數；未設則退回 `~/.config` / `~/.cache`

## Watch 迴圈

### 流程

```
twparking watch
└─ 1. 讀 favourites.json → [{city, id}, ...]
   2. 依 city 分組 → groups: Map<city, lotId[]>
   3. 每輪 (interval 秒):
      ├─ 並行對每個 group 呼叫該 city adapter.fetchAvailability(ids)
      ├─ 合併 Availability 與 catalogCache 的 ParkingLot → LotView[]
      ├─ render(views) → stdout (cursor home + clear-to-end + 印新內容)
      └─ sleep(interval)
   4. SIGINT (Ctrl+C):
      ├─ 印 "stopped." 到 stderr
      └─ exit 0
```

### 畫面範本

```
twparking · 2026-05-13 21:43:11 · refresh every 60s · Ctrl+C to stop

城市  停車場            剩餘 / 總數  更新時間    狀態
台北  信義公務中心       12 / 250    21:42:38
台北  101 購物中心        3 / 1843   21:42:40    ⚠ 將滿
新北  板橋車站           87 / 412    21:41:55
桃園  ─                   ─           ─          ✗ fetch error: timeout
```

- 第一行頂格：程式名、現在時間、refresh 間隔、退出提示
- 欄位：城市、名稱、剩餘/總數（總數缺則只顯示剩餘）、來源 timestamp（非 fetch 時間）、狀態
- 狀態欄：剩餘 ≤ 10 → `⚠ 將滿`；adapter 錯誤 → `✗ fetch error: <原因>`；其餘空白
- v1 不上色（避免干擾、簡化欄寬計算）；行寬不足截斷名稱欄、不換行
- render 是純函式 `render(views, terminal): string`，方便 snapshot test

### 韌性

- 單一 adapter 失敗 → 該城市行印錯誤狀態、其他正常、下一輪重試（不退避變慢，因為單城掛掉不影響其他城市）
- favourites 為空 → 印 `no favourites; use \`twparking add\` first.`、exit 1
- 用 `setTimeout` 而非 `setInterval`：每輪在 render 完成後起算下一輪，避免時鐘倒退或抓取慢於 interval 時 overrun

## 測試策略

- **adapter 單元測試**：fixture JSON → 預期 `ParkingLot[]` / `Availability[]`
- **render 單元測試**：給定 `LotView[]` + 終端寬度 → snapshot string
- **watch loop 整合測試**：mock adapter 與時間（fake timer），跑 3 輪確認畫面更新與單一城市錯誤路徑
- **城市 API smoke test**：每個 adapter 一個 `npm run smoke:<城市>` 真打 API 確認 schema 沒變；CI 不跑、開發者本機定期跑

## 套件與環境

- Node.js ≥ 20（內建 `globalThis.fetch`）
- TypeScript → ES2022 / ESM
- pnpm 為 package manager；lockfile 提交
- 入口：`bin: { "twparking": "dist/cli.js" }`，shebang `#!/usr/bin/env node`

### 依賴

- `cac` — CLI 解析
- `kleur` — 終端顏色（v1 僅標題與狀態欄輕量使用）
- `strip-ansi` + `string-width` — 中文字寬計算（欄位對齊）

不引入 axios / undici / dayjs（內建 `fetch` 與 `Intl.DateTimeFormat` 足夠）。

### Dev 依賴

- `vitest`、`tsx`、`@types/node`、`typescript`、`prettier`、`eslint`

### 目錄

```
twparking/
├─ src/                  # 見 #模組結構
├─ test/
│  ├─ adapters/
│  ├─ render/
│  └─ watch.test.ts
├─ fixtures/             # 各城市 API sample response
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ README.md
└─ .github/workflows/ci.yml   # lint + typecheck + test (Node 20, 22)
```

### Scripts

```json
{
  "dev": "tsx src/cli.ts",
  "build": "tsc -p tsconfig.build.json",
  "test": "vitest run",
  "smoke:台北": "tsx scripts/smoke.ts 台北",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit"
}
```

### 發佈與安裝

- v0.1.0 起發 npm，使用者 `pnpm add -g twparking` 全域安裝
- 也支援 `pnpm dlx twparking …`
- 不提供 single-binary（之後若有需求再用 `pkg` / `bun build --compile`）

## Roadmap（非 MVP，僅供參考）

- **v0.1**：5 城市 adapter + search / add / list / remove / watch / refresh（MVP）
- **v0.2**：欄位排序、watch 閾值高亮、`watch --json`
- **v0.3**：可能加 daemon 模式（若有實際需求）

## 開放問題

每個 adapter 實作時待驗證：

1. 各城市 catalog 與即時 API 的實際 endpoint URL、是否需要 query 參數或 header
2. 各城市 timestamp 欄位的時區（是 UTC 還是 +08:00 還是無時區）
3. 「總車位」是否所有城市都有；缺項是否需要 fallback 計算
4. 桃園 / 台中 API 是否有 rate limit

<p align="left">
  <img src="docs/logo-readme.svg" alt="twparking" width="440">
</p>

CLI 查台北 / 新北 / 基隆 / 桃園 / 台中 五個城市的即時停車格剩餘量。

## Install

```sh
pnpm add -g twparking
# 或一次性執行
pnpm dlx twparking search 信義
```

需要 Node.js ≥ 20。

## Usage

```sh
twparking search <關鍵字> [--city 台北|新北|基隆|桃園|台中] [--json]
twparking add <城市>:<停車場ID或名稱>
twparking list [--json]
twparking remove <城市>:<停車場ID>
twparking refresh [--city <城市>]
twparking watch [--interval 60] [<城市>:<停車場ID> ...]
```

### 範例

```sh
# 找含「信義」的停車場（跨五城）
twparking search 信義

# 加進 favourites（傳精確 ID）
twparking add 台北:TPE0334

# 也可以傳名稱、CLI 會找對應 ID
twparking add 台北:信義公務中心

# 列出 favourites
twparking list

# 開始 watch（預設每 60 秒重整一次畫面、Ctrl+C 結束）
twparking watch

# 不用 favourites、暫時指定要看哪幾個
twparking watch --interval 30 台北:TPE0334 新北:010001
```

### Watch 畫面

```
twparking · 2026-05-13 21:43:11 · refresh every 60s · Ctrl+C to stop

城市  停車場            剩餘 / 總數  更新時間  狀態
台北  信義公務中心      12 / 250     21:42:38
台北  101 購物中心       3 / 1843    21:42:40  ⚠ 將滿
桃園  中路停車場        ─            ─         ✗ fetch error: timeout
```

剩餘 ≤ 10 會顯示 ⚠ 將滿；單城 API 掛了那幾行顯示 ✗、其他城市正常更新。

## 資料來源

各城市官方 open data：

| 城市 | catalog | availability |
|---|---|---|
| 台北 | `tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json` | `TCMSV_allavailable.json` |
| 新北 | `data.ntpc.gov.tw/api/datasets/B1464EF0-…/json` | `data.ntpc.gov.tw/api/datasets/E09B35A5-…/json` |
| 基隆 | `e-traffic.klcg.gov.tw/KeelungTraffic/pages/park.jsp/`（HTML scraping） | 同左 |
| 桃園 | `opendata.tycg.gov.tw/api/dataset/f4cc0b12-…/resource/0381e141-…/download` | 同左 |
| 台中 | `motoretag.taichung.gov.tw/DataAPI/api/ParkingSpotListAPIV2` | 同左 |

停車場目錄會快取到 `~/.cache/twparking/lots-<城市>.json`，預設 7 天 TTL。Favourites 存在 `~/.config/twparking/favourites.json`，尊重 `XDG_CONFIG_HOME` / `XDG_CACHE_HOME`。

## Develop

```sh
pnpm install
pnpm dev search 信義         # tsx 跑原始碼
pnpm test                    # vitest
pnpm typecheck
pnpm build                   # dist/cli.js
node dist/cli.js --help
```

## Use as a Claude Code plugin

本 repo 同時是一個 Claude Code marketplace、可直接安裝：

```
/plugin marketplace add echoulen/twparking
/plugin install twparking@echoulen-twparking
```

裝完之後可用 slash commands：

- `/parking-search <關鍵字> [--city <城市>]` — 模糊搜尋
- `/parking-status <城市>:<id> [...]` — 一次性查剩餘量
- `/parking-add <城市>:<名稱或 id>` — 加進 favourites
- `/parking-list` — 列 favourites

或直接用自然語言問 Claude，它會透過 skill 自動呼叫 CLI。

底層仍依賴本 npm 套件、首次呼叫會自動 `npx -y twparking@latest`，要長期使用建議：

```
pnpm add -g twparking
```

## Branding

| 檔案 | 用途 |
|---|---|
| `docs/icon.svg` | 512×512 方形 logo（npm 套件頁、app 圖示） |
| `docs/social-preview.svg` | 1280×640 GitHub social preview，上傳到 repo Settings → Social preview |
| `docs/logo-readme.svg` | README 頂部的橫式 banner（即上方那張） |

需要 PNG 衍生檔可以用 `rsvg-convert` 或 `inkscape` 導出：

```sh
rsvg-convert -w 512 docs/icon.svg -o icon-512.png
rsvg-convert -w 1280 docs/social-preview.svg -o social-preview.png
```

## License

MIT

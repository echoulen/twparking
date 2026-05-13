# twparking Claude Code Plugin Design

**Date:** 2026-05-13
**Author:** carlos
**Status:** Approved (brainstorming complete)

## Goal

讓 Claude Code 使用者透過 plugin marketplace 一鍵安裝、之後用 slash command 或自然語言請 Claude 查台灣即時停車格資料。底層仍由現有的 `twparking` npm CLI 負責 fetch/parse/render；plugin 是這個 CLI 的「agent-friendly 入口」。

## Architecture

單一 git repo (`echoulen/twparking`) 同時扮演三種角色：

1. **npm 套件** — 既有的 `twparking@0.1.x` CLI，繼續發布
2. **Claude Code plugin** — 提供 slash commands + skill，呼叫底層 CLI
3. **Claude Code marketplace** — 對外宣告本 repo 含一個 plugin（即自己）

```
twparking/
├─ src/                              # CLI source（既有）
├─ dist/                             # built CLI（既有）
├─ .claude-plugin/
│  ├─ plugin.json                    # plugin 清單
│  └─ marketplace.json               # marketplace 清單
├─ commands/
│  ├─ parking-search.md
│  ├─ parking-status.md
│  ├─ parking-add.md
│  └─ parking-list.md
├─ skills/
│  └─ twparking/
│     └─ SKILL.md
└─ ... (既有檔案)
```

設計原則：plugin 自身不存任何資料、不重新實作搜尋/查詢邏輯，全部 delegate 給 CLI。CLI 是 plugin 的 backend。

## CLI 變更：新增 `now` subcommand

需求：slash command `/parking-status` 要一次性拿剩餘量並退出，不能用 `watch` 的 TUI loop（cursor 碼會讓 agent 解析很髒）。

### 介面
```
twparking now <refs...> [--json]
```
- `<refs...>` — 一個或多個 `<city>:<id>` 格式
- `--json` — 結構化輸出，預設為人類可讀的表格（與 watch 第一幀相同但無 cursor escape）
- exit code：所有 ref 都失敗時 1，其餘 0

### 輸出範例
人類可讀（預設）：
```
城市  停車場      剩餘 / 總數  更新時間  狀態
基隆  信二停車場  25 / ─       11:23:00
```

JSON：
```json
[
  {
    "city": "基隆",
    "id": "信二停車場",
    "name": "信二停車場",
    "totalSpaces": null,
    "availableSpaces": 25,
    "updatedAt": "2026-05-13T03:23:00.000Z",
    "fetchError": null
  }
]
```

### 實作策略
重用 `commands/watch.ts` 的 grouped fetch 邏輯與 `render/watchScreen.ts`：
- 抽出 `fetchTickViews(refs)` 純函式（兩者共用）
- `now` = 跑一次 `fetchTickViews` → 渲染（或 JSON.stringify）→ exit
- `watch` 改成 loop 版的 `now`

不重新發明 fetch / render；只多一個 entrypoint。

## Plugin 清單：`.claude-plugin/plugin.json`

```json
{
  "name": "twparking",
  "version": "0.1.0",
  "description": "查台北/新北/基隆/桃園/台中即時停車格剩餘量",
  "author": "echoulen",
  "license": "MIT",
  "homepage": "https://github.com/echoulen/twparking"
}
```

`commands/`、`skills/` 是 Claude Code plugin 的標準位置，會被自動載入；不需要在 `plugin.json` 顯式列出。

## Slash Commands（4 個）

每個 command 是一個 `commands/parking-*.md`，frontmatter 描述用途，body 是給 Claude 的 prompt 模板，內容呼叫 `npx twparking ...` 並要求把結果整理成中文表格回給使用者。

### `/parking-search <keyword> [--city X]`
- 對應 `npx twparking search "$KEYWORD" [--city X] --json`
- Claude 收到 JSON、用中文短表格列出 hits（`城市:ID  名稱`）
- 沒結果時直接告知

### `/parking-status <city>:<id>...`
- 對應 `npx twparking now <refs...> --json`
- Claude 用表格列出剩餘量、更新時間、狀態
- 剩餘 ≤ 10 標記「⚠ 將滿」（與 CLI 一致）

### `/parking-add <city>:<name-or-id>`
- 對應 `npx twparking add <ref>`
- 直接把 stdout/stderr 轉述給使用者

### `/parking-list`
- 對應 `npx twparking list --json`
- Claude 用中文列出 favourites

### 通用約定
- 命令模板都明確要求「跑完 CLI 後不要再去 grep / cat 任何檔案」、避免 agent 漫遊
- 都使用 `npx twparking@latest` 確保拿最新版（首次有冷啟成本，可接受）

## Skill：`skills/twparking/SKILL.md`

```markdown
---
name: twparking
description: 查台北/新北/基隆/桃園/台中即時停車格剩餘量。Use when user asks about Taiwan parking lot availability, looks for a specific lot, or wants to monitor favourites.
---

# twparking

CLI tool for Taiwan real-time parking data across 5 cities.

## When to use
- 使用者問「附近哪裡有空位」「XX 停車場現在剩幾位」
- 需要監控 / 追蹤 favourite lots
- 模糊搜尋停車場名稱

## Install
`npm i -g twparking`，或直接 `npx twparking@latest ...`

## Subcommands cheat sheet
| Command | 用途 | Agent 推薦 flag |
|---|---|---|
| `search <keyword>` | 跨城市模糊搜 | `--json` |
| `now <refs...>` | 一次性拿剩餘量 | `--json` |
| `watch <refs...>` | TUI 監控 loop | 不要在 agent context 用 |
| `add <ref>` | 加進 favourites | — |
| `list` | 列 favourites | `--json` |
| `remove <ref>` | 移除 favourite | — |
| `refresh [--city X]` | 強制更新 catalog cache | — |

## Cities
台北 / 新北 / 基隆 / 桃園 / 台中

## Gotchas
- 基隆 adapter 走 HTML scraping，無 address/district 欄位 → 不能依「區」查
- 各城市資料更新頻率不同，updatedAt 偶爾會明顯偏舊
- `watch` 是長期 TUI loop，agent 千萬不要直接呼叫；要單次查就用 `now`
- catalog cache 7 天 TTL；查不到新蓋的停車場可以建議使用者跑 `refresh`

## Slash commands
本 plugin 提供 `/parking-search`, `/parking-status`, `/parking-add`, `/parking-list` 對應上面的子命令；如果使用者沒明確下指令、Claude 可以自己決定要不要呼叫 CLI。
```

## Marketplace 清單：`.claude-plugin/marketplace.json`

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

`source: "."` 表示 plugin 內容就在 marketplace repo 本身。

## End-user 安裝流程

```
/plugin marketplace add echoulen/twparking
/plugin install twparking@echoulen-twparking
```

之後 `/parking-search 信義` 就能用，或自然語言問 Claude 也能觸發 skill。

## 測試策略

### CLI
- 對 `now` subcommand 寫 unit test：mock fetch、驗證 JSON / 表格輸出
- 既有的 watch.ts 測試需要小幅調整（如果共用邏輯抽出去）

### Plugin
- 不寫 automated test（沒有 plugin e2e infra）
- 手動驗收：
  1. 在本機 `/plugin marketplace add /Users/carlosli/work/twparking` 裝 local path
  2. 執行四個 slash command 各一次，確認輸出乾淨
  3. 自然語言問 Claude（不下 slash command），確認 skill 被自動觸發

## 發布流程

1. CLI 改動（`now` subcommand）→ bump 0.2.0 → release → npm publish（既有 GitHub Actions）
2. Plugin 檔案 → commit → push 到 main
3. Marketplace 自動可被使用（GitHub raw 內容已更新）

Plugin 跟 CLI **共用同一個 git repo 但不共用版本號**：CLI 走 npm semver、plugin 的版本由 `plugin.json` 自己管。第一版 plugin 抓 CLI `^0.2.0`（透過 `npx twparking@latest`，不嚴格 pin）。

## Out of scope（v0.1 plugin）

- MCP server 形式（之後有需要再加）
- Plugin 自己的 hooks / agents
- Marketplace 收第二個 plugin（先服務 twparking）
- 通知 / 桌面提醒（CLI 本身的 v0.1 也沒做）
- Plugin 的 i18n（先單純中文）

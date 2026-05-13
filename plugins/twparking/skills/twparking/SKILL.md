---
name: twparking
description: "查台北/新北/基隆/桃園/台中即時停車格剩餘量。Use when user asks about Taiwan parking lot availability, looks for a specific lot, or wants to monitor favourites."
---

# twparking

CLI tool for Taiwan real-time parking data across 5 cities.

## When to use
- 使用者問「附近哪裡有空位」「XX 停車場現在剩幾位」
- 需要查/監控 favourite lots
- 模糊搜尋停車場名稱

## Install
`pnpm add -g twparking` 或直接 `npx -y twparking@latest ...`

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
本 plugin 提供 `/parking-search`, `/parking-status`, `/parking-add`, `/parking-list` 對應 `search/now/add/list`。

使用者用自然語言問空位 / 找停車場時、應**主動**跑 `npx -y twparking@latest now/search ... --json`、把結果整理回中文表格給他，不要等使用者下 slash command。

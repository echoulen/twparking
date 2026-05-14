<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-readme-dark.svg">
    <img src="docs/logo-readme.svg" alt="twparking" width="440">
  </picture>
</p>

CLI 查台北 / 新北 / 基隆 / 桃園 / 台中 五個城市的即時停車格剩餘量。

## Install (CLI)

```sh
pnpm add -g twparking
# 或 npm / yarn
npm i -g twparking
```

需要 Node.js ≥ 20。裝完直接 `twparking --help`。

## Install (Claude Code plugin)

本 repo 同時是一個 Claude Code marketplace：

```
/plugin marketplace add echoulen/twparking
/plugin install twparking@twparking
```

裝完即可用 slash commands：

- `/parking-search <關鍵字> [--city <城市>]`
- `/parking-status <城市>:<id> [...]`
- `/parking-add <城市>:<名稱或 id>`
- `/parking-list`

底層仍依賴 npm 套件，首次呼叫會自動 `npx -y twparking@latest`；長期使用建議直接 `pnpm add -g twparking`。

## License

MIT

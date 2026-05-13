---
description: 列出 favourites
allowed-tools: Bash
---

請執行（不加 `--json` — 純文字輸出已經有 catalog join 後的友善名稱、JSON 反而只給 city/id）：

```bash
npx -y twparking@latest list
```

輸出每行是 tab 分隔：`<city>:<id>\t<name>`，例如 `基隆:信二停車場\t信二停車場`。

- 「no favourites」開頭表示空、告知「目前沒有 favourites，請用 /parking-add 加入」
- 有資料時用中文清單列出，格式：`城市:ID  名稱`

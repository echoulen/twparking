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

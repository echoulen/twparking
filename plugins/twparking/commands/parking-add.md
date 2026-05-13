---
description: "把停車場加進 favourites"
argument-hint: "<city>:<名稱或 id>"
allowed-tools: Bash
---

User 要加的 ref：`$ARGUMENTS`

請執行（stderr 也要收進來、CLI 用名稱模糊匹配多筆時候選會走 stderr）：

```bash
npx -y twparking@latest add $ARGUMENTS 2>&1
```

把輸出整理給使用者：
- `added <city>:<id> <name>` → 顯示「已加入 <city>:<id> <name>」
- `already in favourites: ...` → 顯示「已在 favourites 中」
- `multiple matches in <city>, please use a precise ID:` 開頭 → **不是錯誤**，把後面的候選清單列給使用者選、請他用精確 ID 再試一次
- `no match for ...` → 告訴使用者沒找到、可改用其他關鍵字

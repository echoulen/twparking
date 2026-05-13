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

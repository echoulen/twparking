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

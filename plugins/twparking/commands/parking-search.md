---
description: "跨台北/新北/基隆/桃園/台中模糊搜尋停車場"
argument-hint: "<關鍵字> [--city 台北|新北|基隆|桃園|台中]"
allowed-tools: Bash
---

User 給的搜尋輸入：`$ARGUMENTS`

請執行：

```bash
npx -y twparking@latest search $ARGUMENTS --json
```

把結果整理成中文短表格給使用者，每行格式：`城市:ID  名稱`。
- 沒 hit 時直接回「沒找到符合的停車場」、不要瞎猜
- 有超過 30 筆時、只列前 30 筆並告訴使用者還有幾筆
- 不要再去 `cat`/`grep` 任何檔案，CLI 給的就是全部資訊

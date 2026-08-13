# 教師退休試算

> **開案先讀：** [制度整合與舊制年資開發計畫](PROJECT_PLAN.md)
> 每次工作先核對進度總覽與第一個未完成階段；完成一段後必須通過該段檢核，再更新狀態與工作紀錄。

計算公式與法規版本集中記錄於 [CALCULATION_RULES.md](CALCULATION_RULES.md)，目前規則版本為 `MOE-114.12.26`。

舊制、基金制與個人專戶制的年資分段規則記錄於 [SERVICE_MODEL.md](SERVICE_MODEL.md)。

公立學校教師退休年資與退休金前端試算網站，特別將留職停薪拆成逐段紀錄，依退撫費用是否繳付決定是否採計年資；並支援舊制＋基金制合併年資、一次退休金、二分之一次退搭配二分之一月退、全額月退，以及一般、減額、展期與屆齡退休情境。

所有輸入採即時運算，頁首固定顯示目前方案與金額；方案比較器會窮舉同一退休年月可用的請領組合，呈現 58、65、75、85 歲累積金額，以及減額月退與展期月退的損益交叉年齡。年度比較可切換是否納入繼續任職收入。

網站另提供 `report.html`：完整解釋所有輸入資料、計算規則，並讀取瀏覽器中最近一次成功試算，產生可列印或另存 PDF 的退休規劃報表。

目前網站版本為 `2.0.0-rc.1`：舊制公式、輸入、方案比較、核定優惠存款與 A4 報表已完成自動及瀏覽器回歸；尚待三份去識別化正式審定／人事試算資料完成外部比對，尚未標示為正式驗證版。發布候選檢核詳見 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)。

直接開啟 `index.html` 即可使用；也可在專案目錄執行：

```powershell
python -m http.server 4173
```

再開啟 `http://localhost:4173`。

執行完整發布回歸：

```powershell
npm install
npx playwright install chromium
npm run test:release
```

線上版本：<https://retireplan-flax.vercel.app/>

本工具僅供規劃，不是正式退休審定。

開發範圍、已完成項目、已知缺口及逐階段驗收方式均記錄於 [PROJECT_PLAN.md](PROJECT_PLAN.md)。

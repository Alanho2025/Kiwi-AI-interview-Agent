### 🛠️ 3 高可行性產品與架構實作方案比較 (Issue #142 解決方案修訂)

依據實際工程可行性、資料庫現狀（`SessionReport` v7）與求職者真實需求，我們剔除了不可行的草人方案，精確梳理出 **三個切實可行、各有架構與產品側重取捨的實作方案**：

---

#### 方案 A：輕量級「面試故事與能力積木庫」方案 (Option A: Story Bank & Competency Blocks)

* **架構與設計**：
  - **核心邏輯**：不畫複雜的跨場數據折線圖，而是幫求職者將歷次練習中驗證過的專案經歷整理為 **「面試故事庫 (Verified Story Bank)」**。
  - **後端實作**：讀取 Completed 且 Status 為 `ready` 的 Session，提取 `report.roleFit` 與 `report.evidenceDiagnostics` 中的專案成效。
  - **前端呈現**：
    - 🟢 **已驗證強效故事 (3 個)**：例如 *「E-Commerce Chatbot 專案（已證明 API 自動化與系統設計）」*。
    - 🟡 *已有解答但缺少數據 (1 個)*
    - 🔴 *目標職缺尚未實證的 Gap (1 個)*
* **優點**：
  - **極度直觀實用**：求職者一眼能看懂自己手上有哪幾個好故事可以講。
  - **開發最快、風險最低**：無需複雜的趨勢演算法，後端 API 1~2 天即可完成，100% 確定性。
* **缺點**：
  - **缺少時間軸演進感**：無法展現求職者隨著練習次數增加的「進步趨勢折線」。

---

#### 方案 B：三階段「實證質地演變與階段就緒度」方案 (Option B: Phased Evidence Evolution & Readiness Banding) —— 【🏆 推薦方案】

* **架構與設計**：
  - **核心邏輯**：按相同 `target_role` 與 `deliveryMode` 聚合最近 $N$ 次練習，解決 Session 混雜問題。
  - **後端實作**：
    1. **實證質地演變**：計算同質練習中，真實經歷 (`direct_past_experience`) vs 假設性空話 (`hypothetical_understanding`) 的消長比例（堆疊圖）。
    2. **階段就緒度 (Readiness Banding)**：不給偽精準的 `82%`，而是給予階段區間（`Getting Started` ➔ `Building Evidence` ➔ `Role Fit Ready`），並列出解鎖條件（如「再補強 1 個團隊協作故事」）。
    3. **1-Click 練習建議**：附帶可選更正/更換的 HITL 預設練習卡片。
* **優點**：
  - **指標嚴謹且具時間演進感**：精確回答「我的回答是不是越來越有實證」，避免過度宣稱。
  - **完整符合 Issue #142 的邊界規範**：涵蓋 Session 比對過濾與 0 LLM 加載要求。
* **缺點**：
  - **需處理 Session 可比性過濾**：當同質 Session $< 2$ 時需處理空狀態與引導。

---

#### 方案 C：基於「真實面試反思 (Real-Interview Reflection)」的雙向校準方案 (Option C: Dual-Loop Reflection & Readiness Calibration)

* **架構與設計**：
  - **核心邏輯**：將進度看板設計為 **「Mock 練習 ➔ 真實面試反思 ➔ 能力圖譜校準」** 的雙向閉環（落實 [Further_requirement.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/Further_requirement.md) 第 58 行規範）。
  - **實作模組**：
    - **模組 1**：Mock 練習能力統計。
    - **模組 2 (Real Interview Reflection Card)**：求職者在參加完真實公司面試後，一鍵填寫簡短反思（如 *「今天 Auckland Eye 面試被問了系統設計，覺得答得很順/卡住」*）。
    - **模組 3 (Calibrated Readiness Map)**：結合 Mock 評分與求職者真實面試反思，標出「Mock 練習成功轉移至真實面試」的能力項，並動態調整下次 Mock 的選題權重。
* **優點**：
  - **產品壁壘極高**：將求職者的「真實面試體驗」融入進度追蹤，對實際拿 Offer 的幫助最大。
  - **完全閉環**：打通了 Practice ➔ Real Interview ➔ Reflection 的完整產品線。
* **缺點**：
  - **開發量最大**：需新增 Real Interview Reflection 的資料表/模型與互動 Entry。

---

#### 📊 3 大可行方案綜合評估表

| 評估維度 | 方案 A：面試故事積木庫 | 方案 B：實證演變與就緒度 (推薦) | 方案 C：真實面試反思雙向閉環 |
| :--- | :--- | :--- | :--- |
| **求職者實用價值** | 🟢 **高 (整理現成故事)** | 🟢 **高 (看見進步與就緒度)** | 🌟 **極高 (結合真實面試反思)** |
| **趨勢與時間演進感** | 低 (靜態故事庫) | 🟢 **高 (有演變堆疊圖)** | 中 (以反思事件為節點) |
| **開發速度與複雜度** | ⚡ **極快 (1-2 天)** | 🛠️ **中等 (依 Issue #142)** | 🏗️ **較大 (需新增 Reflection 表)** |
| **資料確定性與嚴謹度** | 🟢 **100% 確定** | 🟢 **100% 確定 (無偽數據)** | 🟢 **100% (含用戶真實反思)** |

---

請團隊審閱這三個切實可行的方案！若無疑慮，建議優先採用 **方案 B**（或以 **方案 A** 做為 Phase 1 快速切入）。

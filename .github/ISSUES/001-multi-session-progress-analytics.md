# [FEATURE] 實作多 Session 候選人成長聚合 API (progress-analytics) 與前端視覺化成長看板

## 📋 Issue Overview
本 Feature 旨在替 Kiwi AI Interview Agent 補齊**跨練習（Multi-Session）的候選人成長與進步追蹤機制**。透過新增後端聚合 API `GET /api/session/progress-analytics` 以及前端「您的成長足跡 (My Growth Journey)」視覺化區塊，讓非技術求職者與機構買家（大學 Career Offices）能直觀看見練習前後的實證能力提升與文化適應演進。

---

## 🎯 1. 為什麼要做？ (Problem & Motivation)

### 當前痛點 (Current Pain Points)
1. **單場練習孤島（Session Isolation）**：
   目前系統僅在 [ReportPage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/ReportPage.jsx) 提供單次練習的詳細診斷。當候選人完成多次（如 3~5 次）模擬面試後，主頁 [HomePage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/HomePage.jsx) 僅顯示靜態的 `Avg. Score` 和歷次得分列表，無法回答候選人最關心的核心問題：
   - *「我多練了幾次，到底有沒有進步？」*
   - *「我的答題內容是否從空泛的『假設性描述 (Hypothetical)』轉變為具體的『真實經歷 (Direct Past Evidence)』？」*
   - *「我對紐西蘭職場溝通風格（NZ Workplace Culture）的掌握度是否有提升？」*
2. **機構買家（Institutional Buyers）驗證訴求**：
   根據 [SUBMISSION-clean.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/SUBMISSION-clean.md) 規劃，Kiwi Coach 的核心 B2B 付費客戶為大學職涯中心（University Career Offices）。機構在採購或續約時，必須看到**學生群體在多次練習後的具體能力成長曲線**，而非單次練習的片段報告。

---

## 🔄 2. 它會改變什麼？ (Proposed Changes & Features)

### A. 後端數據聚合 API (`GET /api/session/progress-analytics`)
- **API 接口**：`GET /api/session/progress-analytics?limit=10` (需 `requireAuth` 驗證)
- **聚合邏輯**：
  1. **Score History**：提取最近 N 次練習的 Overall Score、Macro (溝通表達) 及 Micro (技術細節) 分數演進。
  2. **Evidence Evolution (STAR 實證轉化率)**：讀取 `report.evidenceDiagnostics.totals`，統計 `direct_past_experience` (真實經歷) vs `hypothetical_understanding` (假設性贅述) 在歷次練習中的消長。
  3. **NZ Culture Fit Trend**：追蹤 `nzWorkplaceFit` 4 大維度的得分成長。
  4. **Aggregated AI Coaching Summary**：聚合最近 3 次 Session 的強項、持續存在的 Gap，生成跨練習的總結與下一階段練習建議。

### B. 前端視覺化成長看板 (Growth Journey Dashboard)
在 [HomePage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/HomePage.jsx) 增加「您的成長足跡 (My Growth Journey)」展現區塊，包含三大視覺圖表：
1. **得分進步折線圖 (Score Trend Sparkline)**：直觀呈現 Overall / Macro / Micro 三條分數曲線。
2. **答題證據轉化堆疊圖 (Evidence Quality Stacking Bar)**：以顏色對比展示「空泛理論」如何逐漸被「真實實證」取代。
3. **紐西蘭職場適應雷達圖 (NZ Culture Fit Radar)**：展示團隊協作、自信謙遜度等指標的成長。
4. **AI 溫暖教練勳章與 Action Plan**：例如 🎖️ *「實證大師：連續兩場練習提供 >80% 真實案例」*。

---

## 📁 3. 要修改與新增哪些檔案？ (Affected Files & Architecture)

### 🔹 後端 (Backend)
- **[NEW]** `backend/src/services/session/sessionProgressAnalyticsService.js`
  - 負責從 `SessionReport` 聚合分數、證據結構統計及文化得分。
- **[MODIFY]** `backend/src/controllers/sessionController.js`
  - 新增 `getProgressAnalytics` controller 方法。
- **[MODIFY]** `backend/src/api.js`
  - 註冊 `GET /api/session/progress-analytics` 路由並掛載 `requireAuth` 中間件。
- **[NEW]** `backend/tests/robustness/report/reportProgressAnalytics.test.js`
  - 單元與健壯性測試（測試 0 次、1 次及多次 Session 的邊界數據處理）。

### 🔹 前端 (Frontend)
- **[MODIFY]** `frontend/src/api/sessionApi.js`
  - 新增 `fetchProgressAnalytics(limit)` API 請求函數。
- **[MODIFY]** `frontend/src/pages/HomePage.jsx`
  - 引入成長看板組件並排版於用戶 Dashboard 頂部。
- **[NEW]** `frontend/src/components/home/GrowthJourneySection.jsx`
  - 成長看板外層容器與狀態管理。
- **[NEW]** `frontend/src/components/home/ScoreTrendChart.jsx`
  - 折線圖組件。
- **[NEW]** `frontend/src/components/home/EvidenceEvolutionChart.jsx`
  - 答題質地堆疊條形圖組件。
- **[NEW]** `frontend/src/components/home/NZCultureRadarChart.jsx`
  - 文化適應雷達圖組件。

---

## ⚠️ 4. 對現在系統的影響是什麼？ (System Impact & Risk Analysis)

1. **資料庫層面 (Zero DB Schema Impact)**：
   - **完全無破壞性變動**。該 API 僅依賴現有的 `interview_sessions` 與 `session_reports` 資料表，直接提取已儲存的 JSON 診斷欄位，無需執行資料庫 Migration。
2. **API 向上相容 (Backwards Compatible)**：
   - 為新增的獨立端點，不會影響現有的 `GET /api/session/:id` 或單場報告生成流程。
3. **效能與 API 成本 (Low Overhead & Cost Safe)**：
   - 數據聚合主要為記憶體內（In-Memory）的 JSON 解析與陣列運算，回應時間小於 50ms。
   - 基本數據讀取**不產生任何額外的 LLM Token 成本**；僅在候選人主動點擊「生成跨 Session 整合教練建議」時，才觸發低成本 LLM 總結。

---

## 🚀 5. 預期會有什麼效果？ (Expected Outcomes & Success Metrics)

1. **用戶端 (Candidate Value)**：
   - **大幅提升複練習率 (Re-practice Rate)**：候選人能直觀看到自己的實證分數從 60% 提升至 85%，獲得極強的正向回饋，預期將 Session 完成次數提升 40% 以上。
   - **解決「答非所問/泛泛而談」問題**：透過「答題證據轉化圖」，明確提示求職者減少「假設性贅述」，多講「真實專案經驗」。
2. **商業與展演端 (Business & Pitch Value)**：
   - **完善 Stage 1 提案與 Pilot 驗證**：滿足 [SUBMISSION-clean.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/SUBMISSION-clean.md) 中向紐西蘭大學 Career Office 展示「產品能有效提升學生就業競爭力」的核心數據指標。

---

## 🧪 6. 驗證與測試計畫 (Acceptance Criteria)

- [ ] **後端測試**：`reportProgressAnalytics.test.js` 需通過 0 個 Session、1 個 Session、3 個以上 Session 等邊界測試，確認回應結構格式正確。
- [ ] **前端測試**：在 `HomePage.jsx` 正確渲染 3 大圖表，當 Session 數量低於 2 次時顯示「完成更多練習以解鎖成長曲線」的空狀態（Empty State）提示。
- [ ] **全套品質門禁**：執行 `backend` 與 `frontend` 的 `npm run lint` 和 focused Vitest 測試，確保無類型或代碼規範錯誤。

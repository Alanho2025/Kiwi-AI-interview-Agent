### 💬 Technical Scope Alignment Brief (Antigravity & Architect Confirmation)

Hi team / GPT, 

針對 **Issue #142：實作多 Session 候選人成長聚合 API (`/api/session/progress-analytics`) 與前端視覺化成長看板**，以下由 Antigravity 整理並確認本 Feature 的技術 Scope、資料契約（Data Contract）、邊界防護與實作藍圖：

---

#### 1. 明確邊界與核心目標 (Scope Boundaries & Non-Goals)

* **核心目標 (In-Scope Goal)**：
  將 Kiwi Coach 從「單場練習診斷工具」升級為「跨 Session 候選人成長追蹤平台」。透過讀取歷次 `SessionReport` 的診斷資料，向求職者與機構買家（Career Office）展示**能力成長曲線**、**STAR 實證結構演變**與**紐西蘭職場文化適應度**。
* **明確非目標 (Explicit Non-Goals / Out-of-Scope)**：
  1. **零 DB Schema 變動**：不修改現有數據庫 Table 結構，不新增 Migration。
  2. **頁面加載零額外 LLM 成本**：基礎資料聚合全部採用記憶體內（In-Memory）JSON 運算；僅在用戶主動點擊「生成跨 Session AI 建議」時才呼叫 LLM。
  3. **不破壞單場報告邏輯**：不修改現有 `ReportPage.jsx` 與 `/api/session/:id` 的運作。

---

#### 2. 架構與資料契約對齊 (Architecture & Data Contract)

##### A. 後端數據源對接 (Backend Data Sources)
* 數據提取來源：現有 `interview_sessions` 與 `session_reports` 資料表。
* 核心指標映射：
  - **Scores**：`report.scores.overall` / `macro` / `micro`
  - **Evidence Structure**：`report.evidenceDiagnostics.totals`（包含 `direct_past_experience`, `adjacent_experience`, `hypothetical_understanding`, `generic_filler`）
  - **NZ Culture Fit**：`report.nzWorkplaceFit.dimensionScores`

##### B. API JSON Response Schema (`GET /api/session/progress-analytics?limit=10`)
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalCompleted": 5,
      "scoreImprovement": 18,
      "currentReadinessBand": "Strong Match"
    },
    "scoreHistory": [
      { "sessionId": "uuid-1", "date": "2026-07-01", "role": "Frontend Engineer", "overall": 65, "macro": 70, "micro": 60 }
    ],
    "evidenceEvolution": [
      { "sessionId": "uuid-1", "directPast": 2, "adjacent": 3, "hypothetical": 4, "filler": 3 },
      { "sessionId": "uuid-2", "directPast": 6, "adjacent": 2, "hypothetical": 1, "filler": 0 }
    ],
    "nzCultureFitTrend": [
      { "sessionId": "uuid-1", "score": 60 },
      { "sessionId": "uuid-2", "score": 85 }
    ],
    "aggregatedCoaching": {
      "topStrengths": ["STAR 結構完整，Action 描述具體"],
      "persistentGaps": ["偶爾在情境題使用假設性描述 (Hypothetical)"],
      "nextActionPlan": "建議下一次練習著重於 Behavioral 面試中的團隊衝突範例。"
    }
  }
}
```

---

#### 3. 檔案變動與組件職責 (Target File Changes)

* **後端 (Backend)**：
  - `[NEW]` `backend/src/services/session/sessionProgressAnalyticsService.js`（資料聚合與指標算子）
  - `[MODIFY]` `backend/src/controllers/sessionController.js`（掛載 `getProgressAnalytics` controller）
  - `[MODIFY]` `backend/src/api.js`（註冊 API 端點與 `requireAuth` 中間件）
  - `[NEW]` `backend/tests/robustness/report/reportProgressAnalytics.test.js`（Vitest 健壯性測試）

* **前端 (Frontend)**：
  - `[MODIFY]` `frontend/src/api/sessionApi.js`（對接 API Client）
  - `[MODIFY]` `frontend/src/pages/HomePage.jsx`（頁面版面整合）
  - `[NEW]` `frontend/src/components/home/GrowthJourneySection.jsx`（成長看板外層）
  - `[NEW]` `ScoreTrendChart.jsx`, `EvidenceEvolutionChart.jsx`, `NZCultureRadarChart.jsx`（三大視覺圖表組件）

---

#### 4. 驗證與 Acceptance Criteria

1. **零 Session / 1 次 Session 邊界處理**：當 Session 筆數 $< 2$ 時，前端呈現優雅的「空狀態提示（Empty State）」，引導用戶完成第 2 次練習解鎖圖表。
2. **效能要求**：API 回應時間 $\le 50\text{ms}$，無耗時資料庫 Join 操作。
3. **品質門禁**：通過 `npm run lint` 與後端 Vitest 測試套件。

---

請確認上述 Scope、API Schema 與檔案規劃是否完善，若無異議，我們將依照此藍圖開始執行實作！

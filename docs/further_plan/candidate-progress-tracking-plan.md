# 候選人面試練習進度與成長追蹤實作計畫

本文件基於對開源 AI 面試練習專案的調研，規劃如何在 Kiwi AI Interview Agent 中設計並實作**「候選人進度與成長追蹤面板 (Progress & Growth Dashboard)」**。該面板專為非技術利害關係人（Non-tech Candidates）設計，以直觀的視覺化指標和教練建議，展示其在多次模擬面試中的進步與成效。

---

## 1. 背景與核心價值 (Background & Core Value)

目前，Kiwi AI Interview Agent 僅針對單次練習（Session）提供詳細報告。當候選人進行多次練習時，唯一可見的歷史成效僅有主頁的 `Avg. Score` 以及歷次 Session 的綜合得分。

對於非技術背景的候選人而言，他們需要更直觀、更具鼓勵性且可操作的成長反饋：
*   **「我是否越說越好了？」**：語音表達與論證結構的進步。
*   **「我是否能給出更多真實經歷，而不是空泛的理論？」**：答題證據強度的轉變。
*   **「我對紐西蘭職場文化/崗位要求的覆蓋度是否提高了？」**：文化適應度與專業意圖覆蓋率。
*   **「我下一步應該練習什麼？」**：跨 Session 的 AI 整合教練建議。

本計畫旨在利用 Kiwi 現有的 `SessionReport` 和 `SessionAnalysis` 資料庫，在**不修改後端 Schema** 的前提下，聚合歷史數據，為候選人量身打造一個驚艷的成長看板。

---

## 2. 後端設計與資料聚合 (Backend API Design)

為了收集歷次 Session 的細粒度數據，我們將設計一個全新的聚合 API：`GET /api/session/progress-analytics`。

### A. 接口規範
*   **路徑**：`/api/session/progress-analytics` (需通過 JWT `requireAuth` 驗證)
*   **查詢參數**：`limit` (預設 10，最大 30，獲取最近的 Session 數據)
*   **返回數據結構 (JSON)**：
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalCompleted": 5,
      "scoreImprovement": 18, // 相比第一次練習提升的分數
      "currentReadinessBand": "Strong Match"
    },
    "scoreHistory": [
      { "sessionId": "uuid-1", "date": "2026-07-01", "role": "Frontend Developer", "overall": 65, "macro": 70, "micro": 60 },
      { "sessionId": "uuid-2", "date": "2026-07-05", "role": "Frontend Developer", "overall": 72, "macro": 75, "micro": 68 },
      { "sessionId": "uuid-3", "date": "2026-07-10", "role": "Frontend Developer", "overall": 83, "macro": 85, "micro": 81 }
    ],
    "evidenceEvolution": [
      { "sessionId": "uuid-1", "directPast": 2, "adjacent": 3, "hypothetical": 4, "filler": 3 },
      { "sessionId": "uuid-2", "directPast": 4, "adjacent": 4, "hypothetical": 2, "filler": 1 },
      { "sessionId": "uuid-3", "directPast": 6, "adjacent": 2, "hypothetical": 1, "filler": 0 }
    ],
    "nzCultureFitTrend": [
      { "sessionId": "uuid-1", "score": 50 },
      { "sessionId": "uuid-2", "score": 75 },
      { "sessionId": "uuid-3", "score": 90 }
    ],
    "aggregatedCoaching": {
      "topStrengths": ["STAR 法則結構完整，行動 (Action) 描述具體", "工作經歷與目標崗位匹配度高"],
      "persistentGaps": ["在回答高難度情境題時，偶爾會使用假說型描述 (Hypothetical)"],
      "nextActionPlan": "建議下一次練習著重於 'Behavioral' 類型，並多準備 2 個關於『團隊衝突解決』的真實故事。"
    }
  }
}
```

### B. 數據查詢與加工邏輯
我們將在 `backend/src/services/sessionService.js` 中新增聚合服務：
1.  **歷次分數提取**：從 `SessionReport` 中提取 `report.scores.overall`、`macro`、`micro`，並結合 `interview_sessions` 的 `created_at`。
2.  **證據結構演變 (STAR 轉化率)**：
    *   讀取 `report.evidenceDiagnostics.totals`，其中包含了 `direct_past_experience` (直接經歷)、`adjacent_experience` (鄰近經歷)、`hypothetical_understanding` (假設性回答)、`generic_filler` (通用贅述) 的出現次數。
    *   計算 **「STAR 實證回答佔比」**。這是一個非技術 stakeholder 能夠立刻理解的指標：*「以前你的回答有 60% 是假說，現在有 85% 都是真實經歷！」*
3.  **教練建議聚合 (LLM Summary)**：
    *   當候選人點擊「生成成長總結」時，將最近 3 次 Session 的 `report.recommendations` 與 `betterAnswerPlan` 的文本片段作為 Context，送入低延遲 LLM，生成一份簡明扼要、充滿溫度與鼓勵的「跨練習成長報告」。

---

## 3. 前端 UI/UX 設計與視覺化呈現 (Frontend UI/UX Design)

我們將在前端的 `HomePage.jsx` 新增一個「**您的成長足跡 (My Growth Journey)**」切換分頁，或者在主頁 StatsSection 下方新增一個展開式區塊。

為了符合 Kiwi 專案的高端視覺風格（磨砂玻璃質感、流暢的漸變與動態效果），我們規劃如下設計：

### A. 成長足跡三大視覺看板
1.  **「得分進步曲線」 (Score Trend Sparkline)**
    *   以折線圖展示 `Overall Score`、`Communication (Macro) Score` 與 `Technical (Micro) Score` 的演進。
    *   非技術點撥：提示候選人「你的表達流暢度 (Macro) 提升速度快於技術細節 (Micro)，說明溝通技巧已大有斬獲！」
2.  **「答題證據轉化漏斗」 (Evidence Quality Stacking Bar)**
    *   利用漸變色的堆疊條形圖（Stacked Bar Chart），展示每次練習中「真實經歷」與「假設 filler」的比例變化。
    *   視覺震撼：第一條（過去）是一片灰暗的 hypothetical filler 佔主導，最後一條（現在）則是亮綠色的 `direct_past_experience` 佔絕大多數。
3.  **「紐西蘭文化適應與軟實力雷達」 (NZ Workplace Nuances Radar)**
    *   展示候選人對「紐西蘭職場溝通風格（如誠實自謙、主動協作、Kiwi Context）」的掌握度。

### B. AI 溫暖教練面板 (Consolidated AI Coach Dashboard)
*   **進步勳章 (Milestone Achievements)**：例如 🎖️ *「證據大師：連續兩次面試提供 80% 以上真實案例」*、📈 *「突飛猛進：得分相較首場練習提升了 18%」*。
*   **下一步練習重點卡片**：直接給予一鍵跳轉的 Action Button（例如：*「前往練習 Behavioral 面試」*）。

---

## 4. 前端技術選型與依賴說明 (Technology & Dependency Approvals)

為了呈現精美的圖表，我們有兩種實作方案供選擇：

### 方案一：引入外建圖表庫 Recharts (推薦)
*   **優點**：基於 React SVG 的聲明式圖表庫，動畫效果極佳，與 Tailwind CSS 配合良好，適合繪製折線圖、雷達圖與堆疊條形圖。
*   **所需審批**：
    *   安裝依賴：`npm install recharts`
    *   *註：根據 `AGENTS.md`，此依賴安裝需在執行前獲得用戶的顯式審批。*

### 方案二：純 SVG + CSS 動畫自研圖表 (零依賴方案)
*   **優點**：100% 零依賴，代碼體積小，完全符合項目現有架構，免去第三方依賴安全審查。
*   **作法**：手動用 React 繪製 `<svg>` 的 `<polyline>` 和 `<rect>`，並加上 CSS 漸變與 `stroke-dasharray` 進入動畫。
*   **缺點**：雷達圖與複雜工具提示（Tooltips）開發成本稍高。

---

## 5. 驗證與發布計畫 (Verification & Handoff Plan)

1.  **單元測試**：在 `backend/tests/robustness/report/reportProgressAnalytics.test.js` 中編寫 API 測試，確保在不同 session 數量、邊界情況（如 0 個或 1 個 session）下 API 均能正確返回，不報錯。
2.  **UI/UX 評估審查**：實作前提供 Figma 級別的前端組件示意圖或 CSS 樣式預覽給設計團隊審查，確保磨砂玻璃與漸變效果符合 Kiwi 的視覺設計規範。

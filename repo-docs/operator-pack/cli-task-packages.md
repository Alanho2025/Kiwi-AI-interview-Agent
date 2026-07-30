# 標準 CLI 任務包與 Prompt 模版 (Standardized CLI Task Packages)

當你需要使用 AI CLI (Codex / Antigravity) 進行程式碼修改、Bug 修復或大規模優化時，**千萬不要發送模糊的指令**（如「幫我修 Voice Bug」或「優化匹配」）。

傳送模糊指令會導致 CLI：
- 盲目重構不相關的檔案。
- 引入未經授權的新 npm 套件。
- 改壞已經測試通過的功能。
- 快速耗盡你的 Token 額度。

使用本頁提供的 **【6 大要素標準任務包】** 結構，將需求精準包裝後發送給 CLI。

---

## 📋 任務包 6 大必要要素 (The 6 Essential Elements)

1. **症狀 (Symptom)**：使用者在 UI 看到或測試中發生的具體現象。
2. **預期行為 (Expected)**：修復後系統應該表現出的正確邏輯。
3. **證據與現狀 (Evidence)**：失敗的測試名稱、Log 輸出或 `git diff` 現狀。
4. **允許修改範圍 (Allowed Files)**：明確限制 CLI 只能修改哪幾個 `.js` 或測試檔。
5. **禁止事項 (Forbidden Rules)**：明確禁止改動的邊界（如：禁止改動評分 Prompt、禁止引入新套件、禁止重構不相關模組）。
6. **驗收標準 (Acceptance Criteria)**：明確的單指令測試全綠指標與 `git diff --check` 通過。

---

## 📦 複製貼上 Prompt 模版

### 範本 1：語音澄清與意圖誤判修復 (Voice Clarification Repair)

```markdown
【Kiwi CLI 任務包 - 語音意圖分類修復】

1. 症狀：
   當候選人在面試中說「Can you explain what you mean by that?」時，系統將其錯判為 answer，記錄了 answer record 並跳到了下一題。

2. 預期行為：
   - 此語音 turn 必須被分類為 clarification (turnType: "clarification")。
   - countsAsAnswer 必須為 false，不得寫入 answer record，不得觸發 evaluator 評分。
   - currentQuestionIndex 與 activeRootQuestionId 保持不變。
   - 系統發出 Clarification 說明，引導候選人重新回答當前題目。

3. 證據：
   - 執行 `npm run test:voice` 顯示 Failure: Expected turnType to be "clarification", but got "answer".

4. 允許修改範圍：
   - backend/src/services/voice/questionScopeClarificationService.js
   - backend/src/services/voice/duplexTurnCoordinator.js
   - backend/tests/robustness/voice/ (新增 regression test)

5. 禁止事項：
   - 嚴禁修改評分 Prompt 與 Schema。
   - 嚴禁改動任何 Report 生成或 UI 頁面。
   - 嚴禁安裝任何新 npm 套件。

6. 驗收標準：
   - 在 backend 目錄執行 `npm run test:voice` 全綠通過。
   - 新增 exact transcript 測試案例。
   - 執行 `git diff --check` 無語法錯誤。
```

---

### 範本 2：Candidate Report 敏感資訊過濾 (Report Projection Leak Repair)

```markdown
【Kiwi CLI 任務包 - 報告 Candidate 視圖安全過濾修復】

1. 症狀：
   生成的 Candidate Report JSON 中包含了內部評分器的 execution cost 與內部 Gap 思考文案 (internalGapRationale)。

2. 預期行為：
   - 在 reportPublicationSummaryService.js 的 candidateProjection 過濾器中，必須安全抹除所有 internalGapRationale、executionCost 及系統內部診斷代碼。
   - Candidate 視圖僅保留具建設性的輔導建議 (coaching feedback) 與證據引用。

3. 證據：
   - 執行 `npm run test:report` 顯示 Failure: Candidate report contains internal execution cost.

4. 允許修改範圍：
   - backend/src/services/report/reportPublicationSummaryService.js
   - backend/src/services/report/candidateReportReflectionService.js
   - backend/tests/robustness/report/

5. 禁止事項：
   - 嚴禁改動 Raw Evaluation 的產出格式與評分算法。
   - 嚴禁改動前端 ReportPage.jsx UI 組件結構。

6. 驗收標準：
   - 在 backend 目錄執行 `npm run test:report` 全綠通過。
   - 執行 `git diff --stat` 確認僅修改指定 3 個檔案。
```

---

### 範本 3：通用大規模優化與迭代 (Large Optimization Task)

```markdown
【Kiwi CLI 任務包 - [填寫優化目標，例：CV-JD 匹配效能優化]】

1. 目標與需求：
   [描述需求]

2. 預期 Outcome：
   [描述修復/優化後的成果]

3. 允許修改範圍 (Allowed Scope)：
   - [明確檔案路徑 1]
   - [明確檔案路徑 2]

4. 影響半徑與禁止事項 (Forbidden)：
   - 嚴禁修改其他流水線 (Voice / Report / Interview) 的程式碼。
   - 變更前必須先說明修改策略與 Impact Radius。

5. 驗收標準：
   - 執行 `npm run test:<module>` 測試全綠。
   - 執行 `git diff --stat` 顯示修改檔案不超出允許範圍。
```

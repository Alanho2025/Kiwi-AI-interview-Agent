### 🔄 Issue #142 Specification Revision (Based on Owner Review)

感謝 Owner (@Alanho2025) 提出的嚴謹架構與產品審查！完全同意：「**不能先做三張圖再回頭猜資料代表什麼；資料契約與比對邊界必須先基於真實 codebase 說真話。**」

依據 2026-07-31 對 `backend/src/api/routes/sessionRoutes.js`、`backend/src/controllers/sessionController.js` 及 `SessionReport` (schemaVersion `v7`) 的實地代碼核對，現將 **Issue #142** 的 Data Contract、Session 可比性邏輯、路由架構與 Acceptance Criteria 重新修訂如下：

---

### 1. 🎯 產品定位與範疇收斂 (Scope Boundaries & Non-Goals)

* **產品定位**：本 Issue **僅限於 Candidate Personal Progress Dashboard**（個人隱私隔離 `user_id` 視角）。
* **明確非目標 (Non-Goals)**：
  1. **禁止混入 B2B Cohort 功能**：機構買家（Career Office）所需的匿名化群體數據、RBAC、同意機制、最少 Cohort 人數 ($N \ge 10$) 屬於獨立的 Future B2B Issue，**本 API 嚴禁宣稱滿足 B2B 驗證需求**。
  2. **Zero DB Schema Migration**：全運算讀取既有 PostgreSQL `interview_sessions` 與 MongoDB `session_reports` JSON 欄位。
  3. **一般 Dashboard 加載 0 LLM 呼叫**：全數採用 Deterministic 記憶體運算。

---

### 2. 🔍 Session 可比性與篩選規則 (Session Comparability Rules)

只有滿足以下**全部條件**的 Session 才可納入比對與演進趨勢計算：

1. **使用者隔離**：`user_id === req.user.id` 且 `deleted_at IS NULL`。
2. **完成狀態**：`interview_sessions.status === 'completed'`。
3. **報告可信度**：`session_reports.latestStatus IN ['ready', 'ready_after_repair']`。
4. **相容模式與 Schema**：相同 `deliveryMode` (`text` 或 `voice`) 且 `schemaVersion === 'v7'`。
5. **目標/領域群組 (Objective/Role Isolation)**：
   - 預設按 `target_role` / `job_family` 進行同質群組聚合。
   - 若可比 Session 筆數 $< 2$，則標記 `insufficient_comparable_sessions: true`，不強行繪製無意義的跨職缺成長折線。

---

### 3. 📊 Evidence Evolution 分母與欄位缺失處理 (Denominator & Field Safety)

* **Denominator 定義**：
  - `sampleSize` = 該場 Session 中**經採納的候選人回答總回合數 ($N_\text{accepted\_turns}$)**。
  - 比例計算公式：$\text{Direct Evidence Rate} = \frac{\text{direct\_past\_experience count}}{N_\text{accepted\_turns}}$。
* **欄位缺失防護 (Missing/Legacy Fields Safety)**：
  - 絕不將缺失欄位默認為 `0`（避免將舊版數據誤診為零分）。
  - 若 `report.evidenceDiagnostics` 或 `nzWorkplaceFit` 缺失，該維度標示為 `status: "unavailable"`。
  - 當符合條件的 Session $< 2$ 時，前端呈現 `insufficient_data` 空狀態，提示求職者：「完成第 2 次相同類型的面試以解鎖能力演進圖表」。

---

### 4. 🛠️ 路由與三階段實作藍圖 (Routing & 3-Phase Architecture)

#### 路由掛載修正
修訂至 [sessionRoutes.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/api/routes/sessionRoutes.js)：
```javascript
// router.get('/history', getSessionHistory);
router.get('/progress-analytics', getProgressAnalytics); // 必須置於 /:sessionId 之前！
router.get('/:sessionId', getSession);
```

#### 三階段實作藍圖
* **Phase A: Deterministic Backend Analytics**
  - 新增 `sessionProgressAnalyticsService.js` 與 `getProgressAnalytics` controller。
  - 零 LLM 呼叫，完成安全聚合與嚴格權限隔離。
  - 完成 Vitest 健壯性測試套件。
* **Phase B: Candidate Dashboard UI & Edge States**
  - 實作前端 `GrowthJourneySection.jsx` 及圖表。
  - 嚴格處理解載中、API 失敗、`insufficient_data` 及部分欄位 `unavailable` 狀態。
* **Phase C: Optional Coaching Synthesis (獨立 Endpoint)**
  - 端點：`POST /api/session/progress-analytics/coaching-summary`
  - 僅在求職者主動點擊時觸發，完全依據 Phase A 算出的 Deterministic 分析結果生成，並記錄 Token/Cost 數據。

---

### 5. 📉 產品假設與效能指標 (Hypotheses & Performance Targets)

* **Product Hypothesis**：個人成長可視化能提高候選人完成第二次以上練習的意願。
* **Measurement Plan**：Dashboard 曝光率 vs. 重複練習完成率 (Repeat-Session Completion Rate)。
* **Performance Target**：在 $N \le 30$ 場歷史紀錄的測試環境下，API 回應時間 **p95 $\le 100\text{ms}$**。

---

### 🧪 6. 全面 Acceptance Criteria (11 大邊界條款)

- [ ] **不同 JD/Objective 隔離**：跨領域或不同模式的 Session 不被錯誤合併為一條成長線。
- [ ] **Legacy / Missing 欄位安全**：缺失診斷欄位回傳 `unavailable`，不默認為 0。
- [ ] **Schema Version 混合處理**：非 `v7` 或結構不符的舊報告不納入分數趨勢。
- [ ] **狀態過濾**：已刪除 (`deleted_at NOT NULL`)、未完成 (`in_progress`) 或 `needs_review` 的 Session 必須排除。
- [ ] **單場/極少 Session 處理**：可比 Session $< 2$ 時傳回 `insufficient_data` 並展示引導 UI。
- [ ] **用戶隔離 (Ownership Isolation)**：無法存取其他 `user_id` 的 Session Analytics。
- [ ] **Limit 參數與最大上限**：`limit` 參數校驗（1 ~ 30），超過自動截斷為 30。
- [ ] **確定性排序與時區**：時間戳統一採用 ISO 8601 UTC 格式，依 `created_at ASC` 穩定排序。
- [ ] **隱私防護 (Privacy Boundary)**：Analytics JSON 回應中**嚴禁包含** Raw Transcript、CV 內文或 raw JD 文字。
- [ ] **一般加載 0 LLM 呼叫**：`GET /progress-analytics` 執行過程 0 次 Evaluator / LLM 呼叫。
- [ ] **前端容錯處理**：妥善處理部分數據 `unavailable`、網路失敗與載入狀態。

---

請 Owner 審閱修訂後的 Data Contract 與 Acceptance Criteria！若此架構符合要求，我們將嚴格按照 **Phase A -> Phase B -> Phase C** 逐步推進。

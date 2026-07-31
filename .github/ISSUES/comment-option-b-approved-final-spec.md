### 🚀 Approved Official Specification: Option B (Candidate Progress Dashboard & 15-Min Practice Closed Loop)

**Status**: ✅ APPROVED by Owner (@Alanho2025) as the official implementation spec for **Issue #142**.

---

## 1. 🎯 核心產品目標與閉環 (Core Value & Closed Loop)

本 Feature 的核心產品目標不是做單純的故事管理或虛榮圖表，而是打造可信的**個人進度視角與 15 分鐘針對性練習閉環**：

```text
Comparable practice evidence 
  -> Identify persistent gap 
  -> Candidate confirms/selects focus (Low-friction HITL) 
  -> Targeted 15-min practice 
  -> Measure evidence change
```

---

## 2. 👑 四階練習就緒度 (Four Practice Readiness Stages)

 readiness 定義為 **"Readiness within the current Kiwi practice rubric and comparable-session evidence"**（不宣稱真實面試 Offer 通過率）：

- **Stage 1: Needs Context** (缺乏脈絡)：回答僅停留在通用理論或宣告，缺少具體專案情境。
- **Stage 2: Building Evidence** (實證建構中)：STAR 架構完整，但個人貢獻與成效待量化。
- **Stage 3: Consistently Demonstrated** (持續穩定實證)：專案實證充分、符合在地溝通風格，無明顯 Answer Drift。
- **Stage 4: Strong Practice Evidence / Practice Ready** (高實證就緒)：在相同 Scoring Schema 練習中持續展現強實證，具備高練習勝任力。

---

## 3. 🔍 5 重同質 Session 比對過濾鏈 (5-Layer Comparability)

只有符合下列全部條件的 Session 才納入趨勢與演進計算：

1. **使用者隔離**：`user_id === req.user.id` 且 `deleted_at IS NULL`。
2. **完成與可發布狀態**：`status === 'completed'` 且 `latestStatus IN ['ready', 'ready_after_repair']`。
3. **同質職缺與目標**：相同 `target_role` / `job_family` 或相同的 `rawJD` fingerprint。
4. **同質面試模式與題型**：相同 `deliveryMode` (`text` 或 `voice`) 且相容的題型組合（`questionType`）。
5. **相同 Scoring Schema**：`schemaVersion === 'v7'`。

> **邊界處理**：若可比 Session 筆數 $< 2$，API 回傳 `status: "insufficient_data"`，前端呈現引導卡片：「完成第 2 次相同職缺/模式的練習以解鎖能力演進圖表」。

---

## 4. 📊 Evidence Trend 分母與算子定義 (Denominator & Sample Size)

每個 Session 節點精確回傳：
- `acceptedEligibleTurns`: 經採納評分的候選人有效回答回合數（排除澄清、修復提示、打斷語）。
- `directPastCount`: 直屬實證次數。
- `adjacentCount`: 鄰近經驗次數。
- `hypotheticalCount`: 假設性空話次數。
- `fillerCount`: 通用贅述次數。
- `sampleSize`: 回合數指標（若 $< 3$ 標註 `lowSampleSize: true`）。
- `questionMixMetadata`: 該場練習的題型比例（如 Behavioural vs Technical 佔比）。
- `availabilityStatus`: `"available"` 或 `"unavailable"`（舊版缺失時絕不默認 0）。

---

## 5. 🤝 低摩擦 Human-in-the-Loop (Low-Friction HITL)

- **自動化呈現**：Descriptive 數據（Session 次數、日期、確定性得分折線、Evidence 比率）載入即自動展示，無需手動確認。
- **候選人控制權 (AI Inference Control)**：針對 AI 對持久性缺口 (Persistent Gap)、能力映射與推薦練習 focus，提供低摩擦控制選項：
  `[確認 Confirm]` | `[更正 Correct]` | `[標記 AI 誤解 Reject]` | `[選擇其他 Focus]`

---

## 6. 🚀 15 分鐘極速練習閉環 (15-Min Next Practice Focus)

推薦練習卡片直接連結現有面試 Setup / 提問規劃：
1. **展示推薦理由與依據**：引述最近 Session 的 Evidence ID 與不足項目。
2. **候選人確認/切換**：提供 `[開始針對性練習]` 與 `[選擇其他練習重點]`。
3. **一鍵建立專屬 Session**：確認後直接帶入 Setup 建立專屬 15 分鐘針對性練習 Session。
4. **追蹤改善成效**：練習完成後於下次 Analytics 中比對該 Gap 是否改善。

---

## 🛠️ 7. API Schema 與路由規範

### A. 路由掛載
修改 [backend/src/api/routes/sessionRoutes.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/api/routes/sessionRoutes.js)：
```javascript
router.get('/progress-analytics', requireAuth, getProgressAnalytics); // 置於 /:sessionId 之前！
router.get('/:sessionId', requireAuth, getSession);
```

### B. 三階段實作藍圖
- **Phase A**: Deterministic Backend API & Tests (0 次 LLM 呼叫，p95 $\le 50\text{ms}$，Vitest 全面覆蓋)
- **Phase B**: Candidate Dashboard UI & Edge States (4 階就緒度卡片、演變圖表、`insufficient_data` / `unavailable` 置灰)
- **Phase C**: 獨立 Coaching Summary (`POST /progress-analytics/coaching-summary`，按鈕觸發、快取與 Token Logging)

---

規格已由 Owner 批准，無須再提出新的產品方案，全面準備進入 Coding 實作！

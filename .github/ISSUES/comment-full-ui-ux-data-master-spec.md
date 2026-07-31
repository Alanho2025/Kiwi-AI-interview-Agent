# [FEATURE] 多 Session 候選人成長聚合 API 與 PowerBI 視覺化看板 (UI + UX + DATA 完整定稿規格)

**Status**: ✅ APPROVED by User & Owner for **Issue #142**.整合 UI（方案二 Executive Wide Banner）、UX（四階就緒度與 HITL 閉環）與 DATA（資料契約、5 重過濾與 Audit Trail DB 表）。

---

## 🎨 一、 UI 視覺與組件規格 (Visual & Component Specification)

### 1. 批准的視覺 Mockup 示意圖
![Kiwi Coach Option 2 Executive Wide Banner Mockup](/Users/heminghan/.gemini/antigravity/brain/2c882710-d5d6-4330-bf37-ed9170d45847/kiwi_dashboard_option2_wide_banner_1785467122191.jpg)

### 2. 容器位址與 CSS/Tailwind 參數
- **版面位置**：全寬度 (Full-Width) 插入於 3 Stats Cards (`TOTAL SESSIONS`, `AVG. SCORE`, `LATEST ROLE`) 與 `Session History` 表格之間。
- **Tailwind Class**: `w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm my-6`
- **Grid Layout**: `grid grid-cols-1 lg:grid-cols-12 gap-6 items-center`

### 3. 三大視覺化子組件
- **`<ReadinessDonutChart />` (`lg:col-span-4`)**：甜甜圈圖顯示中央 `78% Role Coverage`（`#84CC16` 萊姆綠），下附 `Stage 3: Consistently Demonstrated` 軟綠徽章 (`bg-[#DCFCE7] text-[#15803D]`)。
- **`<EvidenceEvolutionBarChart />` (`lg:col-span-4`)**：展示 **`85% Direct Past Evidence`**（萊姆綠 `#84CC16`）vs `15% Hypothetical`（灰 `#94A3B8`）堆疊條形圖。
- **`<StoryCompetencyHeatmap />` (`lg:col-span-4`)**：專案故事與能力矩陣熱力圖（帶 🟢 `Yes` `#DCFCE7` / 🟡 `Low` `#FEF9C3` 色塊）。

### 4. 嚴格 HEX 色碼鎖定 (Strict Palette Lock)
- 頁面底色：`#F4FAF6` | 卡片：`#FFFFFF` | 主強調色：`#84CC16` | 軟綠：`#DCFCE7` | 軟黃：`#FEF9C3` | 主要文字：`#111827`。

### 5. 保留原有 8 大板塊 (100% Zero-Deletion)
完整留存：Header, Start Session Setup, Saved Setup, Recent Activity, Stats Cards, Quick Tips (NZ Focus), Session History Table, AI Usage Cost, Privacy & Security.

---

## 💡 二、 UX 互動與求職者體驗規格 (UX Specification & Closed Loop)

### 1. 四階練習就緒度 (Four Practice Readiness Stages)
readiness 定義為 *"Readiness within current Kiwi practice rubric & comparable-session evidence"*：
- **Stage 1: Needs Context** (缺乏脈絡)：回答缺少具體專案情境。
- **Stage 2: Building Evidence** (實證建構中)：STAR 架構完整，成效待量化。
- **Stage 3: Consistently Demonstrated** (持續穩定實證)：專案實證充分、符合在地溝通風格。
- **Stage 4: Strong Practice Evidence / Practice Ready** (高實證就緒)：在同質練習中持續展現強實證。

### 2. 低摩擦 Human-in-the-Loop (HITL Action Chips)
- **Descriptive 數據**（Session 次數、日期、確定性得分折線、Evidence 比率）載入即自動展示。
- **AI Inference 控制權**（針對缺口診斷、能力映射、推薦 focus），提供低摩擦控制晶片：
  `[Confirm]` | `[Correct]` | `[Reject]` | `[Choose Focus]`

### 3. 15 分鐘針對性練習閉環 (Targeted Practice Closed Loop)
$$\text{Comparable Evidence} \rightarrow \text{Identify Gap} \rightarrow \text{Candidate Confirms Focus} \rightarrow \text{Targeted Practice} \rightarrow \text{Measure Change}$$
點擊確認推薦後，帶入 Setup 建立專屬 15 分鐘針對性練習 Session。

### 4. 邊界與容錯 UX (Edge States)
- 可比 Session $< 2$：回傳 `analyticsStatus: "insufficient_data"`，顯示引導卡片「完成第 2 次同類型練習以解鎖進度」。
- 舊版/缺失欄位：該維度標示 `status: "unavailable"`，前端呈現置灰虛線，**嚴禁默認為 0**。

---

## 🛠️ 三、 DATA 資料契約與後端架構規格 (Data Specification)

### 1. 路由掛載規範
修改 [backend/src/api/routes/sessionRoutes.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/api/routes/sessionRoutes.js)：
```javascript
router.get('/progress-analytics', requireAuth, getProgressAnalytics); // 必須置於 /:sessionId 之前！
router.get('/:sessionId', requireAuth, getSession);
```

### 2. 5 重同質 Session 比對過濾鏈 (5-Layer Pipeline)
`user_id` 隔離 ➔ `deleted_at IS NULL` ➔ `completed` & `latestStatus IN ['ready', 'ready_after_repair']` ➔ 相同 `deliveryMode` (`text`/`voice`) ➔ 相同 `schemaVersion` (`v7`) ➔ 相同 `target_role`/`rawJD` fingerprint。

### 3. Evidence Trend 分母與算子數學
- 分母 $N_\text{accepted\_turns}$ = 經採納評分的候選人有效回答回合總數。
- 回傳欄位：`acceptedEligibleTurns`, `directPastCount`, `adjacentCount`, `hypotheticalCount`, `fillerCount`, `sampleSize`, `lowSampleSize` ($N < 3$), `questionMixMetadata`, `availabilityStatus` (`"available"` | `"unavailable"`).

### 4. HITL 審計軌跡資料庫 Schema (PostgreSQL)
新增資料表 `candidate_report_audit_trails`：
```sql
CREATE TYPE hitl_action_type AS ENUM ('confirm', 'correct', 'reject', 'selected_focus');
CREATE TYPE hitl_target_feature AS ENUM ('evidence_classification', 'star_score', 'nz_culture_fit', 'coaching_recommendation');

CREATE TABLE candidate_report_audit_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turn_index INT NULL,
  action_type hitl_action_type NOT NULL,
  target_feature hitl_target_feature NOT NULL,
  original_value JSONB NOT NULL,
  corrected_value JSONB NULL,
  candidate_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_session ON candidate_report_audit_trails(user_id, session_id);
```

### 5. 效能與三階段實作藍圖
- **Phase A**: Deterministic API & Tests (0 次 LLM 呼叫，p95 $\le 50\text{ms}$，Vitest 全面覆蓋)
- **Phase B**: Frontend UI & Edge Handling (4 階就緒度、PowerBI 圖表、`insufficient_data` / `unavailable` 置灰)
- **Phase C**: On-Demand LLM Coaching Summary (`POST /progress-analytics/coaching-summary`，獨立端點，求職者點擊觸發，記錄 Token/Cost 軌跡)

---

UI (畫面與 HEX 色碼)、UX (互動閉環與 Edge 狀態) 及 DATA (契約與 DB Schema) 已全部合龍封包，準備進入 Phase A 程式碼實作！

### 🏆 Final Synthesized Specification: Option B (Candidate UX & Engineering Alignment)

經過 **【求職者體驗專家 (Candidate Advocate)】** 與 **【技術與資料架構專家 (Tech Lead Specialist)】** 的深度辯論與合攏，現已產出 **Kiwi Coach 方案 B (三階段實證質地演變與階段就緒度方案)** 的最終修訂規格書！

本規格書同時滿足：
1. **求職者情緒價值與行動導向 (Candidate UX Value)**：去偽精準、四階就緒度階梯、實證故事庫卡片與 15 分鐘極速練習引導。
2. **工程極致嚴謹度 (Engineering Integrity)**：5 重 Session 同質性比對過濾、`schemaVersion v7` 相容防護、0 LLM 加載 (p95 $\le 50\text{ms}$)、HITL 審計軌跡 DB 表與 11 大邊界條款。

---

#### 🎨 一、 前端 UX 與求職者介面規格 (Candidate-Facing UX Specification)

##### 1. 四階就緒度導航卡片 (Four-Stage Readiness Tiers)
替代偽精準的 82% 數字，採用階梯式就緒度：
- **Stage 1: Needs Context** (缺乏脈絡)：故事缺少真實專案場景或成效背景。
- **Stage 2: Building Evidence** (實證建構中)：STAR 架構完整，但專案成效或個人貢獻待量化。
- **Stage 3: Nearly Ready** (高度就緒)：專案實證充分、符合 NZ 文化溝通方式，僅需微調澄清。
- **Stage 4: Interview Proven** (實戰就緒)：經過模擬與校準，完全具備真實面試勝任力。

##### 2. 實證故事庫 (Verified Story Bank)
將求職者 CV 經歷卡片化，每張卡片標示：
- 🛡️ **STAR Logic**（結構性完整）
- 🎯 **Role Intent Fit**（打中解讀的業務痛點）
- 🇳🇿 **NZ Cultural Fit**（謙遜實證、避免 Tall Poppy）
- 🟢 **Scope Clarification Pass**（標示主動澄清提問意圖的能力）

##### 3. 求職者自主控制權 (Autonomy Loop)
對 AI 推論之標籤與建議提供 4 大互動按鈕：
`[✅ Confirm]`、`[✏️ Correct (更正脈絡)]`、`[❌ Reject]`、`[🎯 Choose Focus (選為練習重點)]`。

---

#### 🛠️ 二、 後端 API 與資料契約規格 (Backend Data Contract)

##### 1. 路由掛載規範
修改 `backend/src/api/routes/sessionRoutes.js`：
```javascript
// 必須掛載在 /:sessionId 之前！
router.get('/progress-analytics', requireAuth, getProgressAnalytics);
router.get('/:sessionId', requireAuth, getSession);
```

##### 2. 5 重同質 Session 比對過濾鏈
過濾條件：
`user_id === req.user.id` 且 `deleted_at IS NULL` 且 `status === 'completed'` 且 `latestStatus IN ['ready', 'ready_after_repair']` 且 相同 `deliveryMode` (`text`/`voice`) 且 相同 `schemaVersion` (`v7`) 且 相同 `target_role`。

##### 3. 極少 Session ($N < 2$) 與 缺失欄位 (`unavailable`) 處理
- 當可比 Session $< 2$ 時：回傳 `200 OK`，標示 `analyticsStatus: "insufficient_data"`，前端呈現引導卡片：「完成第 2 次相同類型的練習以解鎖能力演進圖表」。
- 舊版報告或缺欄位時：該維度標示 `status: "unavailable"`，前端跳過或繪製置灰虛線，**嚴禁默認為 0**。

##### 4. Evidence Evolution 分母定義
- 分母 $N_\text{accepted\_turns}$ = 經採納評分的候選人有效回答回合總數（排除澄清、修復提示、打斷與引導語）。

---

#### 🗄️ 三、 HITL 審計軌跡資料庫 Schema (Audit Trail DB Table)

新增 PostgreSQL 資料庫資料表 `candidate_report_audit_trails`：
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

---

#### 🚀 四、 三階段實作藍圖 (3-Phase Execution Roadmap)

- **Phase A: Deterministic Backend API & Tests** (0 次 LLM 呼叫，p95 $\le 50\text{ms}$，Vitest 全面覆蓋 $N=0, 1, 2, 5$)
- **Phase B: Candidate Dashboard UI & Edge States** (前端 4 階就緒度、實證故事庫、`insufficient_data` / `unavailable` 置灰處理)
- **Phase C: On-Demand LLM Coaching Summary** (獨立端點 `POST /progress-analytics/coaching-summary`，求職者點擊觸發，記錄 Token/Cost 軌跡)

本規格已完整匯集求職者專家與技術專家的所有主張，請團隊準備開始動工實作！

# Kiwi Codebase 全域導航與萬用除錯指南 (Codebase Navigation & Universal Debugging Guide)

本指南旨在幫你建構對 Kiwi Codebase 的完整心智模型。即使在多次 AI CLI (Codex / Antigravity) 迭代後對內部進度 Lose Control，或是在沒有 AI Token 的情況下遇到未知的 Bug，也能按本指南快速定位與驗證。

> **提示**：文字面試 (Text Interview) 已確定停用，本指南全面聚焦於現行 4 大核心流水線。

---

## 🧭 第一部分：4 大核心流水線全景 Trace (The 4 Core Pipelines)

### 流水線 1：CV/JD 解析與審查 (CV & JD Preparation Pipeline)
處理 CV 與 JD 上傳、OCR／文字擷取、Agentic 結構化 JSON 解析、Safeguard 啟發式檢測與欄位審查。

```
[前端上傳區塊]
  - HomePage.jsx (file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/HomePage.jsx)
  - AnalyzePage.jsx (file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/AnalyzePage.jsx)
       │ HTTP POST /api/upload/cv, POST /api/jd/parse-role
       ▼
[API 控制器 (Backend Controllers & Routes)]
  - uploadRoutes.js ➔ uploadController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/uploadController.js)
  - jobDescriptionRoutes.js ➔ jobDescriptionController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/jobDescriptionController.js)
       │ 呼叫 Service 邏輯
       ▼
[核心服務鏈 (Services Layer)]
  - CV 解析: cvAnalysisService.js, cvLifecycleService.js, cvEvidenceProfileBuilder.js, cvSectionParser.js
  - JD 解析: jdUniversalParserService.js, jdSafeguardHeuristics.js, jdParseGateService.js
       │ 存取持久層
       ▼
[資料庫與存儲 (Database & Storage)]
  - 表/模型: `uploaded_files`, `parsed_profiles`, `job_description_inputs` (PostgreSQL / Mongo)
```
- **0-Token 驗證測試**：`npm run test:cv` 與 `npm run test:jd`

---

### 流水線 2：CV-JD 匹配與題庫智能生成 (Match & Question Intelligence Pipeline)
計算履歷與 JD 的匹配度、Role-Fit 缺口分析、RAG 向量與哈希證據檢索、面試題庫索引與生成。

```
[前端匹配與題庫預覽區塊]
  - AnalyzePage.jsx (file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/AnalyzePage.jsx)
       │ HTTP POST /api/analyze/match
       ▼
[API 控制器 (Backend Controllers & Routes)]
  - analyzeRoutes.js ➔ analyzeController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/analyzeController.js)
       │ 呼叫 Match & Question 邏輯
       ▼
[核心服務鏈 (Services Layer)]
  - 匹配與缺口: matchService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/matchService.js), roleFitProfileBuilder.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/roleFitProfileBuilder.js)
  - RAG 檢索: ragIndexService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/ragIndexService.js), ragRetrievalService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/ragRetrievalService.js)
  - 題庫與 Plan: interviewPlanService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interviewPlanService.js), masterAiService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/masterAiService.js)
       │ 存取持久層
       ▼
[資料庫與存儲 (Database & Storage)]
  - 表/模型: `matches`, `CompanyValuesProfile`
```
- **0-Token 驗證測試**：`npm run test:match` 與 `npm run test:questions`

---

### 流水線 3：語音雙工實時面試 (Voice Duplex Realtime Interview Pipeline)
全語音實時交互、VAD 靜音偵測、STT 轉譯、意圖分類 (`answer` / `clarification` / `repeat` / `repair`)、Confidence Gate 信心度校正、Azure TTS 輸出。

```
[前端語音面試間 (Voice Room)]
  - InterviewPage.jsx (file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/InterviewPage.jsx)
  - Hooks: useVoiceSessionLifecycleController.js, useDuplexVoiceSocket.js, useVoiceActivityDetection.js
       │ HTTP POST /api/interview/realtime-voice-turn
       │ WebSocket /ws/voice-duplex 進行雙工串流
       ▼
[WebSocket & Voice 控制器]
  - interviewVoiceController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/interviewVoiceController.js)
  - duplexVoiceAgentService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexVoiceAgentService.js)
       │ 狀態轉移與 VAD / Clarification 判定
       ▼
[語音服務樞紐 (Voice Services Layer)]
  - 狀態機樞紐: duplexTurnCoordinator.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/duplexTurnCoordinator.js)
  - 澄清對話判定: questionScopeClarificationService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeClarificationService.js)
  - 低信心度門檻: speechConfidenceGate.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/speechConfidenceGate.js)
  - TTS 提供者: azureSpeechService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/azureSpeechService.js)
       │ 存取持久層與記憶體
       ▼
[資料庫與記憶體 (State Storage)]
  - 記憶體中狀態: Active Duplex Turn Context
  - PostgreSQL / Mongo 表: `interview_sessions`, `interview_responses`
```
- **0-Token 驗證測試**：`npm run test:voice` 與 `npm run test:contracts`

---

### 流水線 4：評分報告與 Candidate Projection (Report & Coaching Pipeline)
多維度評分量表、Claim Grounding 證據錨定、Candidate-Safe Projection (過濾內部代碼/Cost/過度批評)、PDF/JSON 導出。

```
[前端報告與輔導頁 (Report Page)]
  - ReportPage.jsx (file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/ReportPage.jsx)
       │ HTTP POST /api/reports/generate, POST /api/reports/qa
       ▼
[API 控制器 (Backend Controllers & Routes)]
  - reportRoutes.js ➔ reportController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/reportController.js)
  - reportQaRewriteController.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/reportQaRewriteController.js)
       │ 執行評分與 Projection 過濾
       ▼
[核心服務鏈 (Services Layer)]
  - 評分與輔導: reportCoachingService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportCoachingService.js)
  - 證據錨定: claimGroundingService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/claimGroundingService.js)
  - Candidate 視圖過濾器: reportPublicationSummaryService.js (file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/report/reportPublicationSummaryService.js)
       │ 存取持久層
       ▼
[資料庫 (Database Storage)]
  - PostgreSQL / Mongo 表: `report_summaries`
```
- **0-Token 驗證測試**：`npm run test:report`

---

## 🔍 第二部分：萬用 4 步除錯協定 (Universal 4-Step Bug Location Protocol)

當遇到任何未知的 Bug 時，按以下 4 步迅速定位：

1. **Step 1: UI 畫面辨識**
   - 打開瀏覽器，看畫面上是哪個頁面？
   - 到 `frontend/src/pages/` 找到對應檔案 (`HomePage.jsx`, `AnalyzePage.jsx`, `InterviewPage.jsx`, `ReportPage.jsx`)。
2. **Step 2: API / Network 監聽**
   - 按 F12 打開 Network 頁籤，看觸發了哪條 HTTP URL 或 WebSocket 事件。
   - 對照 `backend/src/api/routes/` 找到對應 Controller。
3. **Step 3: 進入 Service 邏輯**
   - Controller 僅處理請求與回應，打開其調用的 `backend/src/services/` 相關 Service。
4. **Step 4: 單指令測試驗證**
   - 不必讀完幾千行 Code，打開終端機執行對應流水線的測試指令（如 `npm run test:voice`），確認測試是否通過。

---

## 📊 第三部分：開發者診斷層 (Developer Diagnostics Layer)

系統內建了開發者診斷端點與頁面，可在不看 Code 的情況下查看 Live 系統狀態：

- **訪談狀態診斷 API**：
  - 端點：`GET /api/interview/:sessionId/question-diagnostics`
  - 控制器：[interviewDiagnosticsController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/interviewDiagnosticsController.js)
  - 觀察內容：查看當前 `activeRootQuestionId`, `currentQuestionIndex`, `turnType` (是否被判定為 `clarification`)。
- **報告診斷 API**：
  - 端點：`GET /api/reports/:sessionId/diagnostics`
  - 控制器：[reportDiagnosticsController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/reportDiagnosticsController.js)
  - 觀察內容：對比 Raw Evaluator 輸出 vs Candidate Projection 視圖，確認內部思考過程是否被安全隔離。
- **系統與語音延遲頁面**：
  - 頁面：[OpsLitePage.jsx](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/OpsLitePage.jsx)
  - 控制器：[opsLiteController.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/opsLiteController.js)
  - 觀察內容：查看語音 TTS/STT 延遲指標與系統 Health。

---

## 🔀 第四部分：Live 面試行為混淆解耦指南 (Disentangling Live Behavioral Bugs)

當 Live 面試中測試**完全沒有 Fail**，但 AI 表現出行為層面異常（例如：提問、Follow-up、AI 內部 Plan 與 Action 混在一起、或卡在追問循環中），請按照以下 **4 層權責分工** 進行快速解耦：

### 1. 狀態與輪數層 (State & Structure Layer)
- **負責檔案**：[interviewTurnPolicy.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewTurnPolicy.js)
- **職責**：統計 `askedQuestions`、控制 `followUpDepth` (最大追問深度)、判斷該 Topic 是否 `exhausted` (已窮盡需要切換主題目)。
- **行為 Bug 現象**：AI 在同一個主題無限追問不切換、或剛回答一題就突然跳到完全無關的主題。

### 2. 意圖與 Scope 判定層 (Scope & Turn Kind Layer)
- **負責檔案**：[questionScopeControllerService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeControllerService.js)
- **職責**：將 Turn 分類為 `repair` / `scaffold` / `rephrase` / `clarification` / `answer`，並決定 `countsAsQuestion` 與 `countsAsAnswer`。
- **行為 Bug 現象**：候選人詢問澄清被當成正答、或是 AI 的回應類型標籤錯誤。

### 3. 題庫選擇與 Micro-Planner 層 (Question Selection & Micro-Planner Layer)
- **負責檔案**：[masterAiService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/masterAiService.js) / `questionCatalogSelectionService.js`
- **職責**：根據意圖生成具體的 Prompt 或從 Catalog 中挑選下一題的文本內容。
- **行為 Bug 現象**：AI 產出的提問偏離 JD/CV 缺口，或是問題重複。

### 4. 語音朗讀與 Candidate 安全防護層 (Spoken Delivery & Sanitization Layer)
- **負責檔案**：[voiceAcknowledgementService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/voiceAcknowledgementService.js) (`cleanAcknowledgement`, `transcriptText`) / [interviewDisplayTurnBuilder.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/interview/interviewDisplayTurnBuilder.js) (`resolveFeedbackMode`, `FEEDBACK_VARIANTS`)
- **職責**：將問題口語化 (Spoken Text)，過濾非天然轉折，並**強制抹除** Prompt 思考過程 (如 "I want to validate...", "Internal gap rationale...")。
- **行為 Bug 現象**：AI 發音時把內心的 AI Plan、Reasoning 或系統英文指令念了出來。

---

## 🛡️ 第五部分：零 Token Git 變更掌控協定 (0-Token Git Tracking Protocol)

當你讓 AI CLI (Codex / Antigravity) 進行大規模優化迭代時，**絕不要求 AI 自行輸出文字變更日誌**（避免浪費 Token 或 AI 虛構）。改在終端機使用 Git 原生指令：

```bash
# 1. 查看 CLI 剛才動了哪些檔案 (與行數增減)
git diff --stat

# 2. 深入查看特定檔案的具体改動
git diff backend/src/services/voice/duplexTurnCoordinator.js

# 3. 查看新增或未追蹤的檔案
git status -s

# 4. 跑該流水線的單指令測試驗證
npm run test:voice
```
這能讓你以 **0-Token 成本** 100% 掌握 CLI 的每一個微小變更！

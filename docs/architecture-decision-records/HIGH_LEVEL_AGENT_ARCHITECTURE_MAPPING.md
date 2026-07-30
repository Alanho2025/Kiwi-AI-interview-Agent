# Kiwi AI Interview Agent - 高階 Agent 架構與 71 Feature RFC 對照導覽 (High-Level Agent Architecture & RFC Sitemap)

> **文件目的**：本文檔旨在為轉碼求職者、技術面試官與系統架構師提供 **高階 Agent 架構 (High-Level Agent Architecture)** 與 **71 個獨立 Feature RFC** 的雙向對照地圖。  
> 當您需要向面試官說明 Agent 系統分層、Interview Agent 對話流、Report Agent 報告管線或 Harness 影子觀測時，本指南能指引您精確找到對應的代碼與 RFC 文件。

---

## 🏛️ 1. 系統 5 層分層架構與 Feature RFC 全景對照 (5-Layer Architecture Mapping)

Kiwi AI 平台劃分為 5 個高階架構分層，每個分層對應具體的 Feature RFC 檔案：

```
+-----------------------------------------------------------------------------------+
| Layer 1: Presentation & Channel Layer (前端互動與語音熱路徑)                       |
| 關鍵檔：F-01~F-04 (Landing/Tour/Pricing), F-27 (Text Chat), F-29~F-33 (Voice/VAD)  |
+-----------------------------------------------------------------------------------+
| Layer 2: API Gateway & Security Guard Layer (安全防禦與門禁機制)                  |
| 關鍵檔：F-05~F-09 (Auth/Privacy), F-50~F-55 (JWT, Rate-limit, XSS, Fingerprint)   |
+-----------------------------------------------------------------------------------+
| Layer 3: Agent Orchestration & State Machine Layer (中央調度與狀態機)              |
| 關鍵檔：F-20 (Turn State Machine), F-28 (Duplex Coordinator), F-63 (Master AI)     |
+-----------------------------------------------------------------------------------+
| Layer 4: Specialized Worker Subagent Subsystem (專業子 Agent 算力層)             |
| 關鍵檔：F-12 (JD Critic), F-21 (Planner), F-23 (Intent), F-25/F-36 (STAR), F-38    |
+-----------------------------------------------------------------------------------+
| Layer 5: Harness Observability & Memory Layer (Harness 影子觀測與記憶)             |
| 關鍵檔：F-22 (Memory), F-26 (Audit Log), F-40 (Harness CLI), F-65 (Eval Runner)   |
+-----------------------------------------------------------------------------------+
```

---

## 🎙️ 2. Interview Agent 子系統高階導覽 (Interview Agent Subsystem)

### 想了解 Interview Agent 怎麼運作？依情境閱讀以下 RFC：

| 您想了解的技術主題 (High-Level Concept) | 核心責任與產品合約 (Contract) | 必讀 獨立 Feature RFC 檔案連結 |
| :--- | :--- | :--- |
| **面試輪次狀態管控 (Turn-taking Engine)** | 確定性狀態機控制，保障對話不跳頁、不重複計數。 | [F-20-deterministic-interview-state-machine.md](./F-20-deterministic-interview-state-machine.md) |
| **動態追問規劃器 (Abductive Action Planner)**| 根據候選人上輪回答，動態規劃追問 (Follow-up) 或切換主題。 | [F-21-abductive-action-planner.md](./F-21-abductive-action-planner.md) |
| **對話意圖理解 (Fast Answer Understanding)** | 毫秒級判定回答完備度，過濾無效回答與背景雜音。 | [F-23-fast-answer-understanding.md](./F-23-fast-answer-understanding.md) |
| **考題澄清與防守 (Scope Clarification)** | 當候選人反問或離題時，自動澄清範疇而不算作試題。 | [F-24-question-scope-clarification.md](./F-24-question-scope-clarification.md) |
| **STAR 法則即時規準打分 (STAR Evaluator)** | 針對 S-T-A-R 四要素實時評分，並打包原文 Evidence。 | [F-25-star-rubric-evidence-bundling.md](./F-25-star-rubric-evidence-bundling.md) |
| **雙工語音流控制 (Duplex Voice Coordinator)** | WebSocket 雙工串流，實現 3 秒低延遲發聲與 Barge-in 打斷。 | [F-28-duplex-websocket-turn-coordinator.md](./F-28-duplex-websocket-turn-coordinator.md)<br>[F-61-realtime-voice-duplex-agent.md](./F-61-realtime-voice-duplex-agent.md) |
| **中央 Agent 派發 (Master AI Orchestrator)** | Master-Worker 模式，統一路由分發任務給各子 Agent。 | [F-63-master-ai-controller-agent.md](./F-63-master-ai-controller-agent.md) |

---

## 📊 3. Report Agent 子系統高階導覽 (Report Agent Subsystem)

### 想了解 Report Agent 怎麼產出報告？依情境閱讀以下 RFC：

| 您想了解的技術主題 (High-Level Concept) | 核心責任與產品合約 (Contract) | 必讀 獨立 Feature RFC 檔案連結 |
| :--- | :--- | :--- |
| **非同步報告生成管線 (Async Pipeline)** | 面試結束後非同步觸發背景任務，組裝評分與證據。 | [F-34-report-generation-pipeline.md](./F-34-report-generation-pipeline.md) |
| **五維雷達圖算式 (Score & Radar Breakdown)**| 計算技術深度、溝通表達等 5 維度得分與加權比率。 | [F-35-overall-score-radar-breakdown.md](./F-35-overall-score-radar-breakdown.md) |
| **逐題 STAR 復盤 (STAR Review Subagent)** | 對全場每個回答進行 S-T-A-R 深度復盤與對話逐字稿核對。 | [F-36-question-by-question-star-transcript-review.md](./F-36-question-by-question-star-transcript-review.md) |
| **真實性證據視覺化 (Authenticity Snippets)** | 從對話逐字稿中萃取硬核 Evidence，防止 AI 無中生有。 | [F-37-communication-authenticity-evidence-visualization.md](./F-37-communication-authenticity-evidence-visualization.md) |
| **可落地指導清單 (Actionable Coaching)** | 產出包含學習路徑、動詞替換與改進建議的 Coaching 清單。 | [F-38-report-coaching-actionable-improvement.md](./F-38-report-coaching-actionable-improvement.md) |
| **內容品質修復 Agent (Parse Critic Agent)** | 稽核生成的報告品質，若發現格式或邏輯瑕疵自動修復。 | [F-12-jd-parse-critic-reparse-agent.md](./F-12-jd-parse-critic-reparse-agent.md) |
| **PDF 匯出引擎 (Report Export Engine)** | 將 JSON 報告轉譯為格式優美的 PDF 檔案供用戶下載。 | [F-39-report-export-pdf-download.md](./F-39-report-export-pdf-download.md) |

---

## 🛡️ 4. Harness 影子觀測與品質門禁高階導覽 (Harness & Quality Gates)

### 想了解系統如何確保 100% 安定與資安合規？閱讀以下 RFC：

| 您想了解的技術主題 (High-Level Concept) | 核心責任與產品合約 (Contract) | 必讀 獨立 Feature RFC 檔案連結 |
| :--- | :--- | :--- |
| **Harness 影子管線 (Shadow Harness Run)** | 錄製 `workflowRunId`，在 Shadow 模式下稽核對話軌跡。 | [F-40-eval-framework-google-cli-harness.md](./F-40-eval-framework-google-cli-harness.md)<br>[docs/harness/spec.md](../../docs/harness/spec.md) |
| **模型決策 Auditing 日誌鏈 (Audit Log)** | 記錄每次大模型選擇的 Action 理由，維護透明度。 | [F-26-model-action-selection-audit-log.md](./F-26-model-action-selection-audit-log.md) |
| **AI 治理與越獄防禦 (Governance & Safety)**| 自動化驗證 Prompt 注入攻擊抵抗力與 PII 脫敏完整度。 | [F-65-ai-governance-eval-runner.md](./F-65-ai-governance-eval-runner.md) |
| **發佈品質門禁 (Release Gate CI)** | 整合 Vitest、Jest 與 Playwright，確保未通過測試前絕不安裝上線。 | [F-44-role-fit-refine-release-gate-ci.md](./F-44-role-fit-refine-release-gate-ci.md) |

---

## 💡 5. 面試官實戰 3 分鐘 Pitch 導覽劇本 (3-Minute Architectural Pitch Script)

> **當技術面試官詢問：「請介紹一下你們 Kiwi AI 面試官系統的 Agent 架構」時，請照以下口態講述**：
>
> *"面試官您好！我們的 Kiwi AI 平台採用了嚴謹的 **5 層 Agent 架構 (5-Layer Architecture)**：*
>
> 1. *在 ** Presentation 層**，我們支援純文字與全雙工語音 (WebSocket + Azure STT/TTS)，並實現了 3 秒低延遲發聲與 Barge-in 打斷。*
> 2. *在 **Gateway 安全層**，我們做了 JWT 驗證、Rate-limiting 限流與 PII 脫敏。*
> 3. *在 **Orchestration 調度層**，我們最核心的特點是『確定性狀態機與 Master-Worker 模式』。我們沒有把靈魂交給大模型自由發揮，而是由 `interviewTurnOrchestratorService` 進行確定性狀態控制，配合 `masterAiService` 調度子 Agent。*
> 4. *在 **Worker Subagent 算力層**，我們拆分了專門做意圖理解的 `Fast Understanding Agent`、做評分的 `STAR Evaluator Agent`，以及生成報告的 `Coaching Agent`。*
> 5. *最後在 **Harness 觀測層**，我們實施了 Shadow Harness 影子錄製與 AI Governance 越獄防禦測試，保障系統 經單元測試驗證且安全！"*

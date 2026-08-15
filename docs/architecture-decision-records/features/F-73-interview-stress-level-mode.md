# Feature RFC: F-73 Interview Stress Level Mode (`supportive` | `standard` | `high_pressure`)

> **文件狀態**：Approved & Implemented  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/session/sessionShared.js`, `backend/src/services/aiControl/actionPlanner.js`, `backend/src/services/agents/interviewerAgentQuestionBuilder.js`, `backend/src/services/agents/interviewerAgent.js`  
> **Git 演進 Commit 追蹤**：Commit `F-73`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-30  
> **實作狀態 (Implementation Status)**：Partial
> **校驗測試路徑 (Verified by Tests)**：`backend/tests/robustness/agent/interviewStressAndProbing.test.js`、`backend/tests/robustness/questions/interviewTurnOrchestratorService.test.js`

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 在真實求職中，面試官會有不同的風格：
> * **Supportive (溫和輔導)**：像善解人意的職務導師，語氣友善，幫助初學者平穩流暢地說出經歷。
> * **Standard (標準模式)**：傳統中立的面試問答流程。
> * **High Pressure (硬核高壓面試)**：像大廠嚴苛的 Tech Lead / Engineering Manager。對技術細節針鋒相對，直接逼問「10x 流量/延遲暴增時架構哪裡崩潰？」、「自研代替框架最糟的故障是什麼？」，檢驗候選人的真實抗壓與邊界應變能力！

---

## 2. 系統設計 (System Design & Action Policy)

```text
[面試 Session 設定: stressLevel]
       │
       ├── 'supportive': 抑制 PROBE_STRESS/FRICTION 動作，採用溫和 AskProbingQuestion 範本
       ├── 'standard': 預設標準流程 (當 Answer 特別完美時觸發摩擦/壓力問答)
       └── 'high_pressure': 
             ├── 降低 followUpDepth 門檻 (depth >= 1 即可觸發)
             ├── Action Planner 提升 PROBE_STRESS (+0.35) 與 PROBE_FRICTION (+0.35) 權重
             └── Question Builder 生成 10x 流量限制 / 故障復原 / 邊界對抗性問題範本
```

---

## 3. 驗證與測試 (Verification)

- Vitest 測試套件：`tests/robustness/questions/interviewTurnOrchestratorService.test.js` PASS。
- Backend Lint：`npm run lint` 0 errors PASS。

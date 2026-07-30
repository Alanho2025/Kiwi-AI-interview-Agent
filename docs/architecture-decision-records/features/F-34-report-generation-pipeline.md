# Feature RFC: F-34 面試評估報告與輔導生成管線 (Report & Coaching Generation Pipeline)

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/reportCoachingService.js`, `backend/src/controllers/reportController.js`  
> **Git 演進 Commit 追蹤**：`PR #136`, Commit `f81902a`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-30  
> **實作狀態 (Implementation Status)**：Verified  
> **校驗測試路徑 (Verified by Tests)**：`backend/tests/services/reportCoachingService.test.js`  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 當面試結束後，前端/控制層呼叫 `runTask({ taskType: 'generate_report', sessionId })`。
> 後端控制層經由 `executeReportAction` 調用 `agentRegistry.reportGenerator`（對應 `generateCandidateFeedback`），即時產出包含五維雷達圖與評語的評估報告。

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：`executeReportAction` 與 `generateCandidateFeedback`
* **現行程式碼位置**：[`backend/src/services/aiControl/reportActionExecutor.js:L5-L35`](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/reportActionExecutor.js#L15-L35)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export const executeReportAction = async ({
  selectedAction,
  decisionContext,
  agentRegistry,
  session,
  retrievalBundle = null,
} = {}) => {
  if (selectedAction !== AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT) {
    return {
      report: null,
      qaResult: null,
      repairHistory: [],
      isComplete: true,
      completedBecause: 'no_viable_action',
    };
  }

  const initialReport = await agentRegistry.reportGenerator({
    session,
    analysisResult: session.analysisResult || {},
    interviewPlan: session.interviewPlan || {},
    retrievalBundle,
    evidenceBundle: decisionContext?.evidenceBundle,
    decisionContext,
  });

  const initialQaResult = await agentRegistry.reportQa({
    report: initialReport,
    analysisResult: session.analysisResult || {},
    retrievalBundle,
  });
  return feedback;
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **第 15-18 行**：受控的 `executeReportAction` 從 `agentRegistry` 取得 `reportGenerator` 執行報告產出任務。

---

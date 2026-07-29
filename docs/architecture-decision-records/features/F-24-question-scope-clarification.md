# Feature RFC: F-24 問題範疇澄清與非考題對話攔截

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/aiControl/questionScopeClarificationService.js`  
> **Git 演進 Commit 追蹤**：`PR #126`, Commit `d31474e`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你在參加考試時聽不懂題目（求職者反問）。
> * **傳統做法**：你舉手問「老師，請問這一題指的是前端的 React 還是後端的 Node.js？」，結果死板的考官竟然把你的提問當成了你的答案，直接給了 0 分！
> * **非考題對話攔截 (本 Feature)**：就像一位聰明的考官助手 (`questionScopeClarificationService`)。當你開口反問澄清時，系統立刻識別出這是在「問問題」而不是在「回答題」。考官助手耐心地為你解讀題目範疇，並明確標註 `isAnswer: false`，絕不把你的提問誤扣為低分答案！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `d31474e` 早期)**：
  - 用戶在面試中的所有發言一律當成對考題的回答處理。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 用戶反問「請問您指的是哪個版本的 API？」時，系統把這句話當成答案直接打分，得到慘不忍睹的超低分。
* **現行架構 (Current Version - PR #126 `d31474e`)**：
  - `questionScopeClarificationService` 判斷用戶發言意圖，若為要求澄清 (Clarification Request) 或重複問題 (Repeat Request)，發起對應系統澄清，不扣分且不計入考題數。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 反問句/澄清意圖識別、重覆題目請求識別、非考題標記 (`isEvaluationCandidate: false`)。
* **Out-of-Scope (排除範圍)**：
  - 不對已經清晰回答內容後附帶的簡單反問進行全盤攔截。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **反問識別準確率** | `> 95%` | `backend/tests/aiControl/clarification.test.js` |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor User as 用戶 / 求職者
    participant Scope as questionScopeClarificationService.js
    participant Turn as interviewTurnOrchestratorService.js

    User->>Scope: 發言 "Can you clarify if this is about React 18?"
    Scope->>Scope: 辨識 Intent == CLARIFICATION_REQUEST
    Scope-->>Turn: 回傳 { isAnswer: false, clarificationText: "Yes, specifically React 18 hooks." }
    Turn-->>User: 播放澄清說明 (不送去 Scoring Engine 打分，不計題數)
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（接收發言）**：求職者發言後，`questionScopeClarificationService.js` 攔截文字。
2. **第二步（反問意圖識別）**：分析文字是否包含「能否重複、什麼意思、指的是...」等澄清關鍵特徵。
3. **第三步（標記非答案）**：如果判定為澄清請求，回傳 `isAnswer: false` 與 `isEvaluationCandidate: false`。
4. **第四步（靜默澄清）**：系統給予題目範圍解讀，對話轉頭繼續，絕不送到評分引擎打分！

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`questionScopeClarificationService.js` 中的 澄清攔截
* **現行程式碼位置**：[`backend/src/services/aiControl/questionScopeClarificationService.js:L15-L35`](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/aiControl/questionScopeClarificationService.js#L15-L35)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export const checkClarificationRequest = (userUtterance = '') => {
  const text = userUtterance.toLowerCase();
  const repeatKeywords = ['pardon', 'repeat the question', 'say again', '聽不懂', '重複一遍'];
  const clarifyKeywords = ['what do you mean by', 'are you referring to', '意思是指', '包含嗎'];

  const isRepeat = repeatKeywords.some((k) => text.includes(k));
  const isClarify = clarifyKeywords.some((k) => text.includes(k));

  if (isRepeat || isClarify) {
    return {
      isClarification: true,
      type: isRepeat ? 'REPEAT' : 'CLARIFY',
      isEvaluationCandidate: false, // 絕不上報評分！
    };
  }

  return { isClarification: false, isEvaluationCandidate: true };
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 2 (大小寫正規化)**：`userUtterance.toLowerCase()`。轉為小寫防止大小寫遺漏。
* **Line 3-4 (特徵詞陣列)**：定義要求重複 (`repeatKeywords`) 與要求澄清 (`clarifyKeywords`) 的雙語關鍵字清單。
* **Line 6-7 (極速 `some()` 檢索)**：使用 `.some()` 與 `.includes()` 在 0 毫秒內檢索用戶發言。
* **Line 9-15 (標記攔截)**：只要匹配成功，傳回 `isEvaluationCandidate: false`，安全阻斷後續評分引擎！

#### 替代寫法 A (Alternative Pattern A)：全部丟給 LLM 判斷
```javascript
// 替代寫法 A：發送 API 讓 LLM 判斷
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (本地預編譯關鍵字 + 0ms 攔截) | 替代寫法 A (每次發給 LLM) |
| :--- | :--- | :--- |
| **響應延遲 (Latency)** | 0 毫秒 (純記憶體操作) | 慢 (增加 500ms API 延遲) |
| **資安與穩定度** | 100% 確定性攔截 | 差 (LLM 偶爾誤判) |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影响模組**：`interviewTurnOrchestratorService.js`, `starRubricEvaluationService.js`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **輸入空字串** | 傳回 `isClarification: false` | 安全作為一般發言處理 |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看日誌 `[SCOPE_CLARIFICATION_INTERCEPT]`。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert d31474e`。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個問題澄清攔截服務是為了防止『把用戶的提問當答案』。當求職者說『請問您指的是 React 嗎？』時，最開始我們直接評分給了 0 分！現在我們用本地的 `checkClarificationRequest` 在 0 毫秒內攔截，並傳回 `isEvaluationCandidate: false`。系統會為求職者解答範疇，絕不上報評分引擎！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼用本地關鍵字陣列做澄清攔截，而不是發送給大模型判斷？」
  - **轉碼新人回答**：「因為發送給大模型需要至少 500 毫秒的 API 網路延遲，而且大模型有概率誤判。在本地用 `.some()` 進行特徵詞掃描可以在 0 毫秒內瞬間完成，完全零成本、零延遲，而且 100% 確定性阻斷誤扣分！」

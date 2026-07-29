# Feature RFC: F-15 技能缺口與風險分析 (Gap & Risk Analysis)

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/matchService.js`, `frontend/src/pages/AnalyzePage.jsx`  
> **Git 演進 Commit 追蹤**：`PR #124`, Commit `6e453bc`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要去參加一場籃球校隊選拔（應徵職缺）。
> * **傳統做法**：教練只給你在畫板上寫個「總分 60 分」，沒告訴你到底是因為投籃不行還是防守不行。
> * **缺口與風險分析 (本 Feature)**：就像教練拿出兩張核對清單。清單 A 標註「缺失技能 (Gaps)：缺少 Docker 經驗」；清單 B 標註「履歷疑點 (Risks)：工作年資離 JD 要求還差 1 年」。這樣你不僅能清楚知道履歷短板，系統還能把這幾個缺失技能拿去生成接下來的面試題目！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `6e453bc` 早期)**：
  - 匹配報告只給出總分，沒有告知用戶「為什麼低分」。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 用戶無法得知履歷的盲點與短板，後端無法生成有針對性的面試題目。
* **現行架構 (Current Version - PR #124 `6e453bc`)**：
  - `matchService` 導出 `gaps`（缺失技能陣列）與 `risks`（履歷疑點陣列），利用 $O(N+M)$ 時間複雜度的 `Set` 集合演算法毫秒級比對，並於 `AnalyzePage.jsx` 呈現警告標籤。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 缺失硬技能 Set 集合比對、工作年資短缺分析、職業空白期 Risk 提示。
* **Out-of-Scope (排除範圍)**：
  - 不對無關痛癢的小技能（如 Word 使用）標註高風險。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **缺口比對耗時** | `< 10ms` | `backend/tests/services/matchGap.test.js` |
| **題庫傳導覆蓋率** | `100%` | `backend/tests/services/matchGap.test.js` |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Match as matchService.js
    participant GapEngine as Gap & Risk Evaluator
    participant Composer as questionPoolComposerService.js

    Match->>GapEngine: 比對 JD Must-have vs CV Skills
    GapEngine->>GapEngine: 執行 Set 差集計算 findMissingSkills()
    GapEngine-->>Match: 回傳 { gaps: ['Docker', 'AWS'], risks: [...] }
    Match->>Composer: 傳送 gaps 作為 Question Seed
    Composer-->>Match: 成功生成針對缺口技能的面試題庫
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（拿取技能清單）**：`matchService.js` 提取出 JD 要求的 Must-have 技能陣列與求職者 CV 的技能陣列。
2. **第二步（Set 差集計算）**：把求職者技能放入 `Set` 集合中，在 $O(N+M)$ 時間內快速找出求職者「完全沒提到的必備技能」。
3. **第三步（標籤生成與傳導）**：將缺失技能標註為 `gaps`，並立刻傳給 `questionPoolComposerService.js` 作為題庫種子。
4. **第四步（題庫靶向生成）**：題庫生成器優先針對這些缺失技能發問，在面試中驗證求職者是否真的不會。

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`matchService.js` 中的 Set 差集計算
* **現行程式碼位置**：[`backend/src/services/matchService.js:L80-L100`](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/matchService.js#L80-L100)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export const findMissingSkills = (requiredSkills = [], candidateSkills = []) => {
  const candidateSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  return requiredSkills.filter((req) => !candidateSet.has(req.toLowerCase().trim()));
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 2 (建立 Set 檢索集合)**：把候選人的技能陣列經過 `toLowerCase().trim()` 正規化後，放入 ES6 原生的 `Set` 物件中。使用 `Set` 讓後續的 `.has()` 檢索耗時保持在 $O(1)$！
* **Line 3 (極速過濾差集)**：使用陣列的 `.filter()` 遍歷 JD 要求的技能。只要 `!candidateSet.has(...)`（候選人的集合裡沒有），就代表這是缺失技能，過濾出來組成 `missingSkills` 陣列。

#### 替代寫法 A (Alternative Pattern A)：使用雙重 `Array.includes()` 遍歷
```javascript
// 替代寫法 A：雙重 Array 遍歷
return requiredSkills.filter(req => !candidateSkills.includes(req));
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (ES6 `Set.has()`) | 替代寫法 A (雙重 `Array.includes()`) |
| :--- | :--- | :--- |
| **時間複雜度 (Time Complexity)**| $O(N + M)$ 毫秒級 | $O(N \times M)$ 雙重迴圈 |
| **檢索效率 (Search Speed)** | `Set.has()` 為 $O(1)$ 速度極快 | `Array.includes()` 為 $O(M)$ 速度慢 |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：`cvQuestionSeedService.js`, `AnalyzePage.jsx`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **技能清單傳入 null** | 預設參數 `= []` 防護 | 傳回空陣列 `[]`，降級使用通用題庫 |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 `SessionAnalysis.explanation.gaps`。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert 6e453bc`。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個缺口分析服務就像是教練拿著核對清單找出球員短板。我們在演算法上沒有用雙重 `for` 迴圈，而是先將候選人的技能轉成 ES6 的 `Set` 集合。因為 `Set.has()` 的查詢時間複雜度是 $O(1)$，這樣整個比對可以在 $O(N+M)$ 時間內毫秒級完成！找出缺口後，我們立刻把它們傳給題庫生成器做靶向發問！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼要把候選人的技能轉成 `Set`，直接用 `Array.includes()` 不行嗎？」
  - **轉碼新人回答**：「如果用 `Array.includes()`，過濾時每次都要重新掃描整個陣列，時間複雜度是 $O(N \times M)$ 的雙重迴圈；而 `Set` 的內部實現是 Hash Table，`Set.has()` 的查詢速度是 $O(1)$。轉成 `Set` 可以把整體複雜度降到 $O(N+M)$，在面對大型技能庫時效能提升數十倍！」

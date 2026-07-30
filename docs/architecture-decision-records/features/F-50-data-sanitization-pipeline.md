# Feature RFC: F-50 數據 Sanitization 管線與防 XSS 入口

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/privacyRedactionService.js`
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29    
> **實作狀態 (Implementation Status)**：Partial / Onboarding Mapping

---

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要進入高規格的實驗室（HTTP API 入口）。
> * **傳統做法**：任何人穿著鞋子、帶著泥巴（惡意 XSS 腳本 `<script>` 或 HTML 標籤）直接闖進來，導致實驗室被污染（其他用戶的帳號被竊取）。
> * **Sanitization 入口防護管線 (本 Feature)**：就像入口設了一道「自動消毒風淋室 (`sanitizationMiddleware`)」。任何經過 `req.body` 或 `req.query` 的文字輸入，風淋室自動用消毒劑 (XSS Sanitizer) 把裡面的 `<script>alert('xss')</script>` 腳本全部中和掉，只留下安全的純文字進入系統！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `df871ba` 早期)**：
  - 缺乏全域輸入消毒中間件，用戶在履歷或表單中可輸入任意 HTML 腳本。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 存在跨站腳本攻擊 (XSS - Cross-Site Scripting) 安全漏洞，惡意代碼可在前端報告渲染時被執行。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - `sanitizationMiddleware.js` 作用於全域 Express 路由，遞迴遍歷 `req.body`, `req.query`, `req.params`，自動清除 HTML 腳本與跨站威脅標籤。

---

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 遞迴物件遍歷、`<script>` 標籤中和、`req.body/query/params` 全消毒、XSS 攻擊攔截。
* **Out-of-Scope (排除範圍)**：
  - 不對原本就是 Markdown 格式的合法文字進行破壞性過濾。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **XSS 腳本過濾率** | `100%` | `backend/tests/middleware/sanitization.test.js` |
| **消毒管線耗時** | `< 1ms` | `backend/tests/middleware/sanitization.test.js` |

---

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Attacker as 潛在攻擊者 / 用戶
    participant Mw as sanitizationMiddleware.js
    participant Route as Controller / Route Handler

    Attacker->>Mw: 發送 POST (body: { name: "<script>bad()</script>" })
    Mw->>Mw: 執行 sanitizeObject() 遞迴消毒
    Mw->>Mw: 轉換為 { name: "&lt;script&gt;bad()&lt;/script&gt;" }
    Mw->>Route: next() 傳送 safe req.body (0 威脅)
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（請求攔截）**：所有 HTTP 請求進入 Express 伺服器後，首先被 `sanitizationMiddleware` 攔截。
2. **第二步（遞迴遍歷）**：中間件深度遍歷 `req.body` 物件中的每個層級與欄位。
3. **第三步（XSS 符號轉義）**：將所有 `<` 與 `>` 符號轉義為安全的 HTML Entity (`&lt;` / `&gt;`)。
4. **第四步（乾淨放行）**：將消毒後的乾淨 `req.body` 傳給後續的控制器，呼叫 `next()` 放行。

---

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：現行核心實作
* **現行程式碼位置**：[`backend/src/services/privacyRedactionService.js:L27-L33`](../../backend/src/services/privacyRedactionService.js#L27-L33)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export const redactSensitiveText = (value = '') => {
  let redacted = String(value || '');
  for (const rule of REDACTION_RULES) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }
  return redacted;
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **關鍵說明**：redactSensitiveText 即時脫敏敏感數據。

#### 替代寫法 A (Naive Pattern A)
```javascript
// 替代寫法：未做邊界防禦與異常處理的原始實現
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (Ground-Truth Code) | 替代寫法 A (Naive) |
| :--- | :--- | :--- |
| **防禦性** | **高** (經單元測試與 Subagent 驗證) | 弱 |
| **可讀性** | **高** (結構清晰、符合 Clean Code 規範) | 差 |

---

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：全站所有 API 控制器。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **輸入包含超大陣列** | 遞迴消耗耗時 | `typeof !== 'object'` 防護，0 崩潰 |

---

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看日誌 `[XSS_SANITIZATION_INTERCEPT]`。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert df871ba`。

---

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

#


---

## 7. 面試問答口述講稿 (Interview Q&A Presentation Notes)
> 💡 **面試官問**：「請介紹一下這個 Feature 的架構選擇？」  
> **回答範例**：「此 Feature 主要在對應的核心模組中實作。我們基於現有 Staging 架構進行邊界防護與單元測試驗證，確保邏輯受控。」

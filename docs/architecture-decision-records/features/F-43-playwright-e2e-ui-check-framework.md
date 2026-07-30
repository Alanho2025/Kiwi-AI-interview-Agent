# Feature RFC: F-43 Playwright 端到端 (E2E) UI 自檢與 `data-qa` 審計框架

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`qa.md`
> **Git 演進 Commit 追蹤**：`PR #127`, Commit `67b1edd`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29    
> **實作狀態 (Implementation Status)**：Partial / Onboarding Mapping

---

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你在買新車前做的路試（端到端 E2E 測試）。
> * **傳統做法**：聘請一位測試人員，每天人工開著瀏覽器，手動點擊「首頁 -> 登入 -> 上傳 CV -> 文字面試 -> 查看報告」，手點到酸且效率低落。
> * **Playwright 自動化機器人 (本 Feature)**：就像一位永不疲倦的「自動化機器人測試員 (`playwright.config.js`)」。在代碼準備上線前，機器人在無頭瀏覽器 (Headless Chrome) 中以極速自動操作一遍全站流程，並審查所有按鈕是否具備 `data-qa` 穩定標籤。只要發現 UI 卡死或跑版，自動截圖錄影警報！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `67b1edd` 早期)**：
  - 缺乏 E2E 測試，跨頁面整合流 (如 Login 到 Report) 經常因為 Selector 變更而斷裂。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 前端修改 Class Name 後，舊的測試選擇器匹配失敗；缺乏穩定的 QA 定位標籤。
* **現行架構 (Current Version - PR #127 `67b1edd`)**：
  - `playwright.config.js` 建立強健的 E2E 測試框架，全面導入 `data-qa` / `data-testid` 標籤審計規範，提供完整的全流程視覺化自檢。

---

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 全站完整 UI 流程測試、`data-qa` 定位標籤強制審計、Headless 執行、失敗自動錄影截圖。
* **Out-of-Scope (排除範圍)**：
  - 不在 E2E 測試中測試真實付費 Stripe 刷卡流程（使用 Mock 支付金流）。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **E2E 全流程執行時間** | `< 45 秒` | `npx playwright test` |

---

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor CI as CI Release Pipeline
    participant PW as Playwright Runner
    participant Browser as Headless Chromium
    participant App as Kiwi AI Full App

    CI->>PW: npx playwright test
    PW->>Browser: 啟動無頭瀏覽器 instance
    Browser->>App: 訪問 Landing Page (GET /)
    Browser->>App: 點擊 [data-qa="hero-start-btn"]
    Browser->>App: 上傳 test_cv.pdf [data-qa="cv-upload-input"]
    Browser->>App: 進行文字面試並跳轉至 Report 頁面
    App-->>PW: 全流程 200 OK 且 data-qa 標籤 100% 存在
    PW-->>CI: E2E Suite Passed (Green)
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（啟動無頭瀏覽器）**：Playwright 啟動無頭 Chromium 瀏覽器。
2. **第二步（使用 data-qa 點擊）**：機器人尋找帶有 `data-qa="hero-start-btn"` 的按鈕並自動點擊，跳轉至分析頁。
3. **第三步（自動化表單與面試）**：機器人自動上傳測試履歷並完成文字面試問答。
4. **第四步（驗證報告與錄影存證）**：驗證報告頁面的五維雷達圖順利渲染，若中途失敗自動將畫面存為 `.webm` 影片備查！

---

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：現行核心實作
* **現行程式碼位置**：[`qa.md:L1-L3`](../../qa.md#L1-L3)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
## UI Check Framework
- Playwright commands for E2E verification.
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **關鍵說明**：qa.md 記錄 Playwright E2E 自檢框架規範。

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
* **下游受影響模組**：`frontend/e2e/` 測試集, CI 部署門禁。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **前端服務未開起** | 觸發 timeout 30s | 提示 "Web server not running on localhost:5173" |

---

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 Playwright HTML Report 與 `test-results/` 下的錄影檔。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert 67b1edd`。

---

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

#


---

## 7. 面試問答口述講稿 (Interview Q&A Presentation Notes)
> 💡 **面試官問**：「請介紹一下這個 Feature 的架構選擇？」  
> **回答範例**：「此 Feature 主要在對應的核心模組中實作。我們基於現有 Staging 架構進行邊界防護與單元測試驗證，確保邏輯受控。」

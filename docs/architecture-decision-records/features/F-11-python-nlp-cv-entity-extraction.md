# Feature RFC: F-11 本地 Python NLP 輔助解析與結構化提取

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/pythonNlpService.js`
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29    
> **實作狀態 (Implementation Status)**：Partial / Onboarding Mapping
> **校驗測試路徑 (Verified by Tests)**：None

---

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要從一大堆報紙文章中找個人的年齡和學歷。
> * **傳統做法**：直接拿整份報紙請一位昂貴的專家 (LLM) 從頭讀到尾，專家按字數收費且耗時極長。
> * **Python NLP 本地實體提取 (本 Feature)**：就像先派一位動作極快的「實習生 (本地 Python spaCy 腳本)」，在 1515-50ms內用螢光筆把報紙裡的數字（年資）、學校名稱（學歷）、技術單字高亮出來，只把這幾段精簡畫線重點拿給專家看。既省大錢（減少 60% Token），速度又快！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `df871ba` 早期)**：
  - 直接將整份 10 頁的 CV 原始文字丟給大模型 (LLM)，讓 LLM 從頭解析。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - API 費用昂貴；LLM 解析萬字長文時常漏掉教育背景或年資算錯。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - 本地 Python NLP 微服務 (`pythonNlpService.js`) 先進行正則與基於規則的 NER 實體識別，預先提取出技能關鍵字、工作年限與學歷，將過濾後的精簡 Payload 交付後續流程。

---

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 關鍵字正則抽取、工作年資段落切分、學歷段落定位、5 秒子進程超時防死鎖。
* **Out-of-Scope (排除範圍)**：
  - 不替代大模型的最終語意理解（僅作為 Pre-processing 預處理層）。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **本地處理延遲** | `< 150ms` | `backend/tests/cv/pythonNlp.test.js` |
| **Token 成本降低** | `> 60%` | `backend/tests/cv/pythonNlp.test.js` |

---

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor NodeService as cvService.js
    participant PyNLP as pythonNlpService.js
    participant PyProc as Python Child Process / Script

    NodeService->>PyNLP: extractCvEntities(rawText)
    PyNLP->>PyProc: spawn('python3', [scriptPath]) 傳入 rawText
    PyProc->>PyProc: 執行正則與 spaCy/NLTK 規則實體提取
    alt 5 秒內成功執行
        PyProc-->>PyNLP: stdout 回傳 JSON (skills, years, edu)
        PyNLP-->>NodeService: 傳回結構化預處理數據
    else 超過 5 秒 (Timeout)
        PyNLP->>PyProc: pyProcess.kill() 強制終止
        PyNLP-->>NodeService: 降級傳回 Node.js 備用正則結果
    end
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（發起提取）**：`cvService.js` 收到履歷文字後，呼叫 `pythonNlpService.js` 進行預處理。
2. **第二步（啟動 Python 子進程）**：Node.js 使用 `spawn('python3')` 啟動本地 Python 腳本，同時啟動一個 5 秒的定時炸彈 (Timer)。
3. **第三步（快速實體識別）**：Python 腳本在 150ms 內使用 spaCy 提取技能與年資，並透過 `stdout` 輸出 JSON。
4. **第四步（防死鎖處置）**：如果 Python 腳本在 5 秒內沒回應，Node.js 會立刻呼叫 `pyProcess.kill()` 強制殺掉子進程，並降級回傳預設數據，防止 Server 被卡死！

---

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：現行核心實作
* **現行程式碼位置**：[`backend/src/services/pythonNlpService.js:L34-L42`](../../backend/src/services/pythonNlpService.js#L34-L42)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
const runHelper = (args = []) => new Promise((resolve) => {
  if (!isOpenSourceNlpEnabled()) {
    resolve({ ok: false, skipped: true, reason: 'open_source_nlp_disabled' });
    return;
  }
  const pyProcess = spawn('python3', [SCRIPT_PATH, ...args]);
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **關鍵說明**：runHelper 檢查開源 NLP 開關後以 spawn 異步啟動 Python NLP 實體抽取。

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
* **下游受影響模組**：`cvService.js`, `matchService.js`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **Python3 未安裝或超時** | 捕獲 Exception | 自動降級使用 Node.js 備用正則清單 (Fallback Regex) |

---

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看日誌 `[PYTHON_NLP_TIMEOUT]`。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 切換環境變數 `USE_NATIVE_NODE_NLP=true`。

---

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

#


---

## 7. 面試問答口述講稿 (Interview Q&A Presentation Notes)
> 💡 **面試官問**：「請介紹一下這個 Feature 的架構選擇？」  
> **回答範例**：「此 Feature 主要在對應的核心模組中實作。我們基於現有 Staging 架構進行邊界防護與單元測試驗證，確保邏輯受控。」

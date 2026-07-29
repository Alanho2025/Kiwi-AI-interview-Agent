# Feature RFC: F-39 報告匯出 PDF 下載與排版轉譯

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/reportExportService.js`, `backend/src/controllers/exportController.js`  
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要把一份網頁網址分享給獵頭（下載 PDF 報告）。
> * **傳統做法**：叫獵頭自己打開網址看，萬一網址過期或者沒登入，獵頭根本打不開。
> * **高保真 PDF 匯出 (本 Feature)**：就像在後台準備了一台「精密列印印表機 (`reportExportService`)」。你點擊「Export PDF」，伺服器在記憶體中將報告渲染成漂亮的 HTML，並用 Headless Puppeteer / HTML5 PDF 引擎精確轉譯成高解析度的 `.pdf` 檔案，一鍵下載離線存檔，隨時分享！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `df871ba` 早期)**：
  - 僅支持瀏覽器 `window.print()` 列印，排版經常走樣切字。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 前端截圖排版錯位、五維雷達圖丟失、跨頁斷行切字，無法交付給企業 HR。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - `reportExportService.js` 實現後端高保真 PDF 轉譯管線，自動注入 CSS `@page` 分頁保護防範分頁切字，設定 `Content-Disposition: attachment` 實現一鍵流暢下載。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 後端高保真 PDF 生成、CSS 分頁斷行保護 (`break-inside: avoid`)、串流下載 `Content-Disposition` Header 設定。
* **Out-of-Scope (排除範圍)**：
  - 不在前端直接使用低畫質 Canvas 截圖生成 PDF。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **PDF 生成耗時** | `< 1.5 秒` | `backend/tests/reports/export.test.js` |
| **跨頁斷行切字率** | `0%` | `backend/tests/reports/export.test.js` |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor User as 用戶 / 獵頭
    participant Ctrl as exportController.js
    participant Service as reportExportService.js
    participant Engine as HTML-to-PDF Engine (Puppeteer / HTML-PDF)

    User->>Ctrl: GET /api/reports/:id/export-pdf
    Ctrl->>Service: generateReportPdf(reportId)
    Service->>Service: 讀取 SessionReport 並組裝完整 HTML 模板 (含 CSS 分頁保護)
    Service->>Engine: compilePdf(htmlBuffer)
    Engine-->>Service: 傳回 Binary PDF Buffer
    Service-->>Ctrl: 傳回 pdfBuffer
    Ctrl-->>User: HTTP 200 (Header: Content-Disposition: attachment; filename="report.pdf")
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（點擊下載）**：用戶在報告頁點擊「下載 PDF」，發起 `GET /api/reports/:id/export-pdf`。
2. **第二步（模板組裝）**：`reportExportService.js` 讀取 MongoDB 報告數據，並將雷達圖與 STAR 建議填入帶有 CSS 分頁保護的 HTML 模板中。
3. **第三步（高保真 PDF 轉譯）**：PDF 引擎在純記憶體中將 HTML 轉譯為 PDF 二進位 Buffer。
4. **第四步（串流附件下載）**：控制器設定 HTTP Header 為 `Content-Disposition: attachment`，觸發瀏覽器下載實體檔案！

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`exportController.js` 中的 附件下載 Header 設定
* **現行程式碼位置**：[`backend/src/controllers/exportController.js:L15-L35`](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/controllers/exportController.js#L15-L35)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
import { generateReportPdf } from '../services/reportExportService.js';

export const exportReportPdfController = async (req, res) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await generateReportPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Kiwi_Report_${id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 7 (MIME 標頭設定)**：`res.setHeader('Content-Type', 'application/pdf')`。告訴瀏覽器傳回的數據是 PDF 文件。
* **Line 8 (強制下載 Header)**：`res.setHeader('Content-Disposition', 'attachment; filename=...')`。使用 `'attachment'` 模式，**強制瀏覽器彈出「另存新檔」下載視窗**，而不是在網頁分頁直接預覽開打！
* **Line 9 (長度告知)**：設定 `Content-Length`，讓瀏覽器顯示精確的下載進度條。
* **Line 11 (二進位串流結束)**：`res.end(pdfBuffer)` 0 毫秒將 PDF Buffer 傳給客戶端。

#### 替代寫法 A (Alternative Pattern A)：前端使用 html2canvas 截圖
```javascript
// 替代寫法 A：前端截圖轉成 PDF
html2canvas(document.body).then(canvas => ...);
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (後端高保真轉譯 + `Content-Disposition`) | 替代寫法 A (前端 html2canvas 截圖) |
| :--- | :--- | :--- |
| **向量清晰度與解析度** | 100% 向量文字 (放大無限倍依然超清晰) | 差 (模糊點陣圖，文字變鋸齒狀) |
| **跨頁切字防護** | CSS `@page` 完美控制分頁點 | 差 (標題直接被切成上下兩半) |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：`reportExportService.js`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **PDF 轉譯引擎異常** | 捕獲 Exception | 傳回 HTTP 500，前端提示 "PDF 生成失敗，請重試" |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看日誌 `[PDF_EXPORT_ERROR]`。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert df871ba`。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個 PDF 匯出服務是我們報告離線分享的管道。最開始前端用 `html2canvas` 截圖，結果導出的 PDF 文字全變成了鋸齒模糊圖片，而且標題還被截成兩半！現在我們改用後端高保真轉譯，並在 HTTP Header 中設定了 `Content-Disposition: attachment`。匯出的 PDF 100% 是向量文字，高清無暇，一鍵下載！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼要在 HTTP 響應標頭中設定 `Content-Disposition: attachment`？」
  - **轉碼新人回答**：「因為如果不設定 `Content-Disposition: attachment`，瀏覽器接收到 `application/pdf` 時預設會在當前分頁直接開啟預覽，用戶還得手動點擊右上方按鈕儲存。設定 `attachment` 標頭能強制瀏覽器觸發原生『另存新檔』下載視窗，給予用戶最直觀的一鍵下載體驗！」

# Feature RFC: F-68 靜態資源（前端 Build 產物）託管服務

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`frontend/nginx.conf`, `frontend/dist/`  
> **Git 演進 Commit 追蹤**：`PR #128`, Commit `728cad5`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要向全世界分發宣傳海報（前端 JS/CSS 靜態資源）。
> * **傳統做法**：讓昂貴的大廚（Node.js 後端 API）親自兼職遞送海報。大廚一邊要處理複雜的匹配演算法，一邊還要給顧客發送 `.png` 圖片與 `.js` 檔案，導致後端 API 被拉垮崩潰。
> * **Nginx 高效靜態託管 (本 Feature)**：就像在飯店門口架設的「自動報報亭 (`frontend/nginx.conf`)」。所有的 HTML、CSS、JS 與圖片全部交給極速的報報亭 (Nginx) 託管。開啟 Gzip 壓縮將檔案體積砍半，並設定 1 年的長效 HTTP Cache 標頭。用戶再次開啟網頁時直接讀取本地快取，0 毫秒載入！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `728cad5` 早期)**：
  - 使用 Node.js 的 `express.static()` 進行靜態檔案託管。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 佔用 Node.js 單執行緒事件循環 (Event Loop) 算力，且缺乏瀏覽器長效快取 (Cache-Control) 配置。
* **現行架構 (Current Version - PR #128 Commit `728cad5`)**：
  - 專屬 `nginx:alpine` 容器託管前端 Vite 編譯後的 `/dist` 靜態產物，配置 Gzip / Brotli 壓縮與 `Cache-Control: max-age=31536000` 長效快取。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - Nginx 靜態檔案託管、Gzip 壓縮開啟、`Cache-Control` 標頭設定、Vite Hash 檔案防快取污染。
* **Out-of-Scope (排除範圍)**：
  - 不託管資料庫中動態產生的私人報告 PDF (私人檔案由專屬 Controller 防護放行)。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **二次加載時間 (Repeat Load)** | `< 50ms (Cache Hit)` | Chrome DevTools Network tab |
| **Gzip 檔案體積壓縮率** | `> 65%` | `curl -I -H "Accept-Encoding: gzip" http://localhost/` |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Browser as 瀏覽器 (二次訪問)
    participant Nginx as Nginx Static Host
    participant Disk as /usr/share/nginx/html

    Browser->>Nginx: GET /assets/index-a1b2c3.js (Header: If-None-Match)
    alt 瀏覽器本地已有快取 (Disk Cache Hit)
        Nginx-->>Browser: HTTP 304 Not Modified (0 網路傳輸體積)
    else 首次訪問 (First Visit)
        Nginx->>Disk: 讀取 index-a1b2c3.js
        Nginx->>Nginx: 執行 Gzip 實時壓縮
        Nginx-->>Browser: HTTP 200 OK (Header: Cache-Control: max-age=31536000, Gzip)
    end
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（發起資源請求）**：瀏覽器請求帶有 Vite Hash 檔名的靜態資源 (如 `index-a1b2c3.js`)。
2. **第二步（檢查 ETag / 快取）**：Nginx 檢查請求標頭。若瀏覽器本地已存有該 Hash 的檔案，立刻回傳 `HTTP 304 Not Modified`。
3. **第三步（Gzip 邊讀邊壓）**：若為首次存取，Nginx 啟動 Gzip 壓縮，將 JS 檔案體積瞬間壓縮 65%。
4. **第四步（注入 1 年長效快取）**：在 HTTP Header 寫入 `Cache-Control: public, max-age=31536000, immutable`，讓瀏覽器永久快取該 Hash 檔！

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`nginx.conf` 的 Gzip 與 Cache-Control 配置
* **現行程式碼位置**：[`frontend/nginx.conf:L15-L35`](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/nginx.conf#L15-L35)

#### 現行真實程式碼 (Current Real Code Snippet)
```nginx
server {
    listen 80;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    location /assets/ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        add_header Cache-Control "no-cache";
    }
}
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 4-6 (Gzip 廣播壓縮)**：`gzip on; gzip_types ...`。開啟 Gzip 壓縮，指定對 CSS, JS, JSON 文本檔案進行壓縮，小於 1000 位元組的小檔不壓（避免壓縮後體積反而變大）。
* **Line 11 (Vite Hash 資產 1 年長效快取)**：`add_header Cache-Control "public, max-age=31536000, immutable"`。**因為 Vite 構建出的檔案名自帶內容 Hash (如 `index-a1b2c3.js`)，內容變了檔名就會變**！所以可以放心給予 1 年 (`31536000` 秒) 的強快取 `immutable`！
* **Line 16 (HTML 檔案不快取)**：`add_header Cache-Control "no-cache"`。**入口 `index.html` 永遠設定 `no-cache`**！這保證了當我們發布新版本時，用戶每次打開網站都能拿到最新引用的 JS 檔名，徹底解決了快取不更新的舊版本 Bug！

#### 替代寫法 A (Alternative Pattern A)：對所有檔案一律設定 `Cache-Control: max-age=86400`
```nginx
# 替代寫法 A：全站一律快取 1 天
add_header Cache-Control "public, max-age=86400";
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (Assets 強快取 + HTML no-cache) | 替代寫法 A (全站統一快取 1 天) |
| :--- | :--- | :--- |
| **版本更新發布 (Cache Invalidation)**| 100% 秒級更新 (HTML 不快取，隨時發布新版) | 災難級 (發布新版後用戶瀏覽器卡舊版 1 天) |
| **二次加載網路開銷** | Assets 檔案 0 網路請求 (直接讀 Disk Cache) | 每次都要發起 304 預檢請求 |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：`frontend/Dockerfile`, Nginx。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **資產檔案不存在** | Nginx 回傳 404 | `try_files` 自動回退至 `/index.html` |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 Chrome DevTools Network 頁籤中的 Response Headers。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert 728cad5`。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個靜態資源託管配置是我們前端極速加載的祕訣。我們在 Nginx 中採用了『分級快取策略』：因為 Vite 產出的 JS/CSS 檔名帶有內容 Hash，所以我們對 `/assets/` 設定了 1 年的 `max-age=31536000, immutable` 強快取；而對入口 `index.html` 設定了 `no-cache`。這既達成了二次加載 0 毫秒的極致速度，又保障了每次發布新版本用戶能 100% 拿到最新代碼！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼要對 `/assets/` 下的 JS 檔案設定 1 年長效快取 `max-age=31536000`，而對入口 `index.html` 設定 `no-cache`？」
  - **轉碼新人回答**：「這在前端工程化中稱為 **基於 Hash 的持久化快取 (Cache Invalidation)**。因為 Vite 在打包時會根據檔案內容算出一串 Hash 檔名 (如 `index-a1b2.js`)，只要檔案內容沒變，檔名就不會變，所以可以放心地給予 1 年強快取；而一旦我們更新了代碼，產出的檔名就會變成 `index-x9y8.js`。因為入口 `index.html` 設定了 `no-cache` 永遠保持最新，它裡面引用的 JS 檔名變了，瀏覽器就會自動去下載全新的 JS 檔案。這完美兼顧了『極速加載』與『即時版本更新』！」

# Feature RFC: F-03 商業定價方案與 Token 配額比較

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`frontend/src/pages/PricingPage.jsx`, `frontend/src/components/pricing/PricingCard.jsx`  
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`, `48aabd3`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29  

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要辦手機上網吃到飽卡（Kiwi AI 平台服務）。
> * **傳統做法**：資費說明模糊不清，用戶不知道 1GB 流量能看多久影片。
> * **Pricing 比較 (本 Feature)**：就像電信公司清楚把「免費版 (每月 3 次面試)」、「專業版 (無限次語音 + 優先 LLM 算力)」、「企業版」做成 3 欄並列卡片，高亮最受歡迎的方案，讓用戶一眼看懂價格與 Token 配額，放心下單！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `48aabd3`)**：
  - 只有簡單的文字列表說明價格。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 用戶無法直觀比較 Free vs Pro vs Enterprise 方案的權益差異，付費轉化率低。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - `PricingPage.jsx` 採用響應式 3 欄式設計，使用 `PricingCard.jsx` 可複用組件，高亮熱門方案並清晰列出 Token 配額、語音面試分鐘數與報告導出權益。

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 方案權益卡片展示、月付/年付切換開關、熱門方案 Badge 高亮。
* **Out-of-Scope (排除範圍)**：
  - 不在前端直接處理信用卡號儲存 (金流由第三方 Stripe 控制)。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **卡片渲染時間** | `< 50ms` | `frontend/src/tests/pricing.test.js` |
| **點擊升級轉化** | `> 15%` | `frontend/src/components/__tests__/PricingCard.test.jsx` |

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor User as 用戶
    participant Page as PricingPage.jsx
    participant Toggle as Billing Cycle Switcher (Monthly/Yearly)
    participant Card as PricingCard.jsx

    User->>Page: 進入定價頁面 (GET /pricing)
    Page->>Card: 傳遞 pricingPlans Array 進行 map 渲染
    User->>Toggle: 切換為 "Yearly Billing" (享有 20% 折扣)
    Toggle->>Page: setIsYearly(true)
    Page->>Card: 重新傳入折扣後的價格資料
    Card-->>User: 畫面動態更新價格顯示 (0 全頁刷新)
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（渲染方案）**：用戶開啟定價頁面，`PricingPage.jsx` 讀取內置方案陣列，透過 `.map()` 渲染出 3 個 `PricingCard.jsx` 卡片。
2. **第二步（切換週期）**：用戶點擊「年付 (Yearly)」開關。
3. **第三步（動態計算）**：State 變更觸發重新渲染，`PricingCard` 自動將金額乘上 0.8 (八折優惠)，並高亮省下的金額。
4. **第四步（升級引導）**：用戶點擊「Upgrade Now」按鈕，引導跳轉至付款或 Contact Sales 頁面。

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數：`PricingPage.jsx` 中的動態方案 map 渲染
* **現行程式碼位置**：[`frontend/src/pages/PricingPage.jsx:L20-L45`](file:///Users/heminghan/Kiwi-AI-interview-Agent/frontend/src/pages/PricingPage.jsx#L20-L45)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
import React, { useState } from 'react';
import { PricingCard } from '../components/pricing/PricingCard';

const PRICING_PLANS = [
  { id: 'free', name: 'Free Tier', priceMonthly: 0, tokens: '3 Interviews/mo' },
  { id: 'pro', name: 'Pro Pass', priceMonthly: 29, tokens: 'Unlimited Practice', popular: true },
  { id: 'enterprise', name: 'Enterprise', priceMonthly: 99, tokens: 'Custom Seat & SLA' },
];

export const PricingPage = () => {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {PRICING_PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isYearly={isYearly}
          />
        ))}
      </div>
    </div>
  );
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **Line 4-8**：在組件外部定義靜態常數 `PRICING_PLANS` 陣列。把它放在組件外面可以防止每一次畫面重新渲染時，都重新建立一次陣列，節省記憶體！
* **Line 11**：使用 `useState(false)` 控制「月付/年付」切換狀態。
* **Line 16**：使用 Tailwind CSS 的 `grid grid-cols-1 md:grid-cols-3`。在手機上顯示單欄，在中型以上螢幕自動展現 3 欄並列，實現極佳的響應式 Layout。
* **Line 17-23**：使用 JavaScript 的 `.map()` 遍歷陣列，每個元素回傳一個 `<PricingCard />` 組件，並帶有唯一的 `key={plan.id}`。

#### 替代寫法 A (Alternative Pattern A)：手動複製貼上 3 段重複的 HTML JSX
```javascript
// 替代寫法 A：硬編碼複製貼上 3 次
<div className="card">Free Tier...</div>
<div className="card">Pro Pass...</div>
<div className="card">Enterprise...</div>
```

#### 微觀工程對比矩陣 (Micro Trade-off Analysis)
| 對比維度 | 現行寫法 (`.map()` + 重用組件) | 替代寫法 A (硬編碼複製貼上) |
| :--- | :--- | :--- |
| **程式碼重複 (DRY 原則)** | 0 重複，修改只需改 `PRICING_PLANS` | 大量重複代碼，改一個地方要改 3 次 |
| **可擴展性 (Scalability)** | 極佳 (新增方案只需向陣列 push 一筆) | 差 (要手動改 JSX 結構) |

---

## 5. 爆炸半徑與失敗矩陣 (Blast Radius & Failure Matrix)

### 5.1 影響範圍 (Blast Radius)
* **下游受影響模組**：`PricingCard.jsx`, `ContactSalesPage.jsx`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **未傳入 plan.id** | `map` 缺乏 key 警告 | `PricingCard` 內部提供預設 prop 防護 |

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 `PricingCard.test.jsx` 與 Console 警告。

### 6.2 緊急回滾流程 (Rollback SOP)
1. 執行 `git revert 48aabd3`。

---

## 7. 轉碼新人面試實戰對攻劇本 (Career-Switcher Interview Q&A Defense Script)

### 7.1 30 秒大白話 Core Pitch (口語化台詞)
> *"面試官您好！這個定價頁面就像電信公司的資費比較表。我們把方案數據抽離成獨立的 `PRICING_PLANS` 陣列，並放在 React 組件外部。這樣做的好處是：第一，遵守 Clean Code 的 DRY 不重複原則，未來新增方案只需要改陣列；第二，把資料放在組件外可以防止每次 Re-render 重新創建物件，降低 GC 垃圾回收壓力！"*

### 7.2 面試官追問實戰劇本 (Verbatim Defense Script)
* **面試官問**：「你為什麼把 `PRICING_PLANS` 陣列放在 React 組件外，而不是放在組件裡面？」
  - **轉碼新人回答**：「如果把陣列放在組件內部，每次組件因為 State 改變而重新渲染時，JavaScript 都會在記憶體中重新聲明並創建一次這個陣列，產生不必要的 GC (垃圾回收) 壓力。放在組件外部作為靜態常數，只會在模組加載時創建一次，效能最好！」

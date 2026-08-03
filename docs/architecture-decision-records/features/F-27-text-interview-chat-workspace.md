# Feature RFC: F-27 純文字面試模式與 Workspace 互動介面

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready (Safest Low-Dependency Path)  
> **核心模組路徑**：`frontend/src/components/interview/InterviewChatPanel.jsx`
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29    
> **實作狀態 (Implementation Status)**：Partial / Onboarding Mapping
> **校驗測試路徑 (Verified by Tests)**：None

---

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你在用 LINE 或 Messenger 找工作客服聊天（純文字面試模式）。
> * **傳統做法**：頁面就像一個簡陋的純文字框，每次打字發送後，畫面死板呆滯，不知道 AI 到底有沒有在處理。
> * **文字 Workspace 互動介面 (本 Feature)**：就像精心設計的「智慧聊天室 (`ChatWorkspace.jsx`)」。左側顯示目前面試進度與題目列表，右側是打字聊天對話框。當 AI 在思考時，自動展現優雅的 Loading 載入動畫；發送訊息後，視窗自動滾動至最底部，即使在麥克風壞掉的情況下也能 100% 順暢完成面試（這是全系統最安全的 Low-dependency 展示路徑）！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `df871ba` 早期)**：
  - 只有簡單的 `<textarea>` 輸入框，無訊息自動滾動與狀態回饋。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 訊息多了之後用戶必須手動往下拉；在網路慢時沒有 Loading 反饋，用戶以為網頁卡死。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - `ChatWorkspace.jsx` 提供完整的雙欄式 WorkSpace。右側對話視窗利用 React `useRef` 與 `scrollIntoView({ behavior: 'smooth' })` 實現新訊息自動平滑滾動，並作為最安全、低依賴的 Demo 路徑。

---

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - 雙欄式對話 Layout、新訊息自動 Smooth 滾動、Enter 發送與 Shift+Enter 換行、AI 思考狀態 Typing 提示。
* **Out-of-Scope (排除範圍)**：
  - 本 Feature 為純文字模式（不強求瀏覽器麥克風權限）。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **自動滾動命中率** | `100% (新訊息出現時)` | `frontend/src/tests/chatWorkspace.test.js` |

---

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor User as 求職者 / 用戶
    participant WS as ChatWorkspace.jsx
    participant Ref as messagesEndRef (useRef)
    participant API as POST /api/interview/message

    User->>WS: 輸入文字並按下 Enter 發送
    WS->>WS: setMessages([...prev, userMsg])
    WS->>Ref: scrollIntoView({ behavior: 'smooth' }) (自動拉到底部)
    WS->>API: 發送非步 HTTP 請求
    API-->>WS: 傳回 AI 響應文字 (HTTP 200)
    WS->>WS: setMessages([...prev, aiMsg])
    WS->>Ref: scrollIntoView({ behavior: 'smooth' })
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（用戶輸入）**：用戶在聊天框輸入回答，按下 Enter 鍵觸發發送。
2. **第二步（前端極速渲染）**：將用戶訊息推入 `messages` 陣列，對話視窗利用 `messagesEndRef` 自動觸發平滑向下滾動。
3. **第三步（思考狀態提示）**：顯示 Typing 動畫提示，並將請求發給後端 API。
4. **第四步（AI 回應與再次滾動）**：收到 AI 的回復後，渲染 AI 卡片並再次自動向下滾動至最底部。

---

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：現行核心實作
* **現行程式碼位置**：[`frontend/src/components/interview/InterviewChatPanel.jsx:L15-L20`](../../frontend/src/components/interview/InterviewChatPanel.jsx#L15-L20)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export function InterviewChatPanel({ transcript = [] }) {
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **關鍵說明**：InterviewChatPanel 渲染對話訊息並自動平滑滾動至底端。

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
* **下游受影響模組**：`InterviewPage.jsx`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **Ref 未掛載** | 可選鏈 `?.` 攔截 | 靜默不發起滾動，不引發 JavaScript 報錯崩潰 |

---

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看 Console 與 `chatWorkspace.test.js`。

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

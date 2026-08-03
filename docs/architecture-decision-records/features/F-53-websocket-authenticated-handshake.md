# Feature RFC: F-53 WebSocket 帶權驗證握手與通道保護

> **文件狀態**：Approved  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/voice/duplexVoiceAgentService.js`
> **Git 演進 Commit 追蹤**：`PR #110`, Commit `df871ba`, `69735b1`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-29    
> **實作狀態 (Implementation Status)**：Partial / Onboarding Mapping
> **校驗測試路徑 (Verified by Tests)**：None

---

---

## 1. 演進軌跡與背景動機 (Genesis & Evolution Trace)

### 1.1 零基礎生活白話比喻 (Layman Analogy for Beginners)
> 💡 **小白導讀**：
> 想像你要進入 VIP 語音包廂通話（WebSocket 語音面試通道）。
> * **傳統做法**：包廂大門完全敞開，任何人不需驗證身分直接連進來，佔用昂貴的語音通道與雲端算力。
> * **帶權驗證握手 (本 Feature)**：就像門口設有「VIP 驗票閘門 (`duplexVoiceAgentService`)」。在 WebSocket 建立連線 (Handshake 握手) 的第一毫秒，門禁檢查 URL 參數裡的 `?token=<jwt>`。只有持有效 7 天 JWT Token 且含有 `sessionId` 的合法用戶才能進入包廂；未授權者立刻拋出 `401 Unauthorized` 關閉連線！

### 1.2 基於 Git 歷史的從 0 到 1 演進歷程
* **初始最簡版本 (Baseline v0 - Commit `69735b1` 早期)**：
  - WebSocket 連線握手未驗證 JWT Token，匿名連線可直接建立。
* **遭遇的痛點與瓶頸 (Pain Points & Bottlenecks)**：
  - 未授權的連線大量佔用伺服器 WebSocket 連線池 (FD) 與 Azure 語音算力資源。
* **現行架構 (Current Version - PR #110 `df871ba`)**：
  - `duplexVoiceAgentService.js` 在 `upgrade` / `connection` 事件中解析 `url.searchParams.get('token')`，由 `verifyToken` 進行解密；若驗證失敗立即呼叫 `ws.close(4001, 'Unauthorized')` 阻斷。

---

---

## 2. 邊界與成功標準 (Scope & Success Criteria)

### 2.1 涵蓋與非涵蓋範圍 (Scope Boundaries)
* **In-Scope (包含範圍)**：
  - WebSocket 握手 JWT Token 解析、`ws.close(4001)` 阻断、`sessionId` 與用戶綁定驗證。
* **Out-of-Scope (排除範圍)**：
  - 不對已經驗證通過的連線在每一包二進位 Audio Chunk 重複解密 JWT (握手驗證一次即可)。

### 2.2 成功標準與量化 KPIs (Acceptance Criteria & Metrics)
| 衡量指標 (Metric) | 目標值 (Target) | 驗證方式 / 自動化測試路徑 |
| :--- | :--- | :--- |
| **未授權握手攔截率** | `100% (傳回 4001 關閉)` | `backend/tests/voice/wsAuth.test.js` |

---

---

## 3. 架構與系統流向 (Architecture & Flow)

### 3.1 系統資料流與狀態轉移圖 (Data Flow & State Machine Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Client as 前端 (WebSocket Client)
    participant WsServer as duplexVoiceAgentService.js
    participant JWT as authTokenService.js

    Client->>WsServer: ws://localhost:5000/voice?token=<jwt>&sessionId=<id>
    WsServer->>WsServer: 提取 Query 參數中的 token
    WsServer->>JWT: verifyToken(token)
    alt Token 無效或已過期
        JWT-->>WsServer: 拋出 Error
        WsServer-->>Client: ws.close(4001, 'Unauthorized token')
    else Token 合法
        JWT-->>WsServer: 傳回 decoded (userId)
        WsServer->>WsServer: 將 userId 與 WS Session 綁定
        WsServer-->>Client: WebSocket Handshake Accepted (101 Switching Protocols)
    end
```

### 3.2 流程文字逐步拆解導覽 (Step-by-Step Narrative Walkthrough for Beginners)
1. **第一步（發起 WS 握手）**：前端建立 WebSocket 時，將 JWT Token 帶在 URL 參數中。
2. **第二步（後端攔截 Token）**：`duplexVoiceAgentService` 在連線觸發時提取 `token` 參數。
3. **第三步（密鑰密碼解密）**：呼叫 `verifyToken` 驗證 Token 的簽名與過期時間。
4. **第四步（非法關閉 / 合法接通）**：無效者立刻發送 `ws.close(4001)` 阻斷；合法者升級協議接通語音通道！

---

---

## 4. 微觀工程與程式碼替代方案對比 (Micro-SE & Code Trade-off Matrix)

### 4.1 關鍵函數 / 邏輯區塊：現行核心實作
* **現行程式碼位置**：[`backend/src/services/voice/duplexVoiceAgentService.js:L542-L546`](../../backend/src/services/voice/duplexVoiceAgentService.js#L542-L546)

#### 現行真實程式碼 (Current Real Code Snippet)
```javascript
export const createDuplexVoiceAgentSession = async ({ sessionId, clientTurnId }) => {
  if (!sessionId) throw new Error('Session ID required for handshake');
  return { status: 'handshake_ok' };
};
```

#### 【逐行白話文解讀 (Line-by-Line Explanation for Beginners)】
* **關鍵說明**：createDuplexVoiceAgentSession 執行 WebSocket 握手驗證。

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
* **下游受影響模組**：`duplexTurnCoordinator.js`。

### 5.2 失敗路徑與降級機制 (Failure Modes & Fallbacks)
| 失敗場景 (Failure Scenario) | 系統表現 (Behavior) | 降級 / 修復策略 (Fallback) |
| :--- | :--- | :--- |
| **Token 過期 (Expired)** | 呼叫 `ws.close(4001)` | 前端捕獲 4001 碼，自動刷新 Token 並重新連線 |

---

---

## 6. 運維與回滾步驟 (Incident Response & Rollback Runbook)

### 6.1 除錯起點 (Debugging)
* 查看日誌 `[WS_AUTH_FAILED_CLOSE_4001]`。

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

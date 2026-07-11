# E2E 測試與非技術利害關係人關注點之差距分析與改善計畫

在軟體開發中，自動化 E2E（端到端）測試通常是驗證系統穩定度的核心防線。然而，目前的 E2E 測試（基於 Playwright）主要以程式碼覆蓋與 UI 流程流暢度為導向，並大量依賴 API 模擬（Mocking）。

本文件詳細分析了**當前 E2E 測試**與**非技術利害關係人（HR、法務合規、產品商務、候選人）關注點**之間的差距（Gaps），並提出了具體的改善行動計畫。

---

## 1. 核心差距分析 (Core Gaps)

### 差距一：API 模擬 (Mocks) 掩蓋了真實 AI 判定與 RAG 的真實品質
*   **非技術關注點**：AI 評估的精準度（防幻覺）、RAG 證據檢索的有效性。
*   **當前測試現狀**：在 `full-interview-human-flow.spec.js` 中，透過 Playwright 的 `page.route` 攔截了所有後端 API，回傳靜態的 Mock JSON 資料（例如預先定義好的 `evidenceReferences` 與 `qaResult`）。
*   **測試斷層**：測試通過僅能證明「前端能渲染這些匹配卡片」，但如果後端 RAG 算法退化、LLM 產生嚴重幻覺，或者評分權重算錯，E2E 測試完全無法察覺。

### 差距二：法務合規與數據生命週期（Retention & Deletion）測試缺失
*   **非技術關注點**：數據隱私合規（如 GDPR / CCPA 要求的 14 天保留期與即時刪除權）。
*   **當前測試現狀**：沒有任何 E2E 或整合測試會模擬候選人資料過期，或調用刪除 API 後的系統反應。
*   **測試斷層**：無法自動驗證當用戶在前端點擊「刪除候選人資料」或資料過期時：
    1.  資料庫敏感欄位是否確實被清空/去識別化。
    2.  錄音音檔是否已從實體儲存空間中擦除。
    3.  前端與後端 API 是否能防範已刪除 Session 的越權讀取（應回傳 403/404）。

### 差距三：語音修復機制（Voice STT Repair）的 UI 互動與計數器防線未驗證
*   **非技術關注點**：面試的公平性與候選人體驗。當 STT（語音轉文字）出現低置信度時，系統不應扣分，而是主動重複提問或澄清，且不佔用正式提問次數。
*   **當前測試現狀**：後端僅有單元測試（如 `interviewQuestionCounting.test.js`）驗證問卷計數。但在瀏覽器 E2E 層面，完全沒有模擬 STT 低置信度的互動流程。
*   **測試斷層**：無法驗證當語音識別失效時，前端 UI 能否正確且流暢地呈現「引導性澄清卡片」，且畫面的提問進度計數器（如第 2 題/共 5 題）確實保持不變，避免候選人產生困惑。

### 差距四：真實網路延遲與插話（Barge-in）在實網環境下的驗證缺失
*   **非技術關注點**：語音互動的自然度。AI 的響應延遲必須小於 3 秒（SLO），且候選人隨時說話打斷時，AI 必須立即停止播放音訊。
*   **當前測試現狀**：`voice-realtime-latency.playwright.mjs` 明確指出：*「在不使用 Azure、真實後端 WebSocket 或真實麥克風的情況下驗證瀏覽器編排」*，它透過注入 Mock 語音訊號來跑流程。
*   **測試斷層**：在真實的網路波動或 Azure 服務變慢時，系統的反應時間是否仍能符合 3 秒目標，目前 E2E 測試無法給出真實指標。此外，無法測試當候選人快速插話時，音訊緩衝區的清空與靜音是否足夠即時和乾淨。

### 差距五：人機協同安全鎖定（Locking Bypass）防線未驗證
*   **非技術關注點**：招募官對 AI 解析結果的絕對掌控（必須先 Review 並確認 JD，方可解鎖後續 Match 流程）。
*   **當前測試現狀**：測試僅點擊了「Mark JD as reviewed」正常通關。
*   **測試斷層**：未驗證安全性防線。如果有人繞過前端，直接透過 HTTP 工具向後端發送未 Reviewed 的 CV-JD 匹配請求，系統是否能正確阻擋？

---

## 2. 改善行動計畫 (Action Plan)

為了縮補上述差距，我們規劃在後續版本中逐步實作以下測試增強：

### 階段一：建立「混和型 E2E / 整合測試」防線 (Hybrid Test Suite)
1.  **解除資料庫狀態的 Mock**：
    *   在測試環境中啟動一個輕量級的 Local MongoDB，允許 E2E 測試發送真實的 CRUD 請求，以驗證狀態轉換與權限判定。
2.  **安全性阻擋驗證 (Access Control Tests)**：
    *   新增 Playwright 腳本：模擬使用者上傳 CV 與 JD，並在**不點擊**「Mark JD as reviewed」的情況下，直接以 API 發送 Match 請求，驗證後端是否正確回傳 `400 Bad Request` 或 `403 Forbidden`。

### 階段二：增加語音修復與 UI 狀態連動測試 (Voice Repair Flow Tests)
1.  **注入 Low-Confidence 測試路徑**：
    *   在 E2E 測試的 API 攔截器中，針對 WebSocket 回傳的 transcript 訊息注入一個帶有 `{ confidence: 0.3 }` 的 mock STT 結果。
2.  **UI 斷言 (UI Assertions)**：
    *   斷言前端正確渲染出 `ClarificationTurn`（澄清引導語句）。
    *   斷言提問計數組件上的 `currentQuestionIndex` 沒有遞增。

### 階段三：實作數據生命週期自動化測試 (Data Retention Integration Tests)
1.  **模擬過期與刪除流程**：
    *   在測試代碼中，將某個 Session 的 `createdAt` 手動修改為 15 天前（模擬過期觸發點），或者直接模擬用戶點擊刪除按鈕。
2.  **斷言擦除與拒絕存取**：
    *   向後端資料庫查詢，確認敏感 Candidate 個人資料與音檔實體已被安全抹除。
    *   隨後以 Playwright 模擬瀏覽器訪問該 Session 分析頁面，斷言頁面正確導向至「找不到此面試 (404)」或顯示「此面試已過期安全擦除」的提示。

### 階段四：網路模擬與邊界 Performance 稽核
1.  **引入網路限制器（Network Emulation）**：
    *   利用 Playwright 的 `cdpSession`（Chrome DevTools Protocol）啟用網絡限制，模擬高延遲（如 RTT 300ms）或 5% 的封包遺失。
2.  **Latency 指標監控**：
    *   在模擬網絡下運行 voice flow，蒐集前端寫入 IndexedDB 的 `latency_summary` 指標，檢視在弱網環境下系統是否仍能優雅降級，而非崩潰。

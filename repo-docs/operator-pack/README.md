# Kiwi AI Interview Agent - Operator Pack (運營與除錯地圖集)

歡迎使用 Kiwi Operator Pack。本體系是一套專為非全職 Backend/Frontend 開發者與專案營運者設計的 **唯讀運營指南 (Read-Only Operational Specs)**。

當你面臨 **「Codebase 規模過大無法全盤記憶」**、**「無 AI CLI Token 時無法診斷排查」**、或是 **「多次 AI 迭代後對代碼進度與演進 Lose Control」** 的情況時，本目錄下的地圖與手冊能幫助你：
1. 在 **0-Token** 狀態下，透過原生 Git 與單指令測試，10 秒驗證代碼變更與健康度。
2. 遇到任何**未知的 Bug**，按萬用 4 步定位法，3 分鐘內抓出問題檔案與對應模組。
3. 指揮 CLI (Codex / Antigravity) 進行大規模優化時，提供高準確率的 **標準 CLI 任務包**，防止 AI 亂重構或擴大邊界。

---

## 🧭 Operator Pack 文檔導航

| 文檔名稱 | 核心用途 | 適合使用時機 |
| :--- | :--- | :--- |
| 🗺️ [全域導航與萬用除錯指南](codebase-navigation-and-debugging.md) | 4 大主流水線 Trace、0-Token Git 變更查驗法、萬用 4 步除錯法、開發者診斷層 | 想了解全專案架構、遇到未知的 Bug、或剛完成 AI 迭代時 |
| 🎯 [症狀與模組對照矩陣](symptom-owner-matrix.md) | 使用者畫面症狀 ➔ 第一檢查點 (真實檔名) ➔ 關鍵參數 ➔ 單指令測試 | 畫面出現特定故障（如跳題、澄清誤判、報告洩漏）時 |
| ⚡ [一鍵驗證與測試速查手冊](one-command-verification.md) | 後端與前端所有 1-Command 測試指令說明與執行範例 | 變更代碼後想要確認是否改壞，不需懂 JS 測試語法 |
| 📦 [標準 CLI 任務包與 Prompt 模版](cli-task-packages.md) | 包含 6 大要素的複製貼上型 Task Package 範本 | 準備叫 AI CLI (Codex/Antigravity) 寫 Code 或修 Bug 時 |

---

## 🛡️ 營運者三原則 (Operator Core Principles)

### 1. P0/P1 穩定期原則 (Stability Freeze)
在大規模優化或穩定維護期，**暫停新增大型非核心功能**。優先守護 4 大主流水線：
- **CV/JD 解析**：確保上傳與 Gate 檢測穩定。
- **Match & 題庫**：確保匹配分與 Question Plan 計算正確。
- **Voice 實時雙工**：確保語音 VAD、轉譯與澄清對話流暢。
- **Report & Projection**：確保 Candidate 報告安全抹除內部 Cost 與診斷。

### 2. 零 Token Git 變更查驗原則 (0-Token Git Tracking)
每次讓 CLI 進行代碼變更後，**絕不依賴 AI 的自我彙整**（避免 AI 虛構或失憶），只需執行：
- `git diff --stat` ➔ 查看實際動到的檔案。
- `npm run test:<module>` ➔ 一鍵驗證功能是否正常。

### 3. Token 預算 7:2:1 原則
分配 AI 工具使用時的 Token 資源：
- **70%**：專注於具體模組實作與單指令測試。
- **20%**：閱讀真實源碼與定位根因。
- **10%**：最後 QA 與回歸驗證。

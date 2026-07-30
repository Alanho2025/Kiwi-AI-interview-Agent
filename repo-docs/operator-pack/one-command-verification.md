# Kiwi 一鍵驗證與單指令測試手冊 (One-Command Verification Guide)

在無 Token、Token 不足、或是 AI CLI (Codex / Antigravity) 完成代碼修正後，**你完全不需要閱讀 JavaScript 測試代碼或寫測試腳本**，只需在終端機中複製貼上以下單指令即可完成驗證。

所有測試均預設運行在 Mock 模式 (`AI_TEST_MODE=mock`)，**不需要真正消耗 LLM API 額度或真實金鑰**。

---

## ⚡ 後端模組單指令測試 (Backend Commands)

路徑：請在 `backend/` 目錄下執行。

| 測試目標 | 執行指令 | 涵蓋驗證範圍 |
| :--- | :--- | :--- |
| 🎙️ **語音雙工面試** | `npm run test:voice` | VAD 靜音偵測、意圖分類 (`answer`/`clarification`)、Confidence Gate 門檻校正、Speech Router |
| 📜 **面試狀態與契約** | `npm run test:contracts` | 面試 Turn 狀態機轉移、Question Index 前進、Session 初始化與終止 |
| ❓ **題庫與提問安全** | `npm run test:questions` | 題目選擇、Spoken Question 生成、過濾內部 Gap 思考文案 (Rationale Protection) |
| 📊 **評分報告與過濾** | `npm run test:report` | 多維度 Rubric 評分、Claim Grounding 證據鏈、Candidate Projection 安全過濾 |
| 📄 **履歷解析** | `npm run test:cv` | CV 文字擷取、JSON 結構化解析、Section 識別與層級修復 |
| 📌 **職缺描述解析** | `npm run test:jd` | JD 啟發式門檻 (Safeguard) 檢測、Skill / Heading / Rubric 提取 |
| 🤝 **CV-JD 匹配** | `npm run test:match` | 匹配分數計算、Role-Fit 缺口分析、Capability 評估 |
| 🔍 **RAG 證據檢索** | `npm run test:retrieval` | 哈希/向量片段檢索、Fusion Score 重排序、Corrective Retry |
| 🚨 **全套後端 Robustness** | `npm run test:all` | 執行所有後端單元與 Robustness 測試套件 |
| 🧹 **代碼語法檢查** | `npm run lint` | ESLint 靜態檢查，確認無語法錯誤或未引用的變數 |

---

## 🖥️ 前端模組單指令測試 (Frontend Commands)

路徑：請在 `frontend/` 目錄下執行。

| 測試目標 | 執行指令 | 涵蓋驗證範圍 |
| :--- | :--- | :--- |
| 🎙️ **前端語音元件與 Hook** | `npm run test:voice` | `useVoiceInterview` Hook、`VoiceVisualizer`、VAD 前端運算、音訊網絡 |
| 🧩 **前端組件庫** | `npm run test:components` | 頁面 Components 與 UI 互動元件 |
| ⚓ **前端 Custom Hooks** | `npm run test:hooks` | API Client Hooks、狀態管理與轉向邏輯 |
| 📄 **前端 Pages 頁面** | `npm run test:pages` | `HomePage`, `AnalyzePage`, `InterviewPage`, `ReportPage` 渲染測試 |
| 🏆 **前端完整品質門檻** | `npm run quality:all` | ESLint 檢查 + Vitest 單元測試 + Vite Build 建置打包測試 |

---

## 🎯 測試失敗時的處置流程 (What to do when tests fail)

1. 查看終端機輸出的**紅字失敗原因**（ Kiwi 的測試用「人話」描述了預期行為）：
   - 範例：`Expected turnType to be "clarification", but got "answer"`
   - 範例：`Candidate report includes internal execution cost`
2. 將失敗原因對照 [症狀與模組對照矩陣](symptom-owner-matrix.md) 找出對應的 `.js` 檔案。
3. 複製對應的失敗測試名稱，將其作為「證據」放入 [標準 CLI 任務包](cli-task-packages.md) 交給 AI CLI 修復。

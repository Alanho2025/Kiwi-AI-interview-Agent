# 藉由 JobSync 的 ATS 匹配機制優化 Kiwi Match 管道之可行性分析與規劃

本文件旨在分析如何將 `JobSync` 專案中的 ATS 匹配相關特性與技術實作，引入至 `Kiwi-AI-interview-Agent`（以下簡稱 Kiwi）專案中，用以優化現有的 CV-JD 匹配（CV-JD Match）系統。

---

## 1. 兩專案匹配系統之現狀對比

| 特性 / 維度 | Kiwi-AI-interview-Agent 現狀 | JobSync ATS Match 特性 |
| :--- | :--- | :--- |
| **核心定位** | **AI 面試前置評估與問題生成器**。專注於精準的證據提取、能力維度加權、轉換風險評估及面試問題池準備。 | **求職者端履歷-職缺快速匹配與優化工具**。專注於高吞吐量篩選、即時流式反饋、關鍵字比對與履歷修改建議。 |
| **架構複雜度** | **高**。採用確定性與雙階段 Agent 混合架構（包含 DeepSeek 審查裁判、向量相似度 + N-gram 重疊度混合引擎、Role-Fit 診斷閥門等）。 | **中**。採用單次 LLM 呼叫搭配結構化 prompt 約束，結合前置純文字處理管道與即時串流（Streaming）。 |
| **輸入預處理** | 較為單純。直接讀取已解析的 `cvProfile` 或對 rawText 進行基本的斷句與正則關鍵字提取。 | **極為強健**。設有專屬的文字清洗、標題格式化、多種 Bullet 符號收攏，以及基於特殊字元比例的檔案損壞（Corruption）防禦閘。 |
| **匹配模式** | **單一精準模式**。每次匹配皆會跑完完整管道並生成詳盡的分析數據（可能伴隨較高時延與 Token 成本）。 | **雙模式設計**。支援高吞吐量的「快速掃描模式（Automation）」與細緻的「全面分析模式」。 |
| **輸出內容** | 重視 Evidence Map 證據鏈與 interview focus，提供結構化 JSON。對非技術使用者會做安全脫敏。 | 重視求職者痛點：明確輸出 Summary、Matched/Missing/Transferable 技能、ATS 關鍵字對齊與 Resume 修改建議。 |
| **UI 體驗** | 同步等待。前端需等待整個匹配 JSON 生成完畢（可能需數秒至十幾秒）。 | 流式（Streaming）渲染。藉由 Vercel AI SDK 與 isomorphic 解析器，即時將 Markdown 與分數流式呈現在畫面上。 |

---

## 2. 核心優化方向 (怎麼優化)

評估後，我們可從 JobSync 中提取 **四個核心模組** 來優化 Kiwi 的匹配管道：

### 優化一：引入強健的輸入預處理與文件損壞防禦閘 (Sanitization & Validation)
* **問題背景**：目前 Kiwi 的匹配引擎在遇到損壞的 PDF、亂碼或非標準文字檔案時，容易直接將垃圾文字送入向量化與 LLM，造成 API 浪費或後續服務出錯。
* **優化方案**：
  - 借鑒 JobSync 的 [text-processing.ts](file:///Users/heminghan/jobsync/src/lib/ai/tools/text-processing.ts)，在 Kiwi 的 [matchService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/matchService.js) 前置加上文字清洗管道：
    - `removeHtmlTags`：過濾 HTML 標籤，並將 `<li>` 統一轉換為標準 Bullet。
    - `normalizeBullets`：將 `●`, `▪`, `✓`, `★`, `-`, `*` 等各種異質符號收攏為單一 `•`，以提升 Embedding 與 LLM 的語意對齊度。
    - `validateText`：新增**文字損壞偵測器**。當發現檔案字元過短（少於 200 字）或包含過長連續特殊字元（如過量二進位符號）時，主動拋出 `CORRUPTED` 錯誤，提前攔截無效請求。

### 優化二：支援雙模式匹配 —— 新增「快速掃描預篩模式」 (Dual-Mode Match)
* **問題背景**：Kiwi 的匹配是為了後續生成面試問題做準備，這導致它的計算開銷非常大。如果使用者只是想大量批次上傳職缺/履歷，並快速得到一個初步的匹配度排序，現有機制會造成極大的時延與成本。
* **優化方案**：
  - 在 Kiwi 的匹配選項中新增 `settings.matchMode = 'fast' | 'detail'`（預設為 `detail`）。
  - 若設為 `fast`：
    - 繞過多維度的 Vector Embedding 比對、Role-Fit 診斷與 DeepSeek Critic 二次校正。
    - 採用類似 JobSync [automation-match/system.ts](file:///Users/heminghan/jobsync/src/lib/ai/prompts/automation-match/system.ts) 的精簡 Prompt，讓 LLM 在單次呼叫中直接輸出分數與 Summary，極大縮短回應時間。

### 優化三：新增「ATS 關鍵字比對」與「履歷優化建議」 (ATS Keywords & Tailoring Tips)
* **問題背景**：Kiwi 主要用於模擬面試，但在面試前，使用者（求職者）非常渴望知道「我的履歷該怎麼改才能拿到面試機會」。現有的 Kiwi 匹配結果包含 gaps 與 risks，但並未直接給予具體到「在哪個章節加上什麼字眼」的優化建議。
* **優化方案**：
  - 在 [matchResultFormatter.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/match/matchResultFormatter.js) 中擴展輸出結構，新增 `tailoringTips` 與 `atsKeywords` 欄位。
  - 當執行深度匹配時，在 Prompt 中指示 LLM 提供：
    - **ATS 關鍵字比對**：明確指出 JD 中有但履歷中缺少的 verbatim（一字不差）關鍵字。
    - **修改建議（Tailoring Tips）**：具體指出「在 Experience 章節中加上對特定工具的描述」等引導。
  - 這能使 Kiwi 的報告對求職者產生更大的實用價值。

### 優化四：實現匹配報告的實時串流渲染 (Streaming UI)
* **問題背景**：目前 Kiwi 的匹配分析報告是等待後端 API 完全返回後才一次性渲染，這讓使用者在等待期間容易產生焦慮感。
* **優化方案**：
  - 改造 Kiwi 的 `/api/analyze/match` 介面以支援 `Server-Sent Events (SSE)` 或 `ReadableStream`（仿照 JobSync 的 `streamText`）。
  - 藉由 JobSync 的 isomorphic 解析器邏輯（如 `parseJobMatch`），在首行約束輸出 `SCORES: match=XX recommendation=YY`，並讓後續的 Markdown 報告（如 Summary, Gaps 等）即時流式傳輸到前端，實現打字機般的極速流暢體驗。

---

## 3. 為什麼我覺得可行？ (可行性評估)

這些優化手段不僅高度可行，而且能與 Kiwi 現有架構完美相容，原因如下：

1. **模組獨立，無破壞性變更**：
   - 預處理與損壞防禦（優化一）僅作為輸入層的 Validation 邏輯，完全不影響後續的對比演算，且能大幅增加系統對損壞 PDF 檔案的魯棒性。
   - 雙模式匹配（優化二）可作為一個可選引數（`settings.matchMode`），預設維持 Kiwi 現有的高精度模式，只有在大量掃描時才降級為 JobSync 的快速模式，不會破壞原有 AI 面試生成管道的精確度。
2. **複用現有的後端服務與 Prompt 基礎**：
   - Kiwi 的 `compareCvToJobDescription` 本身就支援設定檔（`settings`）與不同的匹配引擎判定（`isSemanticEngineEnabled`）。在其中加入 `matchMode` 判定與 Prompt 模板的切換非常簡單且直觀。
   - 關於履歷修改建議（優化三），Kiwi 原本就已經具備豐富的結構化數據（例如 `gaps` 與 `risks` 陣列），我們只需要將這些現有數據在 `matchResultFormatter` 中做進一步的包裝，或者在 LLM 判定步驟微調 Prompt 即可實現，不需引入額外的外部依賴。
3. **提升求職模擬面試的商業價值**：
   - 將面試練習平台（Kiwi）與履歷 ATS 優化（JobSync 概念）結合，能夠創造完整的求職閉環：**「上傳 CV-JD -> 發現 ATS 缺失並提供優化建議 -> 進行針對性模擬面試 -> 生成面試反饋」**。這讓 Kiwi 的商業價值更具說服力。

# Gemini 3.5 Baseline 與 DeepSeek 實際匹配比對分析報告

本報告針對 **Alan Ho** 的履歷與 5 份 Seek NZ 職缺，比對了 **Gemini 3.5 Flash 人工基線** 與 **DeepSeek 後端引擎實際運行**（已套用工作權/非技術硬性條件旁路機制）的匹配結果，深度解析兩者之間的評分差距（Gaps）與系統機制成因。

---

## 1. 匹配數據與決策比對總覽 (Comparison Matrix)

| 職位 Seek ID | 職稱 / 公司 | Gemini 3.5 基線分數 / 決策 | DeepSeek 實際分數 / 決策 | 分數與決策差距 (Gap) | 核心 Gap 原因分析 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **93131845** | Senior SE (Agentic)<br>Caruso | **65**<br>Needs Manual Review | **55.48**<br>`not_qualified` | **-9.52** / 降級 | **硬性技術缺口攔截**。由於 `AWS, Fargate, Lambda, Kinesis` 被 Universal Parser 標記為 Must-have 技術，候選人無此實務經驗而被標記 `not_met`，觸發 `hardGateFailed`。這屬於合理的技術缺口防線。 |
| **93211367** | Junior Frontend<br>Humankind | **93**<br>**Strong Fit** | **33.67**<br>`not_qualified` | **-59.33** / 嚴重低估 | **年資行業平移能力缺失**。JD 要求 `1-3 years’ front-end or web app experience`。候選人的商業年資均在富士康從事電機工程（5.5年），其軟體與 React 經歷是在奧克蘭大學碩士期間。AI 引擎無法將電機工程經驗彈性平移，判定該項為 `not_met`，因而否決。 |
| **93218441** | Software Engineer<br>Talent Army | **62**<br>Needs Manual Review | **34.07**<br>`not_qualified` | **-27.93** / 降級 | **商業開發經歷判定**。JD 必備條件為 `2-5 years' strong commercial experience with React/TS`。系統精準識別出候選人無「商業 (commercial)」軟體年資（僅為個人與學術專案），判定為 `not_met` 觸發一票否決。人工基線則對技能符合度較寬容。 |
| **93135927** | 2026 Graduate<br>Serato | **94**<br>**Strong Fit** | **72.08**<br>**moderate_match** | **-21.92** / 偏低 | **成功繞過合規篩選**。在履歷補上工作權字眼並在代碼端旁路非技術硬門檻後，評分由 42.67 回彈至 72.08，順利進入推薦區間。分數的微小差距來自於 C++ 缺失的正常扣分，以及實體模型對畢業生評分機制的權重收緊。 |
| **93129983** | AI Product Engineer<br>HI Tech | **53**<br>Weak Fit / Gap | **60.44**<br>**moderate_match** | **+7.44** / 寬鬆高估 | **複合技術棧拆解漏洞**。JD 要求 Java 與 Angular。系統在比對時因候選人有 TypeScript (Angular 對應) 與 Python (Java/Python 對應) 而判定為 `partial`，沒有被判為 `not_met`，從而躲過了 `hardGateFailed`。這相較於他完全沒有 Java 與 Angular 背景來說是過於寬鬆的。 |

---

## 2. 核心 Gap 機制深度分析

### Gap A: 「年資 (Years of Experience)」的硬性攔截與平移局限
*   **痛點**：Humankind 的 Junior-Intermediate 職缺在人工基線評估中為 **93分 (Strong Fit)**，因為人工能識別出候選人是優秀畢業生，且過往富士康電機工程的商業分析、細節調查能力可高度轉移至前端開發。但系統只跑出 **33.67分**。
*   **機制問題**：
    *   後端 `matchScoringService.js` 在識別「XX年軟體開發商業經驗」時，採用的是嚴格的句法與語義匹配。
    *   富士康電機工程經歷被分類為 `Engineering/Hardware`。
    *   系統因為候選人缺乏 1-3 年的「SaaS/前端」商業年資，將該條件判定為 `not_met`，進而觸發了 `hardGateFailed` 否決。
*   **優化建議**：針對 `Junior / Graduate` 等級的職缺，自動匹配引擎應在 `scoringSchemaService.js` 中進一步弱化「相關年資」的硬性一票否決判定。如果職缺本身接受畢業生（strong graduates considered），相關年資項目不應作為 `hardGateFailed` 的攔截點。

### Gap B: 複合技術要求 (Composite Requirements) 的拆解與判定模糊
*   **痛點**：對於 HI Tech 職位，人工評估給予了 **53分 (Weak Fit / Gap)**，因為候選人完全不懂該職缺的核心技術 Java 與 Angular。但系統卻跑出了 **60.44分 (moderate_match)** 的及格分數。
*   **機制問題**：
    *   JD 原文寫著 `TypeScript with Angular` 與 `Primarily Java, with some Python alongside it`。
    *   系統內建的複合技術要求拆分邏輯 (`splitCompositeRequirement`) 會將其拆分為 `TypeScript`, `Angular`, `Java`, `Python` 四個子標籤。
    *   候選人在 CV 中擁有 TypeScript 與 Python。
    *   語義匹配判定這兩個要求為 `partial`（部分契合），而不是 `not_met`（完全缺失）。
    *   因為只要有一個子標籤符合就不會被判為 `not_met`，這使得候選人避開了 `hardGateFailed`，得以取得合格分數。
*   **優化建議**：在 `matchScoringService.js` 的 `applyEvidenceStrengthPolicy` 中，針對核心後端語言（Java）或前端框架（Angular/React），如果關鍵的核心主技術（Java / Angular）在 CV 中完全不存在，應將該複合要求的狀態強化判定為 `not_met`，而非因為懂輔助語言（Python）就給予 `partial` 判定。

---

*比對依據：Gemini 3.5 基線報告 (docs/evaluation/gemini-3.5-flash-cv-jd-baseline.md) 與 DeepSeek 比對運行日誌 (scratch/ds-run-results.json)。*

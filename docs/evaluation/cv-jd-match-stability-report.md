# CV-JD 匹配穩定性與模型對比報告 (DeepSeek vs Gemini 3.5 Flash)

本報告針對 **Alan Ho** 的履歷與 5 份 Seek NZ 招募職位（JD），對比了 **Gemini 3.5 Flash**（基線人工評估）與 **DeepSeek**（系統當前程式碼實際運行）的解析與匹配結果，分析其評分差異與系統決策穩定性。

---

## 1. 匹配數據對比總覽 (Score & Decision Comparison)

| 職位 Seek ID / 職稱 | 招聘公司 | Gemini 3.5 預估得分 | Gemini 3.5 預估結論 | DeepSeek 實際得分 | DeepSeek 實際結論 | 關鍵差異原因分析 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **93131845**<br>Senior SE (Agentic) | Caruso | **65** | Needs Manual Review | **54.27** | **not_qualified** | **硬性門檻阻擋**。DeepSeek 標記「AWS/Kinesis」與「Agentic工具實作」為 `not_met`，觸發 `hardGateFailed`。 |
| **93211367**<br>Junior Frontend | Humankind | **93** | **Strong Fit** | **39.75** | **not_qualified** | **重大偏差**。因 CV 未明寫「紐西蘭工作權」，且將「1-3年網頁經驗」判定為 `not_met`（忽略了碩士與硬體資深經歷的平移），觸發否決。 |
| **93218441**<br>Software Engineer | Talent Army | **62** | Needs Manual Review | **27.27** | **not_qualified** | **硬性年資判定**。對比「2-5年商業React/TS經驗」時，因 CV 僅有學校/個人項目，被判定為 `not_met`。 |
| **93135927**<br>2026 Graduate | Serato | **94** | **Strong Fit** | **42.67** | **not_qualified** | **致命誤判**。候選人學歷 (GPA 7.75) 與 Agentic 項目完美契合，但因 CV 未提及「NZ工作權」被判為 `not_met`，導致全盤否決。 |
| **93129983**<br>AI Product Engineer | HI Tech | **53** | Weak Fit / Gap | **53.07** | **not_qualified** | **一致性高**。雙方均判定不合格。核心技術棧 Java 與 Angular 的缺失被準確識別。 |

---

## 2. 核心差異與系統行為分析

### 2.1 「紐西蘭工作權 (NZ Work Rights)」缺口判定
*   **現象**：在 Humankind、Serato 和 HI Tech 的匹配中，DeepSeek 將「Right to work in New Zealand」或相關工作簽證要求判定為 `not_met`。
*   **原因**：候選人 Alan Ho 的履歷中僅寫明「Auckland CBD」與「Master of IT, University of Auckland」，並無「NZ Citizen / Resident / Holder of open work visa」等明確字眼。
*   **系統機制**：
    *   後端匹配邏輯中，將工作權等篩選條件列為 **High Priority + Hard Requirement**（必備硬性條件）。
    *   語義匹配引擎（Semantic Matcher）在對比時，由於 CV 中缺乏字面對應，給予了 `not_met`（缺失證據）狀態。
    *   這直接觸發了 [scoringSchemaService.js](../../backend/src/services/scoringSchemaService.js) 的 `hardGateFailed` 否決權，將決定強制降級為 `not_qualified`。

### 2.2 電機/硬體工程經驗與軟體開發經歷的平移
*   **現象**：針對 Junior-Intermediate 職位 (Humankind, 預期分數 93)，系統跑出 39.75 的極低分。
*   **原因**：
    *   該 JD 要求「1–3 years’ front-end or web app experience」。
    *   候選人在富士康有 5.5 年的電機/硬體工程（Senior/Junior Electrical Engineer）商業經驗，而 React/TypeScript/SaaS 的實踐均在奧克蘭大學碩士項目（2025年至今）中。
    *   DeepSeek 判定其「網頁商業開發經驗」為 0，因此該硬性指標被判為 `not_met`，直接觸發 `hardGateFailed`。
    *   基線評估（Gemini 3.5）則採用更具彈性的「Grad / Junior」平移解讀，認為電機工程的細節專注與數據調查經驗能良好平移。

### 2.3 職責句子的 Rubric 過度硬化 (Over-hardened Rubrics)
*   **現象**：在 Caruso 專案中，`Own meaningful domains in small teams...` 這類描述團隊工作模式的句子被 Universal Parser 誤判定為 **Must-have Candidate Requirement (hard)**。
*   **原因**：系統的 parser 判定機制在區分「候選人硬性技術要求」與「招聘環境描述」時存在模糊，導致非技術要求的團隊氛圍句變成了硬性門檻，進而因為 CV 沒寫「在小團隊主導領域」而判定 `not_met`。

---

## 3. 穩定性優化建議 (Stabilization & Optimization Advice)

為了防止高匹配度候選人（如 Serato Graduate 職位的完美契合者）因非技術細節或字面缺失被一票否決，建議進行以下程式碼與 Prompt 優化：

1.  **弱化工作權等非技術硬性門檻在自動匹配中的比重**：
    *   工作權 (NZ work rights) 與工作地點 (Auckland-based) 屬於合規篩選，建議在 Parser 中將其分類為 `availability_or_location`，在匹配決策中，這類屬性應作為「待面試驗證項目 (inferred / Needs validation)」，而非直接將其判定為 `not_met` 並一票否決。
2.  **細化 `hardGateFailed` 的門檻觸發條件**：
    *   不應因為單一項目 `not_met` 就將決策直接拉至 `not_qualified`。可以引入權重機制，或僅對「核心技術技能 (Technical Skill / Tool)」實施硬性否決。
3.  **優化 JD Rubric 提取 prompt (Universal Parser)**：
    *   進一步收緊 [jdUniversalParserService.js](../../backend/src/services/jobDescription/jdUniversalParserService.js) 的規則，確保招聘公司背景、小組環境描述（如 own meaningful domains）不被歸類為「Must-have candidate requirement」，避免產生多餘的硬性攔截點。

---

*數據來源：本報告對比數據基於 `/Users/heminghan/Kiwi-AI-interview-Agent/scratch/ds-run-results.json` 實際跑批結果與 `docs/evaluation/gemini-3.5-flash-cv-jd-baseline.md` 人工評估基準。*

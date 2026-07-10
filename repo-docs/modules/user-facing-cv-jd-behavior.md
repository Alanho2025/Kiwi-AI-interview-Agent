# 用戶層 JD 解析與 CV-JD 匹配指南

本指南詳細說明在 Kiwi AI Interview Agent 中，用戶在前端介面所能看到、編輯與確認的 Job Description (JD) 解析欄位，以及在進行履歷與崗位匹配 (CV-JD Match) 時，系統實際對比了哪些維度，以及呈現給用戶哪些匹配資訊。

---

## 1. JD 解析（用戶層）

當用戶粘貼 JD 內容或輸入 JD URL，並提供 **Company website URL** 或 **Manual company context**（至少提供一項）後，點擊「Summarise JD」，系統會調用後端解析服務產出結構化的職位特徵與 Rubric。

### 1.1 解析提取的欄位
解析結果會映射至以下結構化欄位，並直接呈現在用戶介面上：

*   **職位基本信息 (Job Overview)**:
    *   **Role title (職位名稱)**: 如 Software Engineer, Operations Coordinator 等。
    *   **Company (公司名稱)**: 招聘企業的名稱。
    *   **Location (工作地點)**: 如 Auckland, Remote 等。
    *   **Employment type (雇佣類型)**: 如 Full-time, Contract 等。
*   **關鍵清單 (Lists)**:
    *   **Responsibilities (職責列表)**: 崗位的主要日常工作內容。
    *   **Must-have requirements (必備要求)**: 職位硬性指標與必備條件（如特定年資、特定開發語言）。
    *   **Nice-to-have requirements (加分要求)**: 非強制但優先考慮的加分項。
    *   **Qualifications (資歷與證照)**: 學歷、專業證照或行業註冊資格。
    *   **Soft skills (軟實力)**: 溝通能力、團隊協作、學習敏銳度等特質。
    *   **Benefits (福利待遇)**: 薪資區間、彈性工作、醫療保險等福利。
*   **技術技能群組 (Technical Skills by Groups)**:
    *   按技術族群分類提取的具體技能標籤，包括但不限於：`softwareDevelopment`、`data`、`aiMl`、`itInfrastructure` 等群組。
*   **企業與意圖理解 (Role Fit Profile)**:
    *   **Company understanding (公司理解)**: 基於用戶提供的主動上下文或網站 URL，生成的公司背景、價值觀及業務理解概要。
    *   **Role intent priorities (職位意圖優先級)**: 提煉出最關鍵的崗位意圖語句列表，並標註優先級（High / Medium / Low），用於匹配度的主要計分軸線。
*   **申請注意事項 (Application notes)**:
    *   投遞截止時間、申請特殊管道或材料要求。

### 1.2 用戶在 JD 審查介面看到的資訊與鎖定機制
解析完成後，用戶在 [Analyze Page](../../frontend/src/pages/AnalyzePage.jsx) 上會看到以下內容：

1.  **Analysis Status Block (分析狀態欄)**:
    *   顯示當前 AI 解析的置信度評分（AI confidence %）與審查門檻（Gate %）。
    *   若置信度低於設定的閾值，或者解析結果有缺失，會出現警告標示，提示「Human review required before matching」（需要人工審核）。
2.  **Editable JD Review Panel (可編輯審查面板)**:
    *   上述所有解析出來的欄位（如職位名稱、必備要求、技術群組、公司理解等）皆以輸入框、文字域或可換行列表（One item per line）形式展現。
    *   用戶可以直接對 AI 的解析進行微調、增刪或糾錯。
3.  **確認鎖定 (Mark JD as Reviewed)**:
    *   用戶必須點擊「Mark JD as reviewed」（標記 JD 為已審查）按鈕，將解析與編輯後的結果正式確認為「Verified」狀態，系統才會解鎖下一步的「CV-JD Match」匹配與訪談規劃。

---

## 2. CV-JD 匹配對比（用戶層）

當用戶確認了 JD Rubric 且履歷（CV）結構化解析也處於 Verified 狀態後，點擊「Generate match analysis」，系統會執行比對。

### 2.1 匹配時對比了什麼？
匹配引擎在後端對比了 Reviewed CV Profile (`cv_evidence_profile_v2`) 與 Reviewed JD Rubric，具體比對維度包括：

1.  **Macro Fit (宏觀匹配)**:
    *   對比候選人的整體背景、行業經驗年限、過往職位上下文與目標崗位職責的契合度。
2.  **Micro Fit (微觀匹配)**:
    *   對比 JD 中列出的技術技能（Technical Skills）與軟實力（Soft Skills）在 CV 中是否有對應的證據鏈支持。
3.  **Requirement Checks (要求核對)**:
    *   對比 JD 中的必備要求（Must-have）與加分要求，並為每一項核對生成匹配狀態：
        *   `met` (Matched / 已匹配): CV 中有明確的履歷證據。
        *   `partial` (Partly matched / 部分匹配): 有相關履歷描述但證據不夠充分。
        *   `inferred` (Needs validation / 需驗證): 依據鄰近或 transferable 經驗推導出可能具備，需在面試中驗證。
        *   `not_met` (Missing evidence / 缺失證據): CV 中完全未提及相關要求。
4.  **Role Evidence Map (角色證據地圖)**:
    *   針對提煉出的每一條 **Role intent (職位意圖)**，計算加權匹配得分（Weighted Score）。權重維度包括：
        *   **語義相關性 (Semantic Relevance - 25%)**: 履歷內容與意圖的語義相似度。
        *   **JD 要求匹配度 (JD Requirement Match - 20%)**: 與 Rubric 中 requirement check 狀態的映射關係。
        *   **職位意圖吻合度 (Role Intent Match - 20%)**: 與關鍵意圖優先級的對齊度。
        *   **具體度 (Specificity - 15%)**: 履歷描述是否包含數字、百分比、具體工具等可衡量資訊。
        *   **個人主導權 (Personal Ownership - 10%)**: 是否是個人獨立負責或主導。
        *   **產出結果證據 (Outcome Evidence - 10%)**: 是否有明確的業務產出或成就。
    *   根據得分高低與是否有 Traceable 履歷證據，將匹配度分為四個等級：
        *   `direct` (直接證據): 得分高且有強履歷文字與來源索引。
        *   `adjacent` (鄰近證據): 具備可轉移技能，但缺乏直接的結果或角色級別證明。
        *   `weak` (弱證據): 語義相關但個人主導權或結果證據極其有限。
        *   `gap` (證據缺失): 無明確履歷來源支持該意圖。

### 2.2 用戶在匹配結果介面看到的資訊
匹配結束後，用戶在 [AnalysisStatusCard](../../frontend/src/components/analyze/AnalysisStatusCard.jsx) 介面上會看到以下豐富的可視化分析報告：

*   **Match Summary Banner (匹配概要橫幅)**:
    *   顯示匹配結論級別（如「Strong Fit / 完美契合」、「Good Fit / 良好」、「Manual Review / 需手動複核」）。
    *   **Match score (匹配得分)**: 整體契合度分數（0-100）。
    *   **Evidence confidence (證據置信度)**: 支持該得分的履歷證據置信度。
    *   **文字總結 (Summary)**: 簡明說明最強的匹配信號與最需要驗證的潛在風險。
*   **三個維度得分卡 (Score Cards)**:
    *   **Macro Fit (宏觀契合度)**、**Micro Fit (微觀契合度)**、**Requirements (要求覆蓋度)** 的各自百分制得分與白話文解讀。
*   **訪談策略面板 (Proof Strategy)**:
    *   顯示 KiwiCoach 針對該候選人自動規劃的 Focus Area（重點關注區）及 Gap Area（需要彌補的空白），以及計劃提問的題目數量。
*   **匹配與改善清單 (Matched & Improvement Evidence)**:
    *   **What matched well (匹配良好項)**: 履歷中支持度最高的 Top 3 直接證據項目。
    *   **What to validate or improve (需驗證或改善項)**: 匹配度低或有潛在風險的 Top 3 要求項目。
*   **Evidence Strength Diagnostics (證據強度診斷)**:
    *   統計 Strong / Partial / Weak / Missing 語義匹配的總數。
    *   顯示具體的核心要求與履歷原文段落的對比，標明語義相似度百分比。
*   **Role Evidence Map (角色證據地圖卡片)**:
    *   分門別類展示 Direct、Adjacent、Weak 和 Gap 的所有職位意圖。
    *   用戶可展開查看每一項意圖背後的 **履歷證據原文 (Evidence)**、**來源履歷小節 (CV section)** 以及 **限制性解釋 (Limitation)**（例如：「具備相關證據，但未明確指出直接的產出或 scope」）。
*   **Priority Requirement Checks (優先要求核對清單)**:
    *   按風險等級由高到低（最嚴重的缺失或部分匹配排最前）排序的完整 Rubric 要求核對列表。
    *   每項核對包含：JD 原文要求、要求類別與重要性、匹配狀態標籤（Matched / Partly matched / Needs validation / Missing evidence）、匹配理由 (Reason)、匹配到的履歷證據、缺失證據原因 (Missing evidence) 以及 **KiwiCoach 推薦的追問問題 (Interview probe)**。

---

## 3. 追溯源碼與驗證

*   **JD 解析與 Role Fit 生成**:
    *   [jdUniversalParserService.js](../../backend/src/services/jobDescription/jdUniversalParserService.js)
    *   [roleFitProfileBuilder.js](../../backend/src/services/jobDescription/roleFitProfileBuilder.js)
    *   [jobDescriptionRubricBuilder.js](../../backend/src/services/jobDescription/jobDescriptionRubricBuilder.js)
*   **CV-JD 匹配比對邏輯**:
    *   [matchService.js](../../backend/src/services/matchService.js)
    *   [roleEvidenceMapService.js](../../backend/src/services/match/roleEvidenceMapService.js)
*   **前端視圖與數據處理**:
    *   [matchResultViewModel.js](../../frontend/src/utils/matchResultViewModel.js)
    *   [AnalysisStatusCard.jsx](../../frontend/src/components/analyze/AnalysisStatusCard.jsx)
    *   [JobContextCard.jsx](../../frontend/src/components/analyze/JobContextCard.jsx)

證據狀態：本頁基於 2026-07-10 項目源碼已完全確認。

# 開源 AI 面試練習專案之候選人進度與成長追蹤機制調研

> **學術文獻綜述**：完整的 HCI 與教育評估學術論文調研詳見 [role-fit-interview-coaching-literature-review.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/references/role-fit-interview-coaching-literature-review.md)。

本文件調查並分析了當前開源社群中（如 GitHub 上的熱門專案）如何設計與實作 AI 面試練習（AI Mock Interview）中的「候選人進度與成長追蹤機制」，為 Kiwi AI Interview Agent 的多期練習成長看板提供設計參考與技術文獻。


---

## 1. 核心開源專案調研 (Open Source Project Analysis)

經調研，多個主流的開源 AI 面試平台已逐漸從「單次面試報告」轉向「長期成長與能力演進看板」。以下為代表性專案的具體作法：

### 專案 A：[TakeInt-AI-Interview-Platform](https://github.com/yuvaraj2selvam/takeint-ai-interview-platform)
*   **定位與特色**：基於 React 和 AI 技術的整合式面試平台，主打**技能與學科維度的精細化追蹤**。
*   **成長追蹤機制**：
    1.  **技能雷達圖 (Skill Radar Chart)**：將面試評估出的多個技能維度（如程式邏輯、系統設計、溝通能力、問題解決能力）繪製成雷達圖，展示候選人的強弱項。
    2.  **主題熱力圖 (Topic Heat-map)**：根據不同學術與技術主題（例如：Database, React, Data Structures）的答題正確率，呈現如 GitHub Contributions 般的熱力圖，指出練習覆蓋度。
    3.  **時間軸趨勢 (Progress Over Time)**：記錄每次練習的得分，以折線圖呈現，幫助候選人視覺化自己的成長軌跡。

### 專案 B：[AI-Mock-Interview-Platform](https://github.com/Ak-Rajak/AI-Mock-Interview-Platform)
*   **定位與特色**：基於 Next.js/React、Tailwind CSS 及 Google Gemini API 的智能面試平台，強調快速反饋。
*   **成長追蹤機制**：
    1.  **分值趨勢面板 (Performance Rating Dash)**：為每次面試提供 1-10 分的綜合評級，並將分數與時間點關聯，形成簡明的數字化歷史曲線。
    2.  **答題存檔比對 (Answer Archiving & Comparison)**：儲存候選人在不同 session 中回答相同或相似問題的答案，允許候選人比對「過去的回答」與「現在的回答」，從而直觀看見自己在表達深度、專業詞彙使用上的提升。

### 專案 C：[AI-Interview-App](https://github.com/whd793/AI-Interview-App)
*   **定位與特色**：全端 AI 面試與評估系統，提供多種職位模板。
*   **成長追蹤機制**：
    1.  **崗位匹配度演進 (Role-based Progress Charts)**：如果候選人重複練習同一崗位（如 Frontend Engineer），系統會追蹤其與該崗位 Rubric（評鑑標準）的契合度曲線。
    2.  **趨勢化 AI 建議 (Aggregated AI Recommendations)**：不只針對單次面試給予建議，而是背後有一個聚合器（Aggregator）分析最近 3-5 次的面試弱項，提煉出「本週最需要提升的 3 個核心能力」，避免候選人被單次失誤干擾。

### 專案 D：[Mock-interview-ai-based](https://github.com/adii1576/Mock-interview-ai-based)
*   **定位與特色**：主打語音/語音串流面試的 AI 系統。
*   **成長追蹤機制**：
    1.  **表達特徵追蹤 (Speech & Delivery Metrics Tracking)**：記錄語音面試中的「非技術指標」，包括：**贅字率 (Filler Words like "um", "uh" Count)**、**語速波動 (Speaking Pace)**、**沉默與停頓時間 (Silence Duration)**。
    2.  **非技術 stakeholder 的友好呈現**：對於非技術背景候選人，該系統將這些語音指標以簡單的「流暢度級別（Fluency Level: Good/Needs Practice）」與「緊張度趨勢」折線圖呈現，比單純的技術分數更容易理解與改進。

---

## 2. 業界與開源共識：非技術利害關係人（Non-Tech Stakeholders）的 UX 設計原則

對於非技術背景的候選人，過於冰冷的技術分數或代碼分析會帶來挫折感，因此在設計進度看板時應遵循以下原則：

1.  **結果導向而非單純的活躍度**：
    *   避免僅顯示「練習了多少次」、「答了多少題」（這些是虛榮指標，Vanity Metrics）。
    *   優先顯示「能力就緒度 (Interview Readiness)」、「表達結構改善」等實質成果。
2.  **分層級的資訊架構 (Layered Information Architecture)**：
    *   **第一層：直觀的 KPI 卡片**（如：綜合就緒度、平均進步幅度、最近練習亮點）。
    *   **第二層：趨勢可視化**（如：折線圖、疊加條形圖，展示最近 5 次的進步）。
    *   **第三層：可操作的具體建議 (Actionable Coaching)**（如：「你的 STAR 法則結構有顯著提升，下一步請多加強『Action（行動）』的具體描述」）。
3.  **多維度的軟實力與硬實力平衡**：
    *   包含溝通技巧、結構完整度、回答時的證據強度（Evidence Strength）。

---

## 3. Kiwi AI Interview Agent 的設計啟示

Kiwi AI Interview Agent 本身具備非常豐富的結構化評估數據（儲存於 `SessionReport` 和 `SessionAnalysis` 中），包括了 `evidenceDiagnostics`（證據類型與強度）、`roleFit`（意圖覆蓋率）以及 `scores`（整體、Macro、Micro 得分）。

我們完全可以基於現有的數據架構，無縫設計出一套**不需要大改後端 Schema，但前端能為候選人帶來極大視覺震撼與實用價值的「成長追蹤看板」**。具體實作計畫將於 `docs/further_plan/candidate-progress-tracking-plan.md` 中詳細規劃。

### 💡 Candidate Progress Dashboard: Problem Definition & 3 Potential Solutions Comparison (Issue #142)

依據 Owner (@Alanho2025) 的最新審查意見以及最新學術調研（HCI / Formative Feedback / RAG Groundedness），我們對「如何解決候選人看不到 Progress」進行了深度問題拆解，並整理出 **3 種潛在解決方案及其優缺點比較**：

---

#### 🎯 1. 現在要解決的核心問題是什麼？ (Problem Definition)

**核心問題**：求職者（Candidate / Student）在完成多次模擬面試後，主頁目前僅有單場 `Avg. Score` 列表，**缺乏一個既能直觀反映能力成長、又具備可信度與自主校準權的「個人成長看板 (Candidate Personal Progress Dashboard)」**。

##### 具體痛點與挑戰：
1. **單場孤島 (Session Isolation)**：求職者無法得知「我的回答是否越來越有實證支持？」以及「我的專案故事庫（Story Bank）積攢了哪些能力？」。
2. **偽精準宣稱風險 (Pseudo-Precision Risk)**：若直接展示 `Offer Ready 85%` 或 `NZ Culture Fit 92%` 等數值，會把未經充分校準的 AI 猜測（Inference）當成「既成事實」，反而誤導求職者。
3. **缺乏風險分級人機控制 (Lack of Risk-Based HITL)**：若 AI 對故事品質、能力映射與下一步建議的判定完全不給求職者「確認/更正/拒絕」的控制權，求職者會感到被 AI 標籤化或被剝奪主體性（User Agency）。

---

#### 💡 2. 三種潛在解決方案與優缺點分析 (Three Potential Solutions)

##### 方案一：純客觀事實描述型看板 (Purely Descriptive Analytics Dashboard)
* **概念**：100% 僅展示確定性的客觀數據（Session 次數、日期、經採納的回合數、相同 Schema 版本的得分折線圖、已覆蓋技能與 Evidence IDs）。**完全不顯示 AI 對故事強弱、準備度百分比或下一步行動的解讀與推測**。
* **優點**：100% 真實可追溯、零幻覺；實作最簡單、效能最高（API 回應 $<20\text{ms}$，0 成本）。
* **缺點**：缺少教練指引價值（對焦慮求職者缺乏解答）；體驗較冷冰冰。

---

##### 方案二：分級風險人機校準看板 (Risk-Based HITL Interactive Growth Dashboard) —— 【🏆 推薦方案】
* **概念**：採 **Risk-Based Human Control（風險分級人機控制）** 原則：
  1. **自動呈現客觀事實**：Session 歷程、相同 Scoring Version 趨勢、已覆蓋技能與 Evidence IDs 自動展示。
  2. **AI 解讀預設為「推測 (Hypothesis)」**：AI 生成故事標籤（如 *E-Commerce Chatbot ➔ 實證強*）、準備度涵蓋率 (`Role Preparation Coverage: 78%`) 與下一步建議。
  3. **強制提供候選人 4 大控制按鈕**：`[確認 Confirm]`、`[更正/補充 Correct]`、`[拒絕/標記 AI 誤解 Reject]`、`[選擇其他練習重點 Choose another focus]`。
* **優點**：兼顧教練指引價值與數據真實性；建立求職者信任閉環；完全符合 *Hwang et al. (2024)* 與 *Shute (2008)* 對於 User Agency 與 Formative Feedback 的要求。
* **缺點**：前後端互動邏輯較複雜，需儲存 `candidate_decision` 審計軌跡。

---

##### 方案三：全自動生成式 AI 整合教練看板 (Fully Automated Generative AI Coach Dashboard)
* **概念**：每次載入時，將歷次 Session 報告丟給 LLM 進行全自動 Summary，產出黑盒式的 `Overall Readiness 85%` 分數與全自動生成的評語文案，**不提供候選人手動更正與確認介面**。
* **優點**：文案極具渲染力與對話感；前端 UI 渲染直觀。
* **缺點**：偽精準與幻覺風險極高（易給求職者虛假安全感）；剝奪求職者主體性；頁面加載慢（$2\sim 5\text{s}$）且產生 API Token 成本。

---

#### 📊 3. 三種方案綜合比較表

| 評估維度 | 方案一：純客觀事實描述型 | 方案二：分級風險人機校準 (推薦) | 方案三：全自動生成式 AI |
| :--- | :--- | :--- | :--- |
| **求職者價值與指引感** | 低 (僅圖表無解讀) | 🟢 **高 (有故事庫與具體建議)** | 中 (文案流暢但可能空泛) |
| **真實性與抗幻覺能力** | 🟢 **極高 (100% 確定性)** | 🟢 **高 (有 Candidate HITL 校準)** | 🔴 低 (黑盒偽精準宣稱) |
| **求職者主體性 (User Agency)**| 中 (唯讀數據) | 🟢 **極高 (可確認/更正/拒絕)** | 🔴 低 (無權更改 AI 評斷) |
| **開發與維護複雜度** | 🟢 **低** | 中 (需要互動與 Audit Trail) | 高 (LLM 輸出格式與 Prompt 調校) |
| **頁面載入延遲與成本** | 🟢 **$<20\text{ms}$，0 成本** | 🟢 **$<50\text{ms}$，0 成本** | 🔴 $2\sim 5\text{s}$，有 Token 成本 |

---

#### 🏆 結論與建議

**推薦採用「方案二：分級風險人機校準看板 (Risk-Based HITL Interactive Growth Dashboard)」**。

這個方案精準採納了最新學術調研與 Owner 的審查意見：**「Descriptive 數據自動展示，Inference 數據賦予 Candidate Confirm/Correct/Reject 的控制權」**。既不犧牲教練產品的溫度，又維護了資料庫與評估系統的嚴謹真實！

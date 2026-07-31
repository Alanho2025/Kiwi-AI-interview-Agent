### 🔬 Literature-Grounded Scope & Metric Defense (Based on HCI & Educational Research)

Hi team / GPT,

依據最新完成的 **學術與 HCI 文獻調研綜述**（詳見 [role-fit-interview-coaching-literature-review.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/references/role-fit-interview-coaching-literature-review.md)），針對 Owner 與 GPT 對於 **Issue #142 (Progress Analytics)** 的幾項核心疑慮，我們提供以下基於實證研究（Empirical Research）的理論依據與架構對齊說明：

---

#### 1. 為什麼追蹤「實證質地演變 (% Shift to Direct Past Evidence)」勝過統計「練習次數/分數」？

* **學術論文依據**：*Bodily & Verbert (2017), IEEE Transactions on Learning Technologies*
* **論文發現**：在學生導向的學習看板（Student-Facing Learning Dashboards）中，單純顯示「練習總次數」或「總時數」等虛榮指標（Vanity Metrics）**無法帶來持續的行為改變**；反而展示 **「證據質地轉化（Evidence Quality Shift）」**（例如：回答中「假設性空話 (Hypothetical Filler)」比例隨練習次數下降、「具體真實成效 (Direct Past Experience)」上升）能最有效提升學習者的自我效能（Self-Efficacy）與重複練習意願。
* **架構回應**：這正是我們在 Issue #142 中將 **Evidence Evolution** 作為 Candidate Dashboard 核心圖表的原因——直接向候選人展示他們「說話越來越有實證根據」。

---

#### 2. 為什麼聚焦於「問題意圖對題度 (Answer Alignment)」而非音調、表情或字數？

* **學術論文依據**：*Suen et al. (2019), Computers in Human Behavior*；*Naim et al. (2018), IEEE Transactions on Affective Computing*
* **論文發現**：傳統非同步影片面試（AVI）工具過度依賴表情、眼神與音調分數，已被證明會對國際留學生與非母語者造成嚴重的**演算法偏見（Algorithmic Bias）**。相反地，**評估「回答是否對題（Content Relevance）」與「STAR 結構實證完整度」** 具備最高的求職表現預測效力。
* **架構回應**：Kiwi Coach 絕不評分表情音調，也**不把英文猶豫或澄清誤判為扣分項目**。Analytics 數據完全建立在經採納的回合對題度與實證層面。

---

#### 3. 為什麼堅持「0 即時餵答案」與「Strict Transcript Grounding」？

* **學術論文依據**：*Hwang et al. (2024), arXiv:2411.13032*；*Shute (2008), Review of Educational Research*
* **論文發現**：
  1. *Hwang et al.* 證實：當 AI 過度幫用戶生成或改寫文字時，用戶會產生強烈的「疏離感（Alienation）」並喪失的主體性。
  2. *Shute* 證實：形成的學習反饋必須 100% 建立在可觀察的事實上。無中生有的讚美或批評會直接摧毀用戶對系統的信任。
* **架構回應**：
  - 我們在 Issue #142 中明確規範 **Dashboard 加載過程 0 LLM 呼叫**，所有分數與趨勢皆由 Deterministic 算子從 Transcript Evidence 算出。
  - 當欄位缺失時，**回傳 `status: "unavailable"` 而非默認 0 分**，確保所有向候選人展示的診斷絕不捏造事實。

---

#### 4. 產品定位防護：個人成長 vs. 機構 B2B 驗證

* **學術與合規共識**：個人學習數據與機構 Cohort 數據必須嚴格物理隔離。
* **架構對齊**：Issue #142 100% 聚焦於 **Candidate-Owned Personal Progress**（隱私隔離 `user_id` 視角）。機構買家所需的匿名化 Cohort 數據與 RBAC 將於獨立 Issue 處理，絕不拿個人 API 數據呼悠 B2B 驗證。

---

以上學術文獻依據與修訂後的 Issue #142 規範完全對齊！若團隊無其他疑慮，我們將依照 Phase A -> Phase B 實作藍圖開始動工！

### 🤝 Human-in-the-Loop (HITL) 信任鏈與校準架構補充 (Issue #142)

感謝提示！在討論數據聚合與 Dashboard 視覺化時，必須明確說明 **Kiwi Coach 貫穿全系統的 Human-in-the-Loop (HITL) 信任鏈機制**。

Kiwi Coach 絕非一個「將一切完全交給 LLM 黑盒自動決策」的系統。從 CV/JD 解析、語音交互到報告生成與數據看板，**候選人（Human-in-the-Loop）始終掌握最高控制權與校準權**。

以下補充 Issue #142 中對接 HITL 信任鏈的 4 大關鍵設計：

---

#### 1. 📋 履歷與 JD 解析層的 HITL (Intake Human Review)
* **架構現狀**：[roleIntentDecoderService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/jobDescription/roleIntentDecoderService.js) 生成的對題假說標示為 `reviewConfidence: 'unreviewed'` 與 `claimStatus: 'needs_confirmation'`。
* **Dashboard 對接**：Progress Analytics 在統計 `Verified Story Bank` 時，**僅對接已經過候選人確認 (Candidate Reviewed) 或在模擬面試中驗證過的實證**，絕不將模型未經人核對的推測硬當作「已掌握技能」。

---

#### 2. 🎙️ 語音對話與逐字稿校正的 HITL (Voice Transcript HITL)
* **架構現狀**：參照 [voice-transcript-review-confirmation-spec.md](file:///Users/heminghan/Kiwi-AI-interview-Agent/docs/further_plan/voice-transcript-review-confirmation-spec.md) 與 [questionScopeClarificationService.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/src/services/voice/questionScopeClarificationService.js)。
* **HITL 邊界**：
  - 當 STT 語音辨識對關鍵領域詞（如 PMS, EMR, Vitest, Playwright）信心度不足，或面試官提問語意模糊時，系統觸發 **高價值確認彈窗 (High-Value Confirmation)** 或 **範疇澄清 (Clarification)**。
  - **候選人作為 Human-in-the-Loop 主動確認語意後，系統才進行持久化與評分**，確保進入 Analytics 的每一筆答題質地都是真實且經求職者認可的。

---

#### 3. ⚖️ 報告評分與校準門禁的 HITL (Human Calibration Gate)
* **架構現狀**：參照 [humanCalibrationEvaluator.js](file:///Users/heminghan/Kiwi-AI-interview-Agent/backend/eval/helpers/humanCalibrationEvaluator.js)。
* **核心原則**：*“No numerical release threshold is valid until every sampled case has an auditable human review and rationale.”*
* **Dashboard 對接**：分析算子在計算 `nzWorkplaceFit` 或 `scores` 趨勢時，必須檢查 `latestStatus` 屬於可信狀態（`ready` 或 `ready_after_repair`）。未通過 QA 或待修復的報告標示為 `status: "unavailable"`，防止將錯誤的評分呈現給候選人。

---

#### 4. 🎯 Dashboard 中的 HITL 主動權 (Candidate-Driven Action)
* **求職者主導權**：Dashboard 不僅僅是數據展示，而是 **Human-Driven Coaching**。
* 候選人可以：
  - 自由點擊「一鍵補強最弱故事」觸發對應練習。
  - 在真實面試後主動填寫 **Real-Interview Reflection Form**，校準系統對其能力圖譜的估算（Practice ➔ Real Interview ➔ Human Reflection ➔ Next Practice Loop）。

---

上述 HITL 信任鏈已完全納入 Issue #142 的架構規範中！

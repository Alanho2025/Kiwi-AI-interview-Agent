### 🎯 Candidate-Centric Redesign: 求職者視野下的「面試準備度與成長看板」 (Issue #142 UX 重構)

非常感謝提醒！先前討論過度偏向「技術數據與後端指標算子」，忽略了**登入這個系統的核心使用者是「正在求職、感到焦慮的候選人/畢業生」**。

求職者登入 Dashboard 時，**根本不想看複雜的統計學名詞、分母算式或冷冰冰的數據庫欄位**。他們真正關心、想從 Dashboard 得到的只有 4 件事：

1. **「我對目標職缺準備好了沒？」(Am I ready for my real interview?)**
2. **「我的哪些經歷故事講得很好？哪些還不夠有說服力？」(My Verified Story Bank)**
3. **「我聽起來像不像真正在地做過專案的工程師？」(Real Experience vs. Vague Theories)**
4. **「我現在最該練習什麼才能拿到 Offer？」(Recommended 15-Min Next Focus)**

---

### 🎨 候選人視覺與模組重新設計 (Candidate-Facing Dashboard Architecture)

#### 1. 👑 面試準備度卡片 (Target Role Readiness Header)
* **求職者看到的內容**：
  - 目標職位卡片（例如：`Junior AI/Software Engineer`）。
  - **面試準備度狀態**：如 🟢 **`Interview Ready (82%)`** 或 🟡 **`Nearly Ready (需補強 1 個團隊協作故事)`**。
  - **核心雙指標**：
    - 🛠️ **技術硬實力實證**：已驗證 4/5 個核心技能（React、Node.js、SQL 專案具體成效已備妥）。
    - 💬 **溝通與文化勝任力**：聽起來自信且自然，無講大話或太簡短問題。

#### 2. 📚 實證故事庫 (Candidate Verified Story Bank)
求職者不需要看複雜的矩陣，他們需要知道自己的「專案故事」有沒有過關：
* ⭐️ **已驗證強效故事 (Ready to Tell)**：
  - *「E-Commerce AI Chatbot 專案」* ➔ 成功證明了 API 自動化與系統設計能力。
  - *「紐西蘭診所 PMS 數據移轉」* ➔ 成功證明了處理真實髒資料與 Stakeholder 溝通。
* ⚠️ **需補強的故事漏洞 (Story Gaps to Fix)**：
  - *「團隊衝突處理故事」* ➔ 在過去練習中只給出了「假設性回答 (Hypothetical)」，缺乏真實 Action。

#### 3. 💬 紐西蘭職場表達風格 (NZ Workplace Communication Fit)
針對留學生與國際畢業生的特別教練回饋：
* 🟢 **真實經驗音量 (Authenticity Meter)**：85% 的回答都有具體專案成效支撐，不再只是背誦教科書理論。
* 🟢 **紐西蘭溝通適應度**：
  - **謙遜與自信平衡 (No Tall Poppy)**：成功用「數據與團隊貢獻」代替傲慢自誇。
  - **海外經驗在地轉譯**：海外實習經驗已成功轉譯為紐西蘭雇主聽得懂的商業情境。

#### 4. 🚀 一鍵練習推薦 (1-Click Actionable Next Practice)
不讓求職者迷茫思考要練什麼，直接給予最精準的快捷按鈕：
* 👉 **「耗時 10 分鐘：針對【團隊衝突處理】補強 1 個真實故事」** `[立即開始練習]`

---

### 🛠️ 後端 API 資料契約簡化 (`GET /api/session/progress-analytics`)

後端 API Response 必須完全服務於上述求職者 UI，結構修訂為：

```json
{
  "status": "success",
  "data": {
    "readiness": {
      "targetRole": "Junior Software Engineer",
      "statusBand": "Nearly Ready",
      "overallReadinessScore": 78,
      "verifiedSkillsCount": 4,
      "totalRequiredSkills": 5
    },
    "storyBank": [
      { "storyTitle": "E-Commerce Chatbot Project", "status": "verified_strong", "provenCompetency": "API Architecture & System Design" },
      { "storyTitle": "Team Conflict Scenario", "status": "needs_practice", "provenCompetency": "Stakeholder Management (Only Hypothetical)" }
    ],
    "communicationProfile": {
      "realExperienceRatio": 85,
      "nzWorkplaceFitScore": 82,
      "communicationTip": "你的專案成效數據很亮眼，建議描述團隊合作時多提到『We built』與同事協作過程。"
    },
    "recommendedNextAction": {
      "focusTopic": "Team Conflict Resolution",
      "estimatedMinutes": 10,
      "actionText": "針對【團隊衝突處理】補強 1 個真實故事"
    }
  }
}
```

---

這才是求職者真正想看到、能給予信心並指引行動的 Dashboard！請審閱這個重構方向！

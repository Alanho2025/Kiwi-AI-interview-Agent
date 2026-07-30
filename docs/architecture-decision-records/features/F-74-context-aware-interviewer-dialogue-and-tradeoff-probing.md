# Feature RFC: F-74 Context-Aware Interviewer Dialogue, Organic Trade-Off Probing & NZ Ownership Culture

> **文件狀態**：Approved & Implemented  
> **系統成熟度 (Readiness Level)**：Production-Ready  
> **核心模組路徑**：`backend/src/services/agents/interviewerAgentQuestionBuilder.js`, `backend/src/services/aiControl/actionPlanner.js`, `backend/src/services/questions/interviewTurnOrchestratorService.js`, `backend/src/services/agents/interviewerAgent.js`  
> **Git 演進 Commit 追蹤**：Commit `F-74`  
> **主要負責人 / 日期**：Kiwi AI Team / 2026-07-30  

---

## 1. 動機與白話導讀 (Motivation & Layman Analogy)

> 💡 **小白導讀**：
> 在紐西蘭與國際大廠（如 Xero, Atlassian, Canva）的真實工程師面試中：
> 1. **團隊謙虛文化 (NZ Teamwork Culture)**：候選人說 *"We built a recommendation system..."* 時，面試官不會冰冷地質問 *"What did YOU do?"*，而是會先肯定團隊成果再自然引出個人責任：*"That sounds like a great team effort! What was your specific piece of the puzzle there?"*
> 2. **情境式有機加壓 (Organic Trade-Off Probing)**：當候選人回答得很完美時，面試官不會突然空降一個無關的極限題目（如 *"突然爆增 10 倍流量怎麼辦？"*），而是會針對候選人剛才提到的具體技術選型（如 PostgreSQL / Redis / Docker）進行權衡追問：*"You mentioned using PostgreSQL there. What was the biggest limitation or trade-off you accepted with that choice?"*
> 3. **自然話題過渡 (Conversational Bridging)**：切換話題時，自動帶入前一個主題進行承上啟下 (*"That makes sense for frontend. Moving on to backend infrastructure..."*)。

---

## 2. 系統架構 (System Architecture & Action Flow)

```text
[候選人回答] ──► [Action Planner 決策]
                     │
                     ├── [isTooPerfect & standard mode] ──► AGENT_ACTION_TYPES.PROBE_TRADE_OFF
                     │                                            │
                     │                                            ▼
                     │                              buildProbeTradeOffQuestion
                     │                              ("You mentioned using ${tech} there. What was the limitation?")
                     │
                     ├── [hasTeamworkReference ('we')] ──► buildProbingQuestion (NZ-style Appreciative Probe)
                     │                                            │
                     │                                            ▼
                     │                              "That sounds like a great team effort! What was your specific piece of the puzzle?"
                     │
                     └── [SWITCH_TOPIC / SHIFT_SECTION] ──► buildSwitchTopicQuestion / buildSectionShiftQuestion
                                                                  │
                                                                  ▼
                                                    "That makes sense for ${prevTopic}. Moving on to ${targetTopic}..."
```

---

## 3. 驗證 (Verification)

- Vitest 測試：`tests/robustness/questions/interviewTurnOrchestratorService.test.js`, `tests/robustness/voice/questionScopeClarificationService.test.js`, `tests/unit/transcriptNormalizer.test.js` PASS。
- Backend Lint：`npm run lint` 0 errors PASS。

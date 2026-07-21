Question Intelligence 要解的問題
現在的問題產生是：
CV seed
JD requirement
match gap
behavioural fallback
wrap-up
→ 生成 question
但它還不夠知道：
這題難度是 junior / intermediate / advanced？
這題在測 ownership、validation、trade-off、risk 還是 communication？
這題是不是太淺？
這題是不是太深？
這題應該怎麼 follow-up？
所以 Question Intelligence Layer 要變成：
Role Fit = 要測什麼
Question Intelligence = 怎麼問才測得出來
Report Alignment = 答得有沒有證明到
Codex 的實作順序應該是這樣
PR 1：Question metadata schema
先不要改生成邏輯，只加 metadata。
每題要有：
{
  "targetLevel": "junior | intermediate | advanced",
  "questionType": "technical | behavioural | ai_automation | gap_validation | career_transition | system_design",
  "testedSignal": "ownership | validation | tradeoff | stakeholder_communication | role_intent | gap_risk",
  "expectedSignals": [
    "specific example",
    "personal action",
    "decision",
    "validation",
    "result"
  ],
  "levelFitReason": "...",
  "tooShallowRisk": false,
  "tooDeepRisk": false
}
先讓 question pool 變得可觀測。
PR 2：Question level classifier
根據你已有的 docs/references/interview-question-leveling.md 做 classifier。
它要判斷：
這題適合哪個 level？
為什麼？
是不是太淺？
是不是太深？
例如：
Have you used React before?
對 intermediate 太淺。
應改成：
Tell me about a React feature you owned. What decision did you make, how did you validate it, and what changed as a result?
PR 3：Level-aware question rewriter
如果題目太淺或太深，就 rewrite。
Junior 問：
你做了什麼？你學到什麼？
Intermediate 問：
你怎麼做 decision？怎麼 validate？結果是什麼？
Advanced 問：
你怎麼處理 ambiguity、risk、trade-off、stakeholder、failure mode？
PR 4：Question ranking 接 role fit
這一步才把 role fit 接進 question layer。
問題 ranking 不再只是：
source priority + dedupe
而是：
source priority
+ roleIntentCoverageBoost
+ evidenceMapStrength
+ gapRiskBoost
+ unmetCoverageBoost
- duplicatePenalty
- evidenceOverusePenalty
這樣問題才不只是「從 JD/CV 來」，而是「為了測某個 role-fit signal 而問」。
PR 5：Follow-up strategy by level
Follow-up 也要分難度。
Junior：
What part did you personally do?
What did you learn?
Intermediate：
What trade-off did you make?
How did you validate it worked?
Advanced：
What risk did you consider?
How would you monitor or recover if it failed?
這樣 interview 才會像真人面試官，而不是題庫機。
你可以這樣丟給 Codex
Read the current question generation, prepared question pool, interview turn orchestration, and docs/references/interview-question-leveling.md.

Do not implement yet.

First create:
1. docs/question-intelligence-goal.md
2. docs/question-intelligence-spec.md
3. docs/question-intelligence-implementation-plan.md

The goal is to add a Question Intelligence Layer after Role Fit MVP.

It should refine question generation so each question has:
- targetLevel: junior | intermediate | advanced
- questionType
- testedSignal
- expectedSignals
- levelFitReason
- tooShallowRisk
- tooDeepRisk

It should preserve the existing adaptive interview design, prepared question pool, fallback behavior, and question deduplication.

The implementation plan must be split into small PRs:
1. metadata schema only
2. classifier
3. level-aware rewriter
4. ranking integration with role fit
5. follow-up strategy by level
6. robustness tests

Do not rewrite the whole question pipeline.
Do not make the interview a fixed script.
Do not expose recommended answers to the user during live interview.
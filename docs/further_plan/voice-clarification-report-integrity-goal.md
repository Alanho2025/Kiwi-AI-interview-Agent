# Voice Clarification and Candidate Report Integrity Goal

狀態：Implemented locally；remediation focused gates passed；follow-up audit 由 owner 明確免除  
日期：2026-07-30 Pacific/Auckland  
對應 Spec：[Voice Clarification and Candidate Report Integrity Spec](voice-clarification-report-integrity-spec.md)  
產品契約：[Voice Interview Product Behavior](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)  
相關現行設計：[Voice Scope Clarification](../question_refine/03-voice-scope-clarification.md)、[Report Progress Coaching](../question_refine/04-report-progress-coaching.md)

> **實作狀態 (Implementation Status)**：Implemented / local automated gates passed
>
> **校驗測試路徑 (Verified by Tests)**：[Evidence Matrix](voice-clarification-report-integrity-evidence.md)

## 1. Overview

這個 Goal 處理同一條 candidate trust chain 上的三個問題：

1. Voice interviewer 會把內部 gap/rubric rationale 直接念給候選人，例如 `I want to validate one possible gap around ...`。
2. 候選人要求重述或解釋問題時，deterministic scope detector 可能把它錯當正式答案，造成跳題、計分與 report 污染。
3. Candidate report 把 coaching、QA controls、營運成本、internal evidence diagnostics、reflection form 和 printable export 混在一起，產生重複資訊、不可操作內容與 PII 暴露風險。

本 Goal 不把這三件事當成互不相關的文字修補。它們共享同一個產品邊界：

```text
internal selection evidence
  -> candidate-safe spoken question
  -> candidate voice turn classification
  -> accepted-answer eligibility
  -> candidate-safe report projection
```

任何一層錯把 internal rationale 或 non-answer turn 當成 candidate evidence，都會污染後續 scoring 和 report。

## 2. Pre-change Baseline

以下是 2026-07-30 實作前 source 與使用者提供的真實 transcript 所確認的 baseline：

- `backend/src/services/questions/questionPoolComposerService.js` 的 match-gap fallback 會組出 `I want to validate one possible gap around ${topic}...`。
- `topic` 可以 fallback 到完整 `gap.summary`，因此內部 requirement/gap 文字可能直接進入 spoken question。
- `backend/src/services/questions/interviewMicroPlanningService.js` 有 rubric-style naturalization，但目前 deterministic patterns 沒有攔截 `I want to validate one possible gap around`。
- `backend/src/services/voice/questionScopeClarificationService.js` 只涵蓋有限 scope patterns；使用者實際說出的 `Can you clarify ... what are you asking?` 目前回傳 `not_scope_question`。
- `backend/src/services/voice/realtimeVoiceTurnService.js` 在未辨識 scope request 時，會把 accepted transcript 預設保存為 `user_answer`，並進入正式 answer persistence 和 next-turn path。
- `backend/src/services/report/reportTurnDatasetService.js` 能排除具有正確 non-answer metadata 的 clarification，但不能可靠修復上游已被錯標為 `user_answer` 的 legacy turn。
- `frontend/src/pages/ReportPage.jsx` 現在把 candidate report、Commercial Stress Test、Evidence Sources、diagnostics、reflection form 和 printable content 放在同一個 render tree。
- 現有 developer diagnostics 是 authenticated、owner-scoped，而且 production disabled；repo 目前沒有正式 production developer/admin RBAC。
- 使用者提供的 14 頁 PDF 中，clarification 被當成 Q4 正式答案；candidate export 同時出現內部操作、成本/token 資料、重複 coaching、不可操作 reflection form，以及 CV 聯絡資料。

以上內容保留為 2026-07-30 修正前的問題快照，不代表現行 runtime。實作已逐檔盤點並保留原有 working-tree 修改；現行結果與未執行的人工作業記錄在 Evidence Matrix。

## 3. Product Outcome

### Candidate outcome

Voice candidate 應該可以：

- 聽到自然、簡短、像真人 interviewer 的問題，而不是 internal rubric 或 match-gap 說明。
- 用自然英文要求重複、縮短、重新表述、解釋題意、限定範圍或提供例子。
- 得到與 clarification intent 相符的簡短回應。
- 留在相同 root question，直到回答、跳過或 session 合法結束。
- 確信 clarification、repair、repeat 和 skip control 不會被當成低品質答案。
- 在 report 中只看到可信結論、最多三個優先改善項目、正式逐題 feedback 和可執行改寫。
- 在 HTML、JSON、TXT 和 PDF 中不看到不必要的 PII、internal IDs、rank/trace、provider cost 或 developer controls。

### Developer outcome

Local/development developer 應該可以：

- 用 Candidate View / Developer Diagnostics toggle 檢查本人 session。
- 查到 question selection rationale、clarification classifier reason、turn eligibility、QA、cost/token、trace 和 projection diagnostics。
- 不必讓 candidate payload 攜帶或前端隱藏 developer-only fields。
- 在 production 看不到 diagnostics toggle，且既有 production diagnostics deny boundary 保持有效。

## 4. Observable Goal Tree

```text
VCRI-G0  Current-vs-target contract and evidence baseline
|
+-- VCRI-G1  Candidate-safe spoken questions
+-- VCRI-G2  Deterministic clarification intent coverage
+-- VCRI-G3  Same-root and non-score voice state integrity
+-- VCRI-G4  Report answer-eligibility and legacy safety
+-- VCRI-G5  Candidate report simplification and privacy
`-- VCRI-G6  Verification, rollout and rollback evidence
```

| Goal | Observable outcome | Exit gate |
| --- | --- | --- |
| VCRI-G0 | Current facts、owner decisions、non-goals 和 hard stops 可追溯。 | Goal/Spec lint、source link 和 human approval 完成。 |
| VCRI-G1 | Spoken questions 不再朗讀 internal gap/rubric rationale。 | Composer、micro-planner success/fallback、TTS transcript fixtures 全部 candidate-safe。 |
| VCRI-G2 | Natural clarification intent 由 deterministic policy 分類。 | Reviewed corpus 100%；unseen holdout recall >=95%；negative false-positive <=1%。 |
| VCRI-G3 | Clarification request/response 不存正式答案、不評分、不推進題數，並保持 same root。 | Persistence、controller、question-count、duplicate/reconnect 和 latency tests 通過。 |
| VCRI-G4 | Report 只計 accepted answers；legacy 疑似 clarification 不被靜默當成可信分數。 | Report dataset、QA、legacy warning 和 regenerate tests 通過。 |
| VCRI-G5 | Candidate report 精簡、PII-safe；developer details 只在 non-production owner scope。 | Candidate projection allowlist、export parity、frontend/browser/PDF 和 authorization tests 通過。 |
| VCRI-G6 | Automated、human voice、visual、privacy 和 rollback evidence 分開記錄。 | 未通過的 live/browser/human/production gate 不得被 local tests 取代。 |

## 5. Success Criteria

### Spoken-question integrity

- Match-gap question 不包含 `I want to validate one possible gap around`。
- Candidate-facing question 不包含 `limited direct evidence`、`missing evidence`、coverage、ranking、risk 或 scoring wording。
- 完整 JD requirement 或 gap summary 不會直接插入 spoken question。
- Question 保留 assessment intent，但預設為一個自然問題，約 25–30 個英文單字以內。
- Model invalid、timeout 或 fallback 時仍產生 candidate-safe question。

### Clarification integrity

- Reviewed golden corpus 100% 通過。
- 獨立 unseen paraphrase holdout recall 至少 95%。
- Negative answer corpus false-positive 不高於 1%。
- 每個已辨識 clarification 都是：
  - 0 evaluator calls；
  - 0 正式 answer persistence；
  - 0 question-index advancement；
  - 0 scored answer rows。
- Ambiguous but help-seeking/question-like turn 安全進 repair，不直接計分。
- Repeated clarification 最多進行兩次 bounded help；之後可安全 skip，同樣不製造零分答案。
- 不新增 live classifier LLM call，並保留 `speech_end -> first_audio <= 3 seconds` 產品門檻。

### Report integrity

- Candidate report 只保留 trust status、三個核心分數、簡短說明、最多三個改善優先項、逐題 feedback 和 answer rewrite。
- QA controls、Commercial Stress Test、provider cost、token usage、完整 Evidence Sources、trace、internal diagnostics、empty detail shells 和 mock report reflection form 不出現在 candidate printable report。
- Candidate JSON、TXT、HTML、PDF 使用同一個 server-owned allowlist/redaction authority。
- Email、電話及不必要的 CV 聯絡資料不出現在 candidate report/export。
- Developer diagnostics toggle 只在 local/development 顯示，只能讀取本人 session，production 必須 deny。
- Reflection 只可由候選人主動進入 real-interview reflection flow；它保持 session-private 且不影響 scoring。

## 6. Authority and Trust Boundaries

Authority order：

```text
privacy / ownership / voice product contract
  > domain controller and voice state machine
  > deterministic clarification and projection policies
  > question micro-planner / report generator
  > candidate-facing wording
```

Hard boundaries：

- Internal gap/ranking/evidence metadata 可以影響選題，不可以成為 spoken question 前言。
- LLM 可以 naturalize 已選問題，不可以決定 clarification 是否計分。
- Clarification classification 必須在正式 answer persistence 和 evaluator 之前完成。
- Report UI 不得靠 CSS 或 client-only filtering 保護 developer data。
- Developer diagnostics 不等於 PII exemption；PII 仍預設遮蔽。
- Reflection、memory 或 legacy heuristic 不得改變 scoring。

## 7. In Scope

- Voice-only candidate-safe question composition and validation。
- Voice-only deterministic clarification intent classification。
- Voice same-root、non-countable、non-score persistence/controller behavior。
- Report accepted-answer eligibility and legacy warning/regeneration boundary。
- Candidate report information architecture、candidate projection、export parity 和 PII redaction。
- Non-production owner-scoped developer diagnostics toggle。
- Mock report reflection removal and explicit real-interview reflection entry boundary。
- Focused automated tests、adversarial fixtures、browser/PDF checks、human voice review、rollout and rollback evidence。
- Required Feature RFC、repo-docs 和 change-log synchronization after runtime behavior changes。

## 8. Non-Goals

- Text interview 修改、清理或移除。
- Voice session 的 text fallback 修改。
- 新增 clarification LLM classifier 或 provider dependency。
- Production developer/admin RBAC 或 production diagnostics。
- 自動 migration 或重寫全部歷史 report records。
- 讓 reflection、memory 或 historical hypothesis 影響 matching/scoring。
- 改變 CV-JD match score 本身。
- Production deployment、warn/enforce promotion 或 paid real-provider eval。
- 宣稱 deterministic classifier 能理解無限自然語言。

## 9. Approved Assumptions and Decisions

Owner-approved on 2026-07-30：

1. 本 Goal 只處理 voice；text 完全 out of scope。
2. Clarification classifier 使用 deterministic policy，不增加 live classifier LLM call。
3. 「周全」以 corpus、unseen holdout、false-positive、state invariants 和 human voice evidence衡量。
4. Clarification response 依 intent 和 prepared question context 變化，不使用單一固定句。
5. Candidate report 和 developer diagnostics 分層。
6. Developer toggle 僅 local/development；production 隱藏並拒絕存取。
7. Reflection 移出 mock report。
8. Candidate outputs 必須遮蔽 PII。
9. Legacy report 不做整庫 migration；以 warning、candidate-safe projection 和按需 regenerate 處理。
10. Internal gap rationale 不得出現在 spoken question。

## 10. Delivery and Validation Boundary

Execution sequence：

```text
docs/spec approved
  -> implementation discovery and dirty-tree reconciliation
  -> deterministic corpus and focused unit tests
  -> local shadow comparison
  -> development enforce
  -> integration + browser + PDF verification
  -> human voice/listening review
  -> Product Owner report review
  -> separate production rollout decision
```

`Goal/Spec implemented` 代表 local runtime 與 automated gates 已完成。它仍不代表：

- browser/live voice 已驗證；
- real provider latency 已通過；
- production policy 已 promotion；
- historical reports 已被批次改寫。

## 11. Remaining Decisions and Hard Stops

目前沒有阻擋 local implementation 的產品決策。

Implementation hard stops：

- Runtime code change 已由 owner 在 2026-07-30 明確批准。
- 已盤點並保留所有重疊的未提交修改。
- 自動化 corpus、question-count、PII 或 ownership gate 任一失敗時不得完成；live latency 與真人 voice 尚未執行，因此不得宣稱 production ready。
- Candidate visibility/report publication behavior 若偏離本 Goal，必須重新取得 owner approval。
- Production diagnostics、RBAC、text removal、retention/deletion semantics 或 schema migration 必須另開決策。
- Real-provider eval、dependency install、destructive cleanup、git push 和 production deploy 仍需另外批准。

## 12. Human Approval Status

- Task Blueprint Revision 2：Owner approved by request to create Goal and Spec on 2026-07-30。
- 本 Goal：Owner-approved，且 local implementation 已完成。
- Runtime implementation：Owner 於 2026-07-30 明確要求完整實作。
- Production rollout：Not approved。

證據狀態：本文件依 2026-07-30 current source、使用者提供 transcript/PDF audit、voice product contract、local automated verification 與 Evidence Matrix 更新。Browser、真人 microphone/listening、live provider latency 與 production rollout 仍未執行。

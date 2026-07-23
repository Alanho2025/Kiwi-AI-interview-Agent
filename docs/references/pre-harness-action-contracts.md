# Pre-Harness Action Contracts

狀態：pre-harness contract 草案，不改變目前 runtime 行為。

本文件把目前 interview/report controller 中最重要的 action 先寫成準入前契約。它不是 production `ActionContract` schema；目的是讓之後實作 harness 時不要從抽象 action 名稱開始，而是從現有 `candidateActions`、fallback、side effects 和測試缺口開始。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[共享 Contract Spine](../further_plan/product-harness-contract-spine.md)、[Pre-Harness Task Contracts](pre-harness-task-contracts.md)。

## 1. Current action source

| Source | 已確認內容 |
| --- | --- |
| [agent action enum](../../backend/src/constants/agentActionTypes.js) | 目前 action 名稱集中在 `AGENT_ACTION_TYPES`。 |
| [action planner](../../backend/src/services/aiControl/actionPlanner.js) | 產生 `candidateActions`，每個 candidate 有 `action`、`priority`、`reason`、`evidenceNeed`、`risk`、`actionInput`。 |
| [model action selector](../../backend/src/services/aiControl/modelActionSelectorService.js) | model 只能選 allowed candidate action；invalid/disallowed/error 會 fallback。 |
| [voice decision service](../../backend/src/services/aiControl/voiceAgentDecisionService.js) | voice fast path 也限制 selected action 必須在 candidate actions 裡。 |
| [trajectory service](../../backend/src/services/aiControl/trajectoryService.js) | persisted trajectory 會保存 selected/fallback/candidate actions 和 planner signals。 |

## 2. 最小 action contract 欄位

| 欄位 | 狀態 | 說明 |
| --- | --- | --- |
| `action` | 已確認 | 目前 action enum 已存在。 |
| `allowedCallers` | 未確認 | 還沒有集中定義哪些 task/controller 可以呼叫哪些 action。 |
| `preconditions` | 部分確認 | time limit、question limit、mode boundary、fresh question、final turn 等分散存在。 |
| `actionInput` | 部分確認 | planner 會提供 target topic、probe type、force evidence、freshOnly 等。 |
| `forbiddenBehavior` | 部分確認 | prompt/rules 有局部限制，但沒有 per-action list。 |
| `postconditions` | 部分確認 | question metadata、trajectory、agentMemory 會寫入，但未 formalize。 |
| `fallback` | 已確認 | selector fallback 到 rule plan。 |
| `gateResults` | 未確認 | 沒有 shared `GateResult` 保存。 |
| `idempotencyKey` | 未確認 | 目前無 action-level idempotency contract。 |
| `deadlineMs` / `budget` | 部分確認 | voice 有 latency marks，但不是 action-level contract。 |

## 3. Priority action contracts

| Action | 狀態 | Current behavior | Required pre-harness contract | 需要測試 |
| --- | --- | --- | --- | --- |
| `ASK_POOL_QUESTION` | 部分確認 | 用於 fresh anchor、close current topic、switch to prepared/root question。 | precondition：需要可用 question pool 或可降級；postcondition：AI turn metadata 必須有 `countsAsQuestion=true`、question id/order/reason。 | pool depleted、duplicate transcript reconciliation、freshOnly fallback。 |
| `ASK_PROBING_QUESTION` | 部分確認 | 用於補 personal action、result、evidence gap。 | precondition：latest answer 有 follow-up value 或 evidence gap；postcondition：parent/root question relation 要可追蹤。 | probe 不得重複問同一問題；repair/clarification 不得被算成 root question。 |
| `ASK_VALIDATION_QUESTION` | 部分確認 | 用於 unresolved validation target。 | precondition：validation target 未被 denied，且 mode 允許；postcondition：evidence target 和 validation reason 要保存。 | denied skill target 不得被追問；model 不得選非 allowed validation action。 |
| `SWITCH_TOPIC` | 部分確認 | 用於 repetition risk、coverage gap、candidate repetition complaint。 | precondition：current topic exhausted 或 repetition/coverage signal；postcondition：新 topic source/reason 可追蹤。 | repetition complaint 應 acknowledgement + fresh topic；不可在 misunderstood repair 時強制切題。 |
| `WRAP_STAGE` | 部分確認 | final planned turn 或 wrap stage 時關閉。 | precondition：final planned turn、wrap stage 或 time/question limit；postcondition：不得再開新 evidence chain。 | final turn 不被 model override；candidate question 分支清楚。 |
| `REPHRASE_QUESTION` | 部分確認 | misunderstanding/rephrase signal 時使用，model selection disabled。 | precondition：misunderstanding 或 explicit rephrase request；postcondition：turn metadata 不算 interview question。 | repeated repair 後轉 scaffold；repair prompt outside count。 |
| `ASK_SCAFFOLD_QUESTION` | 部分確認 | repeated misunderstanding repair 時降低負荷。 | precondition：repeated repair 或 question similarity flag；postcondition：仍需 evidence target，但不應懲罰 candidate。 | low-confidence transcript 和 misunderstanding repair 分流。 |
| `GENERATE_REPORT_DRAFT` | 部分確認 | report task 固定 action，model selection disabled。 | precondition：report evidence context 可用；postcondition：必須跑 QA gate 並保存 publication status。 | QA failed 不得標 ready；unsupported high-confidence feedback blocked。 |
| `QA_REPORT` | 未確認 | enum 存在，但主 flow 使用 `qa_report` task + `reportQa` callable。 | 需要決定這是 action 還是 task/gate。 | existing report recheck fixture。 |

## 4. Action gates to introduce first

| Gate | 狀態 | 判斷 |
| --- | --- | --- |
| `action_allowed_candidate` | 部分確認 | source 已 enforce，但 gate result 未保存。 |
| `action_precondition_met` | 未確認 | preconditions 尚未集中。 |
| `question_countable_turn` | 部分確認 | question counting 已有局部邏輯和 tests。 |
| `question_novelty` | 部分確認 | dedupe/ranking 有局部 traces。 |
| `report_publication_allowed` | 部分確認 | report QA flags 有 blocking effect，但不是 shared gate。 |
| `voice_transcript_eligible` | 部分確認 | voice transcript confirmation/review policy 有 tests，但未共用 gate schema。 |

## 5. Not ready yet

| 缺口 | 為什麼不能跳過 |
| --- | --- |
| 沒有 action-level idempotency | voice retry、duplicate speech end、client reconnect 可能造成雙題或雙寫。 |
| 沒有 shared gate artifact | report/voice/question/action gate 無法一起查詢。 |
| 沒有 `allowedCallers` | 之後新增 feature 時容易讓 action 被錯誤 task 呼叫。 |
| 沒有 action budget/deadline | voice hot path 很難靠 `console.log` 快速定位 timeout 來源。 |

## 6. First implementation boundary

第一版 harness 不應重寫 action planner。合理順序是：

1. 只在 shadow mode 產生 action contract view。
2. 先把 `candidateActions` 映射成 read-only `ActionContract` view，不新增平級 snapshot contract。
3. 為 selector fallback 產生 `action_allowed_candidate` gate event。
4. 用現有 question/report/voice tests 跑 baseline，確認 contract view 沒改 runtime 行為。

# Pre-Harness Task Contracts

狀態：pre-harness contract 草案，不改變目前 runtime 行為。

本文件把 Kiwi 目前可確認的主 task 固定成升級前契約。它不是 target harness schema；用途是在進入 harness architecture implementation 前，先確認現在 task 真的做什麼、還缺哪些 formal contract 欄位、哪些行為需要 focused test。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[共享 Contract Spine](../further_plan/product-harness-contract-spine.md)、[Kiwi Agent 現況盤點](agent-current-state-inventory.md)、[Product Agent Harness Upgrade Guide Plan](../further_plan/agent-harness-architecture-upgrade-plan.md)。

## 1. 狀態標記

| 狀態 | 意思 |
| --- | --- |
| 已確認 | 可由目前 source 或 docs 直接確認。 |
| 部分確認 | 有現有能力，但還沒有集中 contract 或證據不完整。 |
| 未確認 | 目前不能把它當成已存在行為。 |
| 需要測試 | 靜態閱讀不足，需要 focused test、fixture 或 replay。 |

## 2. Task surface

目前 task runner surface 來自 [任務路由器](../../backend/src/services/masterAiService.js)：

| Task | 目前入口 | 狀態 | 現況判斷 |
| --- | --- | --- | --- |
| `interview_next_turn` | `runTask({ taskType: 'interview_next_turn' })` | 部分確認 | 會載入 session 並進入 interview controller，但沒有獨立 `TaskContract` schema。 |
| `generate_report` | `runTask({ taskType: 'generate_report' })` | 部分確認 | 會進入 report controller、QA、存 report artifact，但 publication criteria 分散。 |
| `qa_report` | `runTask({ taskType: 'qa_report' })` | 部分確認 | 會對已存 report 重新跑 QA；它像 gate/recheck，不是完整 repair workflow。 |

## 3. `interview_next_turn`

| Contract 欄位 | 狀態 | Current source evidence | Pre-harness contract |
| --- | --- | --- | --- |
| Objective | 部分確認 | interview controller 會 retrieval、build environment、evaluate latest answer、select action、execute action。 | 收集下一輪可評估的 interview evidence，或在達到限制時結束本輪。 |
| Inputs | 已確認 | `sessionId`、`payload`、`onSentence`、`trace`。 | 必須至少有可讀 session；voice path 可帶 streaming callback 和 latency trace。 |
| Required context | 部分確認 | controller 建 retrieval bundle、environment、decision context。 | 需要 session state、latest answer、question history、retrieval result、agent memory。缺 context 時應降級或 fallback。 |
| Output | 部分確認 | 目前 return interviewer output、decision metadata、trajectory/memory side effects。 | 應映射到 `WorkflowRun.resultRefs`、selected action、question/turn artifact、gate refs 和 trace refs，不另建平級 result contract。 |
| Success criteria | 部分確認 | 正常產生下一題、repair prompt、wrap action，或 question/time limit complete。 | success 不能只等於有文字輸出；需要 action 合法、turn metadata 可追蹤、counting 正確。 |
| Stop condition | 部分確認 | question limit、final planned turn、wrap stage、no viable action 等分散在 controller/planner。 | 需要集中列出 `question_limit_reached`、`time_limit_reached`、`wrap_stage`、`needs_human_confirmation`。 |
| Forbidden behavior | 部分確認 | model selector prompt 禁止 override time/question/mode/privacy/safety/report QA。 | 不得產生不在 candidate actions 的 action；不得把 repair/confirmation/system turn 算作 interview question；不得把低信心 transcript 直接當高信心答案評分。 |
| Side effects | 已確認 | decisionRecords、trajectoryRecords、agentTraceEvents、agentMemory、reflection/UserCoachingMemory、transcript/question metadata。 | 需要 `sideEffects[]` read model，標出 write target、idempotency key、source task。 |
| Needs test | 需要測試 | 現有 question/voice/action tests 覆蓋局部行為。 | duplicate turn、retry、model invalid action、low-confidence transcript confirmation、question counting 必須進 baseline。 |

## 4. `generate_report`

| Contract 欄位 | 狀態 | Current source evidence | Pre-harness contract |
| --- | --- | --- | --- |
| Objective | 部分確認 | report controller 建 report retrieval、select `GENERATE_REPORT_DRAFT`、執行 report action、QA、persist artifact。 | 產生 grounded report，只有通過 QA 或明確標 `needs_review` 才能被視為可發布。 |
| Inputs | 已確認 | `sessionId`。 | 必須能讀 session、CV/JD/interview plan、prepared question pool、transcript、analysis result。 |
| Required context | 部分確認 | report retrieval sourceTypes 包含 `cv_profile`、`jd_rubric`、`interview_plan`、`prepared_question_pool`、`transcript`。 | 需要 claim/evidence mapping 和 report evidence refs；不足時 report 應降級或 needs review。 |
| Output | 部分確認 | `report`、`qaResult`、`stored`、`controllerAction`。 | 應映射到 `WorkflowRun.resultRefs`、`publicationStatus`、GateResult refs、repair span/event refs，不另建 report-specific result contract。 |
| Success criteria | 部分確認 | `qaResult.passed` 影響 `ready` / `needs_review` / repair 狀態。 | success 應要求 blocking QA flags 為空、candidate-facing claims 有 evidence label/confidence/status。 |
| Stop condition | 部分確認 | QA repair loop 有 attempt limit，Role-Fit deterministic failure 不讓 wording repair 清掉。 | 需要列出 `qa_passed`、`qa_failed_needs_review`、`repair_failed`、`deterministic_gate_failed`。 |
| Forbidden behavior | 部分確認 | report QA 會擋 unsupported high-confidence feedback、unknown evidence id、role-fit artifact ownership 等。 | 不得把 unsupported claim 寫成 high confidence；不得引用未 review company claim；不得隱藏 transcript risk。 |
| Side effects | 已確認 | reportArtifacts、SessionReport、usage metadata、question artifact cleanup。 | 需要 side-effect inventory 和 cleanup/retry idempotency policy。 |
| Needs test | 需要測試 | report robustness tests 存在。 | 需要 baseline 記錄 unsupported claim rate、repair pass/fail、QA blocking flags。 |

## 5. `qa_report`

| Contract 欄位 | 狀態 | Current source evidence | Pre-harness contract |
| --- | --- | --- | --- |
| Objective | 部分確認 | 對 existing stored report 建 retrieval bundle 並跑 `reportQa`。 | recheck stored report 的 publication safety，不應默默 rewrite。 |
| Inputs | 已確認 | `sessionId`，且必須有 stored report。 | 沒有 stored report 時應 fail closed。 |
| Required context | 部分確認 | 重新 indexing report session artifacts，使用 CV/JD/interview/transcript sources。 | QA recheck 應紀錄 source bundle summary 和 QA attempt context。 |
| Output | 部分確認 | `report`、`qaResult`、`stored`。 | 應輸出 gate result、blocking flags、publication recommendation。 |
| Success criteria | 部分確認 | QA passed 且 persist artifact 成功。 | `qa_report` success 應分成 task success 和 report publication success。 |
| Stop condition | 已確認 | 找不到 session 或 report 直接 throw。 | 應在 harness 中轉成 typed failure：`session_not_found`、`report_not_found`。 |
| Forbidden behavior | 未確認 | 目前沒有集中寫在 task contract。 | 不得在 QA-only task 裡做未授權 rewrite；不得把 QA failed artifact 標 ready。 |
| Side effects | 部分確認 | 會 record local usage 並 persist QA result。 | 需要標明 recheck 是否覆蓋既有 artifact status。 |
| Needs test | 需要測試 | integration route tests 可能覆蓋局部行為。 | 需要 stored report missing、QA failed、QA passed 三種 replay fixture。 |

## 6. Pre-harness acceptance

進入第一個 harness implementation slice 前，task contract 至少要補到：

1. 每個 task 有固定 objective、inputs、outputs、success/failure、stop conditions、forbidden behavior。
2. 每個 task 的 side effects 可被列出，包含 persistence target 和 rollback/retry 風險。
3. `interview_next_turn` 的 action selection 必須能回放：同一 fixture 下可看見 selected action、fallback action、candidate actions、question metadata。
4. `generate_report` 的 publication gate 必須可回放：同一 fixture 下可看見 QA flags、repair decision、ready/needs_review。
5. `qa_report` 必須被定義成 recheck/gate，不和 rewrite/repair 混在一起。

## 7. Current gaps to carry back into audit

| Gap | 對 audit 的影響 |
| --- | --- |
| 沒有 shared `WorkflowRun` result/status mapping | `Task contract` 維持 `部分確認`。 |
| side effects 沒有 formal inventory | `Trace/observability` 和 `Eval/replay baseline` 不能標 ready。 |
| `qa_report` 的 gate/recheck 語義還沒集中 | `Gate taxonomy` 只能標 `部分確認`。 |
| duplicate/retry/idempotency 未完成 replay | `Action boundary` 裡 idempotency/concurrency 維持 `需要測試`。 |

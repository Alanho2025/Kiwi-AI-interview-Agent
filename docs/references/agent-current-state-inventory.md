# Kiwi Agent 現況盤點

狀態：current-state inventory 草案，不改變目前產品行為。
日期：2026-07-15
Repo baseline：`497c21a`

本文件用來回答一個升級前問題：Kiwi 現在的 agent 到底處於什麼狀態，距離正式的 product-agent harness architecture 還缺哪些條件。

結論先講清楚：Kiwi 目前已經不是單純 LLM wrapper。它有產品控制器、固定 agent registry、rule-first action planning、bounded model-assisted selection、session memory、coaching memory、decision records、trajectory records、trace events、report QA 和 transcript/voice guards。比較準確的描述是：

> Kiwi 目前是一個 controlled agentic interview-coaching workflow。它已經有局部 harness 能力，但還沒有形成正式的 shared harness architecture。

也就是說，現在已經有一些「像 harness 的局部能力」，但每個 agent 的行為、memory 更新、trace、gate、failure attribution 還沒有被同一套 contract 管起來。

---

## 1. 目前能確認的 agent-like component

| Component | 現在做什麼 | 現在的邊界 | Harness 缺口 |
| --- | --- | --- | --- |
| Product controller / task runner | `runTask` 根據 `taskType` 路由到 interview、report、QA flow。 | `masterAiService` 是產品流程 source of truth，不是純 LLM wrapper。 | 還沒有 `WorkflowRun`、`ExecutionSpan`、`GateResult`、`FailureClassification`。 |
| Agent registry | 登記 `retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。 | registry 是 function map。 | 還不是 `AgentProfile`，沒有集中定義 purpose、allowed workflows、tool scope、memory permission、budget。 |
| Retrieval agent | 按 objective 選 source，取 session/global evidence，評估 quality，必要時 corrective retry。 | 回傳 retrieval bundle，不直接寫 DB。 | 還沒有 formal `ContextPacket`、claim-to-source gate、retrieval budget、failure attribution。 |
| Interview evaluator | 把最新答案轉成 specificity、evidence gain、misunderstanding、skill denial、planner signals。 | evaluator 不直接問下一題。 | evaluator output 還沒有被 formalized 成 reusable evaluation span 或 gate result。 |
| Action planner | rule-first 選下一步 action，建 candidate actions，部分 action 禁止 model selection。 | 有 action enum、priority、risk、evidenceNeed、fallback selection。 | 還不是完整 `ActionContract`，缺 pre/postcondition、idempotency、concurrency、cancellation、budget。 |
| Model action selector | model 只能從 `candidateActions` 選 action，選錯或失敗會 fallback。 | 這已經是 bounded model-assisted decision。 | 還缺統一 action contract、gate result、run/span trace。 |
| Voice decision fast path | voice mode 可用一次 bounded model decision 同時做 answer understanding 和 action selection。 | 只能從 allowed candidates 選 action，失敗回 fallback。 | 還沒有完整 voice-specific run/span/gate model；latency gate 仍分散。 |
| Interviewer agent | 把 selected action 變成下一題，處理 root/follow-up/validation/deep dive/section shift/wrap-up。 | 做 mode guard、novelty guard、fallback；本身不直接寫 response。 | question selection reason、dedupe、counting、latency 還沒有統一 GateResult 表示。 |
| Report generator agent | 建 scored turn dataset、deterministic feedback、report scores、claim grounding、schema validation。 | non-countable turns 不應進 scored dataset。 | report output 有 grounding，但還沒有 formal publication workflow run。 |
| Report QA agent | 檢查 report 缺段、證據、分數、rewrite、Role-Fit integrity、transcript risk。 | blocking flags 會阻擋 ready 狀態或要求 repair/review。 | QA result 還不是 shared `GateResult`，不能和 interview/voice gate 用同一套表示。 |
| Memory services | 寫 session-local memory、reflection records、UserCoachingMemory summary。 | user-level memory 是 bounded coaching memory，不是完整 progress-learning profile。 | 缺 formal `MemoryPolicy`、source evidence、read/write permission、`canAffectScoring`。 |
| Trace / decision records | 寫 `decisionRecords`、`trajectoryRecords`、`agentTraceEvents`。 | 可以事後查部分 decision、trajectory、latency、report trace。 | 還不能穩定重建一個完整 workflow episode；缺 run/span/gate correlation。 |

Source locators：

- agent registry 在 [agent registry service](../../backend/src/services/agentRegistryService.js)，目前是固定 function map。
- task runner 在 [master AI service](../../backend/src/services/masterAiService.js)，`runTask` 支援 `interview_next_turn`、`generate_report`、`qa_report`。
- repo-docs 的現況說明在 [Agent registry 與 task runner](../../repo-docs/modules/agent-registry-and-task-runner.md)、[Agent memory 與 trace](../../repo-docs/modules/agent-memory-and-trace.md)、[访谈控制机制](../../repo-docs/modules/feature-interview-control.md)。

---

## 2. 現在每個 agent 的行為是否已經清楚定義

答案：局部清楚，整體不夠。

現在已經清楚的部分：

- 正式 registry 只暴露五個 callable agent/service：`retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。
- action planner 有 hard-coded action enum、blocked model-selection actions、candidate action ranking。
- model action selector 和 voice decision fast path 都有 allowed-candidate boundary。model 不能任意 invent action；如果 selected action 不在 allowed set，系統會 fallback。
- report QA 有 blocking flags，對 report ready 狀態有守門效果。

還不夠的部分：

- 沒有每個 agent 的 formal `AgentProfile`。
- 沒有統一描述「這個 agent 可以在哪些 workflow 被呼叫、能讀什麼、能寫什麼、可用哪些 tool、最多花多少時間/成本」。
- action 的 precondition/postcondition 分散在 controller、planner、interviewer、voice、report QA 裡。
- agent 行為目前主要靠 code path 和 tests 定義，不是靠 shared runtime contract 定義。

目前比較像：

```text
controller rules + service functions + localized guards
```

還不是：

```text
AgentProfile + TaskContract + ActionContract + GateResult + EvalPolicy
```

---

## 3. Memory 層現在能不能更新

答案：可以更新，但還不是完整 agent memory layer。

目前已經有兩層 memory：

| Memory | 寫在哪裡 | 用途 | 現在邊界 |
| --- | --- | --- | --- |
| Session-local memory | `SessionAnalysis.agentMemory` | 記錄 topic history、recent patterns、evidence gaps、project usage、friction level。 | 主要支援同一場 interview 的下一題和 report trace。 |
| Reflection records | `SessionAnalysis.reflectionRecords` | 記錄一場 session 中值得保留的 coaching lesson。 | 是 session artifact，不是完整 user profile。 |
| UserCoachingMemory | `UserCoachingMemory.memoryRecords`、`latestSummary` | 保存最近幾條 reflection lesson，讓後續 session 可讀 bounded summary。 | 是 bounded coaching memory，不是完整 progress dashboard，也不應直接當 scoring evidence。 |

Source locators：

- session memory 更新在 [agent memory service](../../backend/src/services/aiControl/agentMemoryService.js)。
- user-level coaching memory 在 [user coaching memory service](../../backend/src/services/aiControl/userCoachingMemoryService.js)。
- `SessionAnalysis` 目前用 Mixed fields 存 `reflectionRecords`、`agentMemory`、`trajectoryRecords`、`agentTraceEvents`，見 [session analysis model](../../backend/src/db/models/sessionAnalysisModel.js)。
- `UserCoachingMemory` schema 目前主要是 `memoryRecords` 和 `latestSummary`，見 [user coaching memory model](../../backend/src/db/models/userCoachingMemoryModel.js)。

缺口：

- 每筆 memory write 沒有固定 `sourceWorkflowRunId`。
- 沒有每筆 memory 的 `sourceEvidenceRefs`。
- 沒有 formal `canAffectScoring`。
- 沒有 reader/writer policy，例如 interviewer 可讀哪些、report 可讀哪些、planner 可讀哪些。
- 沒有把 stale memory、deleted session、deleted CV/JD 對應的 derived memory 清楚關聯起來。

升級 harness 前，memory 不能只回答「有沒有存」。它要回答：

```text
這筆 memory 從哪裡來？
誰寫的？
誰可以讀？
能不能影響下一題？
能不能影響 scoring？
使用者刪資料後它怎麼處理？
```

---

## 4. Agent 行為的可追蹤性現在夠不夠

答案：有 trace，但不夠做 product-agent harness debugging。

目前可追蹤的資料：

| Trace artifact | 位置 | 現在能看什麼 |
| --- | --- | --- |
| `decisionRecords` | `SessionAnalysis.decisionRecords` | controller build context、action selection、report context、report execution 等 decision summary。 |
| `trajectoryRecords` | `SessionAnalysis.trajectoryRecords` | selected action、candidate actions、planner signals、generated question、latest answer、tool/action summary。 |
| `agentTraceEvents` | `SessionAnalysis.agentTraceEvents` | answer evaluated、followup decision、report generation started/completed、voice background quality 等 events。 |
| latency marks | runtime trace object / trace summary | retrieval、planning、model selection、TTS first audio 等局部 latency。 |

Source locators：

- decision record 寫入在 [decision record service](../../backend/src/services/aiControl/decisionRecordService.js)。
- trajectory record 建立在 [trajectory service](../../backend/src/services/aiControl/trajectoryService.js)。
- agent trace event 寫入在 [agent trace service](../../backend/src/services/aiControl/agentTraceService.js)。
- interview turn 會寫 context/action/execution records 和 trajectory，見 [master AI service](../../backend/src/services/masterAiService.js)。

缺口：

- 沒有全局 `workflowRunId` 把 context、retrieval、evaluation、planning、model selection、action execution、memory write、gate result 串起來。
- 沒有 `ExecutionSpan`，所以看不出每一步是同一個 task run 裡的哪個 span。
- 沒有 shared `GateResult`，所以 report QA、question novelty、transcript confirmation、voice confidence、memory policy 不能用同一種方式比較。
- 沒有 formal `FailureClassification`。失敗時還是要靠人看 logs、trace、DB artifacts 推斷是 context、model、tool、policy、verification、latency 還是 environment。
- background jobs 會寫部分 trace，但它們和 foreground run 的因果關係不夠硬。

所以現在 trace 可以回答一部分「發生了什麼」，但還不能穩定回答：

```text
這次 run 用了哪些 context？
哪個 gate warn/block/degrade？
哪個 action contract 被違反？
哪個 memory write 來自哪個 evidence？
如果結果變差，是 retrieval、planner、model selector、interviewer、report QA 還是 voice latency 的問題？
```

---

## 5. 只靠 console.log 為什麼會開始不夠

`console.log` 適合看單點錯誤，不適合看 product-agent workflow。

Kiwi 現在一個 interview turn 可能經過：

```text
session load
-> time/question limit
-> optional warm context
-> retrieval
-> environment build
-> answer understanding
-> evaluator
-> evidence bundle
-> decision context
-> rule fallback plan
-> optional model action selection / voice agent decision
-> action execution
-> question metadata
-> decision records
-> trajectory records
-> trace events
-> reflection memory
-> session memory
```

只靠 log 的問題：

- log 沒有穩定 run id，難以把同一輪的多個 background/foreground event 串起來。
- log 很難查「這個問題為什麼被問」和「它用了哪些 evidence」。
- log 不能當 release gate，不容易比較 before/after。
- log 不能清楚區分 provider failure、bad model output、retrieval low quality、policy block、human review。
- voice latency/debug 需要 structured marks，不是幾行文字。

後續新 feature 如果涉及 agent decision、memory、report、voice、RAG，應該優先寫 structured trace 和 gate result，再補必要 logs。

---

## 6. 現在已經接近 harness 的地方

這些能力可以保留，升級時用 adapter 包起來，不要重寫。

| 現有能力 | 為什麼接近 harness | 升級方式 |
| --- | --- | --- |
| Fixed agent registry | 已經有有限 service surface。 | 包成 `AgentProfile`。 |
| Rule-first action planner | 行動不是完全交給模型。 | 補 `ActionContract`。 |
| Candidate action model selection | 模型只能從 allowed candidates 選。 | 補 gate result、failure reason、run/span id。 |
| Voice decision fast path | voice 模式有 bounded one-shot decision。 | 補 latency budget、voice-specific gate、fallback event。 |
| Report QA blocking flags | report 已經有 publication guard 雛形。 | 包成 `GateResult` / `PublicationGate`。 |
| Claim grounding / report evidence | report claim 已經有 grounding 概念。 | 補 claim id、evidence refs、unsupported claim zero-tolerance gate。 |
| Session memory + UserCoachingMemory | 已經有 session 和 user-level bounded memory。 | 補 `MemoryPolicy` 和 provenance。 |
| Decision/trajectory/trace records | 已經有局部可觀測資料。 | 包成 `WorkflowRun` / `ExecutionSpan` / `AgentEvent` read model。 |

---

## 7. 現在還不能宣稱已經滿足 harness architecture 的地方

| 條件 | 現況 | 判定 |
| --- | --- | --- |
| 每個 agent 都有 formal behavior contract | registry 只有 function map。 | 未滿足 |
| 每個 task 有 objective/scope/success/stop/forbidden behavior | controller 內有邏輯，沒有集中 task contract。 | 部分滿足 |
| 每次 run 有 immutable context packet | decision context 有 snapshot，但不是 ContextPacket contract。 | 部分滿足 |
| 每個 action 有 pre/postcondition、timeout、retry、fallback、idempotency | 部分 action 有 fallback，voice 有 latency marks，沒有 formal action contract。 | 部分滿足 |
| Memory 有 source evidence、reader/writer policy、canAffectScoring | 有 memory write，缺 formal policy。 | 未滿足 |
| Gate 統一表示 pass/warn/block/review/degrade | report QA、voice confidence、question novelty 各自存在。 | 未滿足 |
| Trace 能重建完整 workflow run | 有 decision/trajectory/trace，但缺 shared run/span correlation。 | 部分滿足 |
| Failure 可以分類到 context/tool/model/policy/verification 等 | 目前多靠人工推斷。 | 未滿足 |
| Eval/replay 能比較 before/after | 有 tests/evals，但還不是每個 harness change 的 release gate。 | 部分滿足 |
| Candidate-facing explanation 有 user-safe boundary | report/question reason 有素材，但未形成統一 exposure policy。 | 部分滿足 |

---

## 8. 升級成 harness architecture 前要先滿足的條件

這些是進入 implementation 前的準入條件。沒有完成時，不應直接開始大改架構。

### 8.1 Agent behavior inventory

先把每個 agent-like component 寫成一張表：

```text
component
purpose
caller
input
output
side effects
allowed tools
forbidden behavior
fallback
current tests
harness gaps
```

第一批 component：

- `masterAiService`
- `agentRegistryService`
- `runRetrievalAgent`
- `evaluateInterviewTurn`
- `selectNextAction`
- `selectActionWithModel`
- `resolveVoiceAgentDecisionOnce`
- `executeInterviewAction`
- `runInterviewerAgent`
- `runReportGeneratorAgent`
- `runReportQaAgent`
- `updateAgentMemory`
- `persistUserCoachingMemory`

### 8.2 Task contract inventory

先定義三個最重要 task：

| Task | 必須定義 |
| --- | --- |
| `interview_next_turn` | 何時問下一題、何時 wrap、何時 repair/clarify、何時計為正式題、何時不能再問。 |
| `generate_report` | 哪些 turns 可計分、哪些 claim 可發布、QA 不通過時怎麼處理。 |
| `qa_report` | QA 是 manual recheck、publication gate 還是 repair trigger；結果如何影響 report status。 |

### 8.3 Context and evidence contract

要能回答：

- 本輪用了哪些 CV/JD/transcript/RAG evidence。
- 每個 evidence 的 source type、version、hash、trust level。
- 哪些 user-provided content 只能作 data，不能作 instruction。
- 哪些 claim/question/action 使用了哪些 evidence refs。

### 8.4 Action contract

每個 action 至少要有：

- allowed caller / agent
- input schema
- output schema
- preconditions
- postconditions
- idempotency policy
- concurrency policy
- timeout/deadline
- retry/fallback policy
- cancellation policy
- data classification

### 8.5 Memory policy

每筆 memory write 至少要有：

- source workflow / source turn
- source evidence refs
- writer
- reason
- confidence
- retention class
- can affect scoring or not
- reader policy

### 8.6 Gate and failure taxonomy

先統一這些 gate：

- report claim grounding gate
- report QA publication gate
- transcript confidence / confirmation gate
- question novelty gate
- question counting gate
- action allowed-candidate gate
- memory write policy gate
- retrieval quality gate

每個 gate 都要能輸出：

```text
status: pass | warn | block | review | degrade
reasonCode
evidenceRefs
affectedOutput
fallbackOrNextStep
```

失敗分類至少要包含：

- context
- retrieval
- model output
- tool/action
- policy
- permission
- verification
- latency
- environment
- human review

### 8.7 Observability read model

第一版不一定要先新增永久 collection，但至少要有 read model：

```text
AgentEpisode
WorkflowRun
ExecutionSpan
AgentEvent
GateResult
FailureClassification
```

這些可以先從現有 `decisionRecords`、`trajectoryRecords`、`agentTraceEvents`、report artifacts adapter 出來。

### 8.8 Eval and replay baseline

升級前要先有 baseline：

- unsupported report claim rate
- report repair rate
- question duplicate rate
- no unique question rate
- fallback action rate
- model disallowed action fallback rate
- retrieval limited/failed rate
- memory write coverage
- voice first-audio latency
- trace completeness

沒有 baseline，就不能說 harness upgrade 讓產品更可靠。

---

## 9. 建議第一個 implementation slice

不要先從全產品 runtime rewrite 開始。建議順序：

1. **Current-state inventory 補完**：先把本文件變成可核對的 component inventory。
2. **Report QA / publication gate shadow harness**：report 風險高，又不在 voice hot path，最適合先做 `GateResult` 和 `WorkflowRunView`。
3. **Interview next-turn action contract observe mode**：先觀察 contract violation，不急著 block。
4. **MemoryPolicy wrapper**：補 source evidence、writer、reader、canAffectScoring。
5. **Voice hot-path lightweight gates**：等 trace/gate/read model 穩定後再套進 voice，避免破壞 latency。

---

## 10. 需要後續確認的問題

- `AgentProfile` 第一版要放在 code config、DB snapshot，還是只做 runtime constant？
- `WorkflowRunView` 第一版是否只從現有 `SessionAnalysis` adapter 出來？
- `GateResult` 是否先從 report QA 做，再擴到 transcript/question/action？
- User-level memory 是否只做 coaching，不進 scoring，直到 progress profile 和 policy 完成？
- Candidate-facing explanation 先放 report，還是也要在 match/interview review UI 顯示？
- Background jobs 的 trace 如何跟 foreground `WorkflowRun` 關聯？
- 刪除 CV/session/account 時，derived memory 和 trace artifact 要刪除、redact，還是 tombstone？

---

## 11. 和 guide plan 的關係

這份 inventory 是升級前的現況盤點；[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md) 已記錄每個準入條件的狀態、focused verification 與第一個 shadow slice；[Product Agent Harness Upgrade Guide Plan](../further_plan/agent-harness-architecture-upgrade-plan.md) 是後續升級指南。

閱讀順序建議：

1. 先讀本文件，確認現況與缺口。
2. 再讀 [Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)，看哪些準入條件需要補文件、補測試或重新驗證。
3. 再讀 [Harness Engineering 定義參考](harness-engineering-reference.md)，確認 harness 概念邊界。
4. 最後讀 [Product Agent Harness Upgrade Guide Plan](../further_plan/agent-harness-architecture-upgrade-plan.md)，看後續 roadmap。

Evidence status：除特別標註外，本頁基於 2026-07-15 對 repo-docs 與當前 source 的檢查。它描述 current state，不代表 target harness 已實作。

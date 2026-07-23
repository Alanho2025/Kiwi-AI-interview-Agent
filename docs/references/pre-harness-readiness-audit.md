# Pre-Harness Readiness Audit

狀態：audit run 已完成；這是 pre-implementation readiness snapshot，不改變目前產品行為。
日期：2026-07-15
Repo baseline：`497c21a`

本文件用來決定 Kiwi 是否可以直接進入 harness architecture implementation。結論是：**目前可以進入第一個低風險、shadow-only 的 harness slice，但仍不應直接做完整 harness architecture。**

原因很直接：現在 source 已經顯示 Kiwi 有局部 agentic control、memory、trace、QA gate 和 bounded action selection，但這些能力分散在 controller、agent services、report、voice、memory、trace service 裡。若直接按 target architecture 開工，很容易把「預想中的 agent 行為」誤當成「實際已存在的 agent 行為」。

---

## 1. 狀態標記定義

| 狀態 | 本文件裡的意思 |
| --- | --- |
| 已確認 | 目前 source 或 repo-docs 已有明確證據，且不需要跑新測試就能確認存在。 |
| 部分確認 | 有局部實作或文檔證據，但範圍不完整，或還沒有被 formal contract 統一起來。 |
| 未確認 | 目前沒有看到足夠 source、schema、test 或 docs 證據。不能把它當成現狀。 |
| 需要測試 | 靠靜態閱讀無法確認真實 runtime 行為，需要 focused test、replay、fixture 或現場 run。 |

審計原則：

- `部分確認` 不等於 ready。它只表示有可包裝的現有能力。
- `需要測試` 不等於沒有實作。它表示行為可能存在，但目前還沒有可引用的 runtime 證據。
- `已確認` 只確認 current state，不代表已達 target harness。

---

## 2. 總體判斷

整體 readiness：**Yellow（有條件準入）**。

本輪已完成 current-state inventory、readiness artefact set 與六組 mock focused verification。這證明現有 bounded action、question guard、report QA、retrieval、voice transcript guard 和 retention framework 有回歸測試保護；它不代表 shared runtime contract、recorded-session replay、production voice latency 或 real-model distribution 已確認。

| Readiness area | 狀態 | 判斷 |
| --- | --- | --- |
| Agent/component 清單 | 部分確認 | 主要 agent-like component 已列出；完整 caller/input/output/side-effect/test matrix 尚未完成。 |
| Task contract | 部分確認 | 三個主 task 已有集中 docs 草案；current runtime 尚未用 shared `TaskContract` / `WorkflowRun` result/status mapping enforce。 |
| Action boundary | 部分確認 | 已有 rule-first planning、bounded model selection 與 action contract 草案；current runtime 仍缺 shared action result/gate。 |
| Memory policy | 部分確認 | 產品已核准 user-scoped cross-session adaptive interview memory 與 V0 `canAffectScoring=false`。Legacy runtime 仍只有 session memory、reflection 和 bounded `UserCoachingMemory`。 |
| Trace/observability | 部分確認 | 有 decision/trajectory/trace records，但缺 run/span/gate correlation。 |
| Gate taxonomy | 部分確認 | report QA、voice confidence、question novelty 等 gate 分散存在，缺 shared `GateResult`。 |
| Failure taxonomy | 部分確認 | 已有 pre-harness reason-code 草案；current runtime 尚未統一 emit 或 persist failure classification。 |
| Eval/replay baseline | 部分確認 | 六組 mock focused tests 已形成局部 baseline；recorded-session replay、real AI 與 production baseline 仍未確認。 |
| Candidate-facing explanation boundary | 部分確認 | 產品已核准 developer full-detail / user important-summary 分界；runtime projection/redaction 尚未實作。 |
| Harness implementation readiness | 部分確認 | 產品已核准 `interview_next_turn` shadow/observe first 與 report QA candidate-enforce second；每個 code milestone 仍需 approval，且不能直接開始全域 persistence、voice hot path 或 user-memory schema migration。 |

Focused verification 結果：

| Scope | Result |
| --- | --- |
| Agent | `13 test files / 81 tests` passed |
| Questions | `25 test files / 97 tests` passed |
| Report | `17 test files / 86 tests` passed |
| Retrieval | `10 test files / 32 tests` passed |
| Voice | `22 test files / 81 tests` passed |
| Retention | `15 test files / 55 tests` passed |
| Total | `102 test files / 432 tests` passed |

測試使用 `NODE_ENV=test AI_TEST_MODE=mock`。未執行 real AI eval、browser/live voice、production traffic 或真實 p95 latency 測量；完整紀錄見 [Pre-Harness Baseline Metrics](pre-harness-baseline-metrics.md)。

目前適合做的事：

```text
current-state inventory
-> readiness artefacts
-> focused verification
-> re-classify current agent state
-> choose first harness slice
```

目前不適合做的事：

```text
直接新增完整 harness runtime
直接把所有 service 改成 AgentRun
直接上 persistence schema
直接把 gate/block 放進 voice hot path
```

---

## 3. 準入條件審計表

### 3.1 Agent behavior inventory

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| 列出所有正式 agent/service surface | 已確認 | `agentRegistry` 固定暴露 `retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator`。 | registry 只列 callable function，沒有行為 contract。 | 把 registry 轉成第一版 `AgentProfile` 草案。 |
| 列出 controller 和 task runner 職責 | 已確認 | `runTask` 支援 `interview_next_turn`、`generate_report`、`qa_report`。 | controller 內部流程很長，責任仍散在多段 service call。 | 為每個 task 補 call sequence 和 side effects。 |
| 每個 component 的 input/output/side effects | 部分確認 | current-state inventory 已列主要作用、邊界與 harness gap。 | background jobs、caller、persistence side effects 尚未逐列完整展開。 | 把第一版 inventory 擴成完整 component behavior matrix。 |
| 每個 component 的 current tests | 部分確認 | 六組 focused test 已記錄，主要 component 有 local test anchors。 | tests 尚未和每個 component contract 一對一映射。 | 建立 component-to-test matrix。 |
| 每個 component 的 forbidden behavior | 部分確認 | task/action/memory contract 草案已列部分 forbidden behavior。 | 還沒有每個 component 的完整 `AgentProfile` forbid list。 | 在第一版 `AgentProfile` 草案補齊。 |

判斷：這一區是 **部分確認**。可以開始做 inventory 補強，但還不能說 agent behavior 已經清楚定義。

### 3.2 Task contract inventory

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| `interview_next_turn` task 存在 | 已確認 | `runTask` 會載入 session 並呼叫 interview controller。 | task contract 沒有集中定義。 | 定義 objective、inputs、outputs、stop conditions、forbidden behavior。 |
| `generate_report` task 存在 | 已確認 | `runTask` 會呼叫 report controller。 | publication criteria 分散在 report generator、QA、persist flow。 | 定義 report task contract 和 publication policy。 |
| `qa_report` task 存在 | 已確認 | `runTask` 支援 manual QA existing report。 | QA result 對 publication/repair/review 的語義未 formalize。 | 定義 QA task 是 recheck、gate 還是 repair trigger。 |
| task-level success criteria | 部分確認 | task contract 草案已整理 return result、report QA、question/time limit 與 stop semantics。 | current runtime 沒有 shared success/failure schema。 | shared kernel 先以 shadow `WorkflowRun.resultRefs` 與分離 status 驗證 mapping。 |
| task-level forbidden behavior | 部分確認 | 三個主 task 的 docs 草案已列不可做事項。 | current runtime 未以 shared contract 驗證或記錄 violation。 | 先 observe violation，不改 legacy control flow。 |

判斷：這一區是 **部分確認**。task 路由存在，但 formal task contract 未完成。

### 3.3 Context and evidence contract

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| interview turn 會建 retrieval/context | 已確認 | interview controller 會 index artifacts、run retrieval、build environment、build decision context。 | context 沒有 immutable packet id。 | 設計 `ContextPacket` read model。 |
| report flow 會取 report evidence | 已確認 | report controller 取 CV/JD/interview plan/prepared pool/transcript sources。 | evidence refs 和 report claim 的 mapping 未統一到 shared contract。 | 對 report slice 建 claim-to-evidence map。 |
| retrieval agent 有 source selection 和 quality assessment | 已確認 | retrieval agent 依 objective 選 source，並做 corrective retry。 | quality result 還不是 shared gate。 | 包成 `retrieval_quality` GateResult。 |
| user-provided content 作 data 不作 instruction | 部分確認 | guide plan 和 prompt rules 有此方向；部分 services 做 safety/guard。 | 沒有 `instructionUseAllowed=false` 這類 runtime metadata。 | 在 `ContextPacket` 草案加入 trust metadata。 |
| context version/hash/trust level | 未確認 | current source 沒有 formal ContextPacket schema。 | 無統一 context hash/version/trustLevel。 | 先做 shadow read model，不急著新增 collection。 |

判斷：這一區是 **部分確認**。context 有被組裝，但不是 harness-grade context contract。

### 3.4 Action contract

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| action enum 和 candidate actions | 已確認 | action planner 建 candidate actions，含 priority、reason、evidenceNeed、risk、actionInput。 | 不是完整 contract。 | 從現有 candidate action 產出 `ActionContract` 草案。 |
| model 只能選 allowed action | 已確認 | model action selector 和 voice decision fast path 都檢查 selected action 是否在 allowed set。 | gate result 未統一保存。 | 建立 `action_allowed_candidate` gate。 |
| fallback on invalid model output | 已確認 | disallowed action、invalid JSON/provider failure 會回 fallback plan。 | failure reason 未分類到 shared taxonomy。 | 補 `model_output_invalid` / `disallowed_action` reason code。 |
| action preconditions/postconditions | 部分確認 | time limit、question limit、mode boundaries、question metadata 已整理到 action contract 草案。 | current runtime 沒有 shared contract validator。 | 第一版只 observe top action contract。 |
| idempotency/concurrency/cancellation | 需要測試 | voice/client turn、question persistence 可能有局部防護。 | 靜態閱讀不足以確認 duplicate speech/end retry 不產生雙題。 | 寫 duplicate turn/retry replay tests。 |
| deadline/cost/budget | 部分確認 | voice path 有 latency marks 和 fast path；usage metadata 有成本/operation metadata。 | action-level maxModelCalls、deadline、cost 未 formalize。 | 第一版只對 voice/interview next turn 設 deadline。 |

判斷：這一區是 **部分確認**。已有 bounded action selection，是最接近 harness 的部分之一，但還不是 formal action contract。

### 3.5 Memory policy

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| session-local memory 存在 | 已確認 | `agentMemory` 記錄 topic history、patterns、evidence gaps、project usage。 | mixed schema，沒有 per-write provenance。 | 補 memory write envelope。 |
| UserCoachingMemory 存在 | 已確認 | user-level memory 存 `memoryRecords` 和 `latestSummary`。 | 是 bounded coaching memory，不是 full progress profile。 | 明確標 `no direct scoring` policy。 |
| Target user interview learning memory | 產品已核准 / runtime 未實作 | 產品要求跨 session 理解使用者、避免例行重問已多次證明的內容並提高問題深度。 | 缺 user/role/competency/question-family aggregation、promotion/revalidation、planner/evaluator isolation。 | 先做 shadow memory projection 和 replay fixtures，不直接改 scoring。 |
| reflection records 寫入 | 部分確認 | interview controller 會在符合條件時寫 reflection 並同步 UserCoachingMemory。 | 哪些 reflection 可以跨 session 使用還未 formalize。 | 補 reflection memory policy。 |
| source workflow / evidence refs | 未確認 | 現有 memory service 未保存固定 `sourceWorkflowRunId`、`sourceEvidenceRefs`。 | 缺 provenance。 | 每筆 memory write 增加 source refs 草案。 |
| reader/writer policy | 部分確認 | policy 草案已盤點 controller/memory writer 與 planner/report reader。 | current runtime 沒有集中 enforce。 | 實作前逐一驗證 legacy read/write call site。 |
| `canAffectScoring` | 產品已核准 / runtime 未實作 | User memory 可影響 planning/question selection/depth；V0 `canAffectScoring=false`。 | current schema 沒有 runtime field，planner/evaluator packet 尚未隔離。 | 第一版 shadow envelope明確輸出 false，增加 context-isolation fixture。 |
| deletion/retention propagation | 原則已核准 / 需要測試 | models 有 retention/deleted fields 和 retention index 線索。 | contribution-level delete/recompute/redact 與無內容 tombstone 尚未驗證。 | 補 retention/deletion/recompute path tests 或 audit。 |

判斷：這一區是 **部分確認**。memory 可更新，但還沒有達到 harness memory policy。

### 3.6 Gate taxonomy

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| report QA gate | 已確認 | report QA 有 blocking flags 和 coverage/quality checks。 | 還不是 shared `GateResult`。 | 從 report QA 先 adapter 成 `GateResult`。 |
| claim grounding gate | 部分確認 | report generator 有 claim grounding 和 evidence diagnostics。 | claim id、evidence refs、publication gate 未統一。 | 建 `report_claim_grounding` gate。 |
| transcript confidence / confirmation gate | 部分確認 | voice docs/source 有 transcript confidence/review policy。 | 和 report/interview gate 表示不同。 | 建 `transcript_eligibility` gate。 |
| question novelty/counting gate | 部分確認 | interviewer/question metadata 有 novelty/dedupe/counting concept。 | gate outcome 沒有 shared representation。 | 建 `question_quality` gate。 |
| action allowed-candidate gate | 部分確認 | selector 會檢查 allowed action。 | gate result 未持久化為 shared artifact。 | 建 `action_allowed_candidate` gate。 |
| memory write policy gate | 未確認 | memory service 直接更新 memory。 | 沒有 memory write gate。 | 建 `memory_write_policy` gate。 |
| retrieval quality gate | 部分確認 | retrieval quality assessment 存在。 | 未接入 shared gate vocabulary。 | 建 `retrieval_quality` gate。 |

判斷：這一區是 **部分確認**。已有多個局部 gate，但沒有 shared gate taxonomy。

### 3.7 Failure taxonomy

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| context failure | 未確認 | 部分 degraded reason 或 diagnostics 可推斷。 | 沒有正式 reason code。 | 定義 `context_missing`、`context_stale`、`context_untrusted_instruction`。 |
| retrieval failure | 部分確認 | retrieval agent 有 `retrievalFailed`、`retrievalErrors`、quality reasons。 | 未映射到 shared failure taxonomy。 | adapter 成 `retrieval_failed`、`retrieval_low_alignment`。 |
| model output failure | 部分確認 | invalid JSON、disallowed action 會 fallback。 | 未統一 failure classification。 | adapter 成 `model_invalid_json`、`model_disallowed_action`。 |
| tool/action failure | 未確認 | action execution 可能有 fallback，但 taxonomy 未集中。 | 缺 shared reason code。 | 從 interview action executor 盤點 failure modes。 |
| policy/permission failure | 未確認 | 有 auth/session ownership/guards，但不是 agent harness taxonomy。 | 缺 harness-level policy failure。 | 分開 product auth 和 harness policy。 |
| verification failure | 部分確認 | report QA flags、claim grounding diagnostics 存在。 | 未統一到 failure taxonomy。 | adapter report QA flags。 |
| latency failure | 需要測試 | latency marks 存在。 | 未定義 failure threshold 和 regression baseline。 | 建 voice/interview latency baseline。 |
| human review failure/waiting | 未確認 | transcript/report review concept 存在。 | 沒有 shared review state/resume semantics。 | 定義 `HumanReviewGate` 狀態。 |

判斷：這一區是 **部分確認**。已建立 [Pre-Harness Failure Taxonomy](pre-harness-failure-taxonomy.md) 作為 reason-code 草案，但 current runtime 還沒有統一 classification adapter。

### 3.8 Observability read model

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| `decisionRecords` | 已確認 | session analysis schema 和 decision service 已存在。 | 記錄不是 workflow/span 結構。 | adapter 到 `ExecutionSpan` 或 decision event。 |
| `trajectoryRecords` | 已確認 | trajectory service 會記 selected action、candidate actions、planner signals。 | 不等於完整 run timeline。 | adapter 到 action span。 |
| `agentTraceEvents` | 已確認 | trace service push events 到 session analysis。 | event id 不含 workflow/span correlation。 | 補 correlation id。 |
| `WorkflowRunView` | 未確認 | 尚未存在 formal read model。 | 無 shared run unit。 | 第一版用 adapter，不先加 collection。 |
| `ExecutionSpan` | 未確認 | trajectory/decision 可映射部分 span。 | 無 formal span schema。 | 定義 shadow span mapping。 |
| `GateResult` | 未確認 | 局部 gate output 存在。 | 無 shared gate model。 | 從 report QA gate 開始。 |
| background job correlation | 需要測試 | background jobs 會寫 memory/trace/records。 | 因果關係需要 runtime verification。 | 對 single interview turn 做 replay trace audit。 |

判斷：這一區是 **部分確認**。原始 trace 資料存在，但 formal read model 未完成。

### 3.9 Eval and replay baseline

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| unit/robustness tests 存在 | 已確認 | repo-docs 指向 agent、question、report、voice、retrieval robustness tests。 | tests 還不是 pre-harness baseline matrix。 | 建 readiness test matrix。 |
| report QA baseline | 部分確認 | `npm run test:report` 通過 `17 files / 86 tests`。 | 缺 production unsupported-claim rate、repair rate。 | 後續用 replay/observed metrics 補 rate baseline。 |
| interview action baseline | 部分確認 | `test:agent` 與 `test:questions` 合計通過 `38 files / 178 tests`。 | 沒有 aggregate fallback rate，也未驗證 duplicate client event。 | 建 recorded turn replay 與 idempotency assertions。 |
| memory write baseline | 部分確認 | agent memory policy tests 和 retention groups 通過。 | legacy shape 沒有 provenance、reader/writer 與 scoring-policy fields。 | 先做 shadow memory envelope，保留 `canAffectScoring=false`。 |
| voice latency baseline | 部分確認 | `npm run test:voice` 通過 `22 files / 81 tests`，包含 mock acceptance gate。 | mock timing 不能代表真實 STT/TTS/network p95。 | 另跑 recorded/live latency benchmark。 |
| replay dataset | 需要測試 | 已列出 fixture contract 和 local test anchors。 | 尚未建立 recorded-session input、expected gates 與 before/after diff。 | 建最小 3 條 deterministic replay fixtures。 |

判斷：這一區是 **部分確認**。focused mock baseline 已完成，但 replay、real-model 與 production baseline 仍是 open gate。

### 3.10 Candidate-facing explanation boundary

| 條件 | 狀態 | 現有證據 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- |
| report 能展示 evidence/feedback | 部分確認 | report generator 有 evidence references、candidate feedback、claim grounding。 | user-safe explanation policy 未集中定義。 | 定義 report explanation allowlist。 |
| question reason 有素材 | 部分確認 | interviewer output metadata 有 whyThisQuestion、evidenceUsed、questionDecision。 | live/post-session 展示策略未 formalize。 | 先只允許 post-session summary。 |
| raw internal trace 不應直接展示 | 部分確認 | guide plan 已明確禁止 raw chain-of-thought。 | runtime redaction policy 未集中。 | 定義 internal trace redaction policy。 |
| candidate-visible memory explanation | 產品已核准 / runtime 未實作 | 一般使用者只看重要、非技術性的 progress、evidence、下一步練習摘要；developer 才看完整 trace。 | 尚未建立 projection allowlist、redaction 和 UI placement。 | 先建 candidate-safe progress summary contract，不暴露 raw memory/trace。 |

判斷：這一區是 **部分確認**。有素材，但未形成產品級 exposure policy。

---

## 4. Readiness artefacts 清單

在進入 harness implementation 前，至少要產出這些 artefacts：

| Artefact | 狀態 | 目的 | 建議位置 |
| --- | --- | --- | --- |
| Component behavior table | 部分確認 | 已列主要 agent-like component、現有邊界與 harness gap；caller/input/output/test 還未全部一對一展開。 | [Kiwi Agent 現況盤點](agent-current-state-inventory.md) |
| Task contract inventory | 部分確認 | 三個 task 已有 objective、inputs、output、stop、forbidden behavior 與 side-effect 草案；runtime 沒有 shared schema。 | [Pre-Harness Task Contracts](pre-harness-task-contracts.md) |
| Action contract draft | 部分確認 | 已 cover 核心 interview/report actions；idempotency、deadline、budget 尚未 runtime enforce。 | [Pre-Harness Action Contracts](pre-harness-action-contracts.md) |
| Memory policy draft | 部分確認 | 已定義 reader/writer、provenance、scoring 與 retention 目標；legacy schema 尚未實作。 | [Pre-Harness Memory Policy](pre-harness-memory-policy.md) |
| Gate taxonomy | 部分確認 | 已統一 pass/warn/block/review/degrade vocabulary；current gates 尚未 adapter 成 shared artifact。 | [Pre-Harness Gate Taxonomy](pre-harness-gate-taxonomy.md) |
| Failure taxonomy | 部分確認 | 已定義 reason-code families；current failure paths 尚未統一 emit。 | [Pre-Harness Failure Taxonomy](pre-harness-failure-taxonomy.md) |
| Trace coverage map | 部分確認 | 已對照 decision/trajectory/trace 到 target run/span/gate；缺 correlation id。 | [Pre-Harness Trace Coverage](pre-harness-trace-coverage.md) |
| Baseline metrics note | 部分確認 | 六組 mock focused tests 已記錄；production/real AI/rate metrics 未完成。 | [Pre-Harness Baseline Metrics](pre-harness-baseline-metrics.md) |
| Replay fixture list | 需要測試 | fixture contract 和 candidate cases 已列出；尚無 recorded-session replay runner/dataset。 | [Pre-Harness Replay Fixtures](pre-harness-replay-fixtures.md) |

這些 artefacts 可以先是 docs，不一定一開始就要新增 runtime schema。

---

## 5. 本輪執行結果

### Step 1：補完 component behavior table

狀態：部分確認；第一版 inventory 已建立。

目標是把「我們覺得 agent 在做什麼」改成「source 已確認它做什麼」。這一步要列出 caller、input、output、side effects、fallback、tests。

完成條件：

- 每個 agent-like component 都有一列。
- 每列至少有 source locator。
- 每列都有 harness gap。
- 每列都有 current tests 或標 `未確認`。

### Step 2：補 task/action/memory/gate 四份 contract 草案

狀態：已完成 docs 草案；runtime enforcement 維持部分確認。

這一步不改 runtime，只把 contract 寫出來。寫出來後，才能用它回頭檢查現在 source 是否符合。

完成條件：

- `interview_next_turn`、`generate_report`、`qa_report` 有 task contract。
- Top interview actions 有 action contract。
- Memory policy 明確標 `canAffectScoring`。
- Gate taxonomy 有 status、reasonCode、evidenceRefs、fallbackOrNextStep。

### Step 3：跑 focused verification

狀態：本輪 selected mock verification 已完成；recorded/live/real AI verification 仍需要測試。

這一步用測試或 replay 驗證靜態閱讀無法確認的行為。

本輪已跑：

- report QA focused tests
- interview turn/question metadata tests
- memory grounding/policy tests
- retrieval robustness tests
- voice transcript confirmation / latency mock tests

完成條件：

- 每個測試輸出被記錄到 baseline metrics note。
- 每個失敗要標成 context/retrieval/model/action/policy/verification/latency/environment/human review 其中一類，沒有分類就更新 taxonomy。

### Step 4：重新確認 current agent state

狀態：本輪重新確認已完成。

完成前面三步後，才能重新判斷 Kiwi 目前 agent state。建議用成熟度標記：

| Level | 條件 |
| --- | --- |
| H0 | 只有 service workflow，缺 shared trace/gate/memory policy。 |
| H1 | 有 shadow read model，可重建主要 workflow。 |
| H2 | 有 observed contracts，可記錄 violation/warn/degrade。 |
| H3 | 高風險 gate 可 block/fallback/human review，且有 replay baseline。 |

重新確認後，Kiwi 整體仍在 **H0 到局部 H1/H2 之間**。Report QA、bounded action selection、question guard 和局部 trace 有 source 與 mock test 證據，接近局部 H1/H2；shared `WorkflowRun`、memory provenance、failure adapter、shared gate artifact 和 replay dataset 仍停在 H0/H1。測試通過沒有改變這個架構邊界。

---

## 6. 目前不應跳過的風險

| 風險 | 為什麼不能跳過 |
| --- | --- |
| 以為 agent behavior 已清楚定義 | registry 是 function map，不是 behavior contract。 |
| 把已核准的 memory target 當成 current progress loop | Current `UserCoachingMemory` 仍只是 bounded coaching summary；user-level adaptive depth/coverage memory 尚未實作。 |
| 以為 trace 已足夠 debug | 現有 trace 沒有 workflowRun/span/gate correlation。 |
| 以為 report QA gate 可直接泛化 | report QA 是強局部 gate，但 gate taxonomy 還沒統一。 |
| 以為 voice path 可直接加重型 harness | voice 有 latency target，應最後做 lightweight hardening。 |
| 以為 mock baseline 等於完整 eval/replay | focused tests 已整理成 local baseline，但仍沒有 recorded-session before/after、real-model distribution 或 production metrics。 |

---

## 7. Audit 後的 architecture clarification package

Runtime implementation 前先完成三個跨產品產物：

1. [Product Harness Boundary Map](../further_plan/product-harness-boundary-map.md)：確認 CV-JD、question、interview、memory、report、QA、voice 的 agent/tool/context/gate/memory/channel 邊界。
2. [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md)：定義 `WorkflowRun`、`TaskContract`、`ContextPacket`、`ActionContract`、`GateResult`、`MemoryWrite`、`FailureClassification`。
3. [Product Harness Contract Pressure Tests](../further_plan/product-harness-contract-pressure-tests.md)：用 CV-JD match、interview next turn、memory update、report QA 四個 case 驗證架構表達力。

Pressure test 提出的 rollout 建議是：

- 第一個 observe-mode slice：`interview_next_turn`，因為它同時驗證 context、action、question、state、memory 和 channel；不改 legacy output/fallback。
- 第一個 enforceable gate slice：report QA，因為 blocking/publication semantics 最清楚，且不受 voice hot-path latency 影響。

已核准的產品語義：agent/workflow 分類、user-level adaptive interview memory、report QA publication policy、refs-first privacy/deletion、voice same-run confirmation、developer/user observability 分界。

Runtime 前仍需關閉：run persistence、background correlation、redacted snapshot allowlist/retention、contract code ownership、user-memory promotion/revalidation threshold與 enforce threshold。Rollout、Memory V0 no-scoring、voice resume 與 source deletion 原則已核准，但仍需 runtime replay/propagation 測試。

---

## 8. 相關文件

- [Harness Goal](../harness/goal.md)
- [M1 Proposed Spec](../harness/spec.md)
- [Harness Execution Rules](../harness/AGENTS.md)
- [Kiwi Agent 現況盤點](agent-current-state-inventory.md)
- [Pre-Harness Task Contracts](pre-harness-task-contracts.md)
- [Pre-Harness Action Contracts](pre-harness-action-contracts.md)
- [Pre-Harness Memory Policy](pre-harness-memory-policy.md)
- [Pre-Harness Gate Taxonomy](pre-harness-gate-taxonomy.md)
- [Pre-Harness Failure Taxonomy](pre-harness-failure-taxonomy.md)
- [Pre-Harness Trace Coverage](pre-harness-trace-coverage.md)
- [Pre-Harness Baseline Metrics](pre-harness-baseline-metrics.md)
- [Pre-Harness Replay Fixtures](pre-harness-replay-fixtures.md)
- [Product Harness Boundary Map](../further_plan/product-harness-boundary-map.md)
- [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md)
- [Product Harness Contract Pressure Tests](../further_plan/product-harness-contract-pressure-tests.md)
- [Harness Engineering 定義參考](harness-engineering-reference.md)
- [Product Agent Harness Upgrade Guide Plan](../further_plan/agent-harness-architecture-upgrade-plan.md)
- [Agent registry 與 task runner](../../repo-docs/modules/agent-registry-and-task-runner.md)
- [Agent memory 與 trace](../../repo-docs/modules/agent-memory-and-trace.md)
- [访谈控制机制](../../repo-docs/modules/feature-interview-control.md)

Evidence status：除特別標註外，本頁基於 2026-07-15 對 current-state inventory、repo-docs、當前 source 與 `102 test files / 432 mock tests` 的檢查。它是 readiness audit，不代表 target harness 已實作。

# Product Harness Contract Pressure Tests

狀態：architecture pressure test completed；只驗證設計表達力，不代表 runtime contract 已實作。
日期：2026-07-15

本文件用四個 Kiwi 代表 case 壓測 [共享 Contract Spine](product-harness-contract-spine.md)。目的不是證明 schema 看起來完整，而是確認它能同時描述 evidence lineage、agent action/state change、memory policy 和 report publication，不需要為每個 feature 發明另一套頂層 contract。

相關文件：[Harness Boundary Map](product-harness-boundary-map.md)、[Pre-Harness Replay Fixtures](../references/pre-harness-replay-fixtures.md)、[Pre-Harness Baseline Metrics](../references/pre-harness-baseline-metrics.md)。

---

## Overview

這份 pressure test 用四個不同風險面的產品 case 驗證 shared contract 是否真的跨產品，而不是只適合 report。結果同時區分 contract 表達力與 current runtime readiness。

## Requirements

- 四個 case 必須同時覆蓋 evidence lineage、action/state transition、memory policy、verification/publication。
- 每個 case 必須列出 current evidence、BDD scenario、七個 contract mapping 與 runtime gap。
- 不適用的 contract 必須明確標記，不得為了完整性把所有 helper 包成 agent/action。
- 只有四個 case 都不需要 feature-specific top-level schema，spine 才算通過架構壓測。

---

## 1. Pressure-test Method

每個 case 都要回答：

1. 輸入 evidence 從哪裡來，版本/review/trust 是否可追蹤。
2. 哪個 task/run 擁有 lifecycle。
3. 哪個 action 可以改變 state，誰允許它執行。
4. 哪個 gate 能 pass/warn/block/review/degrade，阻擋範圍是什麼。
5. 是否產生 memory write，該 write 能不能影響 planning/scoring。
6. failure、fallback、best-effort error 或 human waiting 如何分類。
7. output/artifact/state change 是否能被 replay assertion 驗證。

判定：

| 結果 | 意思 |
| --- | --- |
| 可表達 | 七個 contract 已足夠描述 case，不需新增 feature-specific top-level contract。 |
| 需補欄位 | Contract family 正確，但原草案缺少跨 case 必要欄位；已回補到 spine。 |
| Runtime gap | 設計可表達，但 current source 沒有足夠欄位或 enforcement。 |
| 不適用 | 該 case 合理地不使用此 contract，不能為了填滿表格硬套。 |

---

## 2. Case A：CV-JD Match Evidence and Review Lineage

### Current behavior evidence

- [CV analysis service](../../backend/src/services/cv/cvAnalysisService.js) 要求 `jdRubric.roleFit`，並用 owner、`jdFingerprint`、review version、Role-Fit profile ID 驗證 reviewed company/role understanding。
- [Analyze controller](../../backend/src/controllers/analyzeController.js) 執行 match、usage record、match persistence，之後 best-effort 建 JD question filter。
- [Match analysis record service](../../backend/src/services/cv/matchAnalysisRecordService.js) 產生 `matchAnalysisId`，保存 match artifact、evidence refs、warnings、retention。
- [Session persistence](../../backend/src/services/session/sessionPersistenceService.js) 將 `roleEvidenceMap`、source snapshots 和 `retrievalSnapshots[{matchAnalysisId,evidenceRefs}]` 帶入 session analysis。
- Match robustness tests 已確認未 verified/只靠 legacy client marker 的 JD review 不能開啟新 match。

### BDD scenarios

```gherkin
Scenario: Verified CV-JD inputs produce a traceable match artifact
  Given an owned CV artifact
  And a persisted JD Role-Fit profile with fingerprint, profile ID, and verified review version
  When the cv_jd_match task runs
  Then the ContextPacket records both source artifact versions and review lineage
  And the WorkflowRun returns a versioned match artifact and evidence references
  And the task cannot claim completion without a persisted match artifact reference

Scenario: Unverified or stale JD review blocks match
  Given a JD Role-Fit profile whose review is edited, missing, stale, or not owned by the user
  When the cv_jd_match task is requested
  Then a GateResult blocks the task with blockingScope task
  And no match artifact is persisted
  And the failure is classified as context or policy failure rather than model failure

Scenario: Best-effort question filter fails after match persistence
  Given a valid match artifact has already been persisted
  When question-filter generation fails
  Then the main WorkflowRun may complete with qualityStatus degraded
  And FailureClassification records a handled tool_or_side_effect_failure
  And the persisted match artifact remains the result source of truth
```

### Contract mapping

| Contract | Mapping | 結果 |
| --- | --- | --- |
| `WorkflowRun` | `taskType=cv_jd_match`，run 從 owned/reviewed input load 到 match artifact persistence。 | 需補欄位：需要 `episodeId`、result refs、best-effort side effects；已加入 spine。 |
| `TaskContract` | `workflowKind=guarded_workflow`；success 要求 match artifact ref；forbid unreviewed/stale/unowned JD。 | 可表達。也證明 TaskContract 不只服務 registry agent。 |
| `ContextPacket` | CV ref、JD ref、`jdFingerprint`、Role-Fit profile/review version、trust level、source snapshots。 | 需補欄位：`reviewStatus`、artifact version/hash；已加入 spine。 |
| `ActionContract` | Pure comparison 不需要硬包成 agent action；persistence 由 task side-effect policy 管理。 | 不適用於 pure match computation；這是刻意邊界。 |
| `GateResult` | `jd_role_fit_review_verified`、ownership/fingerprint/version gate；block task。 | 可表達。 |
| `MemoryWrite` | Match artifact 是 domain artifact，不是 coaching/session memory。 | 不適用。 |
| `FailureClassification` | 未 verified input、match failure、question-filter best-effort failure 可分開。 | 需補欄位：`handled`、`expected`、`userImpact`；已加入 spine。 |

Pressure finding：contract spine 必須涵蓋非 agent workflow；否則 CV-JD lineage 會被排除在 product harness 外。它不需要把 match service 假裝成 autonomous agent。

---

## 3. Case B：Interview Next Turn Action, Question, and State Change

### Current behavior evidence

- [Master AI service](../../backend/src/services/masterAiService.js) 在 `interview_next_turn` 依序建立 environment/evaluation/evidence/decision context、rule fallback candidates、bounded model selection、action execution、decision/trajectory/trace records、question metadata 和 memory writes。
- Model action selector 和 voice decision fast path 都不能選 candidate set 以外的 action；invalid/error 會回 rule fallback。
- Question output 保存 `controllerAction`、`fallbackAction`、`selectionSource`、question source、parent/root relation、counting metadata 和 rank/decision data。
- Agent/question/voice mock baseline 已通過；duplicate client event/idempotency replay 尚未建立。

### BDD scenarios

```gherkin
Scenario: Interview turn chooses and executes an allowed action
  Given a session state, latest candidate answer, prepared question pool, match evidence, and session memory
  When interview_next_turn evaluates and plans the next step
  Then WorkflowRun records stateBeforeRef and stateAfterRef
  And the selected action exists in the candidate action set
  And the resulting question or completion state satisfies the ActionContract postconditions
  And question metadata records source, reason, counting, and parent/root relationship

Scenario: Model returns invalid or disallowed action output
  Given a valid rule fallback plan and candidate action set
  When model-assisted selection returns invalid JSON or an action outside the set
  Then action_allowed_candidate produces a non-pass GateResult
  And the bounded fallback action is executed
  And FailureClassification marks the model failure handled with no unclassified product failure

Scenario: Voice transcript requires confirmation
  Given channel voice and a contentful high-risk or low-confidence transcript
  When transcript eligibility is evaluated
  Then the same interview run enters waiting or produces a non-countable confirmation turn
  And scoring and next-question action remain blocked until confirmation
  And no separate voice product workflow is invented
```

### Contract mapping

| Contract | Mapping | 結果 |
| --- | --- | --- |
| `WorkflowRun` | 一個 candidate answer -> evaluate/plan/action/question/state change；`channel=text|voice`。 | 需補欄位：state before/after、client turn、waiting；已加入 spine。 |
| `TaskContract` | Objective、required context、allowed actions、stop conditions、forbidden counting/scoring behavior。 | 可表達；current runtime 尚無 shared schema。 |
| `ContextPacket` | Session state、latest answer、match evidence、question history/pool、retrieval、session/user memory refs。 | 可表達；current context 沒有 immutable packet/version。 |
| `ActionContract` | Selected/fallback/candidate actions、pre/postconditions、idempotency、deadline、side-effect target。 | 可表達；idempotency 和 allowed callers仍是 runtime gap。 |
| `GateResult` | allowed candidate、question novelty/counting、transcript eligibility、precondition gate。 | 可表達；current gates 尚未 shared persist。 |
| `MemoryWrite` | Turn 後的 `agentMemory`、reflection、UserCoachingMemory write 必須回綁 run。 | 可表達；current background jobs 缺 run correlation/provenance。 |
| `FailureClassification` | model invalid/disallowed、action precondition、question persistence、latency、human confirmation。 | 可表達。 |

Pressure finding：這是最能驗證 shared observability 的核心 case。第一個 observe-mode runtime slice 應優先用 `interview_next_turn`，因為它同時壓到 context、action、question、state、memory 和 channel；第一版不得 block 現有合法 fallback。

---

## 4. Case C：Memory Update Provenance and Scoring Boundary

### Current behavior evidence

- [Agent memory service](../../backend/src/services/aiControl/agentMemoryService.js) 將 topic history、patterns、evidence gaps、project usage、strategy outcome 和 friction 寫回 `SessionAnalysis.agentMemory`。
- `agentMemory.projectUsage` 已會影響 planner 的 project-shift decision，因此 memory 不是完全 inert。
- [User coaching memory service](../../backend/src/services/aiControl/userCoachingMemoryService.js) 將 reflection 轉成 bounded `memoryRecords` 和 `latestSummary`。
- Current write shape 沒有固定 `workflowRunId`、source evidence refs、reader allowlist、policy version 或 `canAffectScoring`。

### BDD scenarios

```gherkin
Scenario: Session memory write keeps source and planning authority explicit
  Given an interview_next_turn run with selected action, outcome, turn ID, and evidence references
  When a session memory update is proposed
  Then MemoryWrite records the source run, source turn, writer, evidence references, and policy version
  And memory_write_policy evaluates before commit
  And the committed memory may affect planning only according to its allowlist

Scenario: User interview memory changes coverage or depth without changing scoring evidence
  Given multiple independent sessions contain grounded strong evidence for the same applicable role competency and question family
  When the MemoryWrite is evaluated
  Then scope is user_interview
  And the question planner may suppress routine repetition, choose another coverage gap, or increase question depth
  And canAffectScoring is false
  And the evaluator scoring ContextPacket does not treat historical memory as the current answer
  And the candidate sees only an allowlisted progress summary rather than internal memory trace

Scenario: Stale or role-mismatched memory cannot suppress an interview question
  Given user interview memory whose role applicability is different, freshness expired, or source evidence conflicts
  When the next question is planned
  Then the memory applicability or revalidation GateResult does not pass
  And routine question suppression is not allowed
  And the planner may ask a revalidation question

Scenario: Memory write has no provenance
  Given a derived memory value without source WorkflowRun or evidence references
  When memory_write_policy evaluates the write
  Then the GateResult blocks memory_write
  And MemoryWrite status becomes rejected
  And FailureClassification uses memory_policy_failure with memory_provenance_missing
```

### Contract mapping

| Contract | Mapping | 結果 |
| --- | --- | --- |
| `WorkflowRun` | Memory write 是來源 interview/report run 的 side effect；不預設建立獨立 agent run。 | 可表達。 |
| `TaskContract` | 來源 task 宣告允許的 memory scope/type/side effect。 | 可表達；需在各 task contract 補 allowed memory writes。 |
| `ContextPacket` | 後續 memory read 必須出現在 purpose-specific packet，才能知道它影響了 planning/question depth/report 哪一段，並與 evaluator scoring packet 隔離。 | 可表達；current read provenance不足。 |
| `ActionContract` | Memory write 通常不是 model-selectable interview action；由 task side-effect + memory gate 管理。 | 不適用於一般 write；若未來有 autonomous consolidation action 再建立。 |
| `GateResult` | source、scope、promotion、applicability、freshness、conflict、scoring、visibility、retention gate。 | 可表達；promotion/revalidation threshold 尚待產品決策。 |
| `MemoryWrite` | proposed/committed/rejected、source、reader、planning/question-selection/depth/scoring authority、retention/delete。 | 需補欄位：user interview scope、depth/repeat policy、source-delete behavior；已加入 spine。 |
| `FailureClassification` | provenance/scope/scoring/retention policy violation。 | 可表達；current runtime adapter不存在。 |

Pressure finding：contract design 可以表達產品 owner 核准的 user-scoped cross-session interview learning target，但 current runtime 明確不 ready。Current `UserCoachingMemory` 只能當 adapter source；在 provenance、run correlation、promotion/revalidation gate 和 planner/evaluator context isolation 完成前，不能宣稱已具備 adaptive progress-learning memory。

---

## 5. Case D：Report QA Verification, Review, and Publication

### Current behavior evidence

- [Report QA agent](../../backend/src/services/agents/reportQaAgent.js) 回傳 `qualityFlags`、`consistencyChecks`、coverage、hallucination risk 和 `passed`；Role-Fit integrity、unknown evidence、alignment grounding、company claim review 等 flags 可 block。
- [Master AI service](../../backend/src/services/masterAiService.js) 的 `generate_report` 執行 retrieval、context、report action、QA、repair 和 persistence；`qa_report` 對 stored report recheck。
- Report persistence 將 QA 結果映射成 `ready`、`ready_after_repair`、`needs_review`、`repair_failed`，並保存 report versions。
- Report mock tests 已驗證 grounding/QA/repair boundary；仍缺 shared gate artifact 和完整 replay dataset。

### BDD scenarios

```gherkin
Scenario: Grounded report passes QA and becomes ready
  Given a report artifact whose claims and Role-Fit references resolve to reviewed evidence
  When qa_report evaluates the stored report
  Then WorkflowRun lifecycleStatus is completed
  And GateResult status is pass with blockingScope publication
  And qualityStatus is passed
  And publicationStatus is ready or ready_after_repair

Scenario: Unsupported or ungrounded claim blocks publication
  Given a report with unsupported high-confidence feedback or an ungrounded alignment claim
  When report QA runs
  Then the QA task may complete successfully
  But GateResult blocks publication with evidence-backed reason codes
  And publicationStatus becomes needs_review or repair_failed
  And the report cannot be represented as publishable output

Scenario: QA-only task does not silently rewrite
  Given an existing stored report
  When qa_report runs
  Then the original report content remains the subject artifact
  And the task emits QA gate and publication recommendation
  And any repair requires a separate authorized action or child run

Scenario: QA passes but persistence fails
  Given a passing QA result
  When report artifact persistence fails
  Then qualityStatus remains passed
  But lifecycleStatus becomes failed or completed with failed side effect according to TaskContract
  And FailureClassification uses tool_or_side_effect_failure rather than verification_failure
```

### Contract mapping

| Contract | Mapping | 結果 |
| --- | --- | --- |
| `WorkflowRun` | `generate_report` 和 `qa_report` 分開；quality/publication/lifecycle status 分離。 | 需補欄位：三種 status；已加入 spine。 |
| `TaskContract` | `qa_report` 是 recheck/gate，forbid silent rewrite；`generate_report` 可有 bounded repair。 | 可表達。 |
| `ContextPacket` | Stored report ref、CV/JD/interview/question/transcript/retrieval evidence refs。 | 可表達；current context packet不存在。 |
| `ActionContract` | `GENERATE_REPORT_DRAFT` 可有 action contract；QA-only 是 task/gate，不必硬當 action。 | 可表達且釐清 `QA_REPORT` 不必作為 model-selectable action。 |
| `GateResult` | QA flags/checks -> pass/warn/block/review/degrade；`blockingScope=publication`。 | 可表達；最適合第一個 enforcement pilot。 |
| `MemoryWrite` | QA recheck 不需要 memory write；report reflection/coaching 是另外的 side effect。 | 不適用於 QA core。 |
| `FailureClassification` | verification failure、persistence failure、repair failure 必須分開。 | 可表達。 |

Pressure finding：report QA 最適合做第一個 enforceable gate，但不是 architecture 起點。它無法單獨驗證 question state、memory provenance 或 voice channel，因此必須排在 cross-product spine 和 interview observe slice 之後。

---

## 6. Coverage Matrix

| Contract | CV-JD match | Interview next turn | Memory update | Report QA | 結論 |
| --- | --- | --- | --- | --- | --- |
| `WorkflowRun` | 可表達 | 可表達 | 來源 run side effect | 可表達 | 需要 episode/parent、state before/after、三種 status。 |
| `TaskContract` | 可表達 non-agent workflow | 可表達 agent task | 由來源 task 宣告 | 可表達 gate/recheck | 適用範圍不能只限 `runTask` registry。 |
| `ContextPacket` | 核心 | 核心 | read provenance | 核心 | 需要 review/version/trust/hash；不得複製 raw private payload。 |
| `ActionContract` | Pure compute 不適用 | 核心 | 一般 write 不適用 | report draft 適用，QA core 不適用 | 不包裝所有 helper/service。 |
| `GateResult` | review/ownership | allowed/counting/transcript | write/scoring/visibility | QA/publication | 七個 contract 中最重要的 shared control vocabulary。 |
| `MemoryWrite` | 不適用 | turn side effect | 核心 | QA core 不適用 | 必須綁 source run/evidence/policy。 |
| `FailureClassification` | 核心 | 核心 | 核心 | 核心 | 需要 handled/expected/fallback/user impact。 |

結果：七個 contract 能覆蓋四個 case，不需要新增 report-specific 或 voice-specific頂層 run schema。Pressure test 同時迫使 spine 補上 review lineage、state transition、blocking scope、memory policy version、handled failure 和 separated statuses。

---

## 7. Decision Status

### 7.1 Product owner approved

1. Product harness scope 包含 CV-JD、question、interview、memory、report、QA、voice；AgentProfile scope 比 product scope 窄。
2. CV-JD match 和 question preparation 是 guarded workflow/context producer，不是因使用 LLM 就成為 product agent。
3. Target memory 是 user-scoped、cross-session interview learning memory；可影響 planning、question selection/depth 和 routine-repeat suppression；V0 `canAffectScoring=false`。
4. Report QA-only 不 silent rewrite；blocking result 進 `needs_review`，repair 是 explicit action/child run。
5. Context 優先保存 refs/hash/version，只在必要時保存 redacted snapshot；source delete 需處理 derived content，只保留無內容 tombstone。
6. Voice immediate transcript confirmation 採 same-run resume；失效或不可安全恢復才用 child run。
7. Detailed run/gate/failure/memory timeline 給 developer；一般使用者只看重要、非技術性的 progress 和 evidence summary。
8. Authority order 採 `policy/safety > controller > contract/gate > deterministic rule > model > wording`。
9. Rollout 採 `interview_next_turn` shadow/observe first，report QA 作第一個候選 enforce slice。

### 7.2 Proposed architecture decisions, not yet product-approved

1. `WorkflowRun` 同時描述 agent task 和 guarded product workflow，不另建 `AgentRun` 作平級核心。
2. `TaskContract` 適用於 `cv_jd_match`、`prepare_question_pool` 等非 registry workflow。
3. `lifecycleStatus`、`qualityStatus`、`publicationStatus` 分開。

---

## 8. Unresolved Decisions Before Runtime

這些決定未關閉前，不應開始 shared harness runtime implementation：

| Decision | 建議預設 | 為什麼仍需確認 |
| --- | --- | --- |
| Run persistence | 先 derived/shadow read model，不新增 collection。 | 需確認 debug/replay query、retention、background event late arrival 是否足夠。 |
| Correlation ID owner | 由 task/controller 入口產生 `workflowRunId`，一路傳入 background jobs。 | Current background jobs 沒有 run id；改動範圍會跨多 service。 |
| Redacted snapshot allowlist | 已核准 refs/hash/version-first；只為必要 replay case建立 allowlist。 | 還需定義哪些 case、保存多久、誰能讀。 |
| Task contract home | 先 code-owned versioned constants + docs mirror。 | 純 docs 不能 enforce；DB config 又會增加 migration/governance。 |
| Gate policy owner | Shared schema，domain owner決定 reason/threshold，controller執行 next step。 | 要避免 central harness 不理解 domain 卻取得 block 權。 |
| Memory promotion/revalidation threshold | 只在跨獨立 session、有 applicability/freshness 的 grounded evidence 後 suppress routine repeat 或提高 depth。 | 尚未決定需要幾次 session、confidence threshold、freshness window 和 conflict policy。 |
| Memory source-deletion implementation | 依 contribution refs delete/recompute/redact，只留無內容 tombstone。 | 原則已核准；聚合 memory 的 recompute 與 retention 細節仍需設計和測試。 |
| Voice resume verification | Product semantics 已核准 same-run confirmation。 | 仍需 duplicate/reconnect/timeout replay，這是測試 gate，不再是產品決策。 |
| Enforcement threshold | Replay/parity 通過後才從 observe/warn 進 enforce。 | 尚未定義 false-block、latency regression 和 human-review cost 門檻。 |

---

## 9. Readiness Decision

這三項 architecture clarification 已足夠讓團隊討論 shared harness kernel，但還不足以直接開始 runtime implementation。

下一個討論 gate 應是逐項確認第 8 節 unresolved decisions。全部確認後，才進入：

```text
shared contract types
-> interview_next_turn shadow run/context/action mapping
-> report QA GateResult shadow parity
-> replay comparison
-> warn/enforce decision
```

不應跳到 memory schema migration、voice enforcement 或全域 persistence rewrite。

Evidence status：四個 case 的 current behavior 基於 source/tests；contract instance、BDD acceptance 和 architecture decisions是 target design。未執行 runtime contract tests或 replay runner。

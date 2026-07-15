# `interview_next_turn` Shadow Harness V0 Spec

- 狀態：修復後 automated browser H1 已通過；等待真人麥克風、live provider 與 production shadow evidence
- Milestone：M1
- Execution mode：`shadow`
- Risk class：High
- Product output authority：current controller/runtime

相關文件：[Goal](goal.md)、[Execution Rules](AGENTS.md)、[M2-M5 milestone contract](milestones-m2-m5.md)、[Final scorecard](evidence/final-scorecard.md)、[Contract Spine](../further_plan/product-harness-contract-spine.md)、[Replay Fixtures](../references/pre-harness-replay-fixtures.md)。

## Overview

- Goal：為每次 `interview_next_turn` 建立 shared contract view、append-only shadow run artifact 和 developer-queryable timeline。
- Users：backend/harness developers、reviewers、eval/replay runners。
- Non-goals：不改 interview action、question、scoring、memory value、report、voice policy或 candidate UI。
- Risk class：High，因為後續 contract 會成為 action、memory、publication 和 human-review authority；M1 僅可 shadow。

## Observable M1 Deliverables

M1 完成時，Product Owner 和 developer 必須能直接檢查以下成果；candidate output 應保持不變：

| Deliverable | 能看到什麼 | Required evidence path |
| --- | --- | --- |
| Developer run timeline | 單一 turn 的 context refs、candidate/selected/fallback action、gates、state before/after、question、memory writes、failures、latency。 | [Shadow run sample](evidence/m1-shadow-run-sample.json) |
| Immediate backend trace | Task 完成時立即看到 redacted `queued` trace；durable correlation 完成後看到 `persisted` trace，不必先猜 API 是否已寫入。 | [H1 persistence/trace evidence](evidence/m1-h1-persistence-trace.md) |
| Before/after replay report | Harness OFF/ON 的 user output、action、state、question、latency、failure、privacy diff。 | [Before/after replay](evidence/m1-before-after-replay.md) |
| Debug benchmark | 相同 failure tasks 用 current logs 與 harness timeline 的完成率、正確率、耗時比較。 | [Debug benchmark](evidence/m1-debug-benchmark.md) |
| Canonical verdict | G2/M1 status、pass/fail、未驗證 gate 和 evidence references。 | [Goal](goal.md) |

只建立 schema、collection 或 JSON 不算完成。Timeline 必須真的縮短 root-cause diagnosis，且 replay 必須證明產品沒有 regression。

Local implementation 使用 `HarnessWorkflowRun` 作為非產品 source of truth 的 durable shadow artifact，`ENABLE_HARNESS_SHADOW=false` 為預設。非 production developer read path 是 `GET /api/interview/harness-runs`；它強制使用 authenticated owner scope，支援 run/session/time filters，並記錄 access。`Harness workflow trace` 是 redacted immediate observability surface，不是第二個 persistence source；API 在背景 queue 完成前可短暫查不到資料。H1 之前 execution mode 保持 `shadow`。

## Requirements

### Functional

| ID | Requirement |
| --- | --- |
| FR-01 | 在 `interview_next_turn` controller/task entry 建立 canonical `workflowRunId`、`idempotencyKey`、owner/session/client-turn/channel identity。 |
| FR-02 | 依 shared spine 產生 `WorkflowRun`、`TaskContract` ref、`ContextPacket`、selected `ActionContract` ref、`GateResult` refs、`MemoryWrite` refs 和 `FailureClassification` refs。 |
| FR-03 | 保存 state-before/state-after、candidate/selected/fallback action、question/result、side-effect outcome 和 lifecycle/quality/publication status。 |
| FR-04 | Model invalid/disallowed/error 必須保存 failure + fallback lineage；不能改變 current fallback。 |
| FR-05 | Background trace/memory/reflection write 必須接收或回綁 `workflowRunId`；無法綁定時標 explicit orphan/correlation failure。 |
| FR-06 | Text 和 voice 共用同一個 run schema，以 `channel` 區分。Voice immediate confirmation 使用同一 run 的 `waiting -> running`。 |
| FR-07 | Shadow run artifact 可按 `workflowRunId`、`sessionId`、owner、time 查詢；candidate-facing API 不得暴露 internal artifact。 |
| FR-08 | Harness 由 `ENABLE_HARNESS_SHADOW` 或等價 code-owned flag 控制，預設不得改 current production behavior。 |
| FR-09 | Frontend 必須等 backend `session_ready` 才把 duplex socket 視為可用；backend session 初始化期間的 ordered messages 不得被丟棄。 |
| FR-10 | 無 active/matching turn 的非重複 `speech_end` 必須回傳 retryable `turn_rejected`；frontend 回到同題 repair state，shadow harness 記錄 redacted failed run。 |
| FR-11 | Task 完成後同步輸出 redacted `task_completed/queued` trace，並將 correlation 明示為 pending；correlation 與 durable append 完成後輸出 `durable_persisted/persisted` trace 與實際計數。Trace emission failure 不得改變 product result。 |

### Non-functional

- Legacy parity：相同 fixture 的 action、question、state、scoring、fallback 和 user-visible output 必須一致。
- Latency：不得新增同步 model/tool call；必須量測 mapping/recording overhead，不能假設無成本。
- Reliability：shadow persistence failure 不得讓 interview task fail，但必須留下 structured recording failure signal。
- Diagnostics consistency：immediate trace 必須明示 `persistenceStatus`；不得把 `queued` 誤稱為 durable，也不得建立與 `HarnessWorkflowRun` 競爭的 pending-run query source。
- Voice recovery：transport rejection 不得讓 frontend 永久停在 processing；不得保存、評分或計數被拒絕的 turn。
- Idempotency：duplicate client/voice event 不得建立兩個 canonical product turns 或兩個 countable questions。
- Rollback：關閉 feature flag 後完全回到 current runtime path，不需要資料 migration rollback。
- Maintainability：使用現有 validation/persistence/config patterns；新增 dependency 必須另行核准。

### Security and privacy

- `ContextPacket` V0 只保存 refs/hash/version/trust/review metadata；redacted snapshot allowlist 初始為空。
- 不保存 raw chain-of-thought、完整 prompt、完整 CV/JD/transcript 或未必要的 candidate-sensitive payload。
- Artifact 必須有 owner scope、retention class、redaction policy version 和 source-deletion handling。
- Developer read path 必須有 auth/role/access logging；一般 candidate session API 不得返回 internal gate/failure/memory trace。
- Immediate backend trace 只允許 run/session/turn refs、action/gate/memory/failure code、計數、status 與 latency；不得輸出 owner ID、raw context、answer、question、prompt 或 memory 內容。

## Contracts

```yaml
apis:
  - internal_harness_run_query:
      audience: developer_only
      filters: [workflowRunId, sessionId, ownerUserId, startedAt]
data_models:
  - WorkflowRun:
      required:
        - workflowRunId
        - taskType
        - executionMode
        - ownerUserId
        - sessionId
        - channel
        - lifecycleStatus
        - qualityStatus
        - publicationStatus
        - contextPacketRefs
        - gateResultRefs
        - memoryWriteRefs
        - failureRefs
        - resultRefs
  - TaskContract:
      ref: interview_next_turn_v0
      workflowKind: agent_task
      executionMode: shadow
      authority: current_controller
  - ContextPacket:
      storage: refs_hash_version_only
      rawSnapshotAllowed: false
  - ActionContract:
      source: current_candidate_actions_and_selected_fallback_metadata
  - GateResult:
      initialAdapters:
        - action_allowed_candidate
        - question_counting
        - question_novelty
        - transcript_eligibility
        - memory_write_policy_shadow
  - MemoryWrite:
      mode: audit_envelope_only
      canAffectScoring: false
  - FailureClassification:
      required: [category, reasonCode, handled, retryable, fallbackApplied, userImpact]
events:
  - workflow_run_started
  - context_packet_assembled
  - candidate_actions_recorded
  - action_selected_or_fallback_used
  - question_or_terminal_result_recorded
  - memory_write_correlated_or_orphaned
  - workflow_run_waiting_resumed_or_completed
  - voice_turn_rejected
external_dependencies: []
```

Contract source of truth 是 [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md)。本 spec 只固定 M1 必填 subset，不複製 feature domain payload。

## Execution Flow

```text
runTask(interview_next_turn)
  -> create run identity and state-before ref
  -> build refs-only ContextPacket
  -> execute current controller unchanged
  -> map candidate / selected / fallback action
  -> map question or terminal state and state-after ref
  -> emit redacted task_completed / queued trace
  -> return exact legacy product result
  -> background correlate gates, failures, trace and memory-write envelopes
  -> append durable shadow artifact
  -> emit redacted durable_persisted / persisted trace
```

Shadow recorder 不是 controller。Contract validation failure、mapper failure或 shadow persistence failure都不得改寫 current product result；它們必須被分類並可在 developer diagnostics 中發現。

## BDD Scenarios

```gherkin
Scenario: A successful text interview turn produces one shadow run
  Given a valid interview session and candidate answer
  When interview_next_turn completes through the current controller
  Then exactly one canonical WorkflowRun is queryable
  And it references state before and after, context, selected action, question result, gates, and side effects
  And the user-visible result equals the legacy result

Scenario: Invalid model action preserves fallback lineage
  Given the deterministic planner produced an allowed candidate set and fallback
  When model selection returns invalid JSON or an action outside the candidate set
  Then the current fallback action is executed unchanged
  And FailureClassification records a handled model output failure
  And WorkflowRun records candidate, rejected selection, and fallback refs

Scenario: Duplicate client or voice event is idempotent
  Given an existing run identity for a client turn
  When the same event is delivered again
  Then no second canonical product turn or countable question is created
  And the duplicate attempt is visible in developer diagnostics

Scenario: Voice transcript confirmation resumes the same run
  Given a contentful transcript requiring confirmation
  When transcript eligibility requests user confirmation
  Then WorkflowRun lifecycleStatus becomes waiting
  And scoring and next-question action remain blocked
  And confirmed input resumes the same run unless it expired or became non-resumable

Scenario: A pre-task voice transport rejection is recoverable and traceable
  Given speech_end cannot be matched to an active client turn
  When the backend rejects the turn before answer processing
  Then the frontend leaves processing and asks the candidate to answer the same question again
  And no answer is saved, scored, or counted
  And a redacted failed WorkflowRun records the block gate, reason code, and voice_turn_rejected event

Scenario: Memory write remains correlated and cannot score
  Given an interview turn produces a reflection or memory update
  When the background write completes
  Then MemoryWrite references the source WorkflowRun and evidence refs
  And canAffectScoring is false
  And an uncorrelated write is explicitly marked as an orphan failure

Scenario: A repeated coaching lesson keeps current run provenance
  Given an older user coaching record has the same normalized pattern and lesson
  When the current run writes the repeated lesson
  Then deduplication keeps the newest record and sourceWorkflowRunId
  And correlation does not mark the current write orphaned only because its content repeated

Scenario: Backend trace is immediate, redacted, and persistence-aware
  Given a completed interview task is waiting in the background persistence queue
  When the shadow recorder schedules durable persistence
  Then backend logs a task_completed trace with persistenceStatus queued
  And after durable append it logs durable_persisted with persistenceStatus persisted
  And neither trace contains owner identity or raw candidate payload

Scenario: Sensitive context is represented by references
  Given CV, JD, transcript, session memory, and retrieval sources
  When ContextPacket is assembled
  Then it stores source refs, versions, hashes, trust and review metadata
  And it does not copy raw candidate payload or chain-of-thought

Scenario: Shadow recording failure does not break the interview
  Given the current controller produced a valid next-turn result
  When harness validation or persistence fails
  Then the legacy result is returned unchanged
  And a structured harness recording failure signal is emitted
```

## Before/After Verification Protocol

1. 在任何 harness code change 前凍結 M1 fixture inputs、legacy outputs、現有 log-debug benchmark 和 latency baseline。
2. Harness OFF 跑 baseline；Harness ON 跑同一組 inputs，禁止換 prompt、model、fixture 或 evaluator rubric。
3. 對 user output、selected/fallback action、question ID/counting、state change、failure、side effects 和 latency做結構化 diff。
4. 用固定 failure tasks 測試 invalid model action、duplicate event、orphan memory write、voice confirmation 和 shadow persistence failure。
5. Debug benchmark 記錄是否找到正確 fault owner/fallback，以及從取得 fixture 到完成 diagnosis 的時間。
6. Before/after artifact、commands、commit/config、時間與未驗證 boundary 寫入 required evidence files。

M1 建議 debug target：在相同 failure tasks 上，median diagnosis time 比 current console/log baseline 至少降低 50%，且 diagnosis correctness 不降低。Baseline 未凍結前不得宣稱達標。

## Verification

- Unit tests：contract validator、status invariants、refs-only context mapper、failure mapper、idempotency key、redaction。
- Integration tests：`interview_next_turn` happy path、invalid model fallback、terminal action、background memory/trace correlation。
- Replay tests：text happy path、invalid/disallowed action、duplicate event、voice pre-task rejection、voice confirmation same-run、shadow persistence failure、immediate redacted trace、repeated-memory latest provenance。
- Privacy tests：owner scope、candidate API exclusion、raw payload/chain-of-thought absence、source deletion handling。
- Performance checks：record mapping/persistence overhead；確認沒有新增同步 model/tool call。
- Agent evals：M1 不要求 real-provider eval；real AI 不可作唯一 gate。
- Review gates：backend owner、product behavior review、privacy/retention review、repo-docs sync。

## Acceptance Gate

- Required field mapping coverage：100%。
- Run reconstructability：required timeline 和 source lineage 100%。
- Fixture legacy parity：100%。
- Selected/fallback action lineage：100%。
- Frozen failure fixture attribution：100%；unclassified 0。
- Median debug diagnosis time：相對 frozen current baseline 至少降低 50%。
- Harness-introduced duplicate countable question：0。
- Candidate-facing internal trace exposure：0。
- Unclassified harness failure：0；orphan write 必須顯式且在進 M3 前降為 0。
- Feature flag rollback 已測試。
- 未通過 gate 前 execution mode 不得高於 `shadow`。

## Rollout and Rollback

1. Tests/local 開啟 shadow flag，建立 deterministic fixtures。
2. 非 production 環境檢查 parity、queryability、privacy 和 overhead。
3. 經明確 approval 後才可在 production shadow；仍不得 block。
4. 任一 parity、privacy、duplicate、latency 或 storage amplification regression 立即關閉 flag。
5. Shadow artifact 不是 source of truth，rollback 不修改 interview/session/report domain data。

## Deferred Decisions

- M2/M3 的 promotion、freshness、revalidation 與 enforce thresholds。
- Candidate-facing progress summary UI。

Evidence status：Product Owner 已核准 G2/M1 implementation。Queue/query race 與 coaching-memory provenance gap 的修復已通過 local automated tests、11/11 replay、privacy、rollback 與 deterministic debug proxy；修復後 automated browser H1 亦完成 harness OFF/ON 各兩個 voice turns、正式結束與 report 載入。Canonical verdict 是 `AUTOMATED_H1_PASS_HUMAN_LIVE_PENDING`；test provider 的 browser pass 不等於真人麥克風、live voice provider 或 production shadow 已驗證。

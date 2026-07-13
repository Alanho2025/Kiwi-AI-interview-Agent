# Agent Harness Architecture Upgrade Plan

本文件規劃 Kiwi AI Interview Agent 後續如何從「product controller + specialized agent services」升級成正式的 agent harness architecture。

核心原則：

> The harness is an enforcement and observability layer around existing domain workflows. It is not a replacement for the interview controller or a second orchestration engine.

也就是說，harness 不應該重寫 `masterAiService`，也不應該把現有 report QA、question diagnostics、voice confidence gate、memory 和 trace 再做一份。它要做的是：把現有 domain workflow 包成可觀測、可治理、可驗證、可回放的 runtime layer。

參考文件：

- [Harness Engineering 定義參考](../references/harness-engineering-reference.md)
- [Agent registry 與 task runner](../../repo-docs/modules/agent-registry-and-task-runner.md)
- [Agent memory 與 trace](../../repo-docs/modules/agent-memory-and-trace.md)
- [Report generation 與 QA](../../repo-docs/modules/feature-report-and-qa.md)
- [Interviewer agent](../../repo-docs/modules/agent-interviewer.md)
- [Match 與問題準備](../../repo-docs/modules/feature-match-and-question-prep.md)
- [Voice interview](../../repo-docs/modules/feature-voice-interview.md)
- [Code-Document Alignment Map](../code-document-alignment.md)

---

## 1. Executive Summary

Kiwi 目前不是一個完全 autonomous multi-agent system。它比較接近：

```text
deterministic product controller
  -> specialized agent/service components
  -> decision records / trajectory / trace / report artifacts
```

這個方向是對的，因為 Kiwi 的高風險點不是「agent 不夠自由」，而是「agent 的判斷能不能被限制、被證明、被回放、被修正」。

後續升級目標不是把所有 component execution 都叫 `AgentRun`。更落地的 runtime model 是三層：

| 層級 | 定義 | 例子 |
| --- | --- | --- |
| `AgentEpisode` | 一個完整使用者工作段，通常是整場 interview session 或一次 preparation session | 一場 12 題 mock interview |
| `WorkflowRun` | 使用者或產品可感知的一次任務 | `interview_next_turn`、`generate_report`、`cv_jd_match` |
| `ExecutionSpan` | WorkflowRun 內部的一段 agent/service execution | context build、retrieval、answer evaluation、planning、report QA、repair |
| `AgentEvent` | span 內發生的事件或狀態記錄 | candidate action generated、gate failed、fallback used、memory write |

這樣一場 12 題面試不會變成數十個平級 `AgentRun`。Debug 時可以先看 task-level `WorkflowRun`，需要時再展開 `ExecutionSpan`。

---

## 2. 為什麼要做 harness architecture

Kiwi 的產品價值建立在三件事上：

1. 它能看懂 CV / JD / candidate answer 的 evidence。
2. 它能把 evidence 轉成有針對性的 interview practice。
3. 它能在 report 裡給出 grounded、可解釋、可改進的 coaching。

這三件事都不能只靠 prompt。Prompt 可以要求模型「要 grounded」，但不能穩定保證：

- 哪些 context 被使用。
- 哪些 action 被允許。
- 哪些 output 通過 gate。
- 哪些 memory 可以影響下一題。
- 哪些 human review 阻擋了 publication。
- 哪些 failure 是 retrieval、model、tool、policy、privacy 或 verification 問題。

Design rationale：

| 觀察 | 風險 | Harness 要補的能力 |
| --- | --- | --- |
| Kiwi 已有 registry、planner、trace、memory、report QA，但語義分散 | feature 越多，debug 越像翻多份 log | `WorkflowRun`、`ExecutionSpan`、`AgentEvent` read model |
| Report 會影響 candidate 對自己能力與 job strategy 的理解 | unsupported claim 可能變成錯誤 coaching | claim grounding gate、publication status、repair event |
| Voice interview 有 3 秒 first-audio target | 多 agent deliberation 會破壞即時體驗 | voice-specific action contract、deadline、budget、latency gate |
| Memory 開始跨 session | 舊記憶可能污染當前評分或題目選擇 | `MemoryPolicy`、provenance、`canAffectScoring` |
| Human review 分散在 JD review、transcript confirmation、report feedback | 人工介入難回放，也難知道系統是否真的可靠 | `HumanReviewGate`、resume semantics、review decision |
| CV/JD/transcript 是 untrusted content | JD 或 CV 可能包含 prompt injection 式文字 | `ContextPacket` trust metadata、instruction-use boundary、data egress policy |

不做 harness 的結果是：系統功能越來越多，但每次錯誤都很難回答「是哪一層出錯」。做 harness 的目的，是讓每次 AI workflow 有可查的 contract、status、gate 和 evidence。

---

## 3. 目前架構 vs 升級後架構

| 維度 | 現在已經有什麼 | 現在缺口 | Harness upgrade 後 |
| --- | --- | --- | --- |
| Runtime unit | `runTask` / interview controller 串 workflow | 任務、步驟、事件層級沒有清楚分開 | `WorkflowRun` 表示任務，`ExecutionSpan` 表示內部步驟 |
| Agent identity | `agentRegistry` 映射 function | registry 不定義 permission、policy、gate | `AgentProfile` 定義 purpose、allowed workflows、allowed spans、memory policy |
| Action boundary | `AGENT_ACTION_TYPES`、candidate actions、model whitelist | action string 還不是完整 runtime contract | `ActionContract` 補 pre/postconditions、idempotency、budget、deadline、fallback |
| Existing guards | report QA、claim grounding、question dedupe、voice confidence gate 已存在 | guard 結果沒有統一 gate representation | 以 adapter 方式轉成 `GateResult`，不重做邏輯 |
| Memory | session memory、reflection、UserCoachingMemory | read/write policy 與 provenance 不夠 formal | `MemoryPolicy` wrapper 控制 scope、writer、reader、retention |
| Status | report 有 ready / needs_review，question pool 有 degraded | lifecycle、quality、publication 混在一起 | 拆成 `lifecycleStatus`、`qualityStatus`、`publicationStatus` |
| Trace | decision records、trajectory、agentTraceEvents | timeline 來源多，讀者要自己拼 | `AgentEvent` read model 統一呈現 |
| Privacy | 有 auth、CSRF、redaction、retention pipeline 等控制 | CV/JD/transcript 在 harness 中缺少 trust / egress policy | `ContextPacket` 保存 trustLevel、dataClassification、hash/version、deletion propagation |
| Testing | robustness tests 覆蓋多條 product guard | 少量測試專門驗證 harness contract | replay、failure injection、duplicate message、stale context、prompt injection tests |

---

## 4. Architecture Planes

前一版把 `AgentProfile -> ContextPacket -> ToolScope -> Plan -> Gate` 寫成一條線，容易讓人誤會它們是依序執行。實際上這些東西分屬不同責任面。

### 4.1 Control Plane

Control Plane 是靜態或半靜態政策層。它回答「誰可以做什麼」。

| 元件 | 責任 |
| --- | --- |
| `AgentProfile` | 定義 agent / service role 的 purpose、allowed workflows、allowed spans |
| `ActionContract` | 定義 action 的 schema、preconditions、postconditions、budget、fallback |
| `ToolScope` | 定義 tool/provider/service 可被誰用、何時用、能接觸哪些資料 |
| `MemoryPolicy` | 定義 memory 的 scope、writer、reader、provenance、retention |
| `EvaluationPolicy` | 定義哪些 workflow 必須通過哪些 gate |

### 4.2 Execution Plane

Execution Plane 是每次任務真的跑起來時的 runtime record。它回答「這次實際發生了什麼」。

| 元件 | 責任 |
| --- | --- |
| `AgentEpisode` | 整場 interview / preparation session |
| `WorkflowRun` | 一次 user-visible task，如 `interview_next_turn` 或 `generate_report` |
| `ExecutionSpan` | WorkflowRun 內部步驟，如 retrieval、evaluation、planning、QA |
| `ContextPacket` | 本次 workflow 使用的 immutable refs、hash、version、trust metadata |
| `Plan` | candidate actions、ranking signals、selected action、fallback |
| `ActionExecution` | action 的輸入、輸出、latency、retry、fallback |
| `Result` | workflow 對外產物或 output refs |

### 4.3 Governance Plane

Governance Plane 管理安全、人工介入、資料保存與外部輸出。它回答「什麼不能做，什麼需要人確認」。

| 元件 | 責任 |
| --- | --- |
| `HumanReviewGate` | blocking / non-blocking review、reviewer decision、resume semantics |
| `PrivacyPolicy` | candidate data、CV、JD、transcript 的存取與展示邊界 |
| `RetentionPolicy` | run artifact、trace、memory 的保存期限 |
| `DataEgressPolicy` | 哪些 provider / model / web enrichment 可以接收哪些資料 |
| `DeletionPropagation` | CV、session、account delete 後，trace/memory/run artifact 如何處理 |

### 4.4 Observability Plane

Observability Plane 負責 debug、metrics 和 failure attribution。它回答「怎麼知道它好或壞」。

| 元件 | 責任 |
| --- | --- |
| `AgentEvent` | 統一 timeline event |
| `Trace` | latency、cost、fallback、provider result、redacted payload refs |
| `Metrics` | contract compliance、claim provenance、latency regression、review precision |
| `FailureClassification` | context/tool/model/policy/permission/verification/environment/human gate |

---

## 5. 現有能力到 Harness Adapter 的對照

Harness 第一版要包裝現有能力，不要重造輪子。

| Current capability | Harness representation | Change type |
| --- | --- | --- |
| voice transcript confidence gate | `stt_confidence_safety` gate | adapter |
| transcript review policy | `transcript_review_gate` + scoring eligibility event | adapter |
| question-pool readiness diagnostics | `question_pool_readiness_gate` | adapter |
| reserve question generation / degraded question pool | `question_pool_degraded` event + `qualityStatus=degraded` | adapter |
| runtime deduplication / novelty guard | `question_novelty_gate` | adapter |
| model action whitelist in action selector | `ActionContract` boundary | strengthen existing check |
| decision records | `AgentEvent` mapper | read-model mapping |
| trajectory records | `ExecutionSpan` mapper | read-model mapping |
| agent trace events | `AgentEvent` mapper | read-model mapping |
| report QA repair loop | `report_qa_span` + `report_repair_event` | adapter |
| claim grounding / re-grounding | `report_claim_grounding` gate | adapter |
| repair history and report version | `artifactVersion` + `repairHistory` | adapter |
| `SessionReport.latestStatus` | `publicationStatus` + `qualityStatus` | adapter |
| user coaching memory | `MemoryPolicy` wrapper | policy enforcement |
| role-fit compact diagnostics | `diagnostic_event` + degraded reason | adapter |

第一版的成功標準不是「新增很多新 service」。成功標準是：現有 domain workflow 不改結果，但可以被同一套 harness view 觀察、檢查和回放。

---

## 6. Runtime Model

### 6.1 WorkflowRun

`WorkflowRun` 是使用者或產品可感知的一次任務。它不是每個 component execution。

```json
{
  "workflowRunId": "wf_...",
  "episodeId": "episode_...",
  "sessionId": "session_...",
  "taskType": "interview_next_turn",
  "idempotencyKey": "session_...:turn_7:speech_end_...",
  "lifecycleStatus": "completed",
  "qualityStatus": "degraded",
  "publicationStatus": "not_applicable",
  "degradedReasons": ["question_pool_below_target"],
  "contextPacketId": "ctx_...",
  "spanIds": ["span_context", "span_evaluation", "span_planning", "span_action"],
  "gateResultIds": ["gate_question_novelty"],
  "outputRefs": {
    "transcriptTurnId": "turn_...",
    "questionId": "question_..."
  },
  "startedAt": "2026-07-13T00:00:00.000Z",
  "completedAt": "2026-07-13T00:00:02.200Z"
}
```

### 6.2 ExecutionSpan

`ExecutionSpan` 是 WorkflowRun 內部的一段 agent/service execution。

```json
{
  "spanId": "span_...",
  "workflowRunId": "wf_...",
  "spanType": "planning",
  "agentId": "master_controller",
  "inputRefIds": ["ctx_..."],
  "outputRefIds": ["plan_..."],
  "lifecycleStatus": "completed",
  "qualityStatus": "passed",
  "latencyMs": 180,
  "modelCalls": 0,
  "fallbackUsed": false
}
```

### 6.3 AgentEvent

`AgentEvent` 是 timeline 事件。

```json
{
  "eventId": "evt_...",
  "workflowRunId": "wf_...",
  "spanId": "span_...",
  "eventType": "candidate_actions_generated",
  "severity": "info",
  "payloadRef": "redacted_payload_...",
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

### 6.4 Status model

Lifecycle status、quality status 和 publication status 必須分開。

| status | allowed values | 意思 |
| --- | --- | --- |
| `lifecycleStatus` | `queued`、`running`、`waiting`、`completed`、`failed`、`cancelled`、`timed_out` | 任務是否執行完 |
| `qualityStatus` | `passed`、`warning`、`degraded`、`failed`、`unknown` | 執行結果品質如何 |
| `publicationStatus` | `publishable`、`needs_review`、`blocked`、`internal_only`、`not_applicable` | 產物是否可以給 candidate 看 |

`waiting_for_human` 不應該是 terminal status。它應該表現為：

```json
{
  "lifecycleStatus": "waiting",
  "qualityStatus": "warning",
  "publicationStatus": "needs_review",
  "waitingOn": "human_review_gate"
}
```

人工確認後有兩種明確語義：

1. Same-run resume：原 `WorkflowRun` 從 `waiting` 回到 `running`，適合 transcript confirmation 這種同一輪可恢復流程。
2. Child-run continuation：原 `WorkflowRun` 結束為 `completed + needs_review`，review action 建立 child `WorkflowRun`，適合 report edit / repair / publish decision。

不能讓 review 隱形修改結果。

---

## 7. Context, Privacy, Prompt Injection, Deletion

CV、JD、transcript 都是 untrusted content。Harness 必須把它們當 data，不允許它們改寫 system / action / policy rules。

### 7.1 ContextPacket

```json
{
  "contextPacketId": "ctx_...",
  "workflowRunId": "wf_...",
  "items": [
    {
      "sourceType": "job_description",
      "sourceRef": "jd_profile_...",
      "trustLevel": "untrusted_user_content",
      "contentVersion": "v3",
      "contentHash": "sha256:...",
      "instructionUseAllowed": false,
      "dataClassification": "candidate_sensitive",
      "retentionClass": "derived_reference"
    }
  ]
}
```

### 7.2 Policy rules

- `ContextPacket` 儘量保存 immutable refs、hash 和版本，不重複保存整份 transcript 或 CV。
- JD、CV、candidate answer、transcript 只能作為 data 使用，不可覆蓋 system prompts、action contracts、tool permissions。
- `instructionUseAllowed=false` 的內容若包含「ignore previous instructions」一類文字，應作為 prompt-injection signal，而不是 agent instruction。
- Provider / model egress 必須按 data classification 控制。候選人 CV 和 transcript 預設是 `candidate_sensitive`。
- 外部 web enrichment 不應帶出 candidate data。若只查公司或職缺公開資訊，也要跟 candidate profile 分離。
- 成功且低風險的 run 可以只保存 summary / refs；failed 或 degraded run 可保存較完整 artifact 供 debug，但仍要遵守 retention policy。
- 使用者刪除 CV、session 或 account 時，相關 `ContextPacket` refs、derived memory、trace payload、WorkflowRun artifact 必須有 deletion propagation 或 tombstone policy。

---

## 8. ActionContract Runtime Guarantees

`ActionContract` 不只是 allowed agent + timeout。它要能限制 runtime 失控。

```json
{
  "action": "ASK_PROBING_QUESTION",
  "allowedAgents": ["interviewer", "master_controller"],
  "inputSchema": "AskQuestionActionInput",
  "outputSchema": "InterviewQuestionOutput",
  "preconditions": [
    "session_is_active",
    "question_limit_not_reached",
    "current_turn_not_waiting_for_confirmation"
  ],
  "postconditions": [
    "official_question_count_incremented_only_if_counts_as_question",
    "question_has_novelty_decision",
    "question_metadata_persisted"
  ],
  "idempotencyPolicy": "same_session_turn_id_returns_same_question_or_noop",
  "concurrencyPolicy": "single_active_interview_next_turn_per_session",
  "retryPolicy": {
    "schema_failure": "retry_once",
    "provider_timeout": "fallback",
    "permission_failure": "do_not_retry"
  },
  "cancellationPolicy": "cancel_when_session_paused_or_ended",
  "dataClassification": "candidate_sensitive",
  "maxModelCalls": 1,
  "maxTokens": 2500,
  "maxCostUsd": 0.01,
  "deadlineMs": 2500,
  "fallbackAction": "ASK_POOL_QUESTION"
}
```

Runtime guarantees to enforce:

- Idempotency：WebSocket retry 或重複 `speech_end` 不能問出兩題。
- Concurrency：同一 session 同時只能有一個 active `interview_next_turn` workflow。
- Cancellation：使用者 pause / end interview 時，仍在生成的 action 要能取消或降級為 no-op。
- Budget：每個 action 有最大 model calls、tokens、cost、deadline。
- Retry classification：schema failure 可 retry；permission failure 不可 retry；provider timeout 應走 fallback。
- Postconditions：action 完成後要能檢查 question metadata、counting、dedupe、gate result 是否存在。

---

## 9. MemoryPolicy and Human Review

### 9.1 MemoryPolicy

| memory 類型 | 可讀者 | 可寫者 | 可否影響 scoring | policy |
| --- | --- | --- | --- | --- |
| session-local agent memory | interviewer、evaluator、report | controller / memory service | limited | 必須有 source turn 或 source workflow |
| reflection records | report、coaching summary | reflection writer | no direct scoring | 只能作 coaching insight |
| UserCoachingMemory | future sessions、report summary | bounded background writer | no direct scoring by default | 只能作 next-practice hint，不可當 latest answer |
| progress memory | progress dashboard | analytics/profile service | no | 需要 aggregation，不由單次 LLM 直接決定 |

Memory write 最小欄位：

```json
{
  "memoryScope": "session",
  "sourceWorkflowRunId": "wf_...",
  "sourceEvidenceRefs": ["turn_7", "question_3"],
  "writeReason": "candidate repeatedly gave broad answers without measurable result",
  "confidence": 0.72,
  "canAffectScoring": false,
  "retentionClass": "coaching_summary"
}
```

### 9.2 HumanReviewGate resume semantics

Human review 必須定義「review 後 workflow 怎麼繼續」。

| 場景 | 建議語義 | 原因 |
| --- | --- | --- |
| transcript immediate confirmation | same-run resume | confirmation 是同一 turn 的一部分 |
| JD / CV review | child workflow after user confirm | review 會改變 downstream match input |
| report unsupported claim | child workflow repair/publish decision | report artifact 版本需要保留 |
| production release gate | blocking external gate | 不應被 runtime fallback 自動繞過 |

Review record：

```json
{
  "gateId": "human_review_...",
  "workflowRunId": "wf_...",
  "reviewType": "unsupported_report_claim",
  "blocking": true,
  "reason": "Report contains a claim not supported by transcript evidence.",
  "reviewerDecision": "rejected",
  "resumeMode": "child_workflow",
  "childWorkflowRunId": "wf_repair_..."
}
```

---

## 10. Implementation Plan

### Phase 0：Baseline and semantic inventory

先做 inventory，不先建新 runtime。

要回答：

- 現有 `decisionRecords`、`trajectoryRecords`、`agentTraceEvents` 各自代表什麼。
- 哪些欄位重複，哪些欄位缺失。
- 哪些資料會影響 scoring、report、question selection。
- 現有 fallback rate、unsupported claim rate、report repair rate、question degraded rate、voice first-audio latency 是多少。
- 哪些現有 guard 可以直接 adapter。

Deliverables：

- `harness_semantic_inventory.md` 或等價內部文件。
- baseline metrics snapshot。
- current capability to adapter mapping。
- first vertical slice 的 schema draft。

### Phase 1：Report pipeline shadow harness

第一條 vertical slice 選 report generation + QA。

理由：

- Report 風險和價值都高。
- 現有 QA repair、claim grounding、report status、repair history 已經存在。
- 不在 voice hot path，不會直接破壞 3 秒 latency target。
- 很適合驗證 `WorkflowRun`、`ExecutionSpan`、`GateResult`、`publicationStatus` 和 artifact version。

Scope：

```text
WorkflowRun: generate_report
  -> build_turn_dataset span
  -> report_generation span
  -> report_qa span
  -> optional_repair span
  -> persist_report span
```

Mode：shadow / read-only。不得改變現有 report output。

Acceptance：

- `WorkflowRunView` 與現有 report result parity 為 100%。
- Publishable report claim provenance 為 100%。
- Report `ready`、`ready_after_repair`、`needs_review`、`repair_failed` 可映射到 `publicationStatus` 和 `qualityStatus`。
- Repair history 可映射成 `ExecutionSpan` / `AgentEvent`。

### Phase 2：Interview action contracts，observe -> warn -> block

第二條 slice 是 `interview_next_turn`，但先 observe，不立即 block。

理由：adaptive controller 已有多種 fallback 和 degraded path。第一天就 block 可能把現有合法 fallback 誤判成違規。

Enforcement ladder：

| mode | 行為 |
| --- | --- |
| `observe` | 記錄 contract violation，不改 output |
| `warn` | 記錄 warning，對 developer/debug UI 顯示 |
| `block` | 阻擋高風險違規，走 fallback 或 human gate |

Scope：

- ActionContract for `ASK_POOL_QUESTION`、`ASK_PROBING_QUESTION`、`ASK_VALIDATION_QUESTION`、`SWITCH_TOPIC`、`WRAP_STAGE`。
- Idempotency for duplicate `speech_end` / retry。
- Single active `interview_next_turn` per session。
- Model-selected action 必須存在於 allowed candidate actions。
- Question novelty / counting gate 作為 adapter，不重做 dedupe。

Acceptance：

- selected action contract compliance 達 100% in observe mode，或違規都能被分類。
- duplicated official question rate 不高於 baseline。
- voice p95 first-audio regression 不超過 baseline + 200 ms，或先用 Phase 0 baseline 定義百分比門檻。

### Phase 3：MemoryPolicy + HumanReviewGate

Scope：

- 為 session memory、reflection、UserCoachingMemory 加 wrapper。
- Memory write 必須有 source workflow / source evidence。
- Define same-run resume vs child-run continuation。
- Transcript confirmation、report review、JD/CV review 對應不同 review semantics。

Acceptance：

- memory provenance coverage 100% for new writes。
- human review gate 都有 reviewer decision 或 explicit waiting state。
- unconfirmed high-risk transcript 不進 scoring dataset。

### Phase 4：Persistence, debug UI, retention

等 schema 穩定後再持久化，不要太早新增 permanent collection。

可能新增：

- `WorkflowRun`
- `ExecutionSpan`
- `GateResult`
- `AgentEvent`
- `AgentProfileSnapshot`
- `ActionContractSnapshot`

Deliverables：

- developer-facing debug timeline。
- failed/degraded run visibility 100%。
- retention/deletion propagation tests。
- successful run summary retention，failed/degraded run debug retention。

---

## 11. Acceptance Criteria

| 指標 | 第一版標準 |
| --- | --- |
| read-model/result parity | 100% in shadow mode |
| selected action contract compliance | 100% or classified violation in observe mode |
| publishable report claim provenance | 100% |
| memory provenance coverage | 100% for new writes |
| orphan/unmapped events | < 5% initially，之後降到 0 |
| failed/degraded run visibility | 100% |
| voice p95 first-audio regression | 不超過 Phase 0 baseline + 200 ms，或明確定義百分比門檻 |
| duplicated official question rate | 不高於 Phase 0 baseline |
| human-review false interruption rate | 必須經 replay test 驗證後才能從 warn 進 block |
| deletion propagation coverage | CV/session/account delete path 有明確 run artifact policy |

---

## 12. Testing Strategy

除了 unit / contract tests，還需要 runtime-oriented tests。

| 測試類型 | 要驗證什麼 |
| --- | --- |
| contract tests | ActionContract、MemoryPolicy、EvaluationPolicy 是否阻擋非法狀態 |
| recorded-session replay | 同一 session replay 後 harness view 不改變原結果 |
| failure injection | provider timeout、schema failure、permission failure、QA failure 的分類 |
| out-of-order background events | trace/event mapper 能處理背景 job 晚到 |
| duplicate WebSocket messages | 重複 `speech_end` 不產生兩題 |
| stale memory/context | 舊 memory/context 不可影響當前 scoring |
| prompt injection inside CV/JD | untrusted content 不可覆蓋 system/action rules |
| malformed structured output | retry/fallback policy 生效 |
| retention/deletion propagation | source artifact delete 後 derived run artifact 有 policy |
| report publication replay | `needs_review` / `repair_failed` 不會被誤標為 publishable |

---

## 13. Maturity Levels

H2 / H3 如果要成為 release gate，必須先定義。

| Level | 定義 | Kiwi 適用範圍 |
| --- | --- | --- |
| H0: implicit workflow | 現有 service 能跑，但缺少統一 harness view | legacy behavior only |
| H1: shadow observability | `WorkflowRunView` / `ExecutionSpan` read model，不改 output | report shadow harness |
| H2: observed contracts | ActionContract / MemoryPolicy / GateResult 以 observe/warn 模式運作 | interview next-turn、question selection |
| H3: enforced contracts | 高風險 contract 可 block / fallback / human review，並有 persistence 與 replay tests | report publication、voice safety、Role-Fit release gate |

第一版建議：

- Report pipeline 先做到 H1，確認 parity 後進 H2/H3。
- Interview next-turn 先做到 H2 observe/warn。
- Voice hot path 不應直接進 H3 block，除非 latency 和 replay false positive 已被驗證。

---

## 14. Candidate-facing Explanation Policy

第一版不要預設在面試中即時顯示「為什麼問這題」。

原因：

- 會打斷 interview flow。
- 可能讓候選人迎合評分邏輯。
- 可能暴露過多 internal ranking / evidence strategy。

建議：

| 場景 | 顯示策略 |
| --- | --- |
| live interview | 不顯示 internal reason，只保持自然對話 |
| post-session review | 顯示 user-safe question reason、expected signal、evidence gap |
| developer audit | 顯示 full WorkflowRun timeline、spans、gates、fallback |
| internal debug | 可看 redacted payload refs、provider errors、failure classification |

---

## 15. 不建議第一版做的事

- 不要把 Kiwi 改成完全 autonomous multi-agent swarm。
- 不要建立第二套 orchestration engine 取代 interview controller。
- 不要把所有 service call 都變成平級 `AgentRun`。
- 不要在 voice hot path 放入重型 multi-agent deliberation。
- 不要重寫 report QA、claim grounding、question dedupe、voice confidence gate。
- 不要保存 raw chain-of-thought。
- 不要讓 memory 直接影響 scoring，除非 policy、provenance、gate 都已就緒。
- 不要在沒有 baseline 的情況下宣稱 harness 改善了品質。

---

## 16. Open Questions

- `WorkflowRun` 第一版是否只做 read model，還是 report pipeline 先落 persistent model？
- Existing `SessionAnalysis` 是否足夠支撐 H1/H2，還是需要新增 denormalized view？
- Human review same-run resume 與 child-run continuation 要在哪些流程分界？
- Provider egress policy 是否要依 model/provider 做 allowlist？
- Failed/degraded run 的 retention 是否要比 successful run 長？
- Candidate-facing post-session explanation 要放在 report、timeline，還是 debug-only beta view？

---

## 17. Source Evidence Status

本計畫基於 2026-07-13 對 repo-docs、current code-document alignment、agent registry、interview controller、question preparation、voice confidence gate、report QA / repair / grounding、agent memory / trace 與 harness research reference 的整理。它描述的是後續 architecture target，不代表目前 runtime 已經完整具備 `WorkflowRun`、`ExecutionSpan`、formal `ActionContract`、formal `MemoryPolicy`、formal `HumanReviewGate` 或 persisted harness model。

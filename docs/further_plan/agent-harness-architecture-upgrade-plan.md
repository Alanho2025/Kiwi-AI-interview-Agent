# Product Agent Harness Upgrade Guide Plan

狀態：future-facing guide plan，不代表目前 runtime 已實作。
用途：作為 Kiwi 後續升級產品 agent 的主指南。
基準：本計畫以目前「product controller + specialized agent services」為起點，目標是補上一層 shared harness infrastructure，而不是把系統改成完全 autonomous multi-agent swarm。

核心判斷：

> A product agent is not just a model. A production product agent is a model-assisted domain workflow wrapped by a harness that controls context, action execution, memory, verification, guardrails, observability, evaluation and human review.

換句話說，Kiwi 要升級的不是「多叫幾個 agent」或「把所有 service 改名成 AgentRun」。Kiwi 要升級的是模型外層的產品級 harness：讓 CV/JD、candidate answer、interview state、memory、RAG、report QA、human review 和 eval 進入同一套可治理、可驗證、可回放的 runtime。

參考文件：

- [Databricks: What is an AI Agent Harness?](https://www.databricks.com/blog/ai-harness)
- [Approved Harness Goal](../harness/goal.md)
- [M1 Proposed Spec](../harness/spec.md)
- [Harness Execution Rules](../harness/AGENTS.md)
- [Product Harness Boundary Map](product-harness-boundary-map.md)
- [Product Harness Contract Spine](product-harness-contract-spine.md)
- [Product Harness Contract Pressure Tests](product-harness-contract-pressure-tests.md)
- [Harness Engineering 定義參考](../references/harness-engineering-reference.md)
- [Agent registry 與 task runner](../../repo-docs/modules/agent-registry-and-task-runner.md)
- [Agent memory 與 trace](../../repo-docs/modules/agent-memory-and-trace.md)
- [Report generation 與 QA](../../repo-docs/modules/feature-report-and-qa.md)
- [Interviewer agent](../../repo-docs/modules/agent-interviewer.md)
- [Match 與問題準備](../../repo-docs/modules/feature-match-and-question-prep.md)
- [Voice interview](../../repo-docs/modules/feature-voice-interview.md)
- [Code-Document Alignment Map](../code-document-alignment.md)

---

## 1. 這份 guide plan 要解決什麼

Kiwi 目前已經有幾個 agent-like component：

- `masterAiService` 負責 task runner 與產品控制流。
- `agentRegistryService` 登記 retrieval、interviewer、report generator、report QA、interview evaluator。
- `actionPlanner` 和 interview controller 會根據 session state 決定下一步。
- Report pipeline 已有 QA、repair、claim grounding 和 status。
- Voice path 已有 transcript confidence、confirmation、barge-in、latency 與 state-machine 約束。
- Memory/trace 會記錄 session pattern、reflection、trajectory 和 agent trace event。

這些能力是好的，但它們仍然分散在各功能裡。後續如果要把 Kiwi 變成更成熟的產品 agent，不能只靠 prompt 或單點 service 增強。需要一層 shared harness infrastructure，讓所有 AI workflow 都有一致的：

- context boundary
- action/tool boundary
- memory policy
- verification loop
- guardrail and human review gate
- observability and audit trail
- evaluation and release gate
- privacy, retention and deletion policy

本文件的任務就是把這條升級路線寫清楚，讓後續 implementation 不會迷失成「重寫 controller」、「增加 agent 數量」或「先做漂亮 schema」。

---

## 2. Product Agent 的目標定義

Kiwi 的 target product agent 不是泛用聊天機器人，也不是完全自治的 workflow runner。它應該是：

```text
domain product controller
  -> model-assisted specialist components
  -> shared harness infrastructure
  -> verified product output
```

其中：

| 部分 | 責任 | Kiwi 例子 |
| --- | --- | --- |
| Domain product controller | 決定產品流程、session 狀態、題數、時間、使用者確認和可見輸出 | interview controller、`masterAiService`、report workflow |
| Model-assisted specialist components | 在受控任務裡做理解、自然語言生成、評估或 repair | interviewer、interview evaluator、report generator、report QA |
| Shared harness infrastructure | 控制模型能看什麼、能做什麼、如何驗證、如何記錄、何時需要人介入 | ContextPacket、ActionContract、MemoryPolicy、GateResult、AgentEvent、eval runner |
| Verified product output | 可給 candidate 或 developer 使用的最終結果 | next question、match diagnostics、grounded report、debug timeline |

重要邊界：

- Domain controller 仍然是產品行為的 source of truth。
- Harness 是包住現有 workflow 的控制、驗證與觀測層，不是第二套 orchestration engine。
- Model 可以輔助 reasoning 和 wording，但不能單獨決定高風險產品結果。
- Schema 服務於 governance 和 debugging，不能反過來主導產品流程。

### 2.1 Approved Product Decisions（2026-07-15）

以下是產品 owner 已確認的 target decisions；它們不代表 current runtime 已實作：

1. CV-JD match、question preparation 維持 guarded workflow / context producer，不因使用 LLM 就升格成獨立 product agent。
2. Memory target 是 user-scoped、cross-session interview learning memory。它可以讓 interview 避免例行重問已多次證明的內容、改問其他 coverage gap，或提高同一能力的問題深度。
3. User-level memory 可以影響 planning、question selection、question depth 和 post-session coaching；V0 `canAffectScoring=false`，evaluator 不把歷史 memory 當本輪答案證據。
4. Report QA-only 不得 silent rewrite。Blocking QA 結果進 `needs_review`；repair 必須是明確、可追蹤、可版本化的 action 或 child run。
5. Candidate-sensitive context 預設只保存 refs/hash/version；只在必要時保存 redacted snapshot。來源刪除後，derived content 必須 delete/recompute/redact，只允許保留不含內容的 audit tombstone。
6. Transcript immediate confirmation 使用 same-run `waiting -> running`；只有 run 已失效或無法安全恢復時才建立 child run。這個產品語義仍需 reconnect/timeout replay 驗證。
7. Full WorkflowRun timeline、spans、gates、fallback 和 failure detail 是 developer-facing。一般使用者只看重要、非技術性的 progress、已證明能力、下一步練習重點和 report evidence summary。
8. V0 rollout 採全產品 shared target；第一個 runtime slice 是 `interview_next_turn` shadow/observe，第一個候選 enforce slice 是 report QA。
9. Authority order 正式採 `policy/safety > controller > contract/gate > deterministic rule > model > wording`。

尚未由產品 owner 確認：gate 進入 enforce 的品質門檻，以及 user memory 升級成「已證明 / 可停止例行重問」需要幾次獨立 session 和多久重新驗證。

---

## 3. 為什麼這才是 Kiwi 需要的 harness

Databricks 的 framing 很適合 Kiwi：agent 不是 model 本身，而是 model + harness。Model 負責 reasoning；harness 負責 action、memory、workspace、execution environment、guardrails、observability 和 feedback loop。

放到 Kiwi，就是：

| Raw model 做不到的事 | Kiwi 產品風險 | Harness 要提供的能力 |
| --- | --- | --- |
| 穩定知道哪些 CV/JD/transcript evidence 可以用 | unsupported claim 變成錯誤 coaching | claim-to-evidence mapping、publication gate |
| 穩定知道下一題是否該問、是否重複、是否算正式題 | interview flow 失真或 question count 錯 | ActionContract、question counting gate、dedupe trace |
| 穩定處理低信心 transcript | 把系統聽錯誤判成候選人答錯 | transcript confidence path、confirmation gate、scoring eligibility |
| 穩定管理跨 session memory | 舊記憶污染當前評分或問題選擇 | MemoryPolicy、provenance、`canAffectScoring` |
| 穩定判斷何時要 human review | report 或 JD review 被隱形修改 | HumanReviewGate、resume semantics、artifact version |
| 穩定比較新版本是否更可靠 | demo 成功但產品品質退化 | replay eval、failure attribution、baseline metrics |

所以 Kiwi 的 harness upgrade 應該以 production reliability 為中心，而不是以「agent 數量」或「模型能力」為中心。

---

## 4. 設計原則

### 4.1 Wrap existing workflows, do not replace them

第一版 harness 必須包裝現有 domain workflow。不要重寫 `masterAiService`，不要重做 report QA，不要重做 question dedupe，不要把 voice hot path 改成重型 multi-agent deliberation。

成功標準是：現有結果不變，但每次 AI workflow 都可以被觀察、驗證、回放和歸因。

### 4.2 Verification before publication

任何會影響 candidate 對自己能力、job fit 或 interview strategy 理解的 output，都要先通過 verification。尤其是 report claim、role-fit explanation、match gap、question reason。

### 4.3 Action boundary before autonomy

不要先增加 agent 自由度。先定義 agent 可以採取哪些 action、action 的 precondition/postcondition、timeout、retry、fallback、idempotency 和 cancellation。

### 4.4 Context is data, not instruction

CV、JD、candidate answer、transcript 都是 untrusted content。它們只能作為 data 使用，不可以覆蓋 system prompt、tool permission、action contract 或 scoring policy。

### 4.5 Memory needs provenance

Memory 不應該是「模型覺得值得記住」。每個 memory write 都要知道 source workflow、source evidence、write reason、confidence、retention class，以及是否可以影響 scoring。

### 4.6 Observe -> warn -> block

高風險 gate 不要第一天就 block。先 observe，收集 baseline；再 warn；最後只對 false positive 已驗證可控的場景 block 或 human gate。

### 4.7 No hidden human correction

使用者、reviewer 或 developer 的介入要留在 trace 裡。人工確認不能隱形修改結果，否則無法知道產品 agent 是否真的可靠。

### 4.8 Do not store raw chain-of-thought

Debug 和 candidate-facing explanation 需要 user-safe reason、evidence refs、decision signals、gate results、failure classification，不需要保存 raw chain-of-thought。

---

## 5. Production Harness Building Blocks

這一節是後續改產品 agent 時的 checklist。每個 AI workflow 都要能對應到這些 building blocks。

| Building block | Kiwi 需要的版本 | 第一版重點 |
| --- | --- | --- |
| System and task contract | 明確任務、不可做事項、成功條件、stop condition | 把 `cv_jd_match`、`interview_next_turn`、`generate_report` 寫成 task contract |
| Tools and action execution | 受控 action，不讓 model 任意呼叫內部能力 | `ActionContract` 包住 interviewer/report/retrieval/action planner |
| Execution environment | 控制 timeout、retry、fallback、cost、concurrency、cancellation | voice/interview next-turn 先做 deadline 和 idempotency |
| Durable workspace and storage | 保存 refs、versions、artifact status，而不是散落 payload | report version、ContextPacket refs、GateResult refs |
| Memory and context management | 管理 active context、summary、cross-session coaching memory | MemoryPolicy + ContextPacket |
| Feedback and self-verification | 每步結果都能被檢查，而不是讓 model 自稱完成 | report QA、claim grounding、replay eval、structured output validation |
| Guardrails and human review | 對高風險 output 阻擋、降級或交給人確認 | transcript confirmation、unsupported claim review、publication gate |
| Observability and logging | 知道 agent 做了什麼、為什麼、在哪裡失敗 | WorkflowRunView、ExecutionSpan、AgentEvent、FailureClassification |
| Evaluation infrastructure | 能比較 before/after，不只看 demo | recorded-session replay、baseline metrics、release gate |
| Governance and privacy | 控制資料外流、retention、deletion、user-visible explanation | data classification、egress policy、deletion propagation |

---

## 6. Failure Modes as Design Drivers

後續每個 harness implementation 都應該能說明它在降低哪一種 failure mode。

| Failure mode | Kiwi 表現 | Harness response |
| --- | --- | --- |
| Context rot | 長 session 後題目選擇或 report 引用舊資訊 | context compaction、ContextPacket version、active evidence set |
| Tool/action overload | agent 面對太多候選 action，選錯或慢下來 | action set pruning、ActionContract、allowed action whitelist |
| Brittle wiring | prompt 或 tool schema 小改造成 silent failure | contract tests、schema validation、failure classification |
| Latency | 多步 reasoning 破壞 voice first-audio 3 秒目標 | deadlineMs、fallbackAction、voice-specific fast path |
| Irrelevant retrieval | RAG 拉到錯 chunk，report 或問題卻看起來很有信心 | retrieval quality gate、claim-to-source mapping |
| Weak verification | report 或 match 自稱 grounded，但沒有證據 | publication gate、unsupported-claim zero tolerance |
| Missing guardrails | 低信心 transcript 直接被 scoring，或 report 直接 publish | transcript review gate、HumanReviewGate、scoring eligibility |
| Agent sprawl | 每個功能各做一套 trace、memory、policy | shared harness planes、common event/gate vocabulary |

---

## 7. Target Harness Planes

這些 planes 是 shared infrastructure 的責任切分。它們不是一條 linear execution chain。

### 7.1 Control Plane

回答「誰可以做什麼」。

| Component | Responsibility |
| --- | --- |
| `AgentProfile` | 定義 agent/service role、purpose、allowed workflows、allowed spans |
| `TaskContract` | 定義 task objective、scope、success criteria、stop condition、forbidden behavior |
| `ActionContract` | 定義 action schema、preconditions、postconditions、budget、deadline、fallback |
| `ToolScope` | 定義 service/provider/tool 可被誰用、何時用、能接觸哪些資料 |
| `EvaluationPolicy` | 定義 workflow 必須通過哪些 checks、evals 或 human gate |

### 7.2 Context and Memory Plane

回答「這次模型看到了什麼，哪些記憶可以影響它」。

| Component | Responsibility |
| --- | --- |
| `ContextPacket` | 保存本次 workflow 使用的 immutable refs、hash、version、trust metadata |
| `MemoryPolicy` | 控制 session/user scope、reader、writer、provenance、question-planning authority、scoring boundary、retention |
| `EvidenceSet` | 把 CV/JD/transcript/RAG chunk 變成可引用 evidence refs |
| `ContextCompaction` | 長 session 裡控制 active context 和 summary |

### 7.3 Execution Plane

回答「這次任務實際發生了什麼」。

| Component | Responsibility |
| --- | --- |
| `AgentEpisode` | 一個完整 user work segment，例如整場 interview 或一次 preparation |
| `WorkflowRun` | 一次 user-visible task，例如 `interview_next_turn` 或 `generate_report` |
| `ExecutionSpan` | WorkflowRun 裡的一段 service/agent execution |
| `ActionExecution` | action input/output refs、latency、retry、fallback、cost |
| `ResultRef` | workflow 對外產物的 versioned refs |

### 7.4 Verification Plane

回答「結果是否可以信任」。

| Component | Responsibility |
| --- | --- |
| `GateResult` | 統一表示 pass/warn/block/review/degrade |
| `ClaimGroundingCheck` | report/match claim 是否有支持證據 |
| `QuestionQualityCheck` | question novelty、coverage、level、counting 是否合格 |
| `TranscriptEligibilityCheck` | transcript 是否能進 scoring dataset |
| `ReplayCheck` | 同一 recorded session 在新版本下是否保持可接受行為 |

### 7.5 Governance Plane

回答「什麼不能做，什麼需要人確認」。

| Component | Responsibility |
| --- | --- |
| `HumanReviewGate` | blocking/non-blocking review、decision、resume semantics |
| `PrivacyPolicy` | candidate data、CV、JD、transcript 的存取與展示邊界 |
| `DataEgressPolicy` | 哪些 provider/model/web enrichment 可以接收哪些資料 |
| `RetentionPolicy` | run artifact、trace、memory 的保存期限 |
| `DeletionPropagation` | CV/session/account delete 後 derived artifact 如何處理 |

### 7.6 Observability and Evaluation Plane

回答「怎麼知道它好或壞，怎麼比較版本」。

| Component | Responsibility |
| --- | --- |
| `AgentEvent` | 統一 timeline event |
| `Trace` | latency、cost、provider result、fallback、redacted payload refs |
| `Metrics` | contract compliance、claim provenance、latency regression、review precision |
| `FailureClassification` | context/tool/model/policy/permission/verification/environment/human gate |
| `EvalRun` | baseline、regression、release gate 和 dataset version |

---

## 8. Current Capability to Harness Mapping

第一版不要重造輪子。先把現有能力包成 harness adapters。

| Current capability | Harness representation | Change type |
| --- | --- | --- |
| voice transcript confidence gate | `TranscriptEligibilityCheck` + `stt_confidence_safety` gate | adapter |
| transcript review policy | `HumanReviewGate` + scoring eligibility event | adapter |
| question-pool readiness diagnostics | `question_pool_readiness` gate | adapter |
| reserve question generation / degraded question pool | `question_pool_degraded` event + `qualityStatus=degraded` | adapter |
| runtime deduplication / novelty guard | `question_novelty` gate | adapter |
| model action whitelist in action selector | `ActionContract` allowed action boundary | strengthen existing check |
| decision records | `AgentEvent` mapper | read-model mapping |
| trajectory records | `ExecutionSpan` mapper | read-model mapping |
| agent trace events | `AgentEvent` mapper | read-model mapping |
| report QA repair loop | `report_qa` span + `report_repair` event | adapter |
| claim grounding / re-grounding | `ClaimGroundingCheck` gate | adapter |
| repair history and report version | `ResultRef` + artifact version | adapter |
| `SessionReport.latestStatus` | `publicationStatus` + `qualityStatus` | adapter |
| user coaching memory | `MemoryPolicy` wrapper | policy enforcement |
| role-fit compact diagnostics | diagnostic event + degraded reason | adapter |

第一版的成功標準：現有 workflow output 不變，但同一套 harness view 可以解釋它看了什麼、做了什麼、檢查了什麼、為什麼 publish/warn/block/degrade。

---

## 9. Runtime Read Model

`WorkflowRun`、`ExecutionSpan`、`AgentEvent` 是 read model，不是產品流程的中心。它們的目的只有三個：

1. 讓 developer 能查看完整 debug timeline、failure、gate 和 fallback。
2. 讓 eval 能 replay 和比較版本。
3. 讓 governance 能知道 output 是否可發布。

這個 detailed read model 不直接給一般使用者。Candidate-facing UI 只投影重要、可理解且經 redaction 的 progress / evidence summary。

### 9.1 WorkflowRun

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

### 9.2 ExecutionSpan

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

### 9.3 AgentEvent

`AgentEvent` 是 timeline event。

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

### 9.4 Status model

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

人工確認後有兩種語義：

1. Same-run resume：原 `WorkflowRun` 從 `waiting` 回到 `running`，適合 transcript confirmation 這種同一輪可恢復流程。
2. Child-run continuation：原 `WorkflowRun` 結束為 `completed + needs_review`，review action 建立 child `WorkflowRun`，適合 report edit、repair、publish decision。

不能讓 review 隱形修改結果。

---

## 10. Core Contracts

### 10.1 ContextPacket

CV、JD、transcript 都是 untrusted content。Harness 必須把它們當 data，不允許它們改寫 system、action 或 policy rules。

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

Policy rules：

- `ContextPacket` 儘量保存 immutable refs、hash 和版本，不重複保存整份 transcript 或 CV。
- JD、CV、candidate answer、transcript 只能作為 data 使用，不可覆蓋 system prompts、action contracts、tool permissions。
- `instructionUseAllowed=false` 的內容若包含 prompt-injection 式文字，應作為 risk signal，不是 agent instruction。
- Provider/model egress 必須按 data classification 控制。候選人 CV 和 transcript 預設是 `candidate_sensitive`。
- 外部 web enrichment 不應帶出 candidate data。若只查公司或職缺公開資訊，也要跟 candidate profile 分離。
- 使用者刪除 CV、session 或 account 時，相關 refs、derived memory、trace payload、WorkflowRun artifact 必須有 deletion propagation 或 tombstone policy。

### 10.2 ActionContract

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

Runtime guarantees：

- Idempotency：WebSocket retry 或重複 `speech_end` 不能問出兩題。
- Concurrency：同一 session 同時只能有一個 active `interview_next_turn` workflow。
- Cancellation：使用者 pause/end interview 時，仍在生成的 action 要能取消或降級為 no-op。
- Budget：每個 action 有最大 model calls、tokens、cost、deadline。
- Retry classification：schema failure 可 retry；permission failure 不可 retry；provider timeout 應走 fallback。
- Postconditions：action 完成後要能檢查 question metadata、counting、dedupe、gate result 是否存在。

### 10.3 MemoryPolicy

| memory 類型 | 可讀者 | 可寫者 | 可否影響 scoring | policy |
| --- | --- | --- | --- | --- |
| session-local agent memory | interviewer、evaluator、report | controller / memory service | limited | 必須有 source turn 或 source workflow |
| reflection records | report、coaching summary | reflection writer | no direct scoring | 只能作 coaching insight |
| current `UserCoachingMemory` adapter | future sessions、report summary | bounded background writer | no | current source 只作 coaching hint，不得假裝已是完整 learning profile |
| target user interview learning memory | question planner、question-pool preparation、post-session summary | policy-gated user-memory aggregator | pending；V0 建議 no | 可調整 coverage、question family 和 depth；決策前不可當本輪 answer 或 scoring evidence |
| progress view | candidate-safe progress UI | user-memory projection / analytics | no | 只顯示重要的已證明能力、待加深方向和重新驗證提示，不顯示 internal trace |

Memory write 最小欄位：

```json
{
  "memoryScope": "user_interview",
  "sourceWorkflowRunId": "wf_...",
  "sourceEvidenceRefs": ["turn_7", "question_3"],
  "applicability": {
    "roleFingerprint": "role_...",
    "competencyKey": "stakeholder_conflict",
    "questionFamilyKey": "conflict_resolution"
  },
  "learningState": {
    "independentSessionCount": 3,
    "demonstratedDepth": "evidence_and_tradeoff",
    "recommendedNextDepth": "constraint_and_failure_analysis",
    "routineRepeatEligible": false,
    "revalidateAfter": "policy-derived timestamp"
  },
  "writeReason": "multiple independent sessions contain strong grounded evidence",
  "confidence": 0.72,
  "canAffectPlanning": true,
  "canAffectQuestionSelection": true,
  "canAffectQuestionDepth": true,
  "canAffectScoring": false,
  "retentionClass": "derived_user_interview_memory"
}
```

「回答很好就不再問」在 runtime 中應表示：停止同一深度的例行重問、轉向其他 coverage gap，或改問更深的 constraint/trade-off/failure 題。它不表示永久封鎖該能力；role relevance 改變、memory 過期、證據衝突或需要更高深度時可以重新驗證。

### 10.4 HumanReviewGate

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

## 11. Upgrade Roadmap

狀態：Rollout sequence 已獲 Product Owner 核准；每個 implementation milestone 仍須依 root `AGENTS.md` 取得非平凡 code/architecture change approval，且不得因本頁排序自動跳過 gate。

### Phase 0：Baseline and failure-mode inventory

先做 inventory，不先建新 runtime。

要回答：

- 現有 `decisionRecords`、`trajectoryRecords`、`agentTraceEvents` 各自代表什麼。
- 哪些欄位重複，哪些欄位缺失。
- 哪些資料會影響 scoring、report、question selection。
- 現有 fallback rate、unsupported claim rate、report repair rate、question degraded rate、voice first-audio latency 是多少。
- 哪些現有 guard 可以直接 adapter。
- 哪些 failure mode 現在最常發生：context、retrieval、model、tool/action、verification、policy、latency、human review。

Deliverables：

- [Product Harness Boundary Map](product-harness-boundary-map.md)：確認 CV-JD、question、interview、memory、report、QA、voice 的角色與 run boundary。
- [Product Harness Contract Spine](product-harness-contract-spine.md)：定義七個 shared contract family。
- [Product Harness Contract Pressure Tests](product-harness-contract-pressure-tests.md)：用四個產品 case 驗證 contract 表達力。
- [Pre-Harness Baseline Metrics](../references/pre-harness-baseline-metrics.md) 與 current capability adapter mapping。

### Phase 1：Shared harness kernel in shadow mode

先建立 shared vocabulary 和 read-model mapper，不改 product output。

Scope：

- `WorkflowRun`
- `TaskContract`
- `ContextPacket`
- `ActionContract`
- `GateResult`
- `MemoryWrite`
- `FailureClassification`
- Nested/ref-only `ExecutionSpan` / `AgentEvent`

Acceptance：

- Shadow view 不改現有 workflow output。
- `cv_jd_match`、`interview_next_turn`、memory write、report QA 四個代表 case 都能映射到 shared contract。
- orphan/unmapped events 初期 < 5%，之後降到 0。
- 每個 degraded/failed run 都能分類到 context、tool/action、model、policy、permission、verification、environment 或 human gate。

### Phase 2：Interview core observe harness

第一條 observe-mode vertical slice 選 `interview_next_turn`，但不立即 block。

理由：

- 這是 Kiwi 的核心 agent loop，同時經過 retrieval、evaluation、planning、bounded model selection、question execution、state change、trace 和 memory write。
- 它能驗證 shared spine 是否真的跨產品，而不是只適合 report。
- Adaptive controller 有多種合法 fallback/degraded path；第一版只 observe 才不會誤擋現有行為。

Enforcement ladder：

| mode | 行為 |
| --- | --- |
| `shadow` | 建 run/context/action view，不改 output |
| `observe` | 記錄 contract compliance/violation，不改 output |
| `warn` | 對 developer/debug view 顯示 warning |
| `enforce` | 只在 replay 和 false-positive gate 通過後，才 block/fallback/review |

Scope：

- ActionContract for `ASK_POOL_QUESTION`、`ASK_PROBING_QUESTION`、`ASK_VALIDATION_QUESTION`、`SWITCH_TOPIC`、`WRAP_STAGE`。
- State-before/state-after、candidate/selected/fallback action、question side effects。
- Single active `interview_next_turn` per session；duplicate client/voice event idempotency。
- Model-selected action 必須存在於 allowed candidate actions。
- Question novelty/counting、transcript eligibility 和 memory write 先作 adapter，不重做 current guards。

Mode：shadow -> observe -> warn。Phase 2 不進 block。

Acceptance：

- Run/action/question/state read-model parity 為 100%。
- selected action contract compliance 達 100%，或所有 violation 都能分類且不改 legacy fallback。
- duplicated official question rate 不高於 baseline。
- question counting 與 repair/clarification/confirmation policy 一致。
- Background trace/memory write 能回綁 source run，無法綁定時明確標 observability gap。

### Phase 3：Report verification enforcement pilot

第一個可進 warn/enforce 的 gate slice 選 report generation + QA。

理由：report QA 已有明確 blocking flags、claim grounding、repair history 和 publication status；它不在 voice hot path，最適合驗證 verification before publication。

Scope：

```text
WorkflowRun: generate_report
  -> build_turn_dataset span
  -> report_generation span
  -> report_qa span
  -> optional_repair span
  -> persist_report span
  -> publication_gate
```

Mode：shadow -> warn -> enforce。第一步不得改變現有 report output；只有 replay 驗證過的 publication rule 才能 enforce。

Acceptance：

- Report result/read-model parity 為 100%。
- Publishable report claim provenance 為 100%。
- Report `ready`、`ready_after_repair`、`needs_review`、`repair_failed` 可映射到 `publicationStatus` 和 `qualityStatus`。
- Unsupported claim 不可進入 publishable output。
- QA failed、persistence failed、repair failed 可被不同 failure/gate semantics 表示。
- Repair history 可映射成 nested span/event refs。

### Phase 4：User-level interview learning memory and context policy

Scope：

- 先為 session memory、reflection、current `UserCoachingMemory` 加 provenance wrapper。
- 建立 target user interview learning memory projection，按 user + role/competency/question-family 聚合多次 session evidence。
- Memory write 必須有 source workflow / source evidence。
- Memory read 必須標示是否可影響 planning、question selection、question depth、report explanation 或 scoring。
- Planner 可以用已證明能力停止例行重問、提高深度或轉向 coverage gap；evaluator 不得把歷史 memory 當本輪 scoring evidence。
- ContextPacket 必須標示 trust level、data classification、hash/version。
- 長 session context compaction 必須保留 active evidence set 和 dropped context reason。

Acceptance：

- memory provenance coverage 100% for new writes。
- user-level memory 的 question-selection/depth effect 都能回指 source sessions、role/competency scope 和 policy version。
- 在 scoring authority 決策關閉前，shadow envelope 固定 `canAffectScoring=false`；planner/evaluator 取得 purpose-specific memory view。
- routine-repeat suppression 只有在跨獨立 session 的 evidence threshold、freshness 和 applicability gate 通過後生效。
- untrusted CV/JD/transcript 不可覆蓋 system/action rules。
- stale、role-mismatched 或 conflicting memory 不可 suppress question，也不可影響當前 scoring。

### Phase 5：Human review and governance gates

Scope：

- 實作已核准的 resume policy：transcript immediate confirmation same-run resume；expired/non-resumable flow 才用 child run。
- Transcript confirmation、report review、JD/CV review 對應不同 review semantics。
- Add data egress classification for model/provider usage。
- Add deletion propagation policy for derived run artifacts。

Acceptance：

- human review gate 都有 reviewer decision 或 explicit waiting state。
- unconfirmed high-risk transcript 不進 scoring dataset。
- report publish/reject/repair 保留 artifact version。
- CV/session/account delete path 有明確 run artifact policy。

### Phase 6：Evaluation and operational dashboards

Scope：

- recorded-session replay dataset。
- report publication replay。
- failure injection：provider timeout、schema failure、permission failure、QA failure。
- harness metrics dashboard。
- release gate for high-risk product-agent changes。

Acceptance：

- 每個 harness upgrade 都有 before/after comparison。
- failed/degraded run visibility 100%。
- human-review false interruption rate 必須經 replay test 驗證後才能從 warn 進 block。
- release note 必須列出 baseline、changed gate、regression result、manual/live gates。

### Phase 7：Voice hot-path hardening

Voice 不應該作為第一條 heavy harness slice。等 report/interview contract 穩定後，再把 lightweight gate 套進 voice hot path。

Scope：

- transcript confidence path。
- barge-in / repair / confirmation turn classification。
- deadlineMs and fallbackAction。
- duplicate speech-end idempotency。
- latency markers。

Acceptance：

- user speech end -> next question first audio 仍符合產品 latency target。
- repair prompt、confirmation、repeat request、system message、barge-in acknowledgement 不計為正式題。
- contentful low-confidence transcript 走 confirmation，不被直接 scoring。

---

## 12. Acceptance Criteria

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
| before/after evaluation | 每個高風險 harness upgrade 都要有 replay 或 deterministic regression result |

---

## 13. Testing Strategy

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
| latency regression | interview/voice first response 不因 harness 加重而失控 |

---

## 14. Maturity Levels

H2/H3 如果要成為 release gate，必須先定義。

| Level | 定義 | Kiwi 適用範圍 |
| --- | --- | --- |
| H0: implicit workflow | 現有 service 能跑，但缺少統一 harness view | legacy behavior only |
| H1: shadow observability | `WorkflowRunView` / `ExecutionSpan` / `AgentEvent` read model，不改 output | shared harness kernel、report shadow harness |
| H2: observed contracts | ActionContract / MemoryPolicy / GateResult 以 observe/warn 模式運作 | interview next-turn、question selection、memory/context |
| H3: enforced contracts | 高風險 contract 可 block / fallback / human review，並有 persistence 與 replay tests | report publication、transcript eligibility、Role-Fit release gate |
| H4: governed product-agent platform | shared governance、eval dashboard、release gate、deletion propagation、model/provider swap support | mature product-agent infrastructure |

第一版建議：

- Interview next-turn 先做到 H1/H2 shadow/observe，驗證跨產品 contract spine。
- Report pipeline 確認 H1 parity 後，作第一個進 H2/H3 的 enforceable gate。
- Memory/context policy 先做到 H2，不直接影響 scoring。
- Voice hot path 不應直接進 H3 block，除非 latency 和 replay false positive 已被驗證。

---

## 15. Candidate-facing Explanation Policy

第一版不要預設在面試中即時顯示「為什麼問這題」。

原因：

- 會打斷 interview flow。
- 可能讓候選人迎合評分邏輯。
- 可能暴露過多 internal ranking / evidence strategy。

建議：

| 場景 | 顯示策略 |
| --- | --- |
| live interview | 不顯示 internal reason，只保持自然對話 |
| post-session review | 顯示重要的已證明能力、這次提高或轉移問題深度的 user-safe 原因、下一個練習重點 |
| report | 顯示 claim 對應的 answer/evidence summary，不顯示 raw internal trace |
| developer audit | 顯示 full WorkflowRun timeline、spans、gates、fallback、memory read/write effect |
| internal debug | 可看 redacted payload refs、provider errors、failure classification |

---

## 16. How to Use This Guide for Future Implementation

每次要升級 Kiwi 的產品 agent 時，先回答這些問題：

1. 這次改的是哪個 workflow？`cv_jd_match`、`interview_next_turn`、`generate_report`、voice turn，還是 memory/report summary？
2. 這次改降低哪個 failure mode？context rot、irrelevant retrieval、weak verification、latency、missing guardrail，還是 agent sprawl？
3. 這次新增的是哪個 harness building block？ActionContract、ContextPacket、MemoryPolicy、GateResult、HumanReviewGate、EvalRun，還是 observability。
4. 這次是 shadow、observe、warn 還是 block？
5. 現有 product output 是否保持 parity？
6. 哪些 test、replay、eval 或 human gate 證明它更可靠？
7. 這次是否影響 candidate-sensitive data、provider egress、retention 或 deletion？

如果回答不清楚，不應該開始實作。

---

## 17. 不建議第一版做的事

- 不要把 Kiwi 改成完全 autonomous multi-agent swarm。
- 不要建立第二套 orchestration engine 取代 interview controller。
- 不要把所有 service call 都變成平級 `AgentRun`。
- 不要在 voice hot path 放入重型 multi-agent deliberation。
- 不要重寫 report QA、claim grounding、question dedupe、voice confidence gate。
- 不要保存 raw chain-of-thought。
- V0 不要讓 user-level memory 直接影響 scoring；即使未來考慮開放，也必須另做產品決策、policy、provenance、gate 和 eval。
- 不要在沒有 baseline 的情況下宣稱 harness 改善了品質。
- 不要先做漂亮 dashboard，卻沒有 GateResult、FailureClassification 和 replay evidence。
- 不要把 eval harness 分數直接等同於 production readiness。

---

## 18. Open Questions

- Developer-only `WorkflowRun` 第一版只做 derived read model，還是需要 persistent debug collection 與明確 retention window？
- Existing `SessionAnalysis` 是否足夠支撐 H1/H2，還是需要新增 denormalized view？
- 哪些 replay case 符合「必要」而允許保存 redacted `ContextPacket` snapshot？
- `cv_jd_match` 和 `prepare_question_pool` 是在 shared kernel Phase 1 一起做 shadow mapping，還是等 interview action contract 穩定後再接完整 run persistence？
- User memory 需要多少獨立 session/evidence 才能標示 `demonstrated` 並停止例行重問？多久或什麼事件後必須 revalidate？
- User-facing important progress summary 要先放在 post-session report，還是同步進 interview preparation / match review UI？
- Gate 從 observe/warn 進 enforce 的 false-block、latency、human-review cost 門檻是多少？
- H4 的 governed product-agent platform 是否需要跨 model/provider abstraction，還是先固定現有 provider 後再抽象？

Evidence status：本文件是後續升級產品 agent 的 guide plan。Current-state claims 應以 repo-docs 與現有 source 為準；target-state 內容不代表 runtime 已實作。

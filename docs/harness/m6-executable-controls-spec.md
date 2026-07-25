# M6 Executable Harness Controls Spec

- 狀態：`in_progress`
- Goal：G7 / M6
- Product Owner implementation approval：2026-07-26（shadow/observe controls 與 Report Trust Status UI）
- Promotion approval：pending（numeric budget、visibility/export、operator policy、warn/enforce）
- Execution mode：`spec -> shadow -> observe -> warn -> domain-owned enforce`
- Risk class：High
- Product output authority：current controller/runtime
- Runtime implementation：first local shadow/observe slice completed

相關文件：[Canonical Goal](goal.md)、[M1 Shadow Spec](spec.md)、[M2-M5 Milestone Contract](milestones-m2-m5.md)、[Final Scorecard](evidence/final-scorecard.md)、[Contract Spine](../further_plan/product-harness-contract-spine.md)、[Decision Questionnaire](../further_plan/product-harness-decision-questionnaire.md)。

## Overview

### Goal

把 Kiwi 已有的 refs-only `WorkflowRun`、`TaskContract`、`ContextPacket`、`ActionContract`、`GateResult`、`MemoryWrite` 和 `FailureClassification` 從執行後觀測資料，升級為可在執行前、中、後驗證的控制層。M6 要讓正式 task 在呼叫 agent/model/capability 前知道允許的 scope、context 和 budget；執行期間能停止超時、取消或越界工作；執行後能驗證 result、postcondition 和 write/publication decision。

M6 不建立第二個 controller。Contract 和 gate 只回傳 control decision；`masterAiService`、report controller、session/voice state machine 和 persistence service 仍執行 fallback、wait、reject、write 或 publish。

### Users

| Audience | M6 完成後可做什麼 |
| --- | --- |
| Product Owner | 查看每個 workflow 的 contract、budget、promotion gate、未核准 decision 和 rollback evidence。 |
| Developer/operator | 從單一 redacted run view 看 preflight、capability、budget、result validation、write gate、failure 和 stop reason。 |
| Candidate | 在 failure/degrade 時收到可理解的 retry、review 或 unsaved 狀態；看不到 internal trace、ranking、memory detail 或 chain-of-thought。 |
| Reviewer/eval | 用 frozen input 重跑 budget、permission、timeout、cancellation、publication 和 memory-write failure case。 |

### Current-state evidence

1. `runTask` 正式路由 `interview_next_turn`、`generate_report`、`qa_report`；`cv_jd_match` 與 `prepare_question_pool` 只有 docs/shadow mapping。
2. `agentRegistry` 是固定名稱到函式的 mapping；它還沒有 versioned capability metadata、data classification、input/output schema、side-effect class、budget 和 required gate。
3. Interview/report `TaskContract` 與 `ActionContract` 已能保存 allowed action、precondition、postcondition、idempotency、gate 和 fallback lineage，但主要由執行後 observation 建立。
4. Interview `ActionContract.deadlineMs` 目前是 `null`，retry policy 沒有 runtime attempt；report action 也沒有統一 task-level budget。
5. DeepSeek boundary 有 request timeout 和事後 usage recording，但沒有全產品 `maxModelCalls`、input/output token、cost ceiling、cancellation 和 budget-exceeded control。
6. Report publication gate 已映射 critical/review/pass，但 `enforced=false`；M3 memory planning 仍 default off；M5 live/latency gate 仍開放。

### Non-goals

- 不新增第八個頂層 shared contract。
- 不把所有 helper/service call 升格為 `TaskContract` 或 agent。
- 不讓 model 動態探索或直接呼叫任意 internal tool。
- 不重寫 `masterAiService`、report QA、question dedupe、voice confidence 或 persistence source of truth。
- 不在本 milestone 自動啟用 report publication、cross-session memory 或 voice hot-path enforcement。
- 不新增 external side-effect action、filesystem/network capability 或 admin policy UI。
- 不在 contract 未穩定前進行多 provider abstraction。

## Approved Constraints and Pending Decisions

### Existing approved constraints

| Topic | Constraint |
| --- | --- |
| Authority | `policy/safety > controller > contract/gate > deterministic rule > model > wording`。 |
| Runtime task | V1 正式 task 仍是 `interview_next_turn`、`generate_report`、`qa_report`。 |
| Auditability | Internal AI-assisted helper 必須出現在所屬 run 的 span/event/action/gate/context/memory/failure evidence，不必全部成為 top-level task。 |
| Memory | Cross-session memory 可影響 planning、selection、depth、coverage、coaching；V0 `canAffectScoring=false`。 |
| Report | QA-only 不 silent rewrite；repair 必須是 explicit action/child run；enforcement 仍受 G5/M4 gate。 |
| Voice | 保留 3 秒產品 latency target；confirmation 使用 same-run resume。 |
| Privacy | Refs/hash/version-first；不保存 raw chain-of-thought 或不必要 candidate payload。 |
| Rollout | `shadow -> observe -> warn -> enforce`；高風險 promotion 需要 replay、human/live evidence 和明確 approval。 |

### M6 decisions still requiring Product Owner approval

| Decision | Source | Hard stop while unresolved |
| --- | --- | --- |
| Per-workflow model-call/token/cost/deadline numbers | Q15 | Budget 只能 observe；不得因新 budget 自動 block candidate flow。 |
| Provider retry/cross-provider/degrade policy | Q16/Q22 | 不新增跨 provider fallback；report 不得用 mock 結果冒充成功。 |
| Report visibility/export and reviewer authority | Q04/Q05 | Publication gate 保持 observe；不得新增 candidate block/export behavior。 |
| Cross-session memory user control and deletion SLA | Q07 | User memory planning 保持 default off；新 write gate只可 shadow/observe。 |
| Production trace roles/raw access/retention | Q14 | 不開 production operator endpoint；只可產生 redacted local evidence。 |
| Warn/enforce thresholds | Q18 | 新 M6 controls 最高進 `observe`。 |
| Contract/policy owner and runtime-config scope | Q20 | Schema/policy採 code-owned versioned draft；不做 admin mutation。 |

## Scope

### Formal runtime task candidates

| Task | M6 control scope | Maximum initial mode |
| --- | --- | --- |
| `interview_next_turn` | preflight、capability scope、budget ledger、cancellation、postcondition、result/failure envelope | `observe` |
| `generate_report` | capability scope、generation/repair budget、result validation、write/publication decision lineage | `observe`; publication enforcement follows G5/M4 |
| `qa_report` | QA-only capability、schema/result validation、publication decision lineage | `observe`; enforcement follows G5/M4 |

### Docs/shadow-only workflows

`cv_jd_match` 和 `prepare_question_pool` 可以產生 capability/budget/context mapping 與 replay fixture，但 M6 不把它們加入 `runTask` 或正式 runtime `WorkflowRun`。

### Internal capability surface

`retrieval`、`interviewer`、`reportGenerator`、`reportQa`、`interviewEvaluator` 保持 fixed registry。M6 為它們建立 code-owned capability metadata；model 只能在 Task/ActionContract 已允許的 bounded surface 內影響既有 candidate action，不能直接選擇 capability。

## Target Control Flow

```text
owned product request
  -> resolve versioned TaskContract
  -> preflight: owner + lifecycle + context + capability + budget
  -> current domain controller
  -> capability adapter: schema + scope + deadline + usage
  -> current deterministic/model/fallback path
  -> postflight: result schema + postcondition + gate + side effects
  -> Product Harness write/publication decision
  -> exact domain result or explicit partial/degraded/review/failed state
  -> redacted WorkflowRun + refs + budget/failure evidence
```

任何 preflight/postflight control failure 都必須產生 versioned `GateResult` / `FailureClassification`。在 `shadow` / `observe` mode，它不能改變 legacy result；在未來 `enforce` mode，它只向 domain controller回傳 `fallback`、`retry`、`wait_for_review`、`reject` 或 `publish` 等既有 next step。

## Requirements

### Functional

| ID | Requirement |
| --- | --- |
| FR-01 | 每個正式 task 在任何 model/capability call 前解析 immutable `taskContractRef`、policy versions、owner/session identity、execution mode 和 idempotency key。 |
| FR-02 | Preflight 必須驗證 task/channel、owned session、lifecycle、required context、allowed capability/action、data classification、budget policy 和 required gates。 |
| FR-03 | Fixed registry 的每個 capability 必須有 versioned ID、allowed task、input/output schema、data classes、side-effect class、timeout、retry/fallback、redaction 和 required gate metadata。 |
| FR-04 | 每個 run 必須在呼叫前取得 budget ceiling，執行中累計 model call、input/output token、estimated cost 和 wall-clock；不得在超額時自動提高 ceiling。 |
| FR-05 | Session pause/end、access revocation、duplicate request 或 newer canonical run 出現時，in-flight work 必須可取消、變成 no-op，或使 late result 進 review；不得建立新 countable question、score、cross-session memory 或 publishable report。 |
| FR-06 | Capability input/output 必須通過 schema validation；invalid schema 只能按 versioned policy repair/retry/fallback，不能由 caller 自行無限 retry。 |
| FR-07 | Postflight 必須驗證 success/stop condition、required result refs、action postconditions、required gate、side-effect status、publication/memory-write decision和 failure completeness。 |
| FR-08 | Domain result外增加 nested/ref-only result envelope，明確分離 lifecycle、quality、publication、partial/insufficient evidence、warnings、unknowns、stop reason 和 user-safe next step。 |
| FR-09 | Report 和 cross-session memory 的 high-risk write 必須有 proposal/decision lineage；沒有 owner、source evidence、policy version、idempotency 或 required gate 的 write 不可被標成 accepted。 |
| FR-10 | 每個 run 記錄 requested/actual provider/model、prompt/schema/policy version、capability calls、token、cost、latency、retry、fallback、guardrail、validation 和 stop reason。 |
| FR-11 | Production operator read path 必須有 explicit role、owner/tenant scope、redaction、access log、retention 和 break-glass policy；一般 candidate API 永不返回 full trace。 |
| FR-12 | Flag OFF 或 rollback 後完全回到 current controller path；M6 artifact 不得成為 interview/session/report domain source of truth。 |

### Non-functional

- Legacy parity：`shadow` / `observe` 下合法 action、question、state、scoring、report、fallback 和 candidate response 必須與 harness OFF 一致。
- Latency：不得新增同步 model call。Voice 仍需 `speech end -> next question first audio <= 3s`，且 M6 mapping/control overhead p95 不得超過 frozen baseline + 200 ms。
- Reliability：budget/trace/persistence adapter failure在 observe mode fail-open，但必須留下 structured recording failure；ownership、permission、candidate-data egress 和 publication critical gate不適用 silent fail-open。
- Determinism：相同 task identity、contract version、policy version和 fixture config必須產生相同 preflight/postflight verdict；model wording可以不同。
- Maintainability：V1 擴充現有七個 contract，不建立第二套 workflow schema或第二個 orchestrator。
- Compatibility：歷史 `workflow_run_v0` / `task_contract_v0` artifact保持可讀；新語義使用新 version，不就地改寫。
- Dependency：M6 V0 不需要新增 package；若 implementation 需要 dependency，必須另行取得 approval。

### Security and privacy

- CV、JD、candidate answer、transcript 和 user memory 都是 untrusted candidate data，`instructionUseAllowed=false`。
- Capability metadata 必須列出可接收的 data classification；未列出的 candidate-sensitive context不得送入 capability/provider。
- External enrichment不得攜帶 CV、transcript、memory 或可識別 candidate payload。
- Context/result/trace 預設保存 refs/hash/version、counts、reason codes和 redacted summaries；不保存 raw prompt、raw response、完整 CV/JD/transcript、access token 或 chain-of-thought。
- Source/session/account deletion 必須能追到 related context refs、memory contributions、run artifacts 和 trace payload；實際 delete/recompute/redact/tombstone 行為由核准 policy決定。
- Cross-user、cross-session、production operator 和 break-glass access 必須分開測試。

## Contracts

以下是 target nested/ref views，不新增 shared top-level contract family。

```yaml
apis:
  - operator_run_query:
      status: target
      route: pending_authorization_design
      auth: operator_role + tenant_scope + access_log
      response: redacted WorkflowRun with nested control refs

data_models:
  - TaskContractV1:
      extends: task_contract_v0
      required:
        - taskContractId
        - taskType
        - contractVersion
        - allowedCapabilityRefs
        - requiredContextTypes
        - successCriteria
        - stopConditions
        - forbiddenBehaviors
        - budgetPolicyRef
        - cancellationPolicyRef
        - requiredGateTypes
        - resultSchemaRef
      budgetPolicy:
        enforcement: observe | enforce
        maxModelCalls: integer
        maxInputTokens: integer
        maxOutputTokens: integer
        maxEstimatedCost: number
        currency: string
        deadlineMs: integer
        overBudgetAction: partial | fallback | reject | wait_for_review

  - CapabilityPolicyEntry:
      storage: code_owned_registry_metadata
      required:
        - capabilityId
        - version
        - allowedTaskTypes
        - inputSchemaRef
        - outputSchemaRef
        - acceptedDataClasses
        - sideEffectClass
        - timeoutMs
        - retryPolicy
        - fallbackPolicy
        - redactionPolicyVersion
        - requiredGateTypes
      sideEffectClass: none | session_write | user_memory_write | report_write | external_provider

  - BudgetLedger:
      owner: WorkflowRun_or_ExecutionSpan
      required:
        - policyRef
        - requestedCeiling
        - actualModelCalls
        - actualInputTokens
        - actualOutputTokens
        - actualEstimatedCost
        - elapsedMs
        - budgetStatus
        - stopReason
      budgetStatus: within_budget | near_limit | exceeded | unavailable

  - ResultEnvelope:
      storage: nested_or_result_ref
      required:
        - domainResultRef
        - lifecycleStatus
        - qualityStatus
        - publicationStatus
        - validationStatus
        - stopReason
        - warnings
        - unknowns
        - nextStep
      validationStatus: valid | partial | insufficient_evidence | denied | invalid | failed

  - WriteGateDecision:
      storage: GateResult_plus_side_effect_ref
      required:
        - proposalRef
        - targetRef
        - ownerScope
        - policyVersion
        - evidenceRefs
        - idempotencyKey
        - decision
        - gateResultRef
      decision: accept | reject | review | defer | no_op

events:
  - task_preflight_evaluated
  - capability_call_started
  - capability_call_completed
  - capability_call_denied
  - budget_updated
  - budget_exceeded
  - cancellation_requested
  - cancellation_applied
  - result_postflight_evaluated
  - write_gate_decided
  - operator_trace_accessed

external_dependencies: []
```

## Control Semantics

### Preflight

Preflight 只能讀取 task identity、auth/ownership、session lifecycle、contract/policy refs、context metadata和 budget ceiling。它不能為了驗證而額外呼叫 LLM。

| Failure | Shadow/observe | Future enforce |
| --- | --- | --- |
| Missing contract/version | 記錄 invalid contract；legacy path不變 | fail before model call |
| Disallowed capability/action | 記錄 violation與 legacy result | deny並交 controller fallback |
| Ownership/permission failure | 沿用 current fail-closed行為 | fail-closed |
| Stale/unreviewed required context | 記錄 block/review/degrade candidate | domain policy決定 block/review/degrade |
| Budget policy missing | 記錄 `budget_unavailable` | 不得進 enforce |

### Runtime budget and cancellation

- Voice 使用 latency hard budget；具體 stage budget待 Q15 核准。
- Text interview 先 observe model-call/token/cost/deadline，再以 baseline決定 warn/enforce。
- Report/QA 保留現有 bounded repair上限；M6 將 generation、QA和每次 explicit repair分開記帳。
- `BudgetLedger` 計數 unavailable 時不得假裝 `within_budget`。
- Budget exceeded 不重設 ceiling；controller按 task policy回 partial、fallback、review或 retryable error。
- Cancellation result必須帶 `handled`、`lateResultDiscarded`、side-effect status和 user impact。

### Postflight

Postflight不讓 model自己批准結果。它只使用 schema validator、domain gate、source/evidence refs、state/side-effect observation和 versioned policy。

`completed` 只代表 execution結束；它不等於 `qualityStatus=passed`、`publicationStatus=ready` 或 memory write accepted。

### Write/publication gate

- `generate_report` / `qa_report` 使用 G5/M4 publication policy。M6 可以驗證 proposal、result和write lineage，但在 Q04/Q05/Q18關閉前不得改 candidate visibility/export。
- Cross-session memory write先產生 shadow/observe `WriteGateDecision`。沒有 source evidence、applicability、freshness、conflict/revalidation和 `canAffectScoring=false` 的 proposal不得標 accepted。
- Session-local trace/memory 在 shadow/observe保持 current persistence behavior；M6只記錄 decision，不重寫 source model。

## BDD Scenarios

```gherkin
Scenario: A valid text interview turn keeps the legacy result and records executable-control evidence
  Given an owned active session and versioned interview_next_turn contract
  And the required capabilities and budget policy are available
  When the current controller completes the turn in observe mode
  Then the candidate result equals the harness-off result
  And preflight, capability, budget, postflight, gate, side-effect, and result refs are recorded
  And no extra model call is introduced

Scenario: A capability outside the task scope is denied before execution
  Given a TaskContract that does not allow reportGenerator
  When a caller requests reportGenerator during interview_next_turn
  Then preflight returns an action_policy failure
  And the capability is not called
  And no report, question, score, or memory side effect is written

Scenario: A run exceeds its model-call or token budget
  Given a versioned budget policy with a fixed ceiling
  When the next capability call would exceed that ceiling
  Then no automatic ceiling increase occurs
  And BudgetLedger records exceeded and a stop reason
  And the controller returns the policy-defined partial, fallback, reject, or review outcome

Scenario: An ended session discards a late interview result
  Given an interview_next_turn is in flight
  When the session is ended or access is revoked
  And the capability returns after cancellation
  Then the late result does not create a countable question, score, or cross-session memory
  And the run records cancellation and discarded side effects

Scenario: Invalid capability output uses bounded recovery
  Given a capability returns output that fails its versioned schema
  When postflight applies the retry policy
  Then retry occurs no more than the configured maximum
  And a failed repair uses the configured fallback or fail-closed result
  And every attempt is linked to the same run and budget ledger

Scenario: Report completion does not bypass publication review
  Given generate_report completes but QA produces a critical publication block
  When M6 postflight validates the result
  Then lifecycleStatus may be completed
  But publicationStatus remains needs_review or rejected
  And no M6 generic control changes candidate visibility before G5 approval

Scenario: A cross-session memory proposal without provenance is rejected
  Given a proposed user_interview memory write has no source evidence or applicability policy
  When the write gate evaluates the proposal
  Then the decision is reject
  And no accepted user-level memory is created
  And current-session scoring remains unchanged

Scenario: Candidate content cannot change capability or scoring policy
  Given a CV, JD, answer, or transcript contains prompt-like instructions
  When it enters a ContextPacket
  Then it remains untrusted data with instructionUseAllowed false
  And it cannot add capabilities, increase budget, alter gates, or affect scoring authority

Scenario: Candidate access never exposes the operator trace
  Given an authenticated candidate requests a normal session or report API
  When a WorkflowRun contains capability, budget, failure, and memory details
  Then the response includes only allowlisted user-safe fields
  And operator-only refs, internal ranking, raw payload, and chain-of-thought are absent

Scenario: Shadow rollback restores the exact current path
  Given M6 shadow or observe adapters are enabled
  When the M6 feature flag is disabled
  Then the request follows the current controller path without M6 preflight or postflight enforcement
  And no migration rollback is required for product domain data
```

## Failure and User-facing Outcomes

| Failure class | Default M6 handling | Candidate-safe outcome |
| --- | --- | --- |
| Permission/ownership | fail closed | access blocked without disclosing another user/session |
| Required context/evidence missing | block/review/degrade by domain policy | explain what evidence is missing and the next safe action |
| Invalid model output | bounded schema repair or deterministic fallback | continue with safe fallback or retryable error |
| Provider timeout/unavailable | task-specific fallback or retryable error | preserve input/session; never return mock as real report |
| Budget exceeded | stop new calls; partial/fallback/review | state what was incomplete; do not auto-charge beyond ceiling |
| Cancellation/session ended | cancel/no-op and discard late write | confirm interview ended or ask user to retry |
| Report verification | follow G5 severity/publication policy | needs review, retry, or verified result |
| Memory write policy | reject/defer without changing scoring | result may complete but personalisation remains unsaved |
| Trace/persistence adapter | observe-mode fail-open with recording failure | product result unchanged; operator evidence shows the gap |

## Rollout

### M6.0 — Spec and decision closure

- Product Owner reviews proposed M6 decisions in `goal.md`.
- Close or explicitly defer Q04/Q05/Q07/Q14/Q15/Q16/Q18/Q20.
- Freeze current per-workflow call/token/cost/latency baseline.
- Define version ownership and rollback flags.

Exit：所有 enforce-affecting decisions有 `[x]`、`[-]` 或 explicit hard stop；不得把 unanswered default當 approval。

### M6.1 — Shadow capability and budget mapping

- Add metadata for the five fixed registry capabilities.
- Map existing timeout、usage、retry、fallback和 side effects into refs-only budget/capability view.
- Keep all product output and persistence unchanged.

Exit：capability metadata coverage 100%；formal task的 requested/actual budget fields 100%可查；legacy parity 100%。

### M6.2 — Observe preflight/postflight

- Evaluate task/context/capability/budget before calls.
- Validate schema/postcondition/result/write lineage after calls.
- Record violations without changing candidate output.
- Voice only adds lightweight synchronous checks and existing latency markers.

Exit：normal、permission、invalid schema、timeout、budget、cancellation、late result和 write-gate fixtures全部可 replay；unclassified failure 0。

### M6.3 — Developer warn

- Show contract/budget/capability/postcondition warnings in developer/operator evidence.
- Do not expose internal warning to candidate unless domain failure policy requires a user-safe state.

Exit：warning precision、false interruption、diagnosis correctness和 trace privacy經 human review。

### M6.4 — Domain-owned enforcement pilots

- Report publication only follows G5/M4 approval and evidence.
- Cross-session memory write only follows G4/M3 user-control/deletion approval.
- Voice hot-path enforcement only follows G6/M5 live latency/provider evidence.

Exit：每個 gate各自通過 replay、false-positive/negative、human/live、rollback和 Product Owner approval；不得用一個 M6 pass全面升級所有 workflow。

## Acceptance Gate

### Contract and capability

- Formal task `TaskContractV1` coverage：100%。
- Fixed agent/capability metadata coverage：5/5。
- Disallowed capability execution：0。
- Required preflight/postflight verdict coverage：100%。
- Contract/policy version missing in enforce candidate：0。

### Budget, cancellation, and side effects

- Requested/actual model-call、input/output token、cost、deadline和 stop reason coverage：100% for formal tasks。
- Budget ceiling自動提高：0。
- Cancellation後新增 countable question/score/cross-session memory/publishable report：0。
- Duplicate task產生 duplicate product side effect：0。
- Unclassified late result或 orphan side effect：0。

### Product behavior and quality

- Harness OFF/ON legacy result parity：100% in shadow/observe。
- New synchronous model calls：0。
- Report publication critical false negative：0；false block需要 human calibration後才能 enforce。
- Cross-session memory影響 scoring/matching：0。
- Candidate-facing internal trace exposure：0。

### Security, privacy, and operations

- Cross-user/cross-session trace access：0。
- Candidate-sensitive payload copied into M6 artifacts：0 in fixtures and reviewed sample。
- Operator trace access event coverage：100% after production operator surface exists。
- Source-delete contribution mapping：100%；actual delete/recompute SLA pending Q07。
- Feature-flag rollback：PASS without domain data migration。

### Voice and live evidence

- M6 mapping/control overhead p95：不超過 frozen baseline + 200 ms。
- `speech end -> next question first audio <= 3s`：live provider gate通過前，M6不得取得 voice enforce status。
- Human microphone、reconnect、timeout、duplicate/counting、barge-in和 cancellation evidence分開記錄。

## Verification

### Focused automated checks

- Contract tests：TaskContractV1、capability metadata、budget ledger、result envelope、write-gate decision、version compatibility。
- Integration tests：interview/report/QA preflight -> current controller -> postflight -> persistence observation。
- Failure injection：permission、invalid schema、provider timeout、budget exceeded、cancellation、late result、write failure。
- Privacy tests：cross-user access、candidate API exclusion、raw payload absence、source-delete mapping。
- Replay：harness OFF/ON parity、duplicate、fallback、report block、memory proposal reject、rollback。
- Voice：existing robustness/browser H1 plus lightweight M6 overhead and cancellation cases。

### Existing commands to preserve

```bash
cd backend
npm run test:all
npm run eval:harness-m1
npm run eval:harness-m2
npm run eval:harness-m3
npm run eval:harness-m4
npm run eval:harness-m5

cd ../frontend
npm run quality:all
npm run test:e2e:harness-h1-voice
```

Planned M6 eval command必須在 implementation時加入 package script與 artifact contract；本 spec不把尚不存在的 command寫成已可執行。

### Human/live/production gates

- Human review：capability scope、budget degrade、report false block、memory rejection、developer warning precision。
- Live provider：actual token/cost/timeout/fallback、voice 3 秒 SLO、report不使用 mock fallback。
- Production observe：operator auth/access log、run retention/deletion、budget aggregation、orphan/late-result rate、rollback。
- Product Owner：每個 warn/enforce promotion單獨批准。

## Required Evidence Artifacts

Implementation開始後，每個 artifact必須記錄 command、commit/config、contract/policy version、date、result和未驗證 boundary：

- `docs/harness/evidence/m6-capability-coverage.md`
- `docs/harness/evidence/m6-budget-and-cancellation.md`
- `docs/harness/evidence/m6-preflight-postflight-replay.md`
- `docs/harness/evidence/m6-write-gates.md`
- `docs/harness/evidence/m6-operator-privacy.md`
- `docs/harness/evidence/m6-final-verdict.md`
- 對應 machine-readable `.json`

## Completion Rule

M6 只有在 contract/capability/budget/postcondition/write-gate/rollback的 local evidence通過，且適用 human/live/production gate分開標示後，才可從 `in_progress` 進 `ready_for_human_validation`。只有所有 M6 exit gate和 Product Owner approval通過後才可標 `verified`。

M6 verified也不等於 G0 verified。G5 report、G4 memory、G6 voice仍保留各自的 domain promotion與 release evidence。

Evidence status：2026-07-26 已完成第一個 local shadow/observe slice：fixed capability metadata/lifecycle、preflight/postflight envelope、DeepSeek task/capability usage correlation、explicit unavailable budget state、owner-scoped developer control view、observed write decision、candidate-safe Report Trust Status 與 local automated/browser evidence。Mock/no-usage path仍會明確標示 unavailable；actual correlation 尚未經 live provider coverage驗證。Cancellation/late-result suppression、production operator role/retention、budget threshold與 enforcement evidence仍不存在；未核准的 promotion decision不得視為已核准。

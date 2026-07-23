# Pre-Harness Failure Taxonomy

狀態：pre-harness taxonomy 草案，不改變目前 runtime 行為。

本文件把 Kiwi 升級 harness 前需要辨識的 failure modes 統一命名。現在 source 裡已有許多 failure signal，但缺少 shared failure vocabulary；因此 audit 裡的 failure taxonomy 不能標為已確認。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[共享 Contract Spine](../further_plan/product-harness-contract-spine.md)、[Pre-Harness Gate Taxonomy](pre-harness-gate-taxonomy.md)。

## 1. Failure class

| Class | 狀態 | Meaning | Current evidence |
| --- | --- | --- | --- |
| `context_failure` | 未確認 | context 缺失、過期、不可信或被 user content 當 instruction。 | retrieval/context builder 有局部 degraded signals，但沒有統一 code。 |
| `retrieval_failure` | 部分確認 | retrieval error、low alignment、retry failure、source unavailable。 | [retrievalAgent](../../backend/src/services/agents/retrievalAgent.js) 有 `retrievalFailed`、`retrievalErrors`、quality reasons。 |
| `model_output_failure` | 部分確認 | invalid JSON、disallowed action、empty action、model timeout/error。 | model selector/voice decision fallback 保存 error string。 |
| `action_policy_failure` | 部分確認 | action 不在 candidate set、precondition 不滿足、mode/time/question limit 被 override。 | allowed action enforced；precondition gate 尚未集中。 |
| `tool_or_side_effect_failure` | 未確認 | persistence、indexing、mark asked state、cleanup、usage record failed。 | source 有 logger warnings，但 taxonomy 未集中。 |
| `verification_failure` | 部分確認 | report QA/claim grounding/transcript eligibility/question counting failed。 | report QA flags 和 tests 存在。 |
| `memory_policy_failure` | 未確認 | memory write 無 provenance、scope 升級、user memory 影響 scoring。 | 沒有 formal memory write gate。 |
| `latency_failure` | 需要測試 | voice/interview path 超過 deadline 或 missing first-audio mark。 | latency marks 存在；baseline/p95 未建立。 |
| `human_review_waiting` | 未確認 | 需要 candidate/human confirmation 才能繼續。 | transcript confirmation/report needs review 有概念，但 shared state 未定義。 |
| `environment_failure` | 需要測試 | local service、DB、WebSocket、STT/TTS provider、sandbox bind 問題。 | 測試/開發環境常見，但不能混進 product failure。 |

## 2. Reason code starters

| Class | Reason codes |
| --- | --- |
| `context_failure` | `context_missing`、`context_stale`、`context_untrusted_instruction`、`context_hash_missing` |
| `retrieval_failure` | `retrieval_failed`、`retrieval_low_alignment`、`retrieval_retry_failed`、`retrieval_source_unavailable` |
| `model_output_failure` | `model_invalid_json`、`model_disallowed_action`、`model_empty_action`、`model_provider_error`、`model_timeout` |
| `action_policy_failure` | `action_not_allowed`、`action_precondition_failed`、`question_limit_reached`、`time_limit_reached`、`mode_boundary_violation` |
| `tool_or_side_effect_failure` | `persist_decision_failed`、`persist_trajectory_failed`、`mark_question_asked_failed`、`indexing_failed`、`cleanup_failed` |
| `verification_failure` | `report_qa_blocked`、`unsupported_claim`、`evidence_mismatch`、`transcript_confirmation_required`、`question_duplicate` |
| `memory_policy_failure` | `memory_provenance_missing`、`memory_scope_violation`、`memory_scoring_violation`、`memory_retention_unverified` |
| `latency_failure` | `first_audio_deadline_missed`、`model_selection_deadline_missed`、`stt_stop_timeout`、`tts_first_audio_missing` |
| `human_review_waiting` | `candidate_confirmation_required`、`report_manual_review_required`、`resume_after_review_missing` |
| `environment_failure` | `db_unavailable`、`websocket_auth_failed`、`speech_provider_unavailable`、`local_bind_denied` |

## 3. Mapping from current signals

| Current signal | Proposed class | Proposed reason |
| --- | --- | --- |
| `retrievalFailed: true` | `retrieval_failure` | `retrieval_failed` |
| retrieval `qualityAssessment.passed=false` | `retrieval_failure` | `retrieval_low_alignment` |
| selector `Model selected disallowed action` | `model_output_failure` / `action_policy_failure` | `model_disallowed_action` |
| selector JSON parse error | `model_output_failure` | `model_invalid_json` |
| report QA blocking flag present | `verification_failure` | `report_qa_blocked` |
| `unsupported_high_confidence_feedback` | `verification_failure` | `unsupported_claim` |
| transcript confirmation requested | `human_review_waiting` | `candidate_confirmation_required` |
| missing trace correlation | `context_failure` / `observability_gap` | `context_hash_missing` 或 `workflow_run_missing` |
| memory write without provenance | `memory_policy_failure` | `memory_provenance_missing` |

## 4. What not to mix

| 不應混在一起 | 原因 |
| --- | --- |
| Product auth failure vs harness policy failure | auth 是產品權限；harness policy 是 agent/action/memory/gate 邊界。 |
| Local sandbox/network failure vs production runtime failure | local `listen EPERM` 類問題不能被當作 product regression。 |
| QA failed vs task failed | report task 可以成功產生 artifact，但 publication gate failed。 |
| Transcript low confidence vs candidate poor answer | 系統理解問題不能直接變成 candidate score penalty。 |
| Model fallback vs product failure | bounded fallback 可能是正常成功路徑，除非超過 retry/deadline 或輸出不可用。 |

## 5. Audit carry-back

Failure taxonomy 目前從 **未確認** 更新為 **部分確認（taxonomy 草案已建立，但未接 runtime adapter）** 才合理。source 有 failure signals，但沒有 shared taxonomy implementation 或 tests，因此不能標 `已確認`。

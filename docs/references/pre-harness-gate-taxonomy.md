# Pre-Harness Gate Taxonomy

狀態：pre-harness taxonomy 草案，不改變目前 runtime 行為。

本文件把 Kiwi 目前分散在 report、question、voice、retrieval、action、memory 的守門行為整理成 shared gate vocabulary。這不是 runtime `GateResult` 實作；用途是先定義哪些 gate 應該存在、哪些已經有局部 source、哪些需要測試或還未確認。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[Pre-Harness Action Contracts](pre-harness-action-contracts.md)、[Pre-Harness Failure Taxonomy](pre-harness-failure-taxonomy.md)。

## 1. Gate result shape

```json
{
  "gateId": "string",
  "gateType": "report_qa | action_policy | transcript_policy | retrieval_quality | memory_policy | question_quality",
  "status": "pass | warn | block | review | degrade",
  "reasonCode": "string",
  "checkedAt": "ISO-8601",
  "sourceRefs": [],
  "humanReadableSummary": "string"
}
```

第一版可以只做 adapter/read model，不需要立刻改所有 service return shape。

## 2. Gate inventory

| Gate | 狀態 | Current evidence | First adapter target |
| --- | --- | --- | --- |
| `report_qa_publication` | 部分確認 | [reportQaAgent](../../backend/src/services/agents/reportQaAgent.js) 有 blocking flags、quality flags、consistency checks。 | 把 `qaResult.passed`、`qualityFlags`、`consistencyChecks` 轉成 `GateResult[]`。 |
| `report_claim_grounding` | 部分確認 | report QA 檢查 evidence refs、role-fit evidence ids、unsupported high-confidence feedback。 | 先 cover unsupported/high-confidence、unknown evidence id、meaningful evidence。 |
| `action_allowed_candidate` | 部分確認 | model selector 和 voice decision service 限制 selected action 必須在 allowed candidates。 | invalid/disallowed/error 都輸出 gate event。 |
| `question_counting` | 部分確認 | repair/confirmation/system turn 不算 question 的邏輯和 tests 存在。 | adapter countable/non-countable reason。 |
| `question_novelty` | 部分確認 | dedupe/ranking/repetition risk 有局部 trace。 | adapter duplicated/fresh/repair/follow-up decision。 |
| `transcript_eligibility` | 部分確認 | transcript review/confirmation service 和 voice tests 覆蓋高風險 transcript。 | adapter accept/review/confirm/reject。 |
| `retrieval_quality` | 部分確認 | retrieval agent 回傳 `qualityAssessment`、retry、sourceQuality。 | adapter passed/limited/retry/failure。 |
| `memory_write_policy` | 產品方向已核准 / runtime 未確認 | memory service 直接寫入 mixed memory。 | Shadow check source/provenance/scope/promotion/applicability/freshness/scoring authority。 |
| `candidate_exposure_policy` | 產品方向已核准 / runtime 未確認 | report/question reason 有素材，但 user-safe projection 尚未集中。 | Allowlist 重要、非技術性的 progress/evidence/next-step fields；full detail只給 developer。 |
| `human_review_required` | 產品語義部分核准 / runtime 未確認 | report needs review、transcript confirmation 有概念。 | Report QA block/explicit repair 與 voice same-run confirmation 轉成 shared `review`/resume semantics。 |

## 3. Status semantics

| Status | Product meaning |
| --- | --- |
| `pass` | 可繼續下一步，且可作為 audit evidence。 |
| `warn` | 可繼續，但必須在 trace 裡留下 caveat。 |
| `block` | 不能發布或不能執行該 action。 |
| `review` | 需要使用者或人工確認後才能繼續。 |
| `degrade` | 允許 fallback/低信心輸出，但不可宣稱完整成功。 |

## 4. Reason code starters

| Gate | Reason codes |
| --- | --- |
| `report_qa_publication` | `qa_passed`、`blocking_flag_present`、`quality_flags_present`、`consistency_check_failed` |
| `report_claim_grounding` | `unsupported_high_confidence_feedback`、`evidence_id_not_found`、`meaningful_evidence_missing`、`company_claim_not_reviewed` |
| `action_allowed_candidate` | `action_in_candidate_set`、`model_disallowed_action`、`model_invalid_json`、`model_selection_error` |
| `question_counting` | `countable_interview_question`、`repair_prompt_non_countable`、`transcript_confirmation_non_countable`、`system_turn_non_countable` |
| `question_novelty` | `fresh_question_selected`、`duplicate_question_rejected`、`repetition_risk_switch`、`pool_degraded` |
| `transcript_eligibility` | `valid_transcript`、`low_confidence_needs_confirmation`、`high_risk_needs_confirmation`、`transcript_rejected` |
| `retrieval_quality` | `retrieval_passed`、`retrieval_low_alignment`、`retrieval_retry_used`、`retrieval_error` |
| `memory_write_policy` | `memory_write_has_source`、`memory_scope_allowed`、`memory_promotion_threshold_not_met`、`memory_role_mismatch`、`memory_stale_revalidation_required`、`memory_conflict_detected`、`memory_scoring_blocked`、`memory_provenance_missing` |

## 5. Slice ordering

Shared gate vocabulary 先跟 [Product Harness Contract Spine](../further_plan/product-harness-contract-spine.md) 一起 pressure-test，不以 report 作唯一架構代表。

1. 已核准第一個 observe-mode product slice 是 `interview_next_turn`：接 `action_allowed_candidate`、question counting/novelty、transcript eligibility 和 memory-write shadow gate，但不 block legacy fallback。
2. 已核准第一個候選 enforceable gate slice 是 report QA：blocking flags 和 publication status 最清楚；實際進 warn/enforce 前仍需 shadow parity/replay 與尚未決定的 enforce threshold。
3. Voice hot path 只共用 lightweight gate result 和 correlation，不先加入 heavy enforcement。

## 6. Audit carry-back

Gate readiness 維持 **部分確認**。目前有多個局部 gate，但沒有 shared `GateResult`，因此不能說 harness gate plane 已確認。

# Pre-Harness Replay Fixtures

狀態：fixture contract 與 local test anchors 已確認；recorded-session replay dataset 尚未建立。

本文件定義升級 harness architecture 前應保留的 replay cases。目標是讓之後每次改 agent/action/memory/gate/trace 都能用同一組 cases 比較 before/after，而不是只靠單次手動操作。

相關文件：[Pre-Harness Readiness Audit](pre-harness-readiness-audit.md)、[Pre-Harness Baseline Metrics](pre-harness-baseline-metrics.md)。

## 1. Fixture requirements

每個 replay fixture 至少要有：

| 欄位 | 說明 |
| --- | --- |
| `fixtureId` | 穩定 ID。 |
| `taskType` | `interview_next_turn`、`generate_report` 或 `qa_report`。 |
| `inputSnapshot` | session、transcript、analysis、question pool、report 等最小輸入。 |
| `expectedActions` | allowed selected action/fallback action 或 report QA expectation。 |
| `expectedGates` | expected pass/warn/block/review/degrade。 |
| `expectedTrace` | 必須出現的 decision/trajectory/trace/gate records。 |
| `mustNotHappen` | 不允許的行為，如 duplicate question、unsupported high-confidence claim、raw trace exposure。 |

## 2. Proposed fixture set

| Fixture | Task | 狀態 | Purpose | Must not happen |
| --- | --- | --- | --- | --- |
| `text_interview_next_turn_happy_path` | `interview_next_turn` | 未確認 | 一般文字面試下一題，確認 action selection、trajectory、question metadata。 | selected action 不在 candidate set；缺 question id/reason。 |
| `text_interview_repair_non_countable` | `interview_next_turn` | 部分確認 | repair/rephrase/clarification 不算正式題。 | repair prompt 增加 planned question count。 |
| `interview_duplicate_question_guard` | `interview_next_turn` | 部分確認 | 相似問題被 dedupe/rejected 或 switch topic。 | 同一題重複出現在 countable question history。 |
| `interview_validation_target_denied` | `interview_next_turn` | 部分確認 | candidate denied skill target 後不得繼續強行 validation。 | 追問 denied target。 |
| `voice_low_confidence_confirmation` | `interview_next_turn` | 部分確認 | high-risk/low-confidence transcript 先 confirmation，原 run `waiting -> running`。 | 直接評分、直接進下一題，或無理由建立新 product run。 |
| `voice_confirmation_reconnect_timeout` | `interview_next_turn` | 未確認 | 驗證 same-run resume、duplicate/reconnect、expired/non-resumable child-run boundary。 | 重複正式題、重複 scoring、失效 run 被不安全恢復。 |
| `voice_duplicate_speech_end_retry` | `interview_next_turn` | 未確認 | duplicate speech_end/retry 不產生雙題。 | 一次 user answer 產生兩個 countable AI questions。 |
| `report_grounded_ready` | `generate_report` | 部分確認 | grounded report 通過 QA 並可 ready。 | missing evidence refs 仍 ready。 |
| `report_unsupported_claim_blocked` | `generate_report` | 部分確認 | unsupported high-confidence feedback 被 QA 擋下或降級。 | unsupported claim 以 high confidence 出現在 candidate-facing report。 |
| `qa_report_existing_report_missing` | `qa_report` | 未確認 | stored report 不存在時 fail closed。 | 靜默建立空 report 或標 passed。 |
| `qa_report_block_no_silent_rewrite` | `qa_report` | 未確認 | blocking QA 進 `needs_review`，原 artifact 不被 QA-only task 隱形改寫。 | QA-only silent rewrite 或 blocked artifact 被標 ready。 |
| `retrieval_low_alignment_retry` | `interview_next_turn` / `generate_report` | 部分確認 | retrieval quality 低時 corrective retry 或 degrade。 | low alignment 被當 strong context。 |
| `memory_session_project_shift` | `interview_next_turn` | 部分確認 | session memory 可影響 project shift，但不直接 scoring。 | user-level memory 直接改 final score。 |
| `memory_cross_session_depth_progression` | `interview_next_turn` | 未確認 | 多個獨立 session 有 grounded strong evidence 後，停止同深度例行重問、提高 depth 或轉向 coverage gap。 | 單次好回答永久 suppress；沒有 source refs 仍 promotion。 |
| `memory_role_mismatch_no_suppression` | `interview_next_turn` | 未確認 | Role/competency/question-family 不適用時，user memory 不改變本次選題。 | 跨 role 過度泛化並跳過必要問題。 |
| `memory_stale_conflict_revalidation` | `interview_next_turn` | 未確認 | 過期或衝突 memory 觸發 revalidation，而不是直接 suppress。 | stale/conflicting memory 被當成已證明能力。 |
| `memory_planner_evaluator_isolation` | `interview_next_turn` | 未確認 | Planner 可使用 user memory 調整選題；V0 evaluator packet 不把歷史 memory 當本輪 scoring evidence。 | 歷史 memory 無 trace 地提高/降低本輪分數。 |
| `retention_delete_derived_memory` | retention audit/cleanup | 需要測試 | delete/retention 後 derived memory 可追蹤處理。 | source deleted 但 derived memory 不可追溯地保留。 |

## 3. Existing local test anchors

| Fixture family | Existing anchors |
| --- | --- |
| repair/counting | `backend/tests/robustness/questions/interviewQuestionCounting.test.js`、`questionMetadataPersistence.test.js`、`questionDeduplicationService.test.js` |
| action selection | `backend/tests/robustness/agent/interviewControllerActionCompleteness.test.js`、`interviewControlRobustness.test.js` |
| report QA/grounding | `backend/tests/robustness/report/reportFrameworkQa.test.js`、`reportGroundingRobustness.test.js`、`reportQaRoleFitRepair.test.js` |
| voice transcript | `backend/tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js`、`transcriptReviewPolicyService.test.js`、`voiceLatencyAcceptanceGate.test.js` |
| retrieval | `backend/tests/robustness/retrieval/retrievalRobustness.test.js`、`runtimeRetrievalEvaluator.test.js` |
| retention | `backend/tests/robustness/retention` |

本輪所有 local anchors 已在 `AI_TEST_MODE=mock` 下通過：`102 test files / 432 tests`。這確認候選 fixture 對應的局部 guard 有 regression coverage；它不代表上表已經有可重播的 `inputSnapshot`、expected gate/trace assertions 或 before/after diff。

## 4. Replay acceptance before harness implementation

| Requirement | 狀態 |
| --- | --- |
| 至少 3 條 deterministic replay fixtures 可在 mock mode 跑完。 | 未確認 |
| 至少 cover interview action、report QA、voice transcript 三條主風險。 | 未確認 |
| 每條 fixture 都有 expected gate and trace assertions。 | 未確認 |
| replay result 能輸出 before/after diff。 | 未確認 |
| real AI eval 不作為唯一 gate。 | 已確認 |

## 5. Audit carry-back

Replay baseline 維持 **需要測試**。現有 tests 是好的起點，但還不是 recorded-session replay dataset，也還沒有 before/after trajectory diff。

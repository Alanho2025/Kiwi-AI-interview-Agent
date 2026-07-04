# Google Agents CLI Question Agent Advice

Source result: /Users/heminghan/Kiwi-AI-interview-Agent/backend/eval/googleAgentsCli/results/question-agent/results_20260618_165153.json

## Summary

- kiwi_question_contract_score: mean 1 (5/5 valid)
- kiwi_question_constructive_review: mean 0.96 (5/5 valid)
- multi_turn_trajectory_quality_v1: mean 0.95 (5/5 valid)
- multi_turn_tool_use_quality_v1: mean 0.96 (5/5 valid)

## Case Advice

### P3: question_misunderstanding_rephrase

- kiwi_question_contract_score: 1
  failed_checks=none; diagnostics={'selectedAction': 'REPHRASE_QUESTION', 'suggestedNextMode': 'rephrase', 'selectedQuestionId': 'repair:system_design', 'turnKind': 'repair', 'sourcePolicy': 'fallback_root_policy', 'selectionSource': 'rule_fallback', 'questionQuality': {'score': 0.86, 'earned': 6, 'possible': 7, 'failedChecks': ['cv_or_project_grounded'], 'checks': [{'label': 'is_question_like', 'passed': True}, {'label': 'natural_length', 'passed': True}, {'label': 'interview_tone', 'passed': True}, {'label': 'jd_grounded', 'passed': True}, {'label': 'cv_or_project_grounded', 'passed': False}, {'label': 'not_repeated', 'passed': True}, {'label': 'difficulty_fit', 'passed': True}]}}
- kiwi_question_constructive_review: 0.9
  The agent correctly identified the candidate's misunderstanding and chose to rephrase the question. The `interview_evaluator` flagged `misunderstandingFlag: True` and `suggestedNextMode: 'rephrase'`. The `adaptive_action_planner` then selected `REPHRASE_QUESTION` as the `recommendedAction`. The `interview_turn_orchestrator` correctly classified the turn as `repair`. The `question_decision_tracer` then generated a `questionDecision` object that accurately reflects the chosen action, the rationale, and the spoken text. The `questionRanking` within the `questionDecision` also shows the controller-directed rephrased question as the selected option, with other prepared questions as alternatives. The agent successfully preserved the parent/root linkage by initiating a repair turn. The final output from the `kiwi_question_agent` confirms the successful execution of the rephrase action. A minor improvement could be to ensure the `questionRanking` within the `questionDecision` more directly reflects the *final* selected question's score and reasons, rather than just listing alternatives. However, the overall behavior demonstrates adaptive question handling based on candidate feedback.
- multi_turn_trajectory_quality_v1: 1
- multi_turn_tool_use_quality_v1: 1
- Suggested fix: inspect the question agent trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.
- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.

### P2: question_validation_uses_prepared_match_gap

- kiwi_question_contract_score: 1
  failed_checks=none; diagnostics={'selectedAction': 'ASK_VALIDATION_QUESTION', 'suggestedNextMode': 'probe', 'selectedQuestionId': 'prepared-db-validation', 'turnKind': 'root_question', 'sourcePolicy': 'prepared_root_pool', 'selectionSource': 'prepared_question_pool', 'questionQuality': {'score': 0.71, 'earned': 5, 'possible': 7, 'failedChecks': ['cv_or_project_grounded', 'difficulty_fit'], 'checks': [{'label': 'is_question_like', 'passed': True}, {'label': 'natural_length', 'passed': True}, {'label': 'interview_tone', 'passed': True}, {'label': 'jd_grounded', 'passed': True}, {'label': 'cv_or_project_grounded', 'passed': False}, {'label': 'not_repeated', 'passed': True}, {'label': 'difficulty_fit', 'passed': False}]}}
- kiwi_question_constructive_review: 1
  The agent successfully evaluated the candidate's answer, identified the need for validation on the 'database' target, and selected an appropriate probing question from the prepared pool. The action planner correctly chose to ask a validation question, and the question pool ranker prioritized a relevant question based on the match gap and action fit. The final question decision trace provides a transparent breakdown of the selection process, including evidence used, alternatives considered, and the rationale for the chosen question. The agent respected the technical mode and produced a natural, interview-like question grounded in the identified match gap.
- multi_turn_trajectory_quality_v1: 1
- multi_turn_tool_use_quality_v1: 0.8
- Suggested fix: inspect the question agent trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.
- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.

### P3: question_followup_does_not_consume_prepared_root

- kiwi_question_contract_score: 1
  failed_checks=none; diagnostics={'selectedAction': 'ASK_DEEP_DIVE_QUESTION', 'suggestedNextMode': 'probe', 'selectedQuestionId': 'follow_up:parent-question', 'turnKind': 'follow_up', 'sourcePolicy': 'follow_up_from_parent_no_prepared_root_consumption', 'selectionSource': 'eval_forced_contract_path', 'questionQuality': {'score': 0.57, 'earned': 4, 'possible': 7, 'failedChecks': ['jd_grounded', 'cv_or_project_grounded', 'difficulty_fit'], 'checks': [{'label': 'is_question_like', 'passed': True}, {'label': 'natural_length', 'passed': True}, {'label': 'interview_tone', 'passed': True}, {'label': 'jd_grounded', 'passed': False}, {'label': 'cv_or_project_grounded', 'passed': False}, {'label': 'not_repeated', 'passed': True}, {'label': 'difficulty_fit', 'passed': False}]}}
- kiwi_question_constructive_review: 1
  The Kiwi AI Interview Agent successfully demonstrated adaptive question behavior. The agent correctly identified the user's answer as 'thin' and 'low specificity', leading to the selection of a 'probe' action. Crucially, the agent chose to ask a follow-up question ('Can you go one level deeper on self_intro and explain what you personally did?') without consuming a prepared root question, aligning with the case's objective. The `interview_evaluator` correctly assessed the answer's `interactionStatus` as 'thin' and `specificity` as 'low', suggesting a 'probe' mode. The `adaptive_action_planner` then selected 'ASK_DEEP_DIVE_QUESTION' as the recommended action. The `interview_turn_orchestrator` correctly classified the turn as 'follow_up' and ensured that the prepared root question linkage was preserved. The `question_decision_tracer` provided detailed metadata, including the `sourcePolicy` 'follow_up_from_parent_no_prepared_root_consumption' and the `whyThisQuestion` rationale, confirming the intended behavior. The final spoken question is natural and grounded in the previous turn's context. No failures were observed.
- multi_turn_trajectory_quality_v1: 1
- multi_turn_tool_use_quality_v1: 1
- Suggested fix: inspect the question agent trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.
- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.

### P3: question_technical_mode_blocks_behavioural_pool

- kiwi_question_contract_score: 1
  failed_checks=none; diagnostics={'selectedAction': 'ASK_POOL_QUESTION', 'suggestedNextMode': 'deepen', 'selectedQuestionId': 'prepared-db-validation', 'turnKind': 'root_question', 'sourcePolicy': 'prepared_root_pool', 'selectionSource': 'prepared_question_pool', 'questionQuality': {'score': 0.57, 'earned': 4, 'possible': 7, 'failedChecks': ['jd_grounded', 'cv_or_project_grounded', 'difficulty_fit'], 'checks': [{'label': 'is_question_like', 'passed': True}, {'label': 'natural_length', 'passed': True}, {'label': 'interview_tone', 'passed': True}, {'label': 'jd_grounded', 'passed': False}, {'label': 'cv_or_project_grounded', 'passed': False}, {'label': 'not_repeated', 'passed': True}, {'label': 'difficulty_fit', 'passed': False}]}}
- kiwi_question_constructive_review: 1
  The agent successfully adhered to the technical mode constraint, prioritizing technical questions over behavioral ones even when the behavioral question had a reasonable score. The `prepared_question_pool_ranker` correctly identified and penalized the behavioral 'teamwork' question with `mode_mismatch:technical`. The `adaptive_action_planner` also correctly identified the need to stay in the technical mode. The `interview_turn_orchestrator` then selected a technical question from the pool ('prepared-db-validation') that fit the `match_gap` source and `technical` category, aligning with the overall goal. The `question_decision_tracer` accurately captured the decision-making process, including the rationale for selecting the database question over the API security question (which was also technical but had a penalty for being a repeated topic). The final spoken question is natural and grounded in the context.
- multi_turn_trajectory_quality_v1: 1
- multi_turn_tool_use_quality_v1: 1
- Suggested fix: inspect the question agent trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.
- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.

### P2: question_section_shift_after_coverage

- kiwi_question_contract_score: 1
  failed_checks=none; diagnostics={'selectedAction': 'SHIFT_SECTION', 'suggestedNextMode': 'advance', 'selectedQuestionId': 'prepared-db-validation', 'turnKind': 'root_question', 'sourcePolicy': 'prepared_root_pool', 'selectionSource': 'prepared_question_pool', 'questionQuality': {'score': 0.57, 'earned': 4, 'possible': 7, 'failedChecks': ['jd_grounded', 'cv_or_project_grounded', 'difficulty_fit'], 'checks': [{'label': 'is_question_like', 'passed': True}, {'label': 'natural_length', 'passed': True}, {'label': 'interview_tone', 'passed': True}, {'label': 'jd_grounded', 'passed': False}, {'label': 'cv_or_project_grounded', 'passed': False}, {'label': 'not_repeated', 'passed': True}, {'label': 'difficulty_fit', 'passed': False}]}}
- kiwi_question_constructive_review: 0.9
  The agent successfully evaluated the user's answer, identified that the current section was sufficiently covered, and planned to shift to the next section. The selection of the next question, 'Tell me about one database task you handled yourself.', is well-grounded in the need to fill a 'match_gap' for database-related technical skills and aligns with the decision to shift sections. The process demonstrates good adaptive behavior and adherence to the product contract.
- multi_turn_trajectory_quality_v1: 0.75
- multi_turn_tool_use_quality_v1: 1
- Suggested fix: inspect the question agent trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.
- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.


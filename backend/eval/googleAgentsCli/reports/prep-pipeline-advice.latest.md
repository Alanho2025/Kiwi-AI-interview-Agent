# Google Agents CLI Prep Pipeline Advice

Source result: /Users/heminghan/Kiwi-AI-interview-Agent/backend/eval/googleAgentsCli/results/results_20260618_143834.json

## Summary

- kiwi_prep_pipeline_score: mean 0.91 (4/4 valid)
- kiwi_prep_constructive_review: mean n/a (0/4 valid)
- multi_turn_trajectory_quality_v1: mean n/a (0/4 valid)

## Case Advice

### P3: graduate_cv_to_graduate_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 29, 'possible': 29, 'checks': {'passed': 25, 'total': 25, 'failedChecks': []}}, 'jdParse': {'score': 1, 'earned': 0.99, 'possible': 0.99, 'checks': {'passed': 9, 'total': 9, 'failedChecks': []}}, 'cvJdMatch': {'score': 1, 'earned': 32, 'possible': 32, 'checks': {'passed': 21, 'total': 21, 'failedChecks': []}}}
- Blocked Google metrics: kiwi_prep_constructive_review, multi_turn_trajectory_quality_v1
- Infrastructure blocker: Google managed/LLM judge metrics require Agent Platform API access with billing enabled on the selected project.
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P2: transition_cv_to_data_engineer_jd

- Suggested area: JD parser / JD safeguard
- kiwi_prep_pipeline_score: 0.64 — failed_checks=jd:companyName,jd:requirements,jd:application,match:decision,match:scoreRange,match:matchedRequirement:sql,match:matchedRequirement:ambiguity,match:matchedRequirement:communication,match:gap:snowflake,match:gap:dbt,match:gap:data modelling,match:risk:production,match:summary:project-based evidence,match:jdRelevantEvidence:sql,match:jdRelevantEvidence:communication,match:priorityTopic:sql,match:priorityTopic:snowflake,match:followUpTarget:self introduction,match:followUpTarget:sql,match:interviewFocus:sql; stage_scores={'cvParse': {'score': 1, 'earned': 28, 'possible': 28, 'checks': {'passed': 24, 'total': 24, 'failedChecks': []}}, 'jdParse': {'score': 0.82, 'earned': 0.85, 'possible': 1.04, 'checks': {'passed': 7, 'total': 10, 'failedChecks': ['companyName', 'requirements', 'application']}}, 'cvJdMatch': {'score': 0.11, 'earned': 3, 'possible': 28, 'checks': {'passed': 2, 'total': 19, 'failedChecks': ['decision', 'scoreRange', 'matchedRequirement:sql', 'matchedRequirement:ambiguity', 'matchedRequirement:communication', 'gap:snowflake', 'gap:dbt', 'gap:data modelling', 'risk:production', 'summary:project-based evidence', 'jdRelevantEvidence:sql', 'jdRelevantEvidence:communication', 'priorityTopic:sql', 'priorityTopic:snowflake', 'followUpTarget:self introduction', 'followUpTarget:sql', 'interviewFocus:sql']}}}
- Blocked Google metrics: kiwi_prep_constructive_review, multi_turn_trajectory_quality_v1
- Infrastructure blocker: Google managed/LLM judge metrics require Agent Platform API access with billing enabled on the selected project.
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P3: cloud_cv_to_cloud_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 25, 'possible': 25, 'checks': {'passed': 21, 'total': 21, 'failedChecks': []}}, 'jdParse': {'score': 1, 'earned': 0.86, 'possible': 0.86, 'checks': {'passed': 7, 'total': 7, 'failedChecks': []}}, 'cvJdMatch': {'score': 1, 'earned': 32, 'possible': 32, 'checks': {'passed': 20, 'total': 20, 'failedChecks': []}}}
- Blocked Google metrics: kiwi_prep_constructive_review, multi_turn_trajectory_quality_v1
- Infrastructure blocker: Google managed/LLM judge metrics require Agent Platform API access with billing enabled on the selected project.
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P3: frontend_student_to_senior_backend_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 25, 'possible': 25, 'checks': {'passed': 22, 'total': 22, 'failedChecks': []}}, 'jdParse': None, 'cvJdMatch': {'score': 1, 'earned': 19, 'possible': 19, 'checks': {'passed': 15, 'total': 15, 'failedChecks': []}}}
- Blocked Google metrics: kiwi_prep_constructive_review, multi_turn_trajectory_quality_v1
- Infrastructure blocker: Google managed/LLM judge metrics require Agent Platform API access with billing enabled on the selected project.
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.


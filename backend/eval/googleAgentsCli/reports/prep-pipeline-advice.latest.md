# Google Agents CLI Prep Pipeline Advice

Source result: /Users/heminghan/Kiwi-AI-interview-Agent/backend/eval/googleAgentsCli/results/results_20260618_145937.json

## Summary

- kiwi_prep_pipeline_score: mean 0.91 (4/4 valid)
- kiwi_prep_constructive_review: mean 0.45 (4/4 valid)
- multi_turn_trajectory_quality_v1: mean 0.75 (4/4 valid)

## Case Advice

### P3: graduate_cv_to_graduate_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 29, 'possible': 29, 'checks': {'passed': 25, 'total': 25, 'failedChecks': []}}, 'jdParse': {'score': 1, 'earned': 0.99, 'possible': 0.99, 'checks': {'passed': 9, 'total': 9, 'failedChecks': []}}, 'cvJdMatch': {'score': 1, 'earned': 32, 'possible': 32, 'checks': {'passed': 21, 'total': 21, 'failedChecks': []}}}
- kiwi_prep_constructive_review: 0.8 — The agent successfully parsed the CV and JD, and performed a CV-JD match. The safeguards were active and did not invent facts. The CV-JD match was evidence-grounded, with strengths and gaps clearly identified. The advice quality is good, providing relevant preparation topics without overstating the candidate's fit. The `cv_parser` correctly identified skills and projects. The `jd_parser` accurately extracted requirements and skills. The `cv_jd_matcher` provided a reasonable score and identified key strengths and gaps, such as the partial match for 'Foundations in C#, .NET, SQL, and Git.' The `match_critic` confirmed no major safety issues. The final output from `kiwi_prep_agent` is a good summary of the findings. No specific failures were observed in the trace.
- multi_turn_trajectory_quality_v1: 1
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P1: transition_cv_to_data_engineer_jd

- Suggested area: JD parser / JD safeguard
- kiwi_prep_pipeline_score: 0.64 — failed_checks=jd:companyName,jd:requirements,jd:application,match:decision,match:scoreRange,match:matchedRequirement:sql,match:matchedRequirement:ambiguity,match:matchedRequirement:communication,match:gap:snowflake,match:gap:dbt,match:gap:data modelling,match:risk:production,match:summary:project-based evidence,match:jdRelevantEvidence:sql,match:jdRelevantEvidence:communication,match:priorityTopic:sql,match:priorityTopic:snowflake,match:followUpTarget:self introduction,match:followUpTarget:sql,match:interviewFocus:sql; stage_scores={'cvParse': {'score': 1, 'earned': 28, 'possible': 28, 'checks': {'passed': 24, 'total': 24, 'failedChecks': []}}, 'jdParse': {'score': 0.82, 'earned': 0.85, 'possible': 1.04, 'checks': {'passed': 7, 'total': 10, 'failedChecks': ['companyName', 'requirements', 'application']}}, 'cvJdMatch': {'score': 0.11, 'earned': 3, 'possible': 28, 'checks': {'passed': 2, 'total': 19, 'failedChecks': ['decision', 'scoreRange', 'matchedRequirement:sql', 'matchedRequirement:ambiguity', 'matchedRequirement:communication', 'gap:snowflake', 'gap:dbt', 'gap:data modelling', 'risk:production', 'summary:project-based evidence', 'jdRelevantEvidence:sql', 'jdRelevantEvidence:communication', 'priorityTopic:sql', 'priorityTopic:snowflake', 'followUpTarget:self introduction', 'followUpTarget:sql', 'interviewFocus:sql']}}}
- kiwi_prep_constructive_review: 0 — The agent failed to produce a meaningful match due to a safeguard being triggered during JD parsing. The `jd_parse_critic` identified that 'Bonus requirements were included as core requirements' and flagged this as a high severity issue, leading to `blockMatch: True` and `blockOutput: True`. The `jd_reparse_agent` attempted to correct this by overriding the JD sections, but the safeguard persisted. Consequently, the `cv_jd_matcher` and `match_critic` also reported that the JD needed review before matching, resulting in a `manual_review` decision and an overall score of 0.0. To improve this, the `jd_parser` needs to be more robust in distinguishing between core and bonus requirements. A test case should be added to specifically cover scenarios where JDs have clearly delineated 'Core' and 'Bonus' sections to ensure accurate parsing. The `jd_parse_critic` and `jd_reparse_agent` should also be enhanced to handle such distinctions more effectively, potentially by introducing a specific rule for 'pluses' or explicitly named sections like 'Bonus Requirements'.
- multi_turn_trajectory_quality_v1: 0
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P2: cloud_cv_to_cloud_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 25, 'possible': 25, 'checks': {'passed': 21, 'total': 21, 'failedChecks': []}}, 'jdParse': {'score': 1, 'earned': 0.86, 'possible': 0.86, 'checks': {'passed': 7, 'total': 7, 'failedChecks': []}}, 'cvJdMatch': {'score': 1, 'earned': 32, 'possible': 32, 'checks': {'passed': 20, 'total': 20, 'failedChecks': []}}}
- kiwi_prep_constructive_review: 0.7 — The agent successfully parsed the CV and JD, and the CV-JD match appears to be evidence-grounded. The safeguards were applied appropriately, with no significant issues detected. The match critic also confirmed the safety of the match. The final response accurately reflects the strengths and potential gaps identified, providing relevant interview topics. No specific failures were observed in the trace that would warrant a lower score or specific repair suggestions. The agent behavior is faithful to the fixtures and the criteria. The CV parse accurately identified candidate facts, skills, and evidence. The JD parse correctly extracted role details and requirements. The CV-JD match provided a reasonable score and identified relevant strengths and priority topics based on the provided CV and JD. The advice quality is good, offering actionable preparation topics without overstating the candidate's fit.
- multi_turn_trajectory_quality_v1: 1
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.

### P1: frontend_student_to_senior_backend_jd

- Suggested area: No deterministic agent issue
- kiwi_prep_pipeline_score: 1 — failed_checks=none; stage_scores={'cvParse': {'score': 1, 'earned': 25, 'possible': 25, 'checks': {'passed': 22, 'total': 22, 'failedChecks': []}}, 'jdParse': None, 'cvJdMatch': {'score': 1, 'earned': 19, 'possible': 19, 'checks': {'passed': 15, 'total': 15, 'failedChecks': []}}}
- kiwi_prep_constructive_review: 0.3 — The CV parser correctly identified the candidate's skills (React, JavaScript, HTML, CSS, Git, Tailwind, Testing) and projects, noting the lack of a clear experience section and limited measurable outcomes. The JD parser accurately extracted the role requirements, technical skills (Node.js, SQL, AWS, Docker, CI/CD), and soft skills (Communication). The CV-JD match correctly identified JavaScript and Testing as strengths but flagged significant gaps in crucial backend experience, Node.js, SQL, AWS, Docker, CI/CD, and soft skills like communication and leadership. The decision 'not_qualified' with an overall score of 7.0 is well-supported by these gaps. The priority interview topics align with the JD requirements where the CV is weak. The safeguards appear to have functioned correctly, as no overconfidence or unsupported claims were detected in the match. The final response accurately summarizes the match and highlights key areas for interview focus. To improve, the CV parser could be more robust in inferring experience from project descriptions, and the CV-JD matcher could provide more granular evidence mapping for the identified gaps. For example, when flagging 'Missing evidence for AWS', it could specify which AWS services are most critical based on the JD. Test cases could include CVs with project descriptions that imply backend experience or CVs with limited but relevant professional experience.
- multi_turn_trajectory_quality_v1: 1
- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.
- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.


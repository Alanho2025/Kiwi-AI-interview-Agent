# End-to-End Interview Eval

- Cases run: 3
- Evaluation method: Fixed interview scenario evaluation covering flow validity, question quality, and report grounding. It does not call production routes, databases, voice runtime, or live AI services.
- Average score: 0.98
- Min average gate: 0.88
- Per-case fail gate: 0.7

## Case results
| case | score | flow | question quality | report grounding | failed checks |
| --- | ---: | ---: | ---: | ---: | --- |
| junior_data_scientist_five_question_flow | 0.97 | 1 | 0.89 | 1 | q2:difficulty_fit, q5:jd_grounded, q5:cv_or_project_grounded, q5:difficulty_fit |
| technical_mode_blocks_behavioural_drift | 0.97 | 1 | 0.86 | 1 | q1:jd_grounded, q1:cv_or_project_grounded, q1:difficulty_fit, q4:difficulty_fit |
| bad_report_and_early_completion_is_caught | 1 | 0.5 | 0.71 | 0.33 | starts_with_self_intro, question_count_matches_setting, required_categories_present, required_topics_present, q1:natural_length, q1:interview_tone, report:evidence_reference_present, report:coaching_present, report:no_forbidden_claims, report:no_unknown_skill_claims |

## Interpretation
These reports evaluate fixed interview transcripts and report artifacts. They are useful for repeatable flow and grounding checks, but they are not evidence of a live production E2E run.


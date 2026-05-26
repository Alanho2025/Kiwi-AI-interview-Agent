# Kiwi Green Agent Eval

- Cases run: 20
- Evaluation method: Fixed interview scenario evaluation covering flow validity, question quality, and report grounding. It does not call production routes, databases, voice runtime, or live AI services.
- Average score: 0.99
- Min average gate: 0.88
- Per-case fail gate: 0.7

## Case results
| case | score | flow | question quality | report grounding | failed checks |
| --- | ---: | ---: | ---: | ---: | --- |
| junior_data_scientist_five_question_flow | 0.97 | 1 | 0.89 | 1 | q2:difficulty_fit, q5:jd_grounded, q5:cv_or_project_grounded, q5:difficulty_fit |
| technical_mode_blocks_behavioural_drift | 0.97 | 1 | 0.86 | 1 | q1:jd_grounded, q1:cv_or_project_grounded, q1:difficulty_fit, q4:difficulty_fit |
| bad_report_and_early_completion_is_caught | 1 | 0.5 | 0.71 | 0.33 | starts_with_self_intro, question_count_matches_setting, required_categories_present, required_topics_present, q1:natural_length, q1:interview_tone, report:evidence_reference_present, report:coaching_present, report:no_forbidden_claims, report:no_unknown_skill_claims |
| vague_star_answer | 1 | 1 | 1 | 1 | - |
| missing_result_answer | 1 | 1 | 1 | 1 | - |
| candidate_overclaims_skill | 1 | 1 | 1 | 1 | - |
| jd_cloud_cv_no_cloud | 0.99 | 1 | 0.96 | 1 | q1:difficulty_fit |
| technical_mode_no_behavioural_drift | 0.99 | 1 | 0.96 | 1 | q1:difficulty_fit |
| behavioural_mode_no_coding_question | 1 | 1 | 1 | 1 | - |
| combined_mode_balanced | 0.99 | 1 | 0.97 | 1 | q1:difficulty_fit |
| junior_too_hard_question_guard | 1 | 1 | 1 | 1 | - |
| senior_too_basic_question_guard | 1 | 1 | 1 | 1 | - |
| nz_context_enabled | 1 | 1 | 1 | 1 | - |
| nz_context_disabled | 0.99 | 1 | 0.96 | 1 | q1:difficulty_fit |
| company_info_available | 1 | 1 | 1 | 1 | - |
| company_info_missing | 1 | 1 | 1 | 1 | - |
| one_word_answer | 1 | 1 | 1 | 1 | - |
| candidate_says_dont_know | 1 | 1 | 1 | 1 | - |
| noisy_voice_transcript | 1 | 1 | 1 | 1 | - |
| long_answer_weak_structure | 0.99 | 1 | 0.96 | 1 | q1:difficulty_fit |

## Interpretation
These reports evaluate fixed interview transcripts and report artifacts. They are useful for repeatable flow and grounding checks, but they are not evidence of a live production E2E run.


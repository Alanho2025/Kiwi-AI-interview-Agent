# Preparation Stability Evaluation

Suite: preparation_stability
Total cases: 80
Passed: 80
Failed: 0

## Artifact Failures

| Artifact type | Count |
|---|---:|
| cvProfileMissing | 0 |
| cvSeedsMissing | 0 |
| jdRubricMissing | 0 |
| jdFilterMissing | 0 |
| matchAnalysisMissing | 0 |
| questionPoolMissing | 0 |
| indexingMissing | 0 |
| reportEvidenceMissing | 0 |

## Case Results

| Case | Group | Passed | Failed artifact type | Failed stage | Fallback triggered | Why fallback did not count as pass | Recommended fix area |
|---|---|---|---|---|---|---|---|
| cv_parse_structured_profile | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_without_projects | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_dense_bullets | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_mixed_education_work | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_ai_project_names | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_low_information_warning | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_repeated_skills_deduped | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_missing_dates | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_personal_statement_noise | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_parse_malformed_layout_no_crash | cv_parsing | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_react_project_ownership | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_backend_api_implementation | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_data_metrics | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_education_only_entry_level | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_weak_experience_no_invention | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_review_adds_project | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_review_removes_skill | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_repeated_project_deduped | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_unclear_ownership_clarification | cv_seed_generation | true | - | - | false | No fallback was used for this case. | - |
| cv_seed_no_usable_evidence_failure | cv_seed_generation | true | cv_seeds | cv_seed_generation | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | cv_seed_generation:cv_seeds |
| jd_parse_normal_software_engineer | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_junior_role | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_senior_role | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_no_salary_no_hallucination | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_long_company_intro | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_repeated_requirements_deduped | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_benefits_responsibilities_split | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_vague_responsibilities | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_non_jd_marketing_text_flagged | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_prompt_injection_ignored | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_seek_noisy_formatting | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_parse_updated_jd_invalidates_summary | jd_parsing | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_frontend_priority | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_backend_priority | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_fullstack_balanced | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_sql_gap_target | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_testing_weak_evidence | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_benefits_noise_excluded | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_required_ranked_higher | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_vague_role_level_targets | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_prompt_injection_ignored | jd_question_filter | true | - | - | false | No fallback was used for this case. | - |
| jd_filter_missing_match_failure | jd_question_filter | true | jd_filter | jd_filter_generation | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | jd_filter_generation:jd_filter |
| match_strong_evidence | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_weak_evidence | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_partial_transferable | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_jd_skill_missing_gap | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_cv_skill_not_required | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_overclaimed_candidate_evidence | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_junior_cv_senior_jd | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_senior_cv_junior_jd | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_ambiguous_role_title | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| match_power_of_3_stability | cv_jd_match | true | - | - | false | No fallback was used for this case. | - |
| pool_rich_cv_rich_jd_full_pool | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_react_cv_backend_integration_jd | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_sql_gap_validation | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_cloud_gap_validation | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_behavioural_mode_star | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_technical_mode_tradeoff | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_combined_mode_balanced | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_junior_role_avoids_overly_senior | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_senior_role_avoids_too_basic | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_duplicate_seeds_deduped | prepared_question_pool | true | - | - | false | No fallback was used for this case. | - |
| pool_empty_cv_seeds_failure | prepared_question_pool | true | cv_seeds | question_pool_composition | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | question_pool_composition:cv_seeds |
| pool_missing_jd_filter_failure | prepared_question_pool | true | jd_filter | question_pool_composition | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | question_pool_composition:jd_filter |
| retrieval_cv_profile_skill_query | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_jd_rubric_skill_query | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_prepared_pool_topic_query | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_match_gap_evidence | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_interview_plan_objective | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_transcript_answer_evidence | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_source_type_preserved | artifact_retrieval | true | - | - | false | No fallback was used for this case. | - |
| retrieval_missing_artifact_failure | artifact_retrieval | true | retrieval_index | artifact_indexing_retrieval | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | artifact_indexing_retrieval:retrieval_index |
| report_supported_strength_passes | report_evidence_qa | true | - | - | false | No fallback was used for this case. | - |
| report_invented_kubernetes_fails | report_evidence_qa | true | report_evidence | report_evidence_qa | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | report_evidence_qa:report_evidence |
| report_skipped_topic_claim_fails | report_evidence_qa | true | report_evidence | report_evidence_qa | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | report_evidence_qa:report_evidence |
| report_high_score_without_evidence_fails | report_evidence_qa | true | report_evidence | report_evidence_qa | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | report_evidence_qa:report_evidence |
| report_wrong_jd_requirement_fails | report_evidence_qa | true | report_evidence | report_evidence_qa | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | report_evidence_qa:report_evidence |
| report_transcript_contradiction_fails | report_evidence_qa | true | report_evidence | report_evidence_qa | false | Required preparation failure was surfaced explicitly; fallback did not satisfy artifact readiness. | report_evidence_qa:report_evidence |
| report_weak_evidence_needs_review | report_evidence_qa | true | - | - | false | No fallback was used for this case. | - |
| report_power_of_3_qa_stability | report_evidence_qa | true | - | - | false | No fallback was used for this case. | - |

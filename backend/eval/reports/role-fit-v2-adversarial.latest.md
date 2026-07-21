# Role-Fit V2 Adversarial Evaluation

- Dataset: role-fit-v2-adversarial-v1
- Cases: 12
- Dataset checks passed: yes
- Risk areas: jd_prompt_injection, website_evidence_safety, company_grounding, source_conflict, role_intent_grounding, candidate_evidence, role_evidence_map, question_ranking, live_no_hint, answer_alignment_dataset, answer_alignment, report_qa
- Calibration status: calibrated
- Calibration reviewed cases: 12
- Release threshold: 0.85
- Production claim allowed: yes
- Production claim blocker: none

This deterministic suite checks mock-safe adversarial coverage for Role-Fit Closed Loop v2. It does not call real AI providers. A production numerical threshold is valid only when the paired human calibration report is fully reviewed and auditable.

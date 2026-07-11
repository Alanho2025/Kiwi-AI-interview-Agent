# Runtime Agent Trajectory Eval

- Dataset: role-fit-trajectory-v1
- Cases run: 5
- Average: 1
- Config fingerprint: sha256:b06adde605043e3327be500c710a480dc27495159b28f978aafac468dde288ef

| Metric | Value |
|---|---:|
| actionSelectionAccuracy | 1 |
| toolArgumentValidity | 1 |
| evidenceUseAccuracy | 1 |
| interviewStateSafety | 1 |
| latencyBudgetCompliance | 1 |

| Case | Action | Tool | Score | Latency (ms) |
|---|---|---|---:|---:|
| vague_answer_requires_probe | ASK_PROBING_QUESTION | generate_interview_question | 1 | 1.8062 |
| misunderstanding_requires_rephrase | REPHRASE_QUESTION | generate_interview_question | 1 | 0.0493 |
| fresh_anchor_uses_pool | ASK_POOL_QUESTION | generate_interview_question | 1 | 0.0284 |
| final_turn_wraps_stage | WRAP_STAGE | generate_interview_question | 1 | 0.112 |
| report_task_uses_report_tool | GENERATE_REPORT_DRAFT | draft_interview_report | 1 | 0.0304 |

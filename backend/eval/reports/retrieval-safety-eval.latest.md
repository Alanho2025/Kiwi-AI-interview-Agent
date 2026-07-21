# Retrieval Eval

- Cases run: 8
- Average score: 0.97

## RAG Evaluation Metrics Summary
| Metric | Average Score | Description |
|---|---|---|
| **Coverage Rate** | 95.83% | Fraction of expected relevant evidence successfully found in retrieved sources. |
| **Citation Accuracy** | 100.00% | Fraction of output citations/claims verified in retrieved sources. |
| **Hallucination Rate** | 0.00% | Fraction of output citations/claims unsupported by sources (1 - Citation Accuracy). |
| **Adversarial Pass Rate** | 87.50% | Fraction of adversarial test cases satisfying complete evidence and zero unsupported claims. |
| **Agent Disagreement Rate** | 4.17% | Jaccard distance between expected evidence and actual retrieved evidence. |
| **Success Rate** | 100.00% | Fraction of cases completing successfully without exception/degradation. |
| **Average Latency** | 0.000324s | End-to-end processing latency. |

## Case Breakdown
| Case | Score | Cov Rate | Cit Acc | Halluc Rate | Adv Pass | Ag Disagree | Latency | Failed Checks |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| direct_skill_match | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.001767s | - |
| paraphrased_skill_match | 1 | 66.7% | 100.0% | 0.0% | Fail | 33.3% | 0.000107s | - |
| weak_evidence_not_upgraded | 0.8 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000070s | query_has_some_overlap_or_timeout |
| irrelevant_evidence_blocked | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000090s | - |
| cv_jd_gap_detected | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000387s | - |
| nz_guidance_only_when_needed | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000101s | - |
| star_example_retrieved_for_coaching | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000043s | - |
| retrieval_timeout_degraded_fallback | 1 | 100.0% | 100.0% | 0.0% | Pass | 0.0% | 0.000028s | - |

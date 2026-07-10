# Runtime Retrieval and Generation Grounding Eval

- Retrieval dataset: role-fit-retrieval-v1
- Generation dataset: role-fit-generation-v1
- Cases run: 10
- Combined average: 1
- Calibration status: pending_human_review
- Numerical release threshold: not_set

## Retrieval metrics
| Metric | Value |
|---|---:|
| precisionAtK | 1 |
| recallAtK | 1 |
| mrr | 1 |
| ndcg | 1 |
| forbiddenEvidenceRetrievalRate | 0 |
| sourcePolicyAccuracy | 1 |

## Generation grounding metrics
| Metric | Value |
|---|---:|
| claimFaithfulness | 1 |
| requiredClaimCoverage | 1 |
| responseRelevancy | 1 |
| noiseSensitivity | 0 |
| unsupportedClaimFailureRate | 0 |

## Important interpretation

This report executes the production fusion ranker through its deterministic in-memory adapter. Generation grounding is a separate claim-level evaluation. Human calibration is required before these scores become numerical release thresholds.

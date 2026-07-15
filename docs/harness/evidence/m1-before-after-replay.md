# M1 Before/After Replay

- Generated: 2026-07-15T11:05:11.855Z
- Mode: `mock_deterministic_local`
- Verdict: `READY_FOR_HUMAN_VALIDATION`
- Scenarios: 11/11 passed

## Result

| Scenario | Result |
| --- | --- |
| `flag_off_rollback` | PASS |
| `text_happy_path_legacy_parity` | PASS |
| `refs_only_privacy` | PASS |
| `invalid_model_action_fallback_lineage` | PASS |
| `voice_pretask_rejection_traceable` | PASS |
| `voice_confirmation_same_run` | PASS |
| `duplicate_canonical_run_count_zero` | PASS |
| `shadow_persistence_failure_preserves_product_result` | PASS |
| `background_memory_write_correlated_no_scoring` | PASS |
| `backend_trace_immediate_redacted` | PASS |
| `repeated_memory_keeps_latest_provenance` | PASS |

Harness OFF and ON returned structurally identical legacy results for the frozen text fixture. The sample run contains refs/hash/version metadata and does not contain the answer, generated question text, or candidate-action rationale.

## Boundaries

This replay is deterministic and mock-safe. Human debug timing, browser H1, live speech providers, and production shadow remain unverified.

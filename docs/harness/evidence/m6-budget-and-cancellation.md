# M6 Budget and Cancellation Evidence

- Generated: 2026-07-26T11:00:23+12:00
- Status: `PARTIAL`
- Promotion allowed: no

## Implemented

The execution-control envelope records elapsed time and makes unavailable usage explicit. DeepSeek usage emitted inside a harness task is correlated to the current `workflowRunId` and, when the call occurs inside a fixed registry capability, its capability ID. The budget ledger then totals model calls, input/output tokens, and estimated cost. If a mock/provider path returns no usage, fields remain unavailable rather than being treated as zero or in budget.

## Not implemented

- Numeric ceilings for model calls, tokens, cost, and task deadline are not approved or enforced.
- Real-provider coverage has not verified that every model call emits usage; non-DeepSeek/provider-local paths remain explicitly unavailable.
- Harness-level cancellation propagation and late-result suppression are not implemented.
- Session pause/end/revocation has not been proven to prevent every late question, score, memory write, or report write.

This evidence therefore blocks `warn` / `enforce` promotion even though local lifecycle tests pass.

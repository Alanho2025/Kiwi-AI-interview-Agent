# M6 Write-Gate Evidence

- Generated: 2026-07-26T11:00:23+12:00
- Status: `OBSERVE_ONLY`

## Current decisions

- Report persistence receives an observed decision derived from the existing publication status.
- `ready` and `ready_after_repair` map to observed accept; `needs_review` and `repair_failed` map to review.
- The evidence explicitly records that current report persistence completes before the observe gate: `sideEffectStatus=completed_before_observe_gate`.
- Session-local memory may record an observed accept decision.
- Cross-session/user coaching memory remains deferred to its owning M3 policy.

## Boundary

All decisions have `enforced=false`. Candidate visibility, download, TXT/PDF export, report persistence, and cross-session memory behavior are unchanged. Moving the decision before persistence or blocking visibility/export requires product approval, false-block evidence, rollback evidence, and domain-owned enforcement.

# M3 User Interview Memory Outcomes

- Generated: 2026-07-15T12:43:27.379Z
- Verdict: `LOCAL_MEMORY_OUTCOME_GATE_PASS`
- Eligible cases: 5
- Same-depth repeat reduction: 100.00% (target >= 30%)
- Coverage increase: 100.00% (target >= 20%)
- Wrong suppression: 0 (target 0)
- Evaluator output changed by memory: no

## Safety cases

| Case | Result |
| --- | --- |
| `single_session_not_promoted` | PASS |
| `role_mismatch_not_applied` | PASS |
| `stale_memory_requires_revalidation` | PASS |
| `conflict_requires_revalidation` | PASS |

## Boundary

The projection is recomputed from session-owned analysis artifacts during warm-up and is stored only on the current session. Runtime planning is off by default. User controls, source-delete invalidation, human repeated-session validation, and production observe remain open gates.

## 2026-08-02 New-session composition extension

- The projection is now read before a new `SessionQuestionSet` is first persisted, only when harness shadow plus observe mode and `ENABLE_USER_INTERVIEW_MEMORY_PLANNING=true` are all present. Flag-off sessions do not read history or alter the pool.
- A contribution uses refs from the last countable AI question that the candidate answered. It does not inherit the next selected question's target, raw question text, or raw answer.
- Only two independent, fresh, same-normalized-role strong contributions with no weak or partial conflict may suppress a matching routine root. Weak/partial/conflicting evidence instead retains the root and applies a bounded `0.18` revalidation priority boost. Opening, closing, and fallback roots stay available.
- The composition policy is planning-only: `canAffectScoring=false`; it contains no raw answer and is not candidate-facing. Browser text, live voice/provider, Mongo persistence, production observe, user controls, and source-delete validation remain `NOT RUN`.
- Local verification: seven focused backend Vitest files, 89 tests passed; backend ESLint passed. This does not verify browser text, live voice/provider, Mongo persistence, or production observe.

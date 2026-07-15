# Harness Product Update Rules

These rules supplement the root `AGENTS.md`. Root, security, privacy, clean-code, and voice product rules still apply.

## Required Reading

Before any harness product update, read:

1. `docs/harness/goal.md` — canonical goal tree, live status, evidence, and final verdict
2. `docs/harness/spec.md`
3. `docs/further_plan/product-harness-decision-questionnaire.md`
4. `docs/further_plan/product-harness-contract-spine.md`
5. Current owning source, tests, and relevant `repo-docs/` pages

For code changes also read `docs/clean-code-rules.md`. For voice/question/transcript changes also read `VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md`.

## Execution Order

1. Name the `Gx/Mx` sub-goal, workflow, and current source of truth.
2. Read and update the sub-goal row in `docs/harness/goal.md`; do not keep status only in chat.
3. Separate current fact, approved target, assumption, and pending decision.
4. Identify affected contracts, gates, memory authority, failure modes, privacy, replay, and rollback.
5. Implement in `shadow -> observe -> warn -> enforce` order.
6. Run focused tests and deterministic before/after replay before broader suites.
7. Write detailed evidence under `docs/harness/evidence/` and update the canonical goal verdict.
8. Update decision status and repo-docs when current behavior changes.

## V0 Boundaries

- Keep the existing domain controller authoritative; do not create a second orchestrator.
- First runtime slice: `interview_next_turn` shadow/observe.
- First candidate enforce slice: report QA, only after parity/replay approval.
- V0 user memory may affect planning, question selection/depth, coverage, and coaching; `canAffectScoring=false`.
- Voice uses lightweight correlation/gates and must preserve the 3-second product latency target.
- Full trace is developer-only; users receive concise, non-technical summaries.
- Store refs/hash/version by default. Do not store raw chain-of-thought or unnecessary candidate payload.

## Required Change Record

Every harness update must state:

- `Gx/Mx` sub-goal and canonical status change
- workflow and execution mode
- approved decision or unresolved assumption
- current-vs-target behavior
- contract/version changes
- side effects and failure classification
- privacy/retention impact
- tests/replay/eval evidence
- rollback trigger and remaining manual/live gates
- evidence artifact paths and before/after verdict

## Hard Stops

Stop and request Product Owner approval before:

- implementing a spec that is not marked approved
- changing an approved product decision
- moving a gate into `enforce`
- letting memory affect matching/scoring
- changing candidate visibility/publication behavior
- adding raw/redacted payload snapshots outside the approved allowlist
- changing retention/deletion semantics
- adding heavy work to the voice hot path
- replacing the current controller or persistence source of truth

## Completion Gate

Do not claim completion unless legacy parity, contract validation, correlation, privacy, replay, rollback, and relevant focused tests pass. State real-provider, live voice, browser, human-review, and production gates separately when they remain unverified.

Detailed evidence may live in separate files, but `docs/harness/goal.md` must always show the latest sub-goal status and final verdict. A chat summary or passing test command alone is not the project result.

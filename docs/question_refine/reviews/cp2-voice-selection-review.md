# CP2 Human Review — Voice Pool Recommendation

> Decision: `approved`
> Reviewer: `heminghan`
> Decided at: `2026-07-28T20:19:45.000Z`
> Dependency: CP1 catalog `2026.1` content approval — satisfied
> Candidate policy digest: `36311aefcc6c503017bcaba7dd5e5bd960c0f07d395d0b5bf4ebea63a81d8116`
> Runtime state: deterministic policy is locally implemented. Historical runtime record (recorded with this decision; not reverified in this task): staging Mongo database `test` contained 21/21 approved `2026.1` entries for new Voice-session preparation.

This is the compact decision sheet. Review the generated [executable role, level, question-count, coverage and follow-up matrix](cp2-voice-selection-policy-full-review.md) before recording a decision here. Catalog activation now requires both the CP1 content review and this CP2 policy review to be approved by the same reviewer for version `2026.1`.

## Candidate-safe wording previews

The stored variants alter expected depth, not just the label.

| Family | Junior | Intermediate | Senior |
| --- | --- | --- | --- |
| AI-assisted delivery | Where in a project have you used AI, what did you use it for, and how did you check the result was useful and correct? | Walk me through how you use AI across planning, building, debugging, testing, or documentation while keeping ownership of the final result. | When you use AI-assisted development, how do you make trade-offs, risks, and release checks explicit while keeping ownership of the final result? |
| Group failure | Tell me about a time a group project did not go as planned. What was your part in it, and what did you learn? | Tell me about a time a group project did not go as planned. What was your part in it, and what did you learn? Include the decision you made, your personal contribution, and the outcome. | Tell me about a time a group project did not go as planned. What was your part in it, and what did you learn? Include the scope, trade-offs, stakeholder impact, and what you would carry into a similar situation. |
| Technical catalog default | Give one concrete example and explain your personal action. | Explain the key decision, validation and outcome. | Explain scope, trade-offs, risks, stakeholder effect and operational confidence. |

## Representative policy traces

These are developer/reviewer traces. Candidate responses receive only a safe status/count summary, not coverage-slot names, rankings, alternatives or private evidence.

| Scenario | Expected trace outcome |
| --- | --- |
| Software or Data, 8/15 questions, no AI in CV/JD | `software_ai_workflow`, `minAsked=1`; reservation becomes urgent only near the remaining-slot boundary |
| Explicit AI Solution role | `ai_solution_delivery` plus one `ai_solution_second_family`; the second root is selected from prompt/context, RAG, agent reliability or evaluation |
| One provider name in a Software JD | Software baseline remains one AI workflow root; provider name alone does not reserve a second AI family |
| Intermediate ML | One `ml_foundation` root |
| Senior ML | `ml_foundation` plus `ml_operations` |
| Non-tech without AI/digital signal | AI judgement is ineligible |
| Non-tech with supported AI/digital signal | AI judgement is optional, `minAsked=0`, `maxAsked=1` |
| Minor answer gap and valuable fresh root | comparator returns `next_root` and the controller actually switches to root |
| Shallow answer with material evidence deficits | comparator may retain a named follow-up |
| Interview ends with a required reservation unasked | developer trace records `coverage_degraded`; candidate receives counts/status only |

## Local evidence

- Question suite: 31 files / 137 tests.
- Matrix coverage: 8 and 15 questions; Junior, Intermediate and Senior; Software, AI Solution, ML and non-tech boundaries.
- Large-pool bound: deterministic ranking of 501 candidates is guarded below 1 second in the focused test; the latest whole test file completed in about 0.4 seconds. This is a local bound, not proof of the Voice 3-second end-to-first-audio SLO.
- Text sessions do not load catalog content or compute catalog completion coverage.
- Historical external execution record: Mongo seed/activation was recorded against the confirmed staging database as 21 unique entries, all `approved`, reviewer `heminghan`; a current task must perform a read-only post-check before claiming this remains active.
- No real-provider eval, live Voice session or browser human flow for this new policy has run.

## Required Product Owner decision

Confirm or revise:

1. Whether the level wording is substantively different enough, especially the generic Intermediate/Senior suffixes.
2. Whether the reservation contract is correct for 8- and 15-question Voice sessions.
3. Whether `isShallow + missingEvidence` is enough to let a follow-up beat the next root, pending later calibration.
4. Whether candidate-safe completion output should expose only status/counts as implemented.

Decision reason: Product Owner approved the CP2 Voice role, level, question-count, coverage, follow-up, and candidate-visibility policy.

This approval and the separately recorded CP1 approval authorized the recorded `2026.1` database activation. It does not authorize CP3 clarification behavior, CP4 report coaching, automatic future policy publishing, or unrelated production rollout. A current external read-only post-check is still required before treating the historical runtime record as present state.

# Phase 1 Review Brief — Voice Duration Assessment

> This is the human-review surface for Phase 1. The full operational plan remains in [impact-first-past-example-phase-1-plan.xml](./impact-first-past-example-phase-1-plan.xml). Review this brief for decisions and acceptance boundaries; use the XML only when implementation or audit needs exact pseudocode.

## Review method

Use progressive disclosure:

1. Review this brief for the product decision, scope, data contract, files, tests, risks, and stop conditions.
2. Review only the linked XML section when a decision is unclear.
3. During implementation, review the changed-file diff and the evidence matrix, not the entire plan again.

The brief is not a second implementation plan. It is a compressed index into the XML and the only document intended for normal line-by-line human review.

## 1. One-sentence goal

For every accepted substantive root voice answer, convert the persisted per-turn `speakingDurationSeconds` into one deterministic five-level assessment and expose it to later score composition without changing the current overall score in Phase 1.

## 2. Scope decision

In scope:

- Read `answerTurn.metadata.voiceDelivery.speakingDurationSeconds`.
- Require an accepted report question-answer pair, a root question, and current voice mode (`realtime_voice` or `duplex_voice`).
- Map duration to Level 1–5 and `0 / 2.5 / 5 / 7.5 / 10` points.
- Expose the same assessment on the pair, nested report metrics, and deterministic turn breakdown.
- Add focused backend tests, F-34 documentation sync, and one change-log entry.

Explicitly deferred:

- Overall score composition and denominator changes.
- Impact-first content evaluation and semantic routing.
- Coaching copy, candidate publication, frontend, PDF/TXT, and public schema.
- Text timing, old-report migration, VAD/STT/TTS/WebSocket behavior, live provider tests, and release.

## 3. Decisions to review

| Decision | Contract | Why it matters |
|---|---|---|
| Canonical source | Per-turn transcript metadata, not `latestVoiceDeliverySummary` | The aggregate is background-derived and may be stale or include excluded turns. |
| Accepted boundary | Reuse `buildReportTurnDataset` | Repair, confirmation, clarification, repeat, acknowledgement, candidate-question, pending, rejected, and unconfirmed turns must not become duration penalties. |
| Root boundary | Reuse `buildQuestionHistory` classification | Follow-ups remain real interview questions but are not duration-scored root answers. |
| Text boundary | Text is `not_applicable` | Text timing is explicitly deferred and must not receive a missing 10-point penalty. |
| Missing evidence | `eligible: false`, `earnedPoints: null` | System measurement failure must not become candidate Level 1 / zero points. |
| Decimal semantics | Do not round before banding | `69.99` stays below 70 and `120.01` is outside the top band. |
| Top band | `90 <= seconds <= 120` = Level 5 / 10 points | A 100-second answer is inside target, not overlong. |
| Phase 1 score boundary | Do not modify `reportScoreService.js` | Phase 4 will compose duration exactly once. |
| Internal metric name | Nested `voiceDurationAssessmentSummary` | Avoid current frontend legacy fields that would misread 100 seconds as overlong. |
| Release boundary | One final release after all phases | Phase 1 is an internal foundation, not a temporary user-facing scoring release. |

## 4. Exact five-band contract

| Level | Continuous duration range | Earned points |
|---:|---|---:|
| 1 | `< 60` or `> 150` | 0 |
| 2 | `60 <= seconds < 70` or `140 < seconds <= 150` | 2.5 |
| 3 | `70 <= seconds < 80` or `130 < seconds <= 140` | 5 |
| 4 | `80 <= seconds < 90` or `120 < seconds <= 130` | 7.5 |
| 5 | `90 <= seconds <= 120` | 10 |

Exact boundary expectations: `60 -> L2`, `70 -> L3`, `80 -> L4`, `90 -> L5`, `120 -> L5`, `130 -> L4`, `140 -> L3`, `150 -> L2`.

## 5. Assessment object

Eligible root voice answer:

```js
{
  eligible: true,
  reason: 'eligible_root_voice_answer',
  seconds: 100,
  level: 5,
  earnedPoints: 10,
  maxPoints: 10,
}
```

Not applicable answer:

```js
{
  eligible: false,
  reason: 'text_timing_deferred', // or another stable reason code
  seconds: null,
  level: null,
  earnedPoints: null,
  maxPoints: 10,
}
```

`null` points and Level 1 zero are intentionally different states.

## 6. Planned change surface

Production files:

- Add `backend/src/services/report/voiceDurationAssessmentService.js` as the only duration-rule owner.
- Modify `backend/src/services/report/reportTurnDatasetService.js` to annotate accepted pairs once.
- Modify `backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js` to expose nested summary metrics.
- Modify `backend/src/services/agents/reportGeneratorAgent.js` to carry the same deterministic assessment into turn breakdowns.

Tests:

- Add `backend/tests/robustness/report/voiceDurationAssessmentService.test.js`.
- Extend `backend/tests/robustness/report/reportTurnDatasetRobustness.test.js`.
- Extend `backend/tests/robustness/voice/voiceDeliveryAnalyzerRobustness.test.js`.

Documentation:

- Update the owning RFC `docs/architecture-decision-records/features/F-34-report-generation-pipeline.md`.
- Append one scoped entry to `repo-docs/change-log.md`.

Read-only guards: `voiceDeliveryAnalyzerService.js`, `realtimeVoiceTurnService.js`, `reportScoreService.js`, `reportCoachingBuilder.js`, `schemaHelpers.js`, and `frontend/src` should not receive Phase 1 task changes.

## 7. Evidence required before Phase 1 is complete

| Requirement | Positive proof | Negative proof |
|---|---|---|
| Source conversion | VAD milliseconds produce seconds | Missing/zero source returns null |
| Five bands | All exact and decimal boundaries pass | No overlap/gap; 100 seconds is L5 |
| Eligibility | Accepted root voice pair is eligible | Text, follow-up, unknown mode, missing duration are N/A |
| Exclusions | Root remains paired after clarification turns | Repair/confirmation/candidate-question/unconfirmed turns create no scored pair |
| Summary | Eligible-only averages/counts | N/A turns do not enter denominator; stale aggregate cannot override pair data |
| Handoff | Pair and deterministic breakdown share values | Model output cannot forge measured duration |
| Score safety | Current score before/after is identical | `reportScoreService.js` has no Phase 1 diff |
| Scope safety | Focused tests, lint, diff checks, docs evidence pass | No frontend/voice-runtime/public-schema/Phase 4 changes |

## 8. Implementation stop conditions

Stop and report before continuing if any of these occurs:

- The actual runtime does not persist the expected per-turn voice metadata.
- A follow-up/root classification cannot be determined from current metadata without inventing a new policy.
- The implementation needs `reportScoreService.js`, frontend/public schema, coaching copy, or voice runtime changes.
- The forecast exceeds 10 task-owned files or 500 incremental lines.
- A focused test shows missing system evidence is being treated as candidate zero.
- Existing dirty edits overlap a planned file.

## 9. Verification sequence

1. Run the three focused Vitest files.
2. Run backend ESLint.
3. Run `git diff --check` and task-scoped forbidden-path checks.
4. Update F-34 and `repo-docs/change-log.md` with actual evidence only.
5. Run exactly one independent audit with a line-by-line PASS/FAIL/NOT RUN matrix.

Live voice/provider, browser, human calibration, production, deployment, and real AI evaluation remain `NOT RUN`.

## 10. Review request

The review decision is whether the ten contracts in Sections 2–5 and the eight evidence rows in Section 7 are correct. If they are accepted, implementation can proceed against the XML without asking for a second review of the same decisions.

## 11. Current implementation evidence

Phase 1 is implemented on branch `codex/impact-first-past-example`. The short brief remains the human review surface; the XML is retained as the execution/audit appendix.

| Gate | Result |
|---|---|
| Focused duration/dataset/voice tests | 3 files / 51 tests passed after Cycle 3 coverage repair |
| Report robustness suite | 23 files / 166 tests passed after Cycle 3 coverage repair |
| Voice robustness suite | 41 files / 183 tests passed after a controlled local-listener rerun; the first sandbox attempt failed only on existing `listen EPERM` |
| Backend lint | Passed |
| `git diff --check` | Passed |
| Independent audit | Final Cycle 3 matrix: 10/10 PASS, no blocking finding |

Implemented production surface: one new duration-rule service plus dataset, metrics and deterministic breakdown handoff. Implemented test surface: one new service test plus two existing robustness test extensions. Documentation synced: F-34 and one changelog entry.

Not run in Phase 1: frontend rendering, browser/manual calibration, live voice/provider, real AI evaluation, Mongo persistence and production rollout. Overall score remains unchanged by design.

The same clean-context Cycle 3 auditor reviewed the repaired implementation and returned PASS for all ten acceptance categories. The first audit's stale XML state and three bounded coverage gaps were repaired before this final result; no additional blocking issue remained.

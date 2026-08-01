# Candidate Turn Assessment and Grounded Better-Answer Specification

> **實作狀態 (Implementation Status)**：Partial / local implementation exists；independent audit blocked duplicate/reordered rewrite matching。
>
> **校驗測試路徑 (Verified by Tests)**：Focused backend/frontend tests passed at the recorded 2026-07-30 checkpoint；release-complete status was not verified。

> **Remediation authority**：本文件保留為歷史 implementation baseline。新的 slice boundaries、blast radius、allowed files、BDD與 stop rules 以 [Candidate Report UI Semantic Integrity Specification](report-ui-semantic-integrity-spec.md) 為準。

日期：2026-07-30 Pacific/Auckland

對應 Goal：[Candidate Turn Assessment and Grounded Better-Answer Goal](candidate-turn-assessment-goal.md)
上游契約：[QI-CP4 Report Alignment and Progress Coaching](../question_refine/04-report-progress-coaching.md)

## 1. Overview, authority and conflict rules

This specification makes the candidate report's turn card answer four different questions without conflating them:

1. What response framework applies and how complete was it?
2. Did the candidate directly address the prompt?
3. What concrete information is missing?
4. How could the candidate answer this same prompt more clearly without inventing new facts?

The CP4 accepted-answer contract, report publication allowlist, privacy/ownership policy and Voice product contract take precedence over display convenience. If a lower layer lacks safe evidence, it must return `not_assessed` or `unavailable`, not guess.

## 2. Current baseline and target delta

| Area | Current fact | Planned delta |
| --- | --- | --- |
| Framework | The per-turn card can render Introduction, STARR or Role-specific framework dimensions and a 0–10 framework score. | Preserve this display and label it only as framework assessment. |
| Answer result | `answer_alignment_v2` exists server-side for prepared Role-Fit pairs, but candidate reports remove the entire Role-Fit object. | Project a safe per-turn assessment to every accepted answer. |
| Non-Role-Fit turn | Alignment returns a legacy/empty role-fit result when no proof strategy exists. | Add a generic directness fallback that never claims role-intent evidence. |
| Better answer | The existing report-generation contract requests `question`, `weak` and grounded `better` answer text, but the HTML renders rewrites as a separate list. | Match each safe rewrite to its turn and render it inside that turn's card. |
| Legacy | Existing reports are read as-is. | Do not alter them; show no fabricated result/rewrite and retain regeneration behavior. |

## 3. Functional requirements

### 3.1 Eligible turns

1. An assessment and rewrite are created only for a user turn that the existing accepted-answer dataset considers accepted.
2. `countsAsAnswer=false`, rejected, pending, unconfirmed, repair, repeat, transcript-confirmation, clarification, system and acknowledgement turns are excluded.
3. The number of candidate turn cards and requested rewrites equals the actual accepted-answer count for that report. There is no static question cap.
4. An incomplete session is supported: every accepted answer already present is shown; no claim is made about unanswered planned questions.

### 3.2 Framework assessment

1. Existing rubric selection and framework scoring remain authoritative.
2. `frameworkScore` remains 0–10 and describes framework completeness only.
3. Framework dimensions must not be presented as a proof that the prompt was directly answered.
4. A turn can have a strong framework score and a partial/directness assessment, or vice versa; the UI must show both without attempting to reconcile them into a new overall score.

### 3.3 Answer-result assessment

Each eligible turn exposes one candidate-safe assessment:

- `directly_addressed`: it directly addresses the prompt with sufficiently clear relevant content.
- `partly_addressed`: it relates to the prompt but omits a key requested aspect, relevant evidence or clear connection.
- `needs_clearer_connection`: it does not yet make the relationship to the prompt sufficiently clear.
- `not_assessed`: a safe deterministic assessment cannot be built from the available report context. This is not a failure label.

The display score is an integer from 0 through 100. It is a coaching score and is not included in the existing overall, interview-performance or framework-score formulas for this slice.

For prepared Role-Fit questions, implementation maps the existing alignment evidence into this public model. For non-Role-Fit eligible questions, it uses a generic directness assessment based on the canonical question and answer content, completion and available evidence signals. The generic fallback must not state that a role intent, CV evidence item or expected signal was met unless that claim is already grounded and safe to publish.

### 3.4 Grounded better answer

1. The existing report-generation LLM call receives every eligible question and answer and is asked for one complete, readable English stronger answer per pair.
2. The rewrite may reorder, clarify or make explicit facts already supplied by the candidate answer and allowed grounded evidence.
3. The rewrite must not add new employers, projects, tools, metrics, people, responsibilities, outcomes, qualifications or events.
4. The deterministic assessment, framework, candidate answer and candidate-safe source constraints are locked. LLM output does not mutate them.
5. The rewrite is accepted only when it is mapped to the same canonical question and passes existing rewrite validation. Missing, invalid, unsafe or mismatched output returns `unavailable` with a candidate-readable reason.
6. No LLM request occurs while the candidate opens, expands or refreshes the report page. The report generation call may have a larger output because the request count tracks actual eligible turns; telemetry must record the existing call's output usage without exposing it to candidates.

### 3.5 Candidate UI

In `TurnBreakdownSection`, order the contents as:

1. question heading;
2. framework assessment;
3. **Answer result** badge, score and one-sentence explanation;
4. **What to add next**;
5. candidate answer summary;
6. existing coach feedback;
7. **A stronger answer** or **Rewrite unavailable**.

The label is primary. The score is visually secondary and is accompanied by language that it is a practice signal. The card remains keyboard accessible and uses existing semantic heading/card patterns.

The separate HTML `How To Answer Better` list is removed from the report page to avoid duplicate candidate coaching. Existing TXT/PDF layout remains out of scope and may continue to use its current rewrite section until a separately approved export-parity slice.

## 4. Candidate-safe contracts

No new HTTP endpoint is introduced. The existing candidate report response includes the following additional allowlisted fields inside each `candidateFeedback.turnBreakdowns[]` item:

```yaml
CandidateTurnAssessmentV1:
  status: directly_addressed | partly_addressed | needs_clearer_connection | not_assessed
  score: 0..100 | null
  summary: string
  missingSignals: [specific_context | personal_ownership | validation | outcome | measurable_result]
  nextStep: string
  source: role_fit_alignment | generic_question_alignment | unavailable

CandidateTurnRewriteV1:
  status: ready | unavailable
  answer: string
  unavailableReason: string | null
```

`CandidateTurnAssessmentV1.source` is descriptive only and must never expose internal IDs, traces, private evidence or evaluation prompts. The candidate response must not include `proofPointId`, `questionId`, `turnId`, `expectedSignals`, `testedRoleIntentIds`, `knownEvidenceIds`, `detectedEvidenceUsed`, `rankTrace`, raw CV/JD text, model prompt or model reasoning.

Internal mapping may use canonical question text and existing server-only identifiers; those mechanisms remain server-private.

## 5. Failure, compatibility and rollback

| Condition | Candidate behavior | Internal behavior |
| --- | --- | --- |
| No accepted answers | Existing empty-state behavior; no assessment/rewrite cards. | No synthetic score. |
| No Role-Fit strategy | Render generic question assessment if available. | Do not claim role-intent coverage. |
| Assessment cannot be safely calculated | `Not assessed` with a concise explanation. | Preserve reason in server diagnostics only. |
| Rewrite missing, invalid, unmatched or ungrounded | `Rewrite unavailable`; keep original answer and feedback. | Existing QA/validation marks the rewrite unavailable; no retry from page-open. |
| Legacy stored report | Existing report remains readable; new fields absent and no fabricated fallback rewrite. | Candidate can regenerate; no bulk write. |
| Projection regression/leak | Block candidate release of the unsafe field. | QA/contract test fails. |

Rollback removes only the new candidate turn fields and restores the current report card/read projection. It does not delete reports, transcripts, rewrites or report evidence.

## 6. Architecture and planned file ownership

| File | Planned responsibility | Estimated incremental lines |
| --- | --- | --- |
| `backend/src/services/report/answerAlignmentService.js` | Produce assessment for Role-Fit and generic eligible turns, preserving non-answer exclusion. | 45–65 |
| `backend/src/services/report/reportPublicationSummaryService.js` | Project only the safe assessment/rewrite under each candidate turn. | 35–50 |
| `backend/src/services/agents/reportGenerator/reportCoachingBuilder.js` | Build an unavailable fallback for every actual accepted turn, not only the first three; the existing report-generation prompt consumes this complete fallback. | 10–20 |
| `frontend/src/components/report/TurnBreakdownSection.jsx` | Render the assessment and grounded rewrite in each card. | 65–90 |
| `frontend/src/pages/ReportPage.jsx` | Remove the duplicate global HTML rewrite block. | 3–8 |

The runtime task budget permits at most five production files. Current source inspection identifies `reportGenerator/reportCoachingBuilder.js` as the cardinality owner because it currently truncates deterministic fallback rewrites to the first three turns; the existing report-coaching normalization already preserves the complete LLM rewrite array. Any finding that requires a `reportCoachingService.js` change expands the approved scope and must stop for owner direction.

Expected test ownership:

| File | Planned coverage |
| --- | --- |
| `backend/tests/robustness/report/answerAlignmentService.test.js` | Direct, partial, generic fallback and excluded non-answer cases. |
| `backend/tests/robustness/contracts/reportPublicationSummary.test.js` | Candidate allowlist, per-turn matching and no metadata leak. |
| `frontend/src/components/report/__tests__/TurnBreakdownSection.test.jsx` | Assessment/rewrite UI, unavailable state and framework/result distinction. |

Implementation documentation is limited to one owning Feature RFC (`F-34-report-generation-pipeline.md`) and one scoped `repo-docs/change-log.md` entry. These planning documents do not authorise runtime changes.

## 7. BDD acceptance scenarios

```gherkin
Scenario: Candidate directly answers a prepared Role-Fit question
  Given an accepted answer with a grounded Role-Fit alignment
  When the candidate opens the report
  Then its turn card shows the unchanged framework score
  And it shows Directly addressed with a 0-100 coaching score and concise reason
  And no internal role-fit identifier is in the response or DOM

Scenario: Candidate partly answers a general interview question
  Given an accepted answer without a Role-Fit proof strategy
  And the answer omits an important requested part of the question
  When the report is generated
  Then the turn has a generic question assessment of Partly addressed
  And the assessment does not claim any private role intent or CV evidence was met

Scenario: Every actual accepted answer receives a rewrite request
  Given an interview with N accepted answers
  When report feedback is generated
  Then the rewrite input contains N canonical question-answer pairs
  And no fixed cap truncates the list
  And a missing or invalid rewrite for one pair remains unavailable without corrupting other pairs

Scenario: Stronger answer remains grounded
  Given a candidate answer without a measurable result
  When a stronger answer is produced
  Then it may explain how to state an available result
  But it must not invent a percentage, project, employer or outcome

Scenario: Clarification is not assessed as an answer
  Given a scope clarification followed by an accepted answer
  When the report is projected
  Then there is one assessment and rewrite for the accepted answer
  And none for the clarification turn

Scenario: Legacy report stays honest
  Given a report stored before this feature
  When the candidate opens it
  Then existing feedback remains readable
  And no new answer-result score or fabricated stronger answer is shown
  And regeneration remains the path to the new details
```

## 8. Verification and acceptance criteria

The future runtime task must run, at minimum:

1. focused backend Vitest for the two changed backend test files;
2. focused frontend Vitest for `TurnBreakdownSection`;
3. backend and frontend lint;
4. manual local browser check with a prepared Role-Fit answer, a generic answer, a missing-evidence answer and a legacy report;
5. one independent read-only audit, because this changes scoring interpretation, candidate projection and frontend behavior across layers.

Acceptance requires all of the following:

- every eligible turn has one safe result; every excluded turn has none;
- existing framework score remains distinct and visible;
- the LLM contract covers actual accepted-answer count and never adds a new page-time provider call;
- every ready rewrite is exact-question matched and grounding-valid; invalid output is visibly unavailable;
- candidates never receive internal metadata or private evidence;
- legacy reports are unchanged unless explicitly regenerated;
- focused tests and lint pass, and the independent auditor returns a final evidence matrix.

Real-provider evaluation, human tone review, cross-browser verification, PDF/TXT parity and production rollout remain unverified and require distinct approval.

## 9. Delivery constraints, approvals and stop conditions

Runtime work requires a new explicit user request. If authorised, it has a 26k token cap, 35-minute target, 45-minute hard stop, fewer than 290 changed lines and three implementation cycles. More than five production files, three tests, two implementation docs, a new dependency/provider call, persistence migration, export redesign, failed independent audit or any candidate-data leak stops the task for owner direction.

Human approval status:

- Owner approved the Goal/Spec content on 2026-07-30, including rewrite count equal to actual accepted interview-answer count.
- This is not runtime approval.
- Production rollout is not approved.

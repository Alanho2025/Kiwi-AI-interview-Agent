# Voice Transcript Review and Confirmation Spec

狀態：first implementation slice completed locally；interactive review actions pending
日期：2026-07-13 Pacific/Auckland
Goal：[Voice Transcript Review and Confirmation Goal](voice-transcript-review-confirmation-goal.md)
主要 guardrails：[Stakeholder Feature Conflict Guardrails](../stakeholder-feature-conflict-guardrails.md)、[Voice Product Behavior](../../VOICE_INTERVIEW_PRODUCT_BEHAVIOR.md)

## Overview

### Goal

在 voice interview 中建立一個 transcript uncertainty decision layer。它接在 backend transcript calibration metadata 之後，決定每個 uncertainty 應該：

- auto-accept：低風險，自動接受 correction。
- defer-review：中風險，不打斷面試，稍後 review。
- confirm-now：高風險，必須立即做 understanding confirmation。

這個 layer 的目的不是讓 transcript 看起來更漂亮，而是保護面試評分所依賴的 evidence truth。

### Risk Class

高。這個 feature 會影響：

- live interview interruption
- answer scoring
- next-question selection
- report evidence
- user trust
- transcript provenance

### Existing Constraints

```yaml
voice_product_contract:
  contentful_low_confidence: "must enter confirmation before scoring"
  repair_confirmation_clarification: "must not count as interview questions"
  latency_target: "user speech end -> next question first audio <= 3 seconds"
  low_confidence_means: "system understanding quality, not answer quality"
```

## Guardrail Gate

| Guardrail | Required result |
| --- | --- |
| Minimal interruption | Only high-risk uncertainty interrupts live interview |
| No silent scoring change | Scoring-impacting uncertainty cannot be auto-corrected silently |
| Raw evidence preserved | Raw transcript remains immutable evidence |
| Correction boundary | Correction fixes STT misunderstanding, not answer quality |
| Clarification boundary | New user content after review is not backdated into live transcript |
| Turn counting | Confirmation/review/clarification turns do not count as interview questions |
| Provenance | Every decision stores reason, risk, source, confidence, and action |
| Privacy | Review UI does not expose raw CV/JD text beyond existing user-facing review paths |

## Requirements

### Functional Requirements

1. The system must classify each transcript uncertainty as `auto_accept`, `deferred_review`, `immediate_confirmation`, or `reject_unusable`.
2. The classifier must evaluate semantic change, scoring impact, and interruption need; STT confidence alone is not sufficient.
3. Low-risk term-level corrections may be auto-accepted only when they do not change predicate, metric, negation, ownership, result, or technical choice.
4. CV/JD context alone must never be enough to auto-insert a term into the spoken transcript.
5. Medium-risk uncertainty must be queued for later review without interrupting the active answer.
6. High-risk uncertainty must block scoring and next-question selection until the user confirms, clarifies, or repeats.
7. User review actions must preserve the raw transcript and write explicit provenance.
8. User-added content during review must be stored as clarification, not as a replacement for the live spoken answer.
9. Confirmation, review, clarification, repair, and repeat turns must not count as interview questions.
10. Reports must distinguish raw spoken evidence, calibrated spoken evidence, user-confirmed correction, post-turn clarification, and CV/JD context.

### Non-Functional Requirements

1. The classifier must be deterministic-first and mock-safe.
2. The live answer path must not add unbounded LLM calls, embedding calls, or full CV/JD scans after `speech_end_received`.
3. Review UI must not create a proofreading workflow during active answering.
4. Review artifacts must be bounded snippets, not full raw CV/JD dumps.
5. The feature must degrade safely when calibration metadata, N-best alternatives, or glossary evidence is missing.
6. Thresholds must be test-covered before being made configurable.
7. The implementation must be rollback-safe: disabling review classification should preserve the current backend calibration and low-confidence confirmation behavior.

## Decision Model

### Decision Types

```yaml
TranscriptReviewDecision:
  decisionType:
    enum:
      - auto_accept
      - deferred_review
      - immediate_confirmation
      - reject_unusable
  riskLevel:
    enum: [low, medium, high, unusable]
  rawTranscript: string
  calibratedTranscript: string_optional
  affectedSpan:
    raw: string
    proposed: string_optional
    startChar: number_optional
    endChar: number_optional
  reasonCodes:
    - enum:
        - spelling_or_format
        - glossary_term_surface
        - provider_nbest_close_candidate
        - low_confidence_contentful
        - scoring_impacting_term
        - numeric_or_metric_change
        - negation_change
        - ownership_change
        - result_or_outcome_change
        - technical_choice_change
        - expected_signal_hit
        - jd_must_have_hit
        - match_gap_hit
        - cumulative_correction_risk
        - no_provider_evidence
        - unusable_transcript
  evidenceImpact:
    enum:
      - none
      - evidence_confidence_only
      - scoring_material
      - report_material
  sourceEvidence:
    providerNBest: boolean
    staticNormalization: boolean
    contextualGlossary: boolean
    currentQuestionExpectedSignal: boolean
    jdMustHave: boolean
    matchGap: boolean
    cvJdContextOnly: boolean
  userAction:
    enum:
      - none_required
      - review_later
      - confirm_understanding
      - repeat_or_clarify
  scoringPolicy:
    enum:
      - safe_to_score
      - score_with_reduced_evidence_confidence
      - block_scoring_until_confirmed
      - do_not_score
```

### Review Item

```yaml
TranscriptReviewItem:
  id: string
  sessionId: string
  questionId: string
  turnId: string
  createdAt: iso_datetime
  status:
    enum:
      - pending
      - accepted_correction
      - kept_raw
      - clarified_after_turn
      - dismissed_non_material
  display:
    questionText: string
    rawSnippet: string
    proposedSnippet: string_optional
    reasonLabel: string
    riskLabel: string
  allowedActions:
    - accept_correction
    - keep_raw
    - clarify_what_i_said
  evidenceBoundary:
    rawTranscriptImmutable: true
    correctionCanAffectScoring: boolean
    clarificationCanAffectCoaching: boolean
    clarificationCanReplaceRawTranscript: false
```

## Classification Rules

### Auto-Accept

Auto-accept is allowed only when all required conditions are true.

Required conditions:

1. Change is term-level, spelling-level, case-level, or formatting-level.
2. Sentence predicate does not change.
3. No number, percentage, money, date, duration, ranking, or metric changes.
4. No negation or modality changes.
5. No ownership or responsibility changes.
6. No result/outcome claim changes.
7. No technical choice or comparison direction changes.
8. There is supporting evidence from static normalization, provider N-best, or contextual glossary plus bounded similarity.
9. The correction does not add a capability that only appears in CV/JD.
10. Per-answer cumulative threshold is not exceeded.

Initial threshold:

```yaml
auto_accept_threshold:
  maxCorrectionsPerAnswerTurn: 3
  maxChangedTokenRatio: 0.15
  exceededBehavior: deferred_review
```

Examples:

| User likely said | STT | Proposed | Decision | Reason |
| --- | --- | --- | --- | --- |
| React and TypeScript | `red act and type scripts` | `React and TypeScript` | auto_accept | Tool names, term surface only |
| Redis caching | `radius catching` | `Redis caching` | auto_accept if provider/glossary evidence exists | Technical term surface; predicate unchanged |
| deployment checklist | `deployment check list` | `deployment checklist` | auto_accept | Formatting only |

### Deferred Review

Deferred review is used when the uncertainty may affect evidence confidence but does not need to interrupt the live answer.

Triggers:

1. Term may be important but lacks enough provider evidence for auto-accept.
2. The term is supporting evidence, not the current question's core expected signal.
3. Meaning is understandable enough for next-question planning.
4. The correction count threshold is exceeded.
5. The uncertainty could affect report wording, but not immediate fairness.

Behavior:

- Do not interrupt active answering.
- Do not show live proofreading badge during answer.
- Queue item for section break, interview end, or report before-finalize.
- Scoring may proceed only with reduced evidence confidence.
- Report must show transcript risk if unresolved.

Examples:

| User likely said | STT | Proposed | Decision | Reason |
| --- | --- | --- | --- | --- |
| SRE team | `history team` | `SRE team` | deferred_review | Could matter, but not always core evidence |
| RACI matrix | `racy matrix` | `RACI matrix` | deferred_review if no provider evidence | PM term, but auto evidence incomplete |
| ETL pipelines | `eating pipelines` | `ETL pipelines` | deferred_review or immediate_confirmation | Deferred if background; confirm if question tests data engineering |

### Immediate Confirmation

Immediate confirmation is required when uncertainty would make scoring unfair if left unresolved.

Triggers:

1. Contentful low-confidence transcript under existing voice product contract.
2. Number, metric, percentage, money, date, duration, ranking, or result changed.
3. Negation changes meaning.
4. Ownership/responsibility changes.
5. Result/outcome claim changes.
6. Technical choice, tradeoff, or comparison direction changes.
7. The affected term is the current question's `expectedSignal`.
8. The affected term maps to JD must-have, match gap, or Answer Alignment evidence.
9. CV/JD context would make the correction look like candidate covered a role requirement that they may not have actually said.

Behavior:

- Do not score yet.
- Do not ask the next interview question yet.
- Keep the user on the same interview question.
- Ask one short understanding confirmation.
- Confirmation turn does not count as an interview question.
- If confirmed, process the answer with `user_confirmed_correction` provenance.
- If rejected, ask for clarification or repeat; do not score the rejected transcript.

Examples:

| User likely said | STT | Why high risk | Confirmation prompt shape |
| --- | --- | --- | --- |
| reduced response time from 48 hours to 14 hours | `48 hours to 40 hours` | Metric changes result | `I heard the response time changed from 48 hours to 14 hours. Did I understand that correctly?` |
| I did not own the migration | `I owned the migration` | Negation and ownership reversed | `I heard that you did not own the migration, but coordinated QA. Is that right?` |
| PostgreSQL over MongoDB | `MongoDB over PostgreSQL` | Technical choice reversed | `I heard that you chose PostgreSQL over MongoDB because of relational constraints. Did I understand that correctly?` |
| conflict with a coworker | `contract with a coworker` | Current behavioral question target changed | `I heard you were describing a conflict with a coworker. Is that what you meant?` |

### Reject Unusable

Reject unusable is not a review state. It is the existing repair path for empty, too short, filler-only, or no-final-STT answers.

Behavior:

- Do not save as interview answer.
- Do not score.
- Do not count question.
- Ask repeat or fuller answer.

## UI Contract

### Live Interview UI

Live UI must optimize for interview practice, not transcript editing.

Allowed:

- Voice confirmation prompt for high-risk uncertainty.
- Minimal state transition such as listening, processing, confirming.

Not allowed:

- Persistent transcript proofreading panel during answering.
- Badge that constantly tells the candidate there are medium-risk review items while they are still answering.
- Modal asking the user to review a full transcript after every answer.

### Review Queue Timing

Review queue can appear at:

1. Section break.
2. Interview end.
3. Report before-finalize.

Default first implementation recommendation:

```yaml
review_queue_timing:
  during_answer: false
  after_every_answer: false
  section_break: optional
  interview_end: true
  pre_report_finalize: true
```

### Review Drawer Content

Each item should show only the minimum context required to decide whether the system heard the candidate correctly.

Required display:

- Interview question.
- Raw transcript snippet.
- Proposed calibrated snippet, if any.
- Reason label, such as `technical term unclear`, `number may be wrong`, `ownership unclear`.
- Risk label.
- Actions: `Accept correction`, `Keep raw`, `Clarify what I said`.

Required copy:

```text
Only correct words the system misheard. Do not add new answer content here.
```

目前實作狀態：report UI 已顯示 transcript risk、raw/proposed snippet、reason/risk label 和 boundary copy；尚未提供可持久化的 interactive review drawer actions。

### Review Actions

| Action | Result | Evidence boundary |
| --- | --- | --- |
| Accept correction | Mark item as `accepted_correction` | Can become `user_confirmed_correction`; raw remains preserved |
| Keep raw | Mark item as `kept_raw` | Scoring/report use raw or reduced confidence |
| Clarify what I said | Create clarification artifact | Cannot replace raw transcript; may be used for coaching/report notes with provenance |

## Scoring and Report Contract

### Evidence Types

```yaml
evidence_types:
  raw_spoken_evidence:
    definition: "What STT captured before correction"
    scoring: "allowed if accepted by confidence gate"
  calibrated_spoken_evidence:
    definition: "Term-level corrected transcript with provenance"
    scoring: "allowed only if auto-accept or user-confirmed"
  user_confirmed_correction:
    definition: "Candidate confirmed the system understanding"
    scoring: "allowed with correction metadata visible"
  post_turn_clarification:
    definition: "Candidate added or clarified after the original answer"
    scoring: "cannot be treated as originally spoken answer"
  cv_jd_context:
    definition: "Vocabulary or role context from CV/JD"
    scoring: "cannot be treated as candidate spoken evidence"
```

### Scoring Policy

| Decision | Scoring behavior |
| --- | --- |
| auto_accept | Can score calibrated transcript; raw/provenance preserved |
| deferred_review | Can proceed with reduced evidence confidence; unresolved risk shown before final report |
| immediate_confirmation | Block scoring until confirmed or clarified |
| reject_unusable | Do not score |

## BDD Scenarios

### Scenario 1: Low-risk technical term is auto accepted

Given the current question is about frontend work
And the raw transcript says `red act and type scripts`
And provider alternatives or contextual glossary support `React` and `TypeScript`
When the review policy evaluates the correction
Then the decision is `auto_accept`
And the answer is not interrupted
And raw transcript is preserved.

### Scenario 2: CV/JD term alone cannot force auto correction

Given the JD mentions `Kubernetes`
And the raw transcript does not contain a close phonetic or provider alternative for `Kubernetes`
When the system considers adding `Kubernetes`
Then the decision is not `auto_accept`
And the correction is rejected or deferred
And `usedCvJdAsSpokenEvidence` remains false.

### Scenario 3: Numeric result requires confirmation

Given the candidate answer includes a measurable result
And raw transcript and candidate correction disagree between `14 hours` and `40 hours`
When the review policy evaluates the change
Then the decision is `immediate_confirmation`
And scoring is blocked until the user confirms.

### Scenario 4: Negation reversal requires confirmation

Given the raw transcript says `I owned the migration`
And another candidate interpretation is `I did not own the migration`
When the review policy detects a negation or ownership reversal
Then the decision is `immediate_confirmation`
And the confirmation turn does not count as an interview question.

### Scenario 5: Medium-risk supporting term is deferred

Given the candidate says they escalated to the `SRE team`
And STT captured `history team`
And the current question is about stakeholder communication rather than incident response depth
When the review policy evaluates the uncertainty
Then the decision is `deferred_review`
And the live interview continues.

### Scenario 6: Too many auto corrections become deferred review

Given an answer turn has four proposed auto corrections
Or more than 15 percent changed tokens
When the review policy evaluates cumulative risk
Then the decision is upgraded to `deferred_review`
And the answer-level transcript reliability is reduced.

### Scenario 7: User adds new content during review

Given the review item asks about a misheard technical term
When the user types a new metric or new achievement not present in the raw transcript
Then the system stores it as `post_turn_clarification`
And it does not replace raw transcript
And report provenance shows it was added after the original answer.

### Scenario 8: High-risk technical choice blocks next question

Given the current question asks about database tradeoffs
And the transcript may have reversed `PostgreSQL over MongoDB`
When the review policy detects a technical choice reversal
Then the system asks an immediate confirmation
And does not select the next interview question until confirmation is resolved.

## Implementation Slices

Implementation should stay split into small SDD slices.

| Slice | Scope | Verification |
| --- | --- | --- |
| VTRC-1 | Pure classification service over transcript calibration metadata | Completed: unit fixtures for auto/deferred/confirm/reject |
| VTRC-2 | Backend turn integration and scoring policy flags | Completed: voice robustness tests for confirmation/counting/scoring block |
| VTRC-3 | Review queue data contract | Partially completed: turn metadata review items; no standalone persistence/API |
| VTRC-4 | Frontend review drawer | Partially completed: report risk surface only; no interactive drawer/actions |
| VTRC-5 | Report evidence boundary | Completed for first slice: report dataset blocks unconfirmed high-risk and surfaces deferred risk |
| VTRC-6 | E2E voice regression | Partially completed: mock-safe voice flow tests; no live provider/browser E2E for this slice |
| VTRC-7 | Targeted policy eval | Completed: deterministic eval plus real DeepSeek judge runner |

## Verification Gates

Before release claim:

1. Classification fixtures cover at least:
   - technical term auto-accept
   - CV/JD-only unsafe correction
   - number conflict
   - negation conflict
   - ownership conflict
   - technical choice reversal
   - cumulative correction escalation
   - post-turn clarification boundary
2. Existing low-confidence voice confirmation tests remain green.
3. Confirmation / review / clarification turns do not count as interview questions.
4. Report dataset distinguishes accepted spoken evidence from clarification.
5. Frontend review UI does not appear during active answering except high-risk voice confirmation.
6. Latency traces show no new unbounded work in `speech_end -> next audio` hot path.

## Implementation Verification 2026-07-13

Commands run:

```bash
NODE_ENV=test AI_TEST_MODE=mock npx vitest tests/robustness/voice/transcriptReviewPolicyService.test.js tests/robustness/voice/realtimeVoiceTurnMocked.test.js tests/robustness/voice/duplexTurnCoordinator.transcriptConfirmation.test.js tests/robustness/report/transcriptReviewRiskRobustness.test.js --run
npm run test:voice
npm run test:report
npm run test:components
npm run lint
npm run eval:voice-transcript-review-policy
```

Result:

- focused backend tests：18/18 passed。
- backend voice suite：22 files / 81 tests passed。
- backend report suite：17 files / 86 tests passed。
- frontend component suite：13 files / 34 tests passed。
- backend/frontend lint：passed。
- real LLM eval：6 cases，average score 0.97，deterministic pass rate 1.0，LLM accept rate 1.0。

Current product gap for stakeholder decision:

1. Report UI is review-aware but not action-complete; accepting/keeping/clarifying still needs persistence/API and re-score behavior.
2. Existing confirmation reply merge still feeds planner text for confirmed clarification; metadata preserves evidence boundaries, but a stricter no-merge planner contract is not implemented.
3. Live provider latency and real microphone behavior remain unverified for this slice.
4. First thresholds are deterministic constants, not human-calibrated product settings.

## Open Decisions

1. Whether first frontend slice should show review queue only at interview end, or also at section break.
2. Whether medium-risk unresolved items should block final report generation or allow report with visible risk warning.
3. Whether review queue should persist independently or live inside session turn metadata first.
4. Whether user typed clarification should be allowed during voice practice, or only before report finalization.
5. Whether thresholds should be globally configurable or fixed behind tests for the first release.

證據狀態：本文件已同步 first implementation slice；classification service、backend turn policy、report boundary、report risk UI 和 targeted eval 已完成；interactive review queue persistence / live provider gate 尚未完成。

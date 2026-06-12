# Report + QA Full Implementation Plan

# 1. Purpose

The goal of the Report + QA module is not only to generate an interview feedback report. The goal is to produce a transparent, evidence-grounded, QA-checked coaching artifact that users can trust.

The report should show what the candidate did well, where the evidence is weak, how the scores were calculated, and which claims are supported by the CV, job description, interview transcript, NZ workplace guide, or voice delivery signals. The QA layer should then verify the report before it is shown as reliable.

This implementation should move the current system from:

```
Generate report -> run QA -> mark ready or needs_review
```

to:

```
Generate report -> run QA -> identify failed checks -> repair report safely -> rerun QA -> persist report versions -> expose trust status in UI
```

This is a full product-quality reliability layer, not a minimum safe patch.

---

## 2. Current Implementation Baseline

The current code already contains a strong foundation.

### Existing backend flow

The current report flow is:

```
runTask(generate_report)
-> indexSessionArtifacts(session.id)
-> retrieval from cv_profile, jd_rubric, interview_plan, prepared_question_pool, transcript
-> buildEvidenceBundle()
-> buildDecisionContext(taskType = generate_report)
-> selectNextAction()
-> executeReportAction()
-> reportGenerator()
-> reportQa()
-> persistReportArtifact()
```

The report generator already builds:

- candidate feedback
- turn breakdowns
- STAR and non-STAR feedback
- deterministic fallback feedback
- NZ workplace fit
- company motivation fit
- voice delivery summary
- claim grounding
- evidence diagnostics
- report scores
- evidence references

The QA agent already checks:

- missing summary
- missing sections
- missing interaction feedback
- missing candidate feedback
- missing metric translation
- missing rewrite examples
- missing STAR breakdowns
- self-introduction wrongly scored with STAR
- missing trust fields
- unsupported high-confidence feedback
- evidence presence
- report metrics
- candidate feedback presence
- QA pass or fail status

The code also already includes a report rewrite service that can rewrite a report based on a prompt while preserving evidence labels, confidence levels, feedback statuses, evidence sources, STAR breakdowns, and needs-user-confirmation flags.

### Main limitation

The current implementation validates the report, but it does not fully close the loop.

If QA fails, the report is marked as `needs_review`, but the system does not yet automatically create a repair instruction, rewrite the report, rerun QA, and store a versioned repair history.

That is the main engineering gap.

---

## 3. Target Architecture

The new Report + QA architecture should include six layers.

```
Layer 1: Report generation
Layer 2: Claim grounding and scoring explanation
Layer 3: QA validation
Layer 4: QA-driven repair loop
Layer 5: User-visible trust display
Layer 6: Evaluation and cohort analytics extension
```

The target flow should be:

```
Interview completed
-> Generate initial report
-> Ground report claims
-> Add scoring explanation
-> Run QA
-> If QA passes:
      persist as ready
      show report with trust labels
   Else:
      build repair plan from QA flags
      rewrite report safely
      rerun QA
      persist repaired version
      if repaired QA passes:
          mark ready_after_repair
      else:
          mark needs_review
          show warning and failed QA flags
```

---

## 4. Gap 1: QA Repair Loop

### Problem

The current QA layer can detect problems, but it does not automatically repair the report.

Current state:

```
reportGenerator()
-> reportQa()
-> persistReportArtifact()
-> latestStatus = ready or needs_review
```

Target state:

```
reportGenerator()
-> reportQa()
-> if failed:
      build repair prompt from QA flags
      rewrite report with evidence safety rules
      rerun reportQa()
      repeat up to maxAttempts
-> persist final report, QA result, and repair history
```

### Files to modify

```
backend/src/services/masterAiService.js
backend/src/services/aiControl/reportActionExecutor.js
backend/src/services/report/reportRewriteService.js
backend/src/services/agents/reportQaAgent.js
backend/src/db/models/sessionReportModel.js
backend/src/db/models/sessionAnalysisModel.js
```

### New file to add

```
backend/src/services/report/reportQaRepairOrchestratorService.js
```

### New service responsibilities

Create `reportQaRepairOrchestratorService.js`.

It should export:

```jsx
export const runReportQaRepairLoop = async ({
  report,
  qaResult,
  session,
  retrievalBundle,
  maxAttempts = 2,
} = {}) => {
  // 1. If QA passed, return original report.
  // 2. Convert QA flags into repair instructions.
  // 3. Call rewriteReportWithQaPrompt().
  // 4. Rerun reportQa().
  // 5. Repeat until pass or maxAttempts reached.
  // 6. Return final report, final QA result, and repair history.
};
```

### Repair instruction builder

Add helper:

```jsx
const buildRepairInstructionFromQa = (qaResult = {}) => {
  const flags = qaResult.qualityFlags || [];
  const failedChecks = (qaResult.consistencyChecks || []).filter((item) => !item.passed);

  const instructions = [];

  if (flags.includes('missing_feedback_trust_fields')) {
    instructions.push('Add or preserve evidenceLabel, confidenceLevel, feedbackStatus, evidenceSources, and needsUserConfirmation fields for every feedback item.');
  }

  if (flags.includes('missing_star_breakdown')) {
    instructions.push('Add STAR breakdowns only for STAR-applicable behavioural answers. Do not apply STAR to self-introduction or company motivation answers.');
  }

  if (flags.includes('self_intro_star_misapplied')) {
    instructions.push('Rewrite self-introduction feedback using an introduction-specific rubric instead of STAR scoring.');
  }

  if (flags.includes('unsupported_high_confidence_feedback')) {
    instructions.push('Downgrade unsupported high-confidence feedback to needs confirmation or medium/low confidence. Do not present weak evidence as confirmed.');
  }

  if (flags.includes('missing_actionable_coaching')) {
    instructions.push('Add specific next-step coaching advice grounded in the CV, JD, transcript, or NZ guide evidence.');
  }

  if (flags.includes('missing_metric_translation')) {
    instructions.push('Explain numeric scores in plain English so the user understands why the score was given.');
  }

  if (flags.includes('missing_rewrite_examples')) {
    instructions.push('Add answer rewrite examples without inventing new achievements, skills, or interview content.');
  }

  if (failedChecks.length) {
    instructions.push(`Fix failed consistency checks: ${failedChecks.map((item) => item.rule).join(', ')}.`);
  }

  return instructions.join('\n');
};
```

### Update `reportActionExecutor.js`

Change `executeReportAction()` from:

```
generate report
run QA
return report + qaResult
```

to:

```
generate report
run initial QA
run QA repair loop if QA fails
return final report + final qaResult + repairHistory
```

Pseudo-flow:

```jsx
const report = await agentRegistry.reportGenerator(...);
const initialQaResult = await agentRegistry.reportQa(...);

const repairResult = await runReportQaRepairLoop({
  report,
  qaResult: initialQaResult,
  session,
  retrievalBundle,
  maxAttempts: 2,
});

return {
  report: repairResult.report,
  qaResult: repairResult.qaResult,
  repairHistory: repairResult.repairHistory,
  tools: [
    AGENT_TOOL_NAMES.DRAFT_INTERVIEW_REPORT,
    AGENT_TOOL_NAMES.REVIEW_REPORT_QUALITY,
  ],
  isComplete: true,
  completedBecause: repairResult.qaResult?.passed
    ? 'report_generated_and_qa_passed'
    : 'report_generated_needs_review',
};
```

### Update persistence

Update `persistReportArtifact()` so it stores:

```jsx
{
  report,
  qaResult,
  latestStatus,
  repairHistory,
  qaAttemptCount,
  reportVersion,
  generatedAt,
  revisedAt,
}
```

Recommended status values:

```
ready
ready_after_repair
needs_review
repair_failed
```

### Definition of done

This gap is complete when:

- QA failure triggers a repair attempt automatically.
- Repair attempts preserve evidence labels and safety fields.
- QA reruns after each repair.
- Report versions are stored.
- Final status clearly shows whether the report passed initially, passed after repair, or still needs review.
- Tests prove unsupported high-confidence feedback is downgraded, not hidden.

---

## 5. Gap 2: Scoring Transparency

### Problem

The backend already calculates interview performance and blended overall score, but the user and marker cannot easily see how the scores were produced.

Peer review repeatedly questioned:

- How is STAR score calculated?
- How is CV-JD match calculated?
- How is interview performance calculated?
- Why did the score improve?
- Is the score calibrated or arbitrary?

### Files to modify

```
backend/src/services/agents/reportGenerator/reportDraftBuilder.js
backend/src/services/agents/reportGenerator/reportFeedbackBuilder.js
backend/src/services/report/turnRubricService.js
frontend/src/pages/ReportPage.jsx
frontend/src/components/report/
```

### New backend file

```
backend/src/services/report/reportScoringExplanationService.js
```

### New scoring explanation object

Add a `scoreExplanations` field to the final report.

Example shape:

```jsx
scoreExplanations: {
  overall: {
    score: 78.5,
    formula: '50% CV-JD match + 50% interview performance',
    inputs: {
      cvJdMatch: 82,
      interviewPerformance: 75,
    },
    explanation: 'The candidate shows good CV-JD alignment, but interview evidence was weaker because several answers lacked measurable results.',
  },
  cvJdMatch: {
    score: 82,
    formula: 'Match score from macro fit, micro evidence, requirement coverage, and risk signals.',
    components: {
      macro: 80,
      micro: 84,
      requirements: 82,
    },
    explanation: 'The CV matches the role in several technical areas, but some JD requirements still need stronger evidence.',
  },
  interviewPerformance: {
    score: 75,
    formula: '40% evidence strength + 30% direct experience ratio + 30% turn breakdown score',
    components: {
      evidenceStrengthScore: 72,
      directExperienceRatioScore: 80,
      turnBreakdownScore: 74,
    },
    explanation: 'The candidate gave some direct project examples, but some answers were hypothetical or lacked specific results.',
  },
  starStructure: {
    explanation: 'STAR is applied only to behavioural answers. Self-introduction and company motivation answers use separate rubrics.',
    turnLevelBreakdowns: []
  }
}
```

### Backend implementation

In `reportDraftBuilder.js`, do not only return raw scores. Also return:

```jsx
scoreExplanations
scoreFormulaVersion
scoreConfidence
scoreLimitations
```

Add `scoreLimitations`, for example:

```jsx
scoreLimitations: [
  'Scores are based on available CV, JD, transcript, and session evidence.',
  'Scores should be treated as coaching signals, not final hiring decisions.',
  'Low transcript confidence or incomplete answers may reduce scoring confidence.',
]
```

### Frontend implementation

Create components:

```
frontend/src/components/report/ScoreBreakdownCard.jsx
frontend/src/components/report/ScoreFormulaPanel.jsx
frontend/src/components/report/TurnScoreBreakdown.jsx
```

UI should show:

```
Overall Readiness Score
= 50% CV-JD Match + 50% Interview Performance

Interview Performance
= Evidence Strength + Direct Experience + Turn Quality

STAR score applies only to behavioural answers.
Self-introduction and company motivation use different rubrics.
```

### Definition of done

This gap is complete when:

- Every visible score has a formula explanation.
- Every score has inputs and component values.
- STAR is not shown as universal.
- Users can understand why a score changed.
- Report JSON includes versioned scoring metadata.

---

## 6. Gap 3: User-Visible Evidence Labels

### Problem

The backend already adds evidence labels and confidence fields, but they need to become visible in the report UI.

Current trust fields include:

```
evidenceLabel
confidenceLevel
feedbackStatus
evidenceSources
evidenceReason
needsUserConfirmation
```

Target behavior:

Every feedback item should show a visible trust badge.

### Files to modify

```
backend/src/services/report/claimGroundingService.js
backend/src/services/agents/reportGenerator/reportDraftBuilder.js
frontend/src/pages/ReportPage.jsx
frontend/src/components/report/
```

### Frontend components to add

```
frontend/src/components/report/EvidenceBadge.jsx
frontend/src/components/report/FeedbackTrustCard.jsx
frontend/src/components/report/EvidenceReasonTooltip.jsx
frontend/src/components/report/NeedsConfirmationWarning.jsx
```

### Evidence badge mapping

```jsx
const EVIDENCE_LABELS = {
  supported_by_answer: 'Supported by interview answer',
  supported_by_cv: 'Supported by CV',
  supported_by_jd: 'Supported by job description',
  supported_by_nz_guide: 'Supported by NZ workplace guide',
  needs_user_confirmation: 'Needs user confirmation',
};
```

### Confidence label mapping

```jsx
const CONFIDENCE_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};
```

### Feedback status mapping

```jsx
const FEEDBACK_STATUS_LABELS = {
  confirmed_feedback: 'Confirmed feedback',
  downgraded_feedback: 'Limited evidence',
  needs_confirmation: 'Needs confirmation',
  refused_claim: 'Not enough evidence',
};
```

### UI behavior

For each strength, improvement, coaching advice, and turn breakdown:

```
[Supported by interview answer] [Medium confidence]
Evidence reason: Grounding overlap: CV 0.12, JD 0.28, transcript 0.33, NZ guide 0.00.
```

If `needsUserConfirmation = true`, show:

```
This feedback needs your confirmation because the system could not strongly verify it from the CV, JD, transcript, or NZ guide.
```

### Backend improvement

Enhance `claimGroundingService.js` to include clearer source snippets.

Add:

```jsx
evidenceSnippets: [
  {
    sourceType: 'transcript',
    text: '...',
    similarity: 0.33,
  }
]
```

This should use only short snippets and should avoid exposing sensitive raw CV text unless the user owns the session.

### Definition of done

This gap is complete when:

- Every feedback item has a visible evidence badge.
- Unsupported claims are clearly downgraded.
- The user can see why feedback is strong, weak, or uncertain.
- QA fails if trust fields are missing.

---

## 7. Gap 4: Human Calibration and Evaluation

### Problem

Internal QA is strong, but peer review asked whether the system agrees with human career advisers or recruiters.

The current system does not yet provide adviser calibration or inter-rater agreement.

### New feature

Add a lightweight human calibration harness.

### New backend files

```
backend/src/services/evaluation/reportCalibrationService.js
backend/src/db/models/reportCalibrationModel.js
backend/src/routes/reportCalibrationRoutes.js
backend/src/controllers/reportCalibrationController.js
```

### New frontend page

```
frontend/src/pages/AdminReportCalibrationPage.jsx
frontend/src/components/reportCalibration/
```

### Calibration data model

```jsx
{
  sessionId,
  reportId,
  sampleType: 'turn_feedback' | 'full_report' | 'score',
  systemScores: {
    overall,
    cvJdMatch,
    interviewPerformance,
    starCompleteness,
    evidenceStrength,
  },
  humanScores: {
    overall,
    starCompleteness,
    evidenceStrength,
    communicationClarity,
    nzWorkplaceFit,
  },
  humanReviewerRole: 'career_adviser' | 'recruiter' | 'lecturer' | 'peer',
  agreementMetrics: {
    absoluteDifference,
    withinOnePoint,
    correlationBucket,
  },
  comments,
  createdAt,
}
```

### API endpoints

```
POST /api/report-calibration/:sessionId/rating
GET /api/report-calibration/summary
GET /api/report-calibration/:sessionId
```

### Calibration metrics

Start simple:

```
Average absolute score difference
Percentage of ratings within 1 point
Percentage of ratings within 2 points
Most common disagreement areas
```

Optional later:

```
Cohen's kappa
Spearman correlation
Cronbach-style consistency summary
```

### UI behavior

Admin can view:

```
System score: 7.5
Human score: 8
Difference: 0.5
Agreement: within 1 point
```

### Report integration

Add to report:

```jsx
calibrationStatus: {
  calibrated: false,
  message: 'This report is internally QA-checked but has not yet been externally calibrated against human adviser ratings.',
}
```

After enough calibration data:

```jsx
calibrationStatus: {
  calibrated: true,
  sampleSize: 12,
  averageAbsoluteDifference: 0.8,
  withinOnePointRate: 0.75,
}
```

### Definition of done

This gap is complete when:

- Human reviewers can rate reports or turn feedback.
- The system stores agreement data.
- The report can state whether scores are internally checked only or externally calibrated.
- The final project report can honestly say how scoring reliability was tested.

---

## 8. Gap 5: Authenticity and Conversational Fluidity

### Problem

Peer review warned about the robotic STAR trap. If students optimise only for STAR score, they may sound rehearsed and unnatural.

The system should reward structured but natural answers.

### Files to modify

```
backend/src/services/report/turnRubricService.js
backend/src/services/agents/reportGenerator/reportEvidenceAnalysis.js
backend/src/services/agents/reportGenerator/reportDraftBuilder.js
backend/src/services/agents/reportQaAgent.js
frontend/src/components/report/
```

### New backend service

```
backend/src/services/report/conversationalAuthenticityService.js
```

### New scoring dimensions

Add:

```jsx
authenticityMetrics: {
  scriptedRisk: 'low' | 'medium' | 'high',
  conversationalFlowScore: 0-10,
  overStructuredStarRisk: 0-10,
  naturalTransitionScore: 0-10,
  personalVoiceScore: 0-10,
  reason: '',
}
```

### Heuristic signals

High scripted risk if:

```
- Many answers repeat the exact STAR labels.
- Many answers use the same sentence pattern.
- Answers are long but low in specific nouns, project names, or measurable outcomes.
- Answer has structure but weak personal ownership.
- Answer sounds polished but lacks direct evidence.
```

Good authenticity if:

```
- Answer has specific project or work detail.
- Answer connects action to result.
- Answer has natural transition language.
- Answer explains uncertainty or learning honestly.
- Answer keeps candidate voice while improving clarity.
```

### Report section

Add section:

```
Communication authenticity
```

Example content:

```
The candidate used a clear answer structure, but some responses risk sounding over-rehearsed. The next improvement is to keep the STAR structure while adding more natural transitions and personal ownership.
```

### QA checks

Add QA flags:

```
scripted_answer_risk_not_reported
overcoached_feedback_risk
authenticity_metrics_missing
```

### Definition of done

This gap is complete when:

- Report includes authenticity or conversational fluidity feedback.
- STAR is not treated as the only success metric.
- QA checks whether overcoaching risk is addressed.
- The report encourages clear but natural communication.

---

## 9. Gap 6: Voice Delivery Integration

### Problem

The current code already captures voice delivery signals, including filler words, long pauses, average pace, and delivery confidence. However, these are not yet deeply integrated into scoring or coaching logic.

### Files to modify

```
backend/src/services/voice/voiceDeliveryAnalyzerService.js
backend/src/services/agents/reportGenerator/reportDraftBuilder.js
backend/src/services/report/conversationalAuthenticityService.js
frontend/src/components/report/VoiceDeliveryPanel.jsx
```

### Target behavior

Voice delivery should support:

```
pacing feedback
filler word feedback
pause feedback
answer length feedback
clarity feedback
confidence limitation warning
```

### Important safety constraint

Do not claim acoustic emotion detection or prosody model analysis unless actually implemented.

Use safe wording:

```
Based on transcript, VAD, and ASR metadata...
```

Do not write:

```
The acoustic model detected nervousness.
```

### Report scoring integration

Add voice delivery to `scoreExplanations`, but do not make it overly dominant.

Recommended formula:

```
Communication Delivery Score
= 40% pace stability
+ 25% filler word control
+ 20% pause management
+ 15% answer completeness
```

If voice metadata is weak, set:

```jsx
voiceDeliveryConfidence: 'low'
voiceScoreUsedInOverall: false
```

### Definition of done

This gap is complete when:

- Voice delivery appears as a clear report section.
- Voice delivery explains what signals were used.
- The system avoids unsupported acoustic or emotion claims.
- Voice delivery can influence communication coaching without pretending to be a clinical speech analysis tool.

---

## 10. Gap 7: B2B Cohort Analytics

### Problem

Current report is candidate-level. For universities, the higher-value product is cohort-level insight.

Career services do not only want one student’s report. They want to know what patterns are appearing across students.

### New feature

Add aggregate analytics over reports.

### New backend files

```
backend/src/services/analytics/cohortReportAnalyticsService.js
backend/src/routes/cohortAnalyticsRoutes.js
backend/src/controllers/cohortAnalyticsController.js
```

### New frontend page

```
frontend/src/pages/CohortAnalyticsPage.jsx
frontend/src/components/analytics/
```

### Aggregated metrics

Collect:

```
average CV-JD match
average interview performance
common missing JD requirements
common weak STAR elements
common communication issues
average evidence strength
common hypothetical answer rate
common voice delivery issues
NZ workplace fit trend
most common feedback categories
```

### Example output

```
Engineering students in this cohort show strong project evidence, but 62% of completed interviews had weak Result statements. 48% had low evidence for conflict resolution examples. Recommended CDES workshop: turning technical project work into impact-based STAR answers.
```

### Privacy design

Cohort analytics must be aggregated.

Rules:

```
Do not expose individual transcript content.
Do not expose individual CV content.
Use minimum cohort size before showing analytics.
Allow admin-only access.
```

Minimum cohort size:

```
Do not show cohort analytics if fewer than 5 completed reports exist.
```

### Definition of done

This gap is complete when:

- Admin can view aggregate report trends.
- Cohort analytics do not reveal personal CV or transcript data.
- The university value proposition becomes measurable.
- The system can support the B2B curriculum feedback loop pitch.

---

## 11. Data Model Changes

### Update SessionReport model

Add:

```jsx
latestStatus: {
  type: String,
  enum: ['ready', 'ready_after_repair', 'needs_review', 'repair_failed'],
  default: 'needs_review',
},
reportVersions: [
  {
    version: Number,
    report: Object,
    qaResult: Object,
    status: String,
    createdAt: Date,
    repairInstruction: String,
    repairMetadata: Object,
  }
],
repairHistory: [
  {
    attempt: Number,
    qaBefore: Object,
    repairInstruction: String,
    rewriteMetadata: Object,
    qaAfter: Object,
    status: String,
    createdAt: Date,
  }
],
scoreExplanations: Object,
calibrationStatus: Object,
trustSummary: Object,
```

### Update SessionAnalysis model

Add or ensure:

```jsx
reportArtifacts: [
  {
    createdAt: Date,
    report: Object,
    qaResult: Object,
    repairHistory: Array,
    status: String,
  }
],
```

---

## 12. API Changes

### Existing endpoints to keep

```
Generate report
Run manual QA
Fetch report
```

### New endpoints

```
POST /api/report/:sessionId/repair
GET /api/report/:sessionId/versions
GET /api/report/:sessionId/trust-summary
POST /api/report-calibration/:sessionId/rating
GET /api/report-calibration/summary
GET /api/cohort-analytics/summary
```

### Repair endpoint behavior

```
POST /api/report/:sessionId/repair
```

Body:

```jsx
{
  userPrompt: 'Make the feedback clearer and fix QA issues.',
  maxAttempts: 2
}
```

Response:

```jsx
{
  report,
  qaResult,
  status,
  repairHistory,
  version
}
```

---

## 13. Frontend Report UI

### Main report page structure

```
1. Report status banner
2. Overall score card
3. Score formula panel
4. Evidence-grounded feedback sections
5. Turn-by-turn answer breakdown
6. Voice delivery panel
7. NZ workplace fit panel
8. QA result panel
9. Evidence references and confidence labels
10. Version history
```

### Status banner

Show:

```
Ready
Ready after QA repair
Needs review
Repair failed
```

### QA warning example

```
This report needs review because some feedback items lack enough evidence or the interview did not complete the planned question set.
```

### Trust badge example

```
Supported by JD requirement · Medium confidence
```

### Normal user vs debug mode

Normal user sees:

```
simple evidence badges
plain-English score explanations
actionable next steps
```

Admin/debug mode sees:

```
QA flags
consistency checks
evidence overlap scores
repair history
retrieval sources
agent trace summary
```

---

## 14. Testing Plan

### Unit tests

Add tests for:

```
reportQaRepairOrchestratorService
reportScoringExplanationService
claimGroundingService evidence labels
reportQaAgent flags
conversationalAuthenticityService
voice delivery scoring
```

### Integration tests

Add tests for:

```
generate_report creates report and qaResult
failed QA triggers repair loop
repair loop preserves evidence labels
unsupported high-confidence feedback is downgraded
self-introduction is not STAR-scored
score explanations are present
report versions are persisted
```

### Robustness tests

Add tests for:

```
empty transcript
short answers
vague JD
missing CV evidence
low-confidence voice transcript
report with invented claim
report with missing trust fields
report with self-intro STAR misuse
```

### Frontend tests

Add tests for:

```
ScoreBreakdownCard renders formulas
EvidenceBadge maps labels correctly
QAStatusBanner shows needs_review
VoiceDeliveryPanel hides unsupported acoustic claims
ReportVersionHistory displays repaired version
```

---

## 15. Implementation Phases

### Phase 1: Backend reliability loop

Implement:

```
reportQaRepairOrchestratorService
repair instruction builder
report version persistence
status update logic
integration with executeReportAction
```

Goal:

```
QA failure should trigger controlled repair and rerun QA.
```

### Phase 2: Scoring transparency

Implement:

```
reportScoringExplanationService
scoreExplanations in report output
plain-English score limitations
turn-level score explanation
```

Goal:

```
Every score should be explainable.
```

### Phase 3: User-visible trust layer

Implement:

```
EvidenceBadge
FeedbackTrustCard
NeedsConfirmationWarning
evidenceReason display
trust summary
```

Goal:

```
Users can see what each feedback claim is based on.
```

### Phase 4: Authenticity and voice coaching

Implement:

```
conversationalAuthenticityService
authenticityMetrics
communication delivery score
voice delivery report panel
QA flags for overcoaching risk
```

Goal:

```
The system should improve interview structure without making users sound robotic.
```

### Phase 5: Calibration and analytics

Implement:

```
reportCalibrationService
human rating UI
agreement summary
cohort analytics service
admin dashboard
```

Goal:

```
Move from single-user coaching to institution-level value.
```

---

## 16. Final Target Outcome

After this implementation, the Report + QA module should support this product claim:

```
Kiwi Coach does not simply generate an AI interview summary. It produces an evidence-grounded coaching report from the candidate’s CV, job description, interview transcript, prepared question history, NZ workplace fit, and voice delivery metadata. Each recommendation is labelled with evidence support and confidence. A QA layer checks report completeness, consistency, STAR applicability, unsupported claims, and user-facing trust fields. If QA fails, the system attempts a safe repair while preserving evidence labels and score integrity. The final report is stored with version history, QA status, score explanations, and trust diagnostics.
```

This is the level needed to answer peer review concerns around scoring transparency, report reliability, hallucination control, and commercial trust.

---

## 17. Definition of Done

The implementation is complete when:

- Report generation uses evidence from CV, JD, transcript, interview plan, prepared question pool, NZ guide, and voice metadata.
- Every feedback item has evidence label, confidence level, feedback status, and evidence reason.
- Every score has a formula and plain-English explanation.
- STAR scoring is only applied to STAR-applicable answers.
- Self-introduction and company motivation answers use separate rubrics.
- QA failure triggers a repair loop.
- Repaired reports rerun QA before being marked ready.
- All report versions and repair attempts are persisted.
- Users can see report confidence and evidence support in the UI.
- Admins can inspect QA flags, repair history, and evidence diagnostics.
- Human calibration can be collected for future scoring validation.
- Cohort analytics can support the B2B university value proposition.

---

## 18. Additional Requirement: STARR Quality Scoring for Each Applicable Question

### Decision

The report should use a **STARR** structure rather than a basic STAR-only structure for most interview answers.

Use:

```
S = Situation
T = Task
A = Action
R = Result / Reaction
R = Reflection
```

In this project, the second R should be treated as **Reflection**. The first R can be called **Result / Reaction** depending on the question type:

- Use **Result** when the answer should describe an outcome, impact, metric, or final result.
- Use **Reaction** when the question is about communication, conflict, stakeholder response, teamwork, or workplace behaviour.
- Always include **Reflection** as the final learning, improvement, or future-facing insight.

This avoids the current risk where the system only checks whether a candidate gave a basic STAR answer, but does not explain which exact part is missing or weak.

---

## 19. Target Behaviour

For every interview question, the report should classify whether STARR scoring applies.

### STARR-applicable questions

Most behavioural, experience-based, project-based, teamwork, conflict, leadership, problem-solving, ownership, failure, and communication questions should use STARR quality scoring.

For these questions, the report must show:

```
STARR quality score
Situation quality
Task quality
Action quality
Result / Reaction quality
Reflection quality
Main missing element
Specific explanation of what is weak or missing
Rewrite suggestion or next improvement
```

### Non-STARR questions

Some question types should not use STARR. These should use a separate rubric.

Examples:

```
self-introduction
company motivation
role motivation
salary expectation
availability
visa/work rights
simple clarification
technical definition question
technical knowledge check
very short factual question
interview logistics question
```

For these questions, the report should explicitly say:

```
STARR not applicable
Rubric used: self-introduction / motivation / technical / clarification / logistics
Reason: this question does not require a full situation-task-action-result-reflection answer
```

This prevents the report from wrongly forcing every answer into a STAR/STARR template.

---

## 20. Required Report Output Shape

Each turn breakdown should include a `starrBreakdown` object when STARR applies.

Example:

```jsx
{
  question: 'Tell me about a time you handled conflict in a team.',
  answer: '...',
  rubricType: 'starr',
  starrApplicable: true,
  starrQualityScore: 7.2,
  starrBreakdown: {
    situation: {
      score: 2,
      maxScore: 2,
      quality: 'clear',
      reason: 'The candidate gave enough background about the team project and context.'
    },
    task: {
      score: 1,
      maxScore: 2,
      quality: 'partial',
      reason: 'The candidate mentioned the problem but did not clearly state their responsibility.'
    },
    action: {
      score: 2,
      maxScore: 2,
      quality: 'clear',
      reason: 'The candidate explained the steps they personally took.'
    },
    resultOrReaction: {
      score: 1,
      maxScore: 2,
      quality: 'partial',
      labelUsed: 'reaction',
      reason: 'The answer mentioned that the team improved, but did not explain how teammates or stakeholders responded.'
    },
    reflection: {
      score: 0.5,
      maxScore: 2,
      quality: 'weak',
      reason: 'The candidate did not clearly explain what they learned or how they would apply it next time.'
    }
  },
  mainMissingElement: 'reflection',
  missingElementExplanation: 'The answer has context and action, but it lacks a clear reflection on what the candidate learned from the conflict.',
  nextImprovement: 'Add one sentence explaining what you learned and how you would handle a similar conflict in a future NZ workplace.',
  rewriteSuggestion: 'After resolving the issue, I learned to clarify ownership early and check in with teammates before small misunderstandings become larger blockers.'
}
```

For non-STARR questions:

```jsx
{
  question: 'Can you introduce yourself?',
  answer: '...',
  rubricType: 'self_intro',
  starrApplicable: false,
  starrBreakdown: null,
  starrQualityScore: null,
  alternativeRubric: {
    structure: 'background -> role interest -> relevant evidence -> concise close',
    score: 7,
    reason: 'The answer introduces the candidate clearly but needs a stronger link to the target role.'
  },
  nonStarrReason: 'Self-introduction questions should not be scored with STARR because they are not asking for a past behavioural example.'
}
```

---

## 21. Backend Implementation Plan

### Files to modify

```
backend/src/services/report/turnRubricService.js
backend/src/services/agents/reportGenerator/reportGeneratorAgent.js
backend/src/services/agents/reportGenerator/reportDraftBuilder.js
backend/src/services/agents/reportQaAgent.js
backend/src/services/report/reportScoringExplanationService.js
frontend/src/components/report/TurnScoreBreakdown.jsx
frontend/src/components/report/ScoreFormulaPanel.jsx
```

### New backend file

```
backend/src/services/report/starrQualityService.js
```

### New service responsibilities

Create `starrQualityService.js` to centralise STARR scoring logic.

It should export:

```jsx
export const classifyQuestionRubric = ({ question = '', metadata = {} } = {}) => {
  // returns: 'starr', 'self_intro', 'motivation', 'technical', 'clarification', 'logistics'
};

export const isStarrApplicable = ({ question = '', metadata = {} } = {}) => {
  // returns true for behavioural, project, teamwork, conflict, leadership, ownership, problem-solving, and experience questions
};

export const analyzeStarrQuality = ({ question = '', answer = '', metadata = {} } = {}) => {
  // returns starrBreakdown, starrQualityScore, mainMissingElement, missingElementExplanation, nextImprovement
};
```

### STARR scoring rules

Each element should be scored from 0 to 2.

```
0 = missing
0.5 = very weak
1 = partial
1.5 = mostly clear
2 = clear and specific
```

Total score:

```
STARR quality score = situation + task + action + resultOrReaction + reflection
Maximum = 10
```

Quality labels:

```
0 to 0.5 = missing_or_weak
1 = partial
1.5 = mostly_clear
2 = clear
```

Main missing element should be selected by the lowest score. If multiple elements are tied, priority order should be:

```
reflection
resultOrReaction
action
task
situation
```

Reason: reflection and result/reaction are often the parts that make an answer mature and interview-ready.

---

## 22. Result vs Reaction Rule

The report should not blindly use the word Result for every answer.

Use `result` when the question asks about:

```
achievement
project delivery
technical problem-solving
measurable impact
performance improvement
product outcome
```

Use `reaction` when the question asks about:

```
conflict
teamwork
communication
stakeholder management
leadership
feedback
workplace culture
customer/user interaction
```

Implementation helper:

```jsx
const resolveFourthElementLabel = ({ question = '', metadata = {} } = {}) => {
  const text = `${question} ${metadata.topic || ''} ${metadata.questionType || ''}`.toLowerCase();
  if (/conflict|team|stakeholder|communicat|feedback|leadership|customer|user|culture/.test(text)) {
    return 'reaction';
  }
  return 'result';
};
```

The report UI should display either:

```
Result quality
```

or:

```
Reaction quality
```

based on this decision.

---

## 23. Turn Rubric Integration

Update `turnRubricService.js` so that `analyzeTurnStructure()` returns STARR fields.

Target return shape:

```jsx
{
  rubricType: 'starr',
  starrApplicable: true,
  structureLabel: 'STARR evidence',
  starrBreakdown,
  starBreakdown: legacyStarBreakdown,
  structureBreakdown,
  mainMissingElement,
  missingElementExplanation,
  nextImprovement,
}
```

Keep `starBreakdown` only for backward compatibility. New code should use `starrBreakdown`.

### Backward compatibility

Existing report code may still expect:

```
starApplicable
starBreakdown
```

Do not remove them immediately. Instead, map:

```jsx
starApplicable = starrApplicable;
starBreakdown = convertStarrToLegacyStar(starrBreakdown);
```

But the new report UI and scoring explanation should use STARR terminology.

---

## 24. Report Generator Integration

Update `buildDeterministicTurnBreakdowns()` in `reportGeneratorAgent.js`.

Current behaviour should be extended from basic STAR feedback to STARR feedback.

Target logic:

```
For each user answer:
1. Get the matching AI question.
2. Run analyzeTurnStructure().
3. If STARR applies:
   - include starrBreakdown
   - include starrQualityScore
   - include mainMissingElement
   - include missingElementExplanation
   - generate targeted feedback based on the weakest element
4. If STARR does not apply:
   - use alternative rubric
   - explicitly set starrApplicable = false
   - explain why STARR does not apply
```

Target feedback examples:

```
Missing situation:
Add one sentence explaining the background, team, project, or problem context before describing what you did.

Missing task:
Make your responsibility clearer. The interviewer needs to know what you personally owned.

Missing action:
Explain the concrete steps you took, not only what the team did.

Missing result:
Add the outcome, impact, metric, or what changed after your action.

Missing reaction:
Explain how the teammate, stakeholder, user, or manager responded after your action.

Missing reflection:
Add what you learned and how you would apply that lesson in a future role.
```

---

## 25. QA Agent Integration

Update `reportQaAgent.js` so QA checks STARR quality.

New QA flags:

```
missing_starr_breakdown
missing_starr_quality_score
missing_main_missing_element
missing_missing_element_explanation
starr_applied_to_non_starr_question
starr_applicable_question_not_scored
legacy_star_wording_used_without_reflection
reflection_missing_but_not_flagged
result_reaction_label_missing
```

New consistency checks:

```jsx
consistencyChecks.push({
  rule: 'starr_breakdowns_present_for_applicable_turns',
  passed: starrApplicableTurns.every((item) => item.starrBreakdown && typeof item.starrQualityScore === 'number'),
});

consistencyChecks.push({
  rule: 'non_starr_turns_explain_alternative_rubric',
  passed: nonStarrTurns.every((item) => item.alternativeRubric && item.nonStarrReason),
});

consistencyChecks.push({
  rule: 'weakest_starr_element_explained',
  passed: starrApplicableTurns.every((item) => item.mainMissingElement && item.missingElementExplanation),
});
```

QA should fail if a behavioural answer is missing STARR scoring.

QA should also fail if a self-introduction or motivation answer is incorrectly scored using STARR.

---

## 26. Frontend Report UI Integration

### New component

```
frontend/src/components/report/STARRBreakdownCard.jsx
```

### UI layout

For each applicable answer, show:

```
STARR Quality: 7.2 / 10

Situation: clear
Task: partial
Action: clear
Reaction: partial
Reflection: weak

Main missing part: Reflection
Why: The answer explains what happened and what the candidate did, but does not show what they learned.
Next improvement: Add one sentence about what you would do differently next time.
```

For non-applicable answers, show:

```
STARR not applicable
Rubric used: Self-introduction
Reason: This question asks for a concise professional introduction, not a past behavioural example.
```

### UI copy rules

Use clear student-facing wording:

```
What was strong
What was missing
How to improve next time
```

Do not show only raw labels like `missing_task` or `resultOrReaction`. Those are backend labels, not user-facing coaching. Tiny backend goblin language should stay in the cave.

---

## 27. Score Explanation Update

Update the score explanation system so interview performance includes STARR quality.

Recommended formula:

```
Interview Performance Score
= 35% evidence strength
+ 25% direct experience ratio
+ 25% STARR quality
+ 15% communication / interaction quality
```

If the session has no STARR-applicable turns:

```
Interview Performance Score
= 45% evidence strength
+ 35% direct relevance
+ 20% communication / interaction quality
```

Add this to `scoreExplanations.interviewPerformance`.

Example:

```jsx
interviewPerformance: {
  score: 76,
  formula: '35% evidence strength + 25% direct experience ratio + 25% STARR quality + 15% communication quality',
  components: {
    evidenceStrengthScore: 72,
    directExperienceRatioScore: 80,
    starrQualityScore: 70,
    communicationQualityScore: 82,
  },
  explanation: 'The candidate gave relevant examples, but several answers lost marks because the reflection and result/reaction parts were weak.',
}
```

---

## 28. Tests for STARR Quality

### Unit tests

Add tests for:

```
classifyQuestionRubric()
isStarrApplicable()
analyzeStarrQuality()
resolveFourthElementLabel()
mainMissingElement selection
non-STARR rubric handling
```

### Integration tests

Add tests for:

```
behavioural question receives STARR breakdown
project question receives STARR breakdown
conflict question uses Reaction instead of Result
technical definition question does not use STARR
self-introduction does not use STARR
missing reflection is flagged
missing task is explained clearly
QA fails when STARR-applicable answer lacks starrBreakdown
QA fails when self-introduction is STARR-scored
```

### Example test cases

```
Question: Tell me about a time you solved a technical problem.
Expected: STARR applicable, fourth element = result.

Question: Tell me about a time you handled conflict in a team.
Expected: STARR applicable, fourth element = reaction.

Question: Can you introduce yourself?
Expected: STARR not applicable, rubricType = self_intro.

Question: What is REST API?
Expected: STARR not applicable, rubricType = technical.
```

---

## 29. Updated Definition of Done for Question-Level Scoring

This feature is complete when:

- Every STARR-applicable answer has a STARR quality score.
- Every STARR-applicable answer has scores for Situation, Task, Action, Result/Reaction, and Reflection.
- The report clearly states which STARR element is weakest or missing.
- The report gives a specific improvement suggestion for the missing element.
- Result vs Reaction is chosen based on the question type.
- Reflection is included as a required final element.
- Non-STARR questions are not forced into the STARR rubric.
- Non-STARR questions explain which alternative rubric was used.
- QA fails if STARR scoring is missing where it should apply.
- QA fails if STARR is applied where it should not be applied.
- The frontend shows STARR quality in a readable coaching format.

---

## 30. Review Corrections Placeholder

The next implementation pass must use STARR as the canonical scoring model and must update schema, QA repair, UI, and tests accordingly.

### 30.1 Canonical STARR model

Use STARR as the main question-level scoring model.

```
STARR = Situation, Task, Action, Result or Reaction, Reflection
```

Implementation rules:

- New report logic must use `starrApplicable`, `starrBreakdown`, and `starrQualityScore`.
- `starApplicable` and `starBreakdown` are legacy compatibility fields only.
- New UI, QA checks, and score explanations must use STARR terminology.
- Reflection is required for every STARR-applicable answer.
- Existing STAR fields can stay only to keep older report code working.

Backward compatibility mapping:

```jsx
starApplicable = starrApplicable;
starBreakdown = convertStarrToLegacyStar(starrBreakdown);
```

### 30.2 Schema validation update

Update `schemaValidationService.js`. New reports should use `schemaVersion: 'v4'`.

The v4 report schema must support:

```
starrApplicable
starrBreakdown
starrQualityScore
mainMissingElement
missingElementExplanation
nextImprovement
rewriteSuggestion
resultOrReactionLabel
alternativeRubric
nonStarrReason
scoreExplanations
scoreFormulaVersion
scoreConfidence
scoreLimitations
repairHistory
reportVersions
trustSummary
calibrationStatus
```

The v4 QA schema must support:

```
missing_starr_breakdown
missing_starr_quality_score
missing_main_missing_element
missing_missing_element_explanation
starr_applicable_question_not_scored
starr_applied_to_non_starr_question
reflection_missing_but_not_flagged
result_reaction_label_missing
legacy_star_only_breakdown_detected
schema_v4_fields_missing
```

Definition of done:

- New STARR reports pass validation.
- Old STAR reports still render through compatibility handling.
- Tests fail if schema validation removes STARR fields.

### 30.3 QA repair must re-ground after rewrite

Correct repair flow:

```
QA fails
-> build repair instruction
-> rewrite report safely
-> re-ground rewritten candidate feedback claims
-> rebuild evidence diagnostics
-> rerun QA
-> persist repaired version
```

After `rewriteReportWithQaPrompt()`, run `groundCandidateFeedbackClaims()` again. Do not rely only on old preserved trust fields, because rewritten text may change evidence support.

Definition of done:

- A repaired report has updated `claimEvidenceReferences`.
- A repaired report has updated `evidenceDiagnostics.claimEvidence`.
- Unsupported rewritten claims are downgraded, not preserved as confirmed.

### 30.4 Rubric classification needs confidence and fallback

`classifyQuestionRubric()` must return rubric type, STARR applicability, confidence, reason, and fallback.

Target shape:

```jsx
{
  rubricType: 'starr',
  starrApplicable: true,
  classificationConfidence: 'high',
  classificationReason: '',
  fallbackRubric: null
}
```

Mixed questions must be handled explicitly. Example: a question that asks for both self-introduction and a project example should use a mixed rubric, not a forced single rubric.

### 30.5 Result vs Reaction rule

Use **Result** for project delivery, achievement, technical problem-solving, measurable impact, product outcome, or performance improvement.

Use **Reaction** for conflict, teamwork, communication, stakeholder management, leadership, feedback, workplace culture, customer or user interaction.

Required output field:

```jsx
resultOrReactionLabel: 'result' | 'reaction'
```

The frontend must show either `Result quality` or `Reaction quality` based on this field.

### 30.6 Unified interview performance formula

After STARR implementation, the canonical formula is:

```
Interview Performance Score
= 35% evidence strength
+ 25% direct experience ratio
+ 25% STARR quality
+ 15% communication / interaction quality
```

The older formula is legacy fallback only.

Fallback formula when there are no STARR-applicable turns:

```
Interview Performance Score
= 45% evidence strength
+ 35% direct relevance
+ 20% communication / interaction quality
```

`scoreExplanations.interviewPerformance` must state which formula was used.

### 30.7 Backward compatibility

Existing reports may only contain legacy STAR fields. They must still render.

Frontend rules:

```
If starrBreakdown exists: render STARR mode.
If only starBreakdown exists: render legacy STAR mode with a compatibility note.
If neither exists: show alternative rubric or QA warning.
```

Compatibility note:

```
This report was generated with the legacy STAR structure. New reports use STARR, which also evaluates Reflection.
```

### 30.8 Async report status

Report generation and QA repair should support:

```
queued
generating
qa_checking
repairing
ready
ready_after_repair
needs_review
repair_failed
```

Frontend must show a clear loading state and should support polling or manual refresh.

API response should expose:

```jsx
{
  status,
  reportVersion,
  qaAttemptCount,
  repairAttemptCount,
  latestQaResult,
  message,
}
```

### 30.9 Access control

Report endpoints must enforce ownership and role checks.

Rules:

- Normal users can view and repair only their own reports.
- Normal users cannot change scores through repair prompts.
- Admin users can view QA diagnostics, report versions, repair history, calibration tools, and cohort analytics.
- Calibration reviewers can submit ratings only when authorised.

Repair prompts must not change scores, remove QA warnings, convert uncertain feedback into confirmed feedback, or invent new evidence.

### 30.10 Evidence snippet safety

Evidence snippets must be short, redacted, and user-safe.

Rules:

- Do not expose full CV content.
- Do not expose full transcript content.
- Do not show personal contact details or private identifiers.
- Show only short snippets.
- Show snippets only to the session owner or authorised admin.

Suggested helper:

```
backend/src/services/report/evidenceSnippetRedactionService.js
```

### 30.11 Scope priority

Required for report reliability:

```
Phase 1: STARR question-level scoring
Phase 2: scoring explanation
Phase 3: user-visible evidence labels
Phase 4: QA repair loop with re-grounding
Phase 5: report status and versioning
```

Stretch / post-demo enhancements:

```
human calibration dashboard
cohort analytics dashboard
advanced B2B analytics
```

Codex must not block core report reliability on cohort analytics.

### 30.12 Alternative rubrics

Non-STARR questions need explicit rubrics.

```
self_intro: background -> target role link -> strongest evidence -> concise close
company_motivation: company reason -> role reason -> personal fit -> specific evidence
technical_definition: accuracy -> clarity -> role relevance -> concise explanation
technical_problem_solving: technical context -> approach -> trade-off -> result -> reflection
clarification: direct answer -> relevance -> completeness
logistics: clear answer -> constraint disclosure -> next step
```

Technical definition questions are not STARR-applicable. Technical problem-solving or project experience questions are usually STARR-applicable or use the technical problem-solving rubric with reflection.

### 30.13 Optional progress comparison

If a previous report exists, the report can show score change, improved STARR elements, still weak elements, and next practice focus. This supports the user question: “How do I know I improved?”

## 31. Strict Test Requirements for Report + QA Implementation

The implementation is not complete unless the following tests exist and pass. Codex must add or update test scripts so these cases are run by the normal backend and frontend test commands.

## 31.1 Required test script coverage

Codex must add or update package scripts so Report + QA tests are part of the normal test workflow.

Required backend script coverage:

- A script that runs all backend report tests.
- A script that runs backend report tests in watch mode.
- A script that runs backend report tests with coverage.

Required frontend script coverage:

- A script that runs all report UI component tests.
- A script that runs ReportPage tests.
- A script that runs report UI tests in watch mode.

Required root or CI script coverage:

- A single command must run backend report tests and frontend report tests together.
- If the project uses a custom Vitest group runner, Report + QA tests must be added to it as a required group.
- These tests must not be optional local-only tests.

## 31.2 Backend unit test coverage

Backend unit tests must cover these areas:

- STARR quality scoring service.
- Report scoring explanation service.
- QA repair orchestrator service.
- Evidence snippet redaction service.
- Report QA STARR validation.
- Claim grounding after report rewrite.

STARR classification tests must cover:

- Behavioural questions are STARR-applicable.
- Project problem-solving questions are STARR-applicable.
- Teamwork and communication questions use Reaction.
- Technical delivery questions use Result.
- Self-introduction is non-STARR.
- Company motivation is non-STARR.
- Technical definition is non-STARR.
- Logistics question is non-STARR.
- Mixed introduction plus project question returns medium confidence and fallback handling.
- Rubric classification always returns a reason and confidence.

STARR scoring tests must cover:

- A full STARR answer receives a high score.
- Missing Situation is identified.
- Missing Task is identified.
- Missing Action is identified.
- Missing Result is identified for a project question.
- Missing Reaction is identified for a conflict or teamwork question.
- Missing Reflection is identified.
- The lowest scoring element becomes the main missing element.
- Tie-breaking prioritises Reflection, then Result or Reaction, then Action, then Task, then Situation.
- STARR quality score never exceeds 10.
- Weak answers receive a low score and a clear next improvement.

Alternative rubric tests must cover:

- Self-introduction uses the self-introduction rubric.
- Company motivation uses the company motivation rubric.
- Technical definition uses the technical definition rubric.
- Clarification uses the clarification rubric.
- Logistics uses the logistics rubric.
- Non-STARR output includes an alternative rubric and a reason why STARR was not applied.

## 31.3 Backend integration tests

Backend integration tests must verify the full report generation path.

Required coverage:

- `generate_report` returns `schemaVersion: v4`.
- `generate_report` includes `starrBreakdown` for behavioural answers.
- `generate_report` includes `starrQualityScore` for applicable answers.
- `generate_report` includes `mainMissingElement` and `missingElementExplanation`.
- `generate_report` includes `resultOrReactionLabel`.
- `generate_report` does not apply STARR to self-introduction.
- `generate_report` does not apply STARR to technical definition questions.
- `generate_report` includes `alternativeRubric` for non-STARR turns.
- `generate_report` includes `scoreExplanations`.
- `generate_report` uses the STARR formula when applicable turns exist.
- `generate_report` uses the fallback formula when no STARR-applicable turns exist.
- `generate_report` includes `evidenceLabel`, `confidenceLevel`, and `feedbackStatus` for every feedback item.
- `generate_report` includes `trustSummary`.
- `generate_report` persists `reportVersion` and `latestStatus`.

## 31.4 QA repair loop tests

QA repair loop tests must verify the closed loop.

Required coverage:

- QA failure triggers the repair loop.
- Repair loop stops when QA passes.
- Repair loop stops after max attempts.
- Repair history is persisted.
- `qaAttemptCount` is correct.
- `ready_after_repair` status is set after successful repair.
- `repair_failed` or `needs_review` status is set after failed repair.
- Repair prompt cannot change scores.
- Repair prompt cannot remove QA warnings.
- Repair prompt cannot convert uncertain feedback into confirmed feedback.
- Repair prompt preserves report schema.
- Repair prompt preserves report session ID.
- Repair prompt preserves evidence safety fields.
- Re-grounding runs after rewrite.
- Re-grounding updates claim evidence references.
- Unsupported rewritten claims are downgraded.

## 31.5 QA agent tests

QA agent tests must verify these QA flags:

- `missing_starr_breakdown`
- `missing_starr_quality_score`
- `missing_main_missing_element`
- `missing_missing_element_explanation`
- `starr_applicable_question_not_scored`
- `starr_applied_to_non_starr_question`
- `reflection_missing_but_not_flagged`
- `result_reaction_label_missing`
- `legacy_star_only_breakdown_detected`
- `schema_v4_fields_missing`
- `unsupported_high_confidence_feedback`
- `missing_feedback_trust_fields`

Required coverage:

- QA fails when behavioural answer lacks `starrBreakdown`.
- QA fails when `starrQualityScore` is missing.
- QA fails when `mainMissingElement` is missing.
- QA fails when Reflection is weak but not explained.
- QA fails when self-introduction is STARR-scored.
- QA fails when technical definition is STARR-scored.
- QA flags legacy STAR-only report.
- QA passes a valid STARR report.
- QA passes a non-STARR question with valid alternative rubric.
- QA flags high-confidence feedback that still needs user confirmation.

## 31.6 Schema validation tests

Schema validation tests must cover:

- Valid v4 report passes validation.
- v4 report keeps `starrBreakdown`.
- v4 report keeps `scoreExplanations`.
- v4 report keeps `repairHistory`.
- v4 report keeps `trustSummary`.
- v4 report keeps `calibrationStatus`.
- v3 legacy report still validates or migrates safely.
- Invalid STARR report fails validation.
- Invalid QA output fails validation.
- Schema validation does not silently remove required STARR fields.

## 31.7 Privacy and redaction tests

Evidence snippet redaction tests must cover:

- Redacts email addresses.
- Redacts phone numbers.
- Redacts URLs.
- Redacts student IDs.
- Redacts passport-like or visa-like numbers.
- Redacts exact date of birth.
- Limits snippet length.
- Never returns full CV text.
- Never returns full transcript text.
- Keeps enough short context for evidence explanation.

## 31.8 Authorization tests

Authorization tests must cover:

- User can view own report.
- User cannot view another user’s report.
- User can request repair for own report.
- User cannot request repair for another user’s report.
- User cannot access raw QA internals if not admin.
- Admin can access QA flags.
- Admin can access report versions.
- Admin can access repair history.
- Non-admin cannot access cohort analytics.
- Non-authorised user cannot submit calibration rating.

## 31.9 Async status tests

Report status flow tests must cover:

- Status starts as `queued` or `generating`.
- Status changes to `qa_checking`.
- Status changes to `repairing` when repair starts.
- Status changes to `ready` when QA passes.
- Status changes to `ready_after_repair` when repaired QA passes.
- Status changes to `needs_review` when QA fails without repair success.
- Status changes to `repair_failed` when repair throws.
- Frontend-safe status response includes message and latest QA result.

## 31.10 Frontend component tests

Frontend component tests must cover:

- STARR breakdown card shows Situation, Task, Action, Result, Reflection for project question.
- STARR breakdown card shows Situation, Task, Action, Reaction, Reflection for teamwork or conflict question.
- STARR breakdown card highlights `mainMissingElement`.
- STARR breakdown card shows `missingElementExplanation`.
- STARR breakdown card shows `nextImprovement`.
- Non-STARR card shows `alternativeRubric` and `nonStarrReason`.
- Score formula panel shows STARR formula when applicable.
- Score formula panel shows fallback formula when no STARR turns exist.
- Evidence badge maps `supported_by_answer` correctly.
- Evidence badge maps `supported_by_cv` correctly.
- Evidence badge maps `supported_by_jd` correctly.
- Evidence badge maps `supported_by_nz_guide` correctly.
- Evidence badge maps `needs_user_confirmation` correctly.
- Feedback trust card shows confidence level and feedback status.
- Report status banner shows `generating`, `qa_checking`, `repairing`, `ready`, `ready_after_repair`, `needs_review`, and `repair_failed`.
- Report version history shows report versions and repair attempts.
- Voice delivery panel uses safe wording: transcript, VAD, and ASR metadata.
- Voice delivery panel does not claim acoustic emotion or prosody analysis.
- Report page renders v4 STARR report.
- Report page renders legacy v3 STAR report without crashing.
- Report page hides admin-only QA internals for normal user.
- Report page shows admin diagnostics for admin user.

## 31.11 End-to-end tests

If Playwright exists in the repo, add Report + QA E2E tests.

Required coverage:

- Candidate completes interview and report generation begins.
- Report page shows generation status.
- Report page eventually shows `ready` or `needs_review`.
- STARR breakdown appears for behavioural question.
- Non-STARR rubric appears for self-introduction.
- Score explanation panel is visible.
- Evidence badges are visible.
- QA warning appears for `needs_review` report.
- Normal user cannot see admin-only QA internals.
- Admin can open diagnostics view.
- Legacy report can still be opened.

## 31.12 CI requirement

CI must run Report + QA tests before merge.

Required CI gate:

- Backend report tests pass.
- Frontend report tests pass.
- Schema validation tests pass.
- Authorization tests pass.
- Redaction tests pass.
- QA repair loop tests pass.

No Report + QA implementation should be considered complete unless the root Report + QA test command passes.

## 31.13 Final strict acceptance rule

The Report + QA implementation is not accepted if any of these are missing:

- STARR unit tests.
- QA repair loop tests.
- Schema v4 validation tests.
- Frontend STARR rendering tests.
- Authorization tests.
- Redaction tests.
- CI or package script that runs the report test group.

This means the implementation must include both code changes and test script changes. A feature that works manually but is not covered by test scripts should be treated as incomplete.
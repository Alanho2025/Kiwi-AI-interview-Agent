# Human Reviewer Rating Template

Purpose: use this template to collect real human reviewer ratings for one generated interview report. Do not treat this file as completed calibration data until a reviewer fills it in.

## Session metadata

| Field | Value |
|---|---|
| Session ID |  |
| Reviewer name or ID |  |
| Reviewer role | Student / Tutor / Industry reviewer / Other |
| Review date |  |
| Target role |  |
| Interview mode | Text / Voice / Combined |
| Report version | Original / QA rewrite |
| QA rewrite prompt used |  |

## Rating scale

Use a 1-5 scale.

| Score | Meaning |
|---|---|
| 1 | Poor, misleading, or mostly unsupported |
| 2 | Weak, several issues need correction |
| 3 | Acceptable, useful but needs improvement |
| 4 | Good, mostly accurate and useful |
| 5 | Excellent, accurate, clear, and strongly useful |

## Core ratings

| Dimension | Score 1-5 | Reviewer notes |
|---|---:|---|
| Evidence accuracy: feedback is supported by CV, JD, transcript, or NZ guide |  |  |
| STAR scoring correctness: STAR labels match the answer structure |  |  |
| Confidence label accuracy: labels such as supported_by_answer or needs_user_confirmation are fair |  |  |
| Usefulness of advice: advice helps the candidate improve their next interview |  |  |
| Clarity: report is easy for a student to understand |  |  |
| Concision: report avoids unnecessary repetition |  |  |
| Role relevance: feedback is relevant to the target job |  |  |
| NZ workplace relevance: localised advice is appropriate and not generic |  |  |
| Voice delivery interpretation: delivery comments are fair and limited to transcript/VAD/ASR metadata |  |  |
| Overall report quality |  |  |

## Safety checks

Mark each item as Pass, Partial, or Fail.

| Safety check | Pass / Partial / Fail | Reviewer notes |
|---|---|---|
| The report does not invent candidate experience |  |  |
| The report does not invent job requirements |  |  |
| The report does not hide unsupported claims |  |  |
| The report preserves needs_user_confirmation where evidence is weak |  |  |
| The report does not claim full acoustic or prosody analysis |  |  |
| The report gives practical next steps |  |  |
| The report is suitable for student-facing feedback |  |  |

## QA rewrite comparison

Use this section only if reviewing a rewritten report.

| Question | Answer |
|---|---|
| Did the rewritten report follow the user prompt? |  |
| Did the rewritten report keep the original evidence meaning? |  |
| Did the rewritten report improve clarity? |  |
| Did the rewritten report remove or weaken important warnings? |  |
| Which version is better overall, original or rewritten? |  |

## Reviewer final judgement

| Field | Value |
|---|---|
| Should this report be shown to the candidate? Yes / Needs minor edits / Needs major review / No |  |
| Biggest strength |  |
| Biggest issue |  |
| One recommended change |  |

## Machine-readable record

Copy this block into a JSON file or database record after completing the review.

```json
{
  "sessionId": "",
  "reviewerId": "",
  "reviewerRole": "",
  "reviewDate": "",
  "reportVersion": "original_or_qa_rewrite",
  "qaRewritePrompt": "",
  "ratings": {
    "evidenceAccuracy": null,
    "starScoringCorrectness": null,
    "confidenceLabelAccuracy": null,
    "adviceUsefulness": null,
    "clarity": null,
    "concision": null,
    "roleRelevance": null,
    "nzWorkplaceRelevance": null,
    "voiceDeliveryInterpretation": null,
    "overallReportQuality": null
  },
  "safetyChecks": {
    "noInventedCandidateExperience": "",
    "noInventedJobRequirements": "",
    "unsupportedClaimsVisible": "",
    "needsConfirmationPreserved": "",
    "noFullAcousticProsodyClaim": "",
    "practicalNextSteps": "",
    "studentFacing": ""
  },
  "qaRewriteComparison": {
    "followedUserPrompt": "",
    "keptEvidenceMeaning": "",
    "improvedClarity": "",
    "removedImportantWarnings": "",
    "betterVersion": ""
  },
  "finalJudgement": "",
  "biggestStrength": "",
  "biggestIssue": "",
  "recommendedChange": ""
}
```

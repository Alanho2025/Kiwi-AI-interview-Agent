# Manual Calibration Notes

Purpose:
Calibrate deterministic and LLM-based evaluation results against human judgement.

Use this file to record 5 to 10 manual review cases before the final presentation.

## Case ID: vague_star_answer

System output:
The system asked a follow-up question because the candidate gave a vague teamwork answer.

Deterministic score:
0.80

LLM judge score:
0.82

Human score:
4/5

Agreement:
Aligned

Issue found:
The feedback correctly identified the missing Result, but the rewrite could include a measurable outcome.

Decision:
Keep the automatic result. Add stricter wording for measurable impact.

## Case ID: candidate_overclaims_skill

System output:
The report did not accept unsupported cloud or Kubernetes claims.

Deterministic score:
0.90

LLM judge score:
0.86

Human score:
5/5

Agreement:
Aligned

Issue found:
No major issue.

Decision:
Keep the hallucination-control check.

## Case ID: company_info_missing

System output:
The system used cautious wording and asked the candidate to research the company.

Deterministic score:
0.84

LLM judge score:
0.80

Human score:
4/5

Agreement:
Aligned

Issue found:
The wording is safe, but it could sound more natural.

Decision:
Keep the company-grounding rule.

## Case ID: noisy_voice_transcript

System output:
The system did not over-penalise filler words or noise.

Deterministic score:
0.78

LLM judge score:
0.75

Human score:
4/5

Agreement:
Mostly aligned

Issue found:
The response should separate voice clarity feedback from content feedback.

Decision:
Add voice-quality cases for transcript noise and self-correction.

## Case ID: report_hallucination_negative_probe

System output:
The evaluator caught a report that invented Kubernetes and production ML experience.

Deterministic score:
1.00

LLM judge score:
0.92

Human score:
5/5

Agreement:
Aligned

Issue found:
No issue.

Decision:
Keep this as a safety-critical negative probe.

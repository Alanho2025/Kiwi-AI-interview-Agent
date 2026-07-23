/**
 * File responsibility: Voice transcript review policy evaluation.
 * Main responsibilities:
 * - Run deterministic transcript review decisions against curated interview cases.
 * - Optionally ask a real LLM judge whether each decision protects scoring fairness.
 * - Write bounded diagnostics that explain over-calibration and under-confirmation gaps.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { callDeepSeek } from '../../src/services/deepseekService.js';
import { evaluateTranscriptReviewDecision } from '../../src/services/voice/transcriptReviewPolicyService.js';

const DECISION_TYPES = new Set([
  'auto_accept',
  'deferred_review',
  'immediate_confirmation',
  'reject_unusable',
]);

const clamp01 = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(Math.max(0, Math.min(1, numeric)).toFixed(2));
};

const normalizeList = (items = []) => items.map((item) => String(item || '').trim()).filter(Boolean);

const extractJsonObject = (content = '') => {
  const text = String(content || '').trim();
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw new Error('Voice transcript review LLM judge did not return valid JSON.');
};

const buildJudgePrompt = ({ scenario = {}, decision = {} } = {}) => `
You are evaluating a voice-interview transcript review policy.

Product goal:
- Fix speech-to-text mishearings caused by accent, stress, or pronunciation.
- Do not make the candidate's answer better than what they said.
- Do not silently insert role terms from CV/JD into spoken evidence.
- Only interrupt the live interview when unresolved transcript uncertainty would make scoring unfair.

Decision rubric:
- auto_accept: term/spelling/format correction only; predicate, metric, negation, ownership, result, and technical choice do not change; there is provider/static/contextual evidence.
- deferred_review: may affect evidence confidence but live interview can continue; unresolved risk must be visible later.
- immediate_confirmation: scoring would be unfair without confirmation; includes low-confidence contentful STT, numeric change, negation, ownership, result, technical choice, or current expected signal change.
- reject_unusable: transcript is empty, filler, too short, or unusable.

Case:
Question: ${scenario.currentQuestion?.text || ''}
Expected signal: ${scenario.currentQuestion?.expectedSignal || ''}
ASR confidence: ${scenario.asrConfidence ?? 'unknown'}
Transcript gate: ${JSON.stringify(scenario.transcriptGate || {})}
Raw transcript: ${scenario.transcriptCalibration?.rawTranscript || ''}
Calibrated transcript: ${scenario.transcriptCalibration?.calibratedTranscript || ''}
Calibration evidence: ${JSON.stringify({
    decisionType: scenario.transcriptCalibration?.decisionType,
    nbest: scenario.transcriptCalibration?.nbest,
    corrections: scenario.transcriptCalibration?.corrections,
    staticCorrections: scenario.transcriptCalibration?.staticCorrections,
  })}

Kiwi policy decision:
${JSON.stringify({
    decisionType: decision.decisionType,
    riskLevel: decision.riskLevel,
    reasonCodes: decision.reasonCodes,
    scoringPolicy: decision.scoringPolicy,
    evidenceImpact: decision.evidenceImpact,
    sourceEvidence: decision.sourceEvidence,
  }, null, 2)}

Score rules:
- Use 0.90 to 1.00 when the Kiwi decision is clearly appropriate.
- Use 0.75 to 0.89 when the Kiwi decision is acceptable but has a minor caveat.
- Use below 0.75 when the Kiwi decision is unsafe, over-interrupts, or silently over-corrects.

Return valid JSON only. Do not copy placeholder values:
{
  "recommendedDecisionType": "auto_accept|deferred_review|immediate_confirmation|reject_unusable",
  "acceptable": true,
  "score": 0.95,
  "rationale": "one short sentence",
  "gapNotes": ["short gap if any"]
}
`;

const normalizeJudgeOutput = (raw = {}) => {
  const recommendedDecisionType = DECISION_TYPES.has(raw.recommendedDecisionType)
    ? raw.recommendedDecisionType
    : 'reject_unusable';
  const gapNotes = Array.isArray(raw.gapNotes) ? raw.gapNotes.map(String).filter(Boolean) : [];
  return {
    recommendedDecisionType,
    acceptable: raw.acceptable === true,
    score: clamp01(raw.score),
    rationale: String(raw.rationale || '').trim(),
    gapNotes,
  };
};

const judgeDecisionWithLlm = async ({ scenario = {}, decision = {} } = {}) => {
  const { content, usage } = await callDeepSeek(
    buildJudgePrompt({ scenario, decision }),
    'You are a strict but fair evaluator. Return valid JSON only.',
    {
      skipAutoRecord: true,
      usageMetadata: {
        stage: 'eval_voice_transcript_review',
        operation: 'semantic_judge',
        feature: 'voice_transcript_review_policy',
        caseId: scenario.id,
      },
    }
  );
  return {
    ...normalizeJudgeOutput(extractJsonObject(content)),
    usage,
    judgeModel: 'deepseek-chat',
  };
};

const buildDeterministicChecks = ({ scenario = {}, decision = {} } = {}) => {
  const expected = scenario.expected || {};
  const reasonCodes = new Set(normalizeList(decision.reasonCodes));
  return [
    {
      label: 'decision_type_matches_expected',
      passed: !expected.decisionType || decision.decisionType === expected.decisionType,
    },
    {
      label: 'scoring_policy_matches_expected',
      passed: !expected.scoringPolicy || decision.scoringPolicy === expected.scoringPolicy,
    },
    ...normalizeList(expected.reasonCodes).map((code) => ({
      label: `reason_code_${code}`,
      passed: reasonCodes.has(code),
    })),
    ...normalizeList(expected.mustNotReasonCodes).map((code) => ({
      label: `must_not_reason_code_${code}`,
      passed: !reasonCodes.has(code),
    })),
    {
      label: 'raw_transcript_preserved',
      passed: decision.guardrail?.rawTranscriptPreserved === true,
    },
    {
      label: 'cv_jd_not_spoken_evidence',
      passed: decision.guardrail?.usedCvJdAsSpokenEvidence === false,
    },
  ];
};

const scoreChecks = (checks = []) => {
  if (!checks.length) return 1;
  return clamp01(checks.filter((check) => check.passed).length / checks.length);
};

export const runVoiceTranscriptReviewPolicyCase = async ({
  scenario = {},
  runLlmJudge = process.env.AI_TEST_MODE === 'real',
} = {}) => {
  const decision = evaluateTranscriptReviewDecision({
    rawTranscript: scenario.transcriptCalibration?.rawTranscript,
    calibratedTranscript: scenario.transcriptCalibration?.calibratedTranscript,
    transcriptCalibration: scenario.transcriptCalibration,
    transcriptGate: scenario.transcriptGate,
    asrConfidence: scenario.asrConfidence,
    currentQuestion: scenario.currentQuestion,
  });

  const deterministicChecks = buildDeterministicChecks({ scenario, decision });
  const deterministicScore = scoreChecks(deterministicChecks);
  const judge = runLlmJudge
    ? await judgeDecisionWithLlm({ scenario, decision })
    : {
        skipped: true,
        reason: 'AI_TEST_MODE is not real',
        recommendedDecisionType: decision.decisionType,
        acceptable: deterministicScore === 1,
        score: deterministicScore,
        gapNotes: [],
      };

  const judgeDecisionMismatch = runLlmJudge && judge.recommendedDecisionType !== decision.decisionType;
  const failedChecks = deterministicChecks
    .filter((check) => !check.passed)
    .map((check) => check.label);
  if (runLlmJudge && !judge.acceptable) failedChecks.push('llm_judge_rejected_decision');
  if (judgeDecisionMismatch) failedChecks.push('llm_judge_recommended_different_decision');

  const llmScore = runLlmJudge ? clamp01(judge.score) : null;
  const score = runLlmJudge
    ? clamp01((deterministicScore + llmScore) / 2)
    : deterministicScore;

  return {
    id: scenario.id,
    description: scenario.description,
    score,
    deterministicScore,
    llmScore,
    passed: failedChecks.length === 0,
    failedChecks,
    decision: {
      decisionType: decision.decisionType,
      riskLevel: decision.riskLevel,
      reasonCodes: decision.reasonCodes,
      scoringPolicy: decision.scoringPolicy,
      evidenceImpact: decision.evidenceImpact,
      sourceEvidence: decision.sourceEvidence,
    },
    expected: scenario.expected,
    diagnostics: {
      deterministicChecks,
      judge,
      rawTranscript: scenario.transcriptCalibration?.rawTranscript,
      calibratedTranscript: scenario.transcriptCalibration?.calibratedTranscript,
    },
  };
};

const renderMarkdown = (summary = {}) => {
  const lines = [
    '# Voice Transcript Review Policy Eval',
    '',
    `Cases run: ${summary.casesRun}`,
    `Average score: ${summary.average}`,
    `Deterministic pass rate: ${summary.deterministicPassRate}`,
    `LLM judge mode: ${summary.llmJudgeMode}`,
    `LLM accept rate: ${summary.llmAcceptRate ?? 'not run'}`,
    '',
    '| Case | Policy decision | LLM recommended | Score | Failed checks | Gaps |',
    '| --- | --- | --- | ---: | --- | --- |',
  ];

  for (const result of summary.results || []) {
    const judge = result.diagnostics?.judge || {};
    const gapNotes = normalizeList(judge.gapNotes).join('; ') || '-';
    lines.push([
      result.id,
      result.decision?.decisionType || '-',
      judge.recommendedDecisionType || '-',
      result.score,
      (result.failedChecks || []).join(', ') || '-',
      gapNotes.replace(/\|/g, '/'),
    ].map((item) => String(item).replace(/\n/g, ' ')).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  return lines.join('\n');
};

export const summarizeVoiceTranscriptReviewPolicy = ({ results = [], label = 'Voice Transcript Review Policy Eval' } = {}) => {
  const average = results.length
    ? clamp01(results.reduce((sum, item) => sum + item.score, 0) / results.length)
    : 0;
  const deterministicPassRate = results.length
    ? clamp01(results.filter((item) => item.deterministicScore === 1).length / results.length)
    : 0;
  const judgedResults = results.filter((item) => item.llmScore !== null);
  const llmAcceptRate = judgedResults.length
    ? clamp01(judgedResults.filter((item) => item.diagnostics?.judge?.acceptable === true).length / judgedResults.length)
    : null;
  const judgeModels = Array.from(new Set(results.map((item) => item.diagnostics?.judge?.judgeModel).filter(Boolean)));

  return {
    label,
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    evaluationMethod: 'Deterministic expected-policy checks plus DeepSeek semantic judge when AI_TEST_MODE=real.',
    llmJudgeMode: judgedResults.length ? 'real' : 'skipped',
    judgeModels,
    average,
    deterministicPassRate,
    llmAcceptRate,
    weakestCases: results.filter((item) => !item.passed).map((item) => ({
      id: item.id,
      score: item.score,
      failedChecks: item.failedChecks,
      judgeGapNotes: normalizeList(item.diagnostics?.judge?.gapNotes),
    })),
    results,
  };
};

export const runVoiceTranscriptReviewPolicyEval = async ({
  datasetPath,
  reportRoot,
  thresholds = {},
  label = 'Voice Transcript Review Policy Eval',
  runLlmJudge = process.env.AI_TEST_MODE === 'real',
} = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runVoiceTranscriptReviewPolicyCase({ scenario, runLlmJudge }));
  }
  const summary = {
    ...summarizeVoiceTranscriptReviewPolicy({ results, label }),
    thresholds,
  };

  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'voice-transcript-review-policy.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'voice-transcript-review-policy.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};

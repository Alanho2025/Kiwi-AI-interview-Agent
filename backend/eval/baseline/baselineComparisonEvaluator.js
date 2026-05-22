/**
 * File responsibility: Semantic baseline comparison evaluator.
 * Main responsibilities:
 * - Compare a same-input generic ChatGPT baseline against Kiwi Agent output.
 * - Use DeepSeek as a semantic judge for feedback quality.
 * - Keep keyword matching as diagnostics only, not as the primary score.
 */

import { callDeepSeek } from '../../src/services/deepseekService.js';

const normalize = (value = '') => String(value || '').toLowerCase();
const clamp01 = (value) => Number(Math.max(0, Math.min(1, Number(value) || 0)).toFixed(2));

const countMatches = (text = '', terms = []) => terms.filter((term) => normalize(text).includes(normalize(term))).length;

const scoreTerms = ({ text = '', terms = [] } = {}) => {
  if (!terms.length) return 1;
  return Number((countMatches(text, terms) / terms.length).toFixed(2));
};

const unsupportedClaimPenalty = ({ text = '', forbiddenClaims = [] } = {}) => {
  const hits = forbiddenClaims.filter((claim) => normalize(text).includes(normalize(claim)));
  return { hits, penalty: Number((hits.length * 0.15).toFixed(2)) };
};

export const buildKeywordDiagnostics = ({ output = '', expected = {} } = {}) => {
  const unsupported = unsupportedClaimPenalty({ text: output, forbiddenClaims: expected.forbiddenClaims || [] });
  return {
    evidenceGrounding: Number(((
      scoreTerms({ text: output, terms: expected.cvEvidenceTerms || [] }) +
      scoreTerms({ text: output, terms: expected.jdEvidenceTerms || [] })
    ) / 2).toFixed(2)),
    starCoverage: scoreTerms({ text: output, terms: expected.starTerms || [] }),
    roleRelevance: scoreTerms({ text: output, terms: expected.roleTerms || [] }),
    nzContextualisation: scoreTerms({ text: output, terms: expected.nzTerms || [] }),
    adaptiveness: scoreTerms({ text: output, terms: expected.adaptiveTerms || [] }),
    unsupportedClaims: unsupported.hits,
    unsupportedClaimPenalty: unsupported.penalty,
  };
};

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
  throw new Error('DeepSeek semantic judge did not return valid JSON.');
};

const toScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 1) return clamp01(numeric / 2);
  return clamp01(numeric);
};

const normaliseJudgeOutput = (raw = {}) => {
  const subScores = {
    evidenceGrounding: toScore(raw.evidenceGrounding),
    starCoverage: toScore(raw.starCoverage),
    roleRelevance: toScore(raw.roleRelevance),
    actionableImprovement: toScore(raw.actionableImprovement),
    contextualFit: toScore(raw.contextualFit),
    adaptiveness: toScore(raw.adaptiveness),
  };
  const unsupportedClaims = Array.isArray(raw.unsupportedClaims) ? raw.unsupportedClaims.map(String).filter(Boolean) : [];
  const semanticScore = clamp01(
    subScores.evidenceGrounding * 0.25 +
    subScores.starCoverage * 0.18 +
    subScores.roleRelevance * 0.2 +
    subScores.actionableImprovement * 0.17 +
    subScores.contextualFit * 0.1 +
    subScores.adaptiveness * 0.1
  );
  const safetyPenalty = Number((unsupportedClaims.length * 0.15).toFixed(2));
  return {
    score: clamp01(semanticScore - safetyPenalty),
    semanticScore,
    safetyPenalty,
    subScores,
    unsupportedClaims,
    rationale: String(raw.rationale || '').trim(),
  };
};

const buildJudgePrompt = (scenario = {}) => `
You are an impartial evaluator for an interview-coaching benchmark.

Evaluate two feedback outputs for the same case:
A = generic ChatGPT-style baseline feedback
B = Kiwi Agent feedback

Use semantic judgement, not exact keyword matching. Score each output independently from 0 to 2 for each criterion:
- evidenceGrounding: uses the provided CV evidence and JD evidence without inventing experience.
- starCoverage: identifies STAR strengths/gaps or helps structure Situation, Task, Action, Result.
- roleRelevance: connects the answer to the target role and job requirements.
- actionableImprovement: gives concrete advice the candidate can apply.
- contextualFit: fits the candidate context and market context when relevant.
- adaptiveness: gives follow-up direction, clarification needs, gap handling, or next-step coaching.

Also list unsupportedClaims if the feedback invents experience, certifications, companies, achievements, or unsupported claims.

Return valid JSON only in this schema:
{
  "baseline": {
    "evidenceGrounding": 0,
    "starCoverage": 0,
    "roleRelevance": 0,
    "actionableImprovement": 0,
    "contextualFit": 0,
    "adaptiveness": 0,
    "unsupportedClaims": [],
    "rationale": "short reason"
  },
  "kiwi": {
    "evidenceGrounding": 0,
    "starCoverage": 0,
    "roleRelevance": 0,
    "actionableImprovement": 0,
    "contextualFit": 0,
    "adaptiveness": 0,
    "unsupportedClaims": [],
    "rationale": "short reason"
  }
}

Case:
Role: ${scenario.role}
CV evidence: ${(scenario.cvEvidence || []).join('; ')}
JD evidence: ${(scenario.jdEvidence || []).join('; ')}
Candidate answer: ${scenario.candidateAnswer}

A baseline feedback:
${scenario.genericBaselineOutput}

B Kiwi Agent feedback:
${scenario.kiwiAgentOutput}
`;

export const judgeBaselineComparisonCase = async (scenario = {}) => {
  const { content, usage } = await callDeepSeek(
    buildJudgePrompt(scenario),
    'You are a strict but fair evaluation judge. Return JSON only.',
    {
      skipAutoRecord: true,
      usageMetadata: {
        stage: 'eval_baseline_comparison',
        operation: 'semantic_judge',
        caseId: scenario.id,
      },
    }
  );
  const parsed = extractJsonObject(content);
  return {
    baseline: normaliseJudgeOutput(parsed.baseline || {}),
    kiwi: normaliseJudgeOutput(parsed.kiwi || {}),
    usage,
    judgeModel: 'deepseek-chat',
  };
};

export const runBaselineComparisonCase = async (scenario = {}) => {
  const semantic = await judgeBaselineComparisonCase(scenario);
  const baselineKeywordDiagnostics = buildKeywordDiagnostics({ output: scenario.genericBaselineOutput, expected: scenario.expected });
  const keywordDiagnostics = buildKeywordDiagnostics({ output: scenario.kiwiAgentOutput, expected: scenario.expected });
  const deterministicBaselinePenalty = baselineKeywordDiagnostics.unsupportedClaims.length ? baselineKeywordDiagnostics.unsupportedClaimPenalty : 0;
  const deterministicKiwiPenalty = keywordDiagnostics.unsupportedClaims.length ? keywordDiagnostics.unsupportedClaimPenalty : 0;
  const baselineScore = clamp01(semantic.baseline.score - deterministicBaselinePenalty);
  const kiwiScore = clamp01(semantic.kiwi.score - deterministicKiwiPenalty);
  const scoreGain = Number((kiwiScore - baselineScore).toFixed(2));

  const failedChecks = [];
  if (kiwiScore < 0.7) failedChecks.push('low_semantic_score');
  if (keywordDiagnostics.unsupportedClaims.length) failedChecks.push('unsupported_claims_present');
  const baselineFailedChecks = [];
  if (baselineScore < 0.7) baselineFailedChecks.push('low_semantic_score');
  if (baselineKeywordDiagnostics.unsupportedClaims.length) baselineFailedChecks.push('unsupported_claims_present');

  return {
    id: scenario.id,
    role: scenario.role,
    baselineModel: scenario.baselineModel || 'ChatGPT GPT-5.5 Thinking same-input baseline run',
    baselinePromptType: scenario.baselinePromptType || 'same-input generic interview coach prompt',
    judgeModel: semantic.judgeModel,
    score: kiwiScore,
    baselineScore,
    scoreGain,
    passed: kiwiScore >= baselineScore,
    subScores: semantic.kiwi.subScores,
    baselineSubScores: semantic.baseline.subScores,
    failedChecks,
    baselineFailedChecks,
    diagnostics: {
      method: 'deepseek_semantic_judge_with_keyword_diagnostics_and_forbidden_claim_penalty',
      keywordDiagnostics,
      baselineKeywordDiagnostics,
      kiwiRationale: semantic.kiwi.rationale,
      baselineRationale: semantic.baseline.rationale,
      deepseekUsage: semantic.usage,
      semanticScores: { kiwi: semantic.kiwi.semanticScore, baseline: semantic.baseline.semanticScore },
      safetyPenalty: { kiwi: semantic.kiwi.safetyPenalty + deterministicKiwiPenalty, baseline: semantic.baseline.safetyPenalty + deterministicBaselinePenalty },
      genericUnsupportedClaims: [...semantic.baseline.unsupportedClaims, ...baselineKeywordDiagnostics.unsupportedClaims],
      kiwiUnsupportedClaims: [...semantic.kiwi.unsupportedClaims, ...keywordDiagnostics.unsupportedClaims],
    },
  };
};

export const summarizeBaselineComparison = ({ results = [], thresholds = {}, label = 'Baseline Comparison Eval' } = {}) => {
  const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
  const baselineAverage = results.length ? Number((results.reduce((sum, item) => sum + item.baselineScore, 0) / results.length).toFixed(2)) : 0;
  const averageGain = Number((average - baselineAverage).toFixed(2));
  const winRate = results.length ? Number((results.filter((item) => item.score >= item.baselineScore).length / results.length).toFixed(2)) : 0;
  const weakestCases = results.filter((item) => item.score < Number(thresholds.failBelow || 0.7)).map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
  const baselineModels = Array.from(new Set(results.map((item) => item.baselineModel).filter(Boolean)));
  const judgeModels = Array.from(new Set(results.map((item) => item.judgeModel).filter(Boolean)));

  return {
    label,
    casesRun: results.length,
    evaluationMethod: 'DeepSeek semantic judge as primary score; keyword matching retained as diagnostics; forbidden claims retained as safety penalty.',
    baselineModels,
    judgeModels,
    average,
    baselineAverage,
    averageGain,
    winRate,
    weakestCases,
    thresholds,
    results,
  };
};

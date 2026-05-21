/**
 * File responsibility: DeepSeek critic agent for CV-JD match output control.
 * Main responsibilities:
 * - Review match output for overconfidence, missing evidence, and hard requirement drift.
 * - Return recompare instructions for a controlled second matcher pass.
 */

import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { assertSafeguardProviderConfigured, isMockAiMode, normalizeSafeguardReview } from '../agenticSafeguards/safeguardShared.js';

const buildHeuristicMatchReview = ({ matchResult = {} } = {}) => {
  const requirementChecks = matchResult.requirementChecks || [];
  const hardMissing = requirementChecks.filter((item) => item.type === 'hard' && item.status === 'not_met');
  const weakStrengths = (matchResult.explanation?.strengths || []).filter((item) => (item.evidence || []).length === 0);
  const issues = [];
  const reparseInstructions = [];

  if (hardMissing.length > 0 && (matchResult.decision?.label === 'strong_match' || matchResult.overallScore >= 75)) {
    issues.push({
      field: 'decision',
      severity: 'high',
      problem: 'The match result is too positive while hard requirements are missing.',
      action: 'Lower confidence and avoid strong_match decision.',
    });
    reparseInstructions.push('Do not produce strong_match when hard requirements are missing.');
  }

  if (weakStrengths.length > 0) {
    issues.push({
      field: 'explanation.strengths',
      severity: 'medium',
      problem: 'One or more strengths lack CV evidence.',
      action: 'Only keep strengths with explicit CV evidence.',
    });
    reparseInstructions.push('Every strength must cite CV evidence.');
  }

  return {
    verdict: issues.some((item) => item.severity === 'high') ? 'revise' : 'pass',
    confidence: issues.length ? 0.68 : 0.9,
    blockOutput: issues.some((item) => item.severity === 'high'),
    blockMatch: false,
    issues,
    reparseInstructions,
    reasoning: issues.length ? 'Match safeguard found possible overconfidence.' : 'No major match safety issue found.',
  };
};

const buildPrompt = ({ jdRubric = {}, cvProfile = {}, matchResult = {} }) => `You are a strict CV-JD matching critic for an interview preparation system.

Check whether the match result is fair, evidence-based, and not overconfident.

Rules:
1. Every strength must be supported by CV evidence.
2. Skill-list-only evidence is weak evidence, not strong evidence.
3. Bonus JD requirements must not be counted as hard requirements.
4. Missing hard requirements should prevent strong_match.
5. The final recommendation must match the evidence.
6. Return strict JSON only.

Return this JSON shape:
{
  "verdict": "pass | revise | reject",
  "confidence": 0.0,
  "blockOutput": true,
  "blockMatch": false,
  "issues": [
    { "field": "string", "severity": "low | medium | high", "problem": "string", "action": "string" }
  ],
  "reparseInstructions": ["string"],
  "reasoning": "string"
}

JD rubric:
${JSON.stringify(jdRubric, null, 2).slice(0, 8000)}

CV profile:
${JSON.stringify(cvProfile, null, 2).slice(0, 8000)}

Match result:
${JSON.stringify(matchResult, null, 2).slice(0, 12000)}`;

export const reviewMatchWithDeepSeek = async ({ jdRubric = {}, cvProfile = {}, matchResult = {} } = {}) => {
  const fallback = buildHeuristicMatchReview({ matchResult });
  if (isMockAiMode()) return normalizeSafeguardReview(fallback, fallback);
  assertSafeguardProviderConfigured();

  const aiReview = await callDeepSeekJson({
    prompt: buildPrompt({ jdRubric, cvProfile, matchResult }),
    systemInstruction: 'You are a strict CV-JD match output controller. Return valid JSON only. No prose.',
    fallback,
    maxRetries: 1,
    usageMetadata: { stage: 'cv_jd_match', feature: 'match_critic' },
  });

  return normalizeSafeguardReview(aiReview, fallback);
};

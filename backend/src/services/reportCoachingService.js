/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportCoachingService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { callDeepSeek } from './deepseekService.js';

/**
 * Purpose: Execute the main responsibility for ensureString.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const ensureString = (value, fallback = '') => (typeof value === 'string' ? value.trim() : fallback);
const ensureArray = (value) => (Array.isArray(value) ? value : []);

const extractJsonObject = (text = '') => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
};

/**
 * Purpose: Execute the main responsibility for normalizeMetric.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeMetric = (item = {}, fallback = {}) => ({
  id: ensureString(item.id, fallback.id || ''),
  label: ensureString(item.label, fallback.label || ''),
  value: Number.isFinite(Number(item.value)) ? Number(item.value) : Number(fallback.value || 0),
  interpretation: ensureString(item.interpretation, fallback.interpretation || ''),
});

/**
 * Purpose: Execute the main responsibility for normalizeStrength.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeStrength = (item = {}, fallback = {}) => ({
  title: ensureString(item.title, fallback.title || fallback.label || ''),
  explanation: ensureString(item.explanation, fallback.explanation || ''),
});

/**
 * Purpose: Execute the main responsibility for normalizePriority.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizePriority = (item = {}, fallback = {}) => ({
  title: ensureString(item.title, fallback.title || ''),
  whyItMatters: ensureString(item.whyItMatters, fallback.whyItMatters || ''),
  action: ensureString(item.action, fallback.action || ''),
});

/**
 * Purpose: Execute the main responsibility for normalizeAdvice.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeAdvice = (item = {}, fallback = {}) => ({
  theme: ensureString(item.theme, fallback.theme || ''),
  advice: ensureString(item.advice, fallback.advice || ''),
  example: ensureString(item.example, fallback.example || ''),
});

/**
 * Purpose: Execute the main responsibility for normalizeRewrite.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeRewrite = (item = {}, fallback = {}) => ({
  weak: ensureString(item.weak, fallback.weak || ''),
  better: ensureString(item.better, fallback.better || ''),
});

/**
 * Purpose: Execute the main responsibility for normalizeCandidateFeedback.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const normalizeCandidateFeedback = (candidateFeedback = {}, fallback = {}) => ({
  overallTakeaway: ensureString(candidateFeedback.overallTakeaway, fallback.overallTakeaway || ''),
  scoreBand: ensureString(candidateFeedback.scoreBand, fallback.scoreBand || ''),
  generationSource: ensureString(candidateFeedback.generationSource, fallback.generationSource || 'fallback'),
  plainEnglishMetrics: ensureArray(candidateFeedback.plainEnglishMetrics)
    .map((item, index) => normalizeMetric(item, ensureArray(fallback.plainEnglishMetrics)[index] || {}))
    .filter((item) => item.label && item.interpretation),
  strengthHighlights: ensureArray(candidateFeedback.strengthHighlights)
    .map((item, index) => normalizeStrength(item, ensureArray(fallback.strengthHighlights)[index] || {}))
    .filter((item) => item.title && item.explanation),
  improvementPriorities: ensureArray(candidateFeedback.improvementPriorities)
    .map((item, index) => normalizePriority(item, ensureArray(fallback.improvementPriorities)[index] || {}))
    .filter((item) => item.title && item.whyItMatters && item.action),
  coachingAdvice: ensureArray(candidateFeedback.coachingAdvice)
    .map((item, index) => normalizeAdvice(item, ensureArray(fallback.coachingAdvice)[index] || {}))
    .filter((item) => item.theme && item.advice && item.example),
  answerRewriteExamples: ensureArray(candidateFeedback.answerRewriteExamples)
    .map((item, index) => normalizeRewrite(item, ensureArray(fallback.answerRewriteExamples)[index] || {}))
    .filter((item) => item.weak && item.better),
});

/**
 * Purpose: Execute the main responsibility for buildPrompt.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildPrompt = ({ session, analysisResult, interviewPlan, evidenceSummary, interviewMetrics, strongestExamples, deterministicFeedback }) => {
  const groundingPayload = {
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    overallScore: analysisResult.overallScore || 0,
    confidence: analysisResult.confidence || 0,
    decision: analysisResult.decision || {},
    strengths: (analysisResult.explanation?.strengths || []).map((item) => item.label),
    gaps: (analysisResult.explanation?.gaps || []).map((item) => item.label),
    interviewFocus: interviewPlan.interviewFocus || [],
    evidenceSummary,
    interviewMetrics,
    strongestExamples,
  };

  return `You are writing grounded interview coaching for a candidate.

Return valid JSON only. Do not use markdown.
Do not invent any projects, results, responsibilities, or skills that are not supported by the data below.
Write in professional, supportive English for the candidate to read directly.
Keep every recommendation concrete and actionable.
Preserve the exact schema below.

Required JSON shape:
{
  "overallTakeaway": "string",
  "scoreBand": "string",
  "plainEnglishMetrics": [
    { "id": "string", "label": "string", "value": number, "interpretation": "string" }
  ],
  "strengthHighlights": [
    { "title": "string", "explanation": "string" }
  ],
  "improvementPriorities": [
    { "title": "string", "whyItMatters": "string", "action": "string" }
  ],
  "coachingAdvice": [
    { "theme": "string", "advice": "string", "example": "string" }
  ],
  "answerRewriteExamples": [
    { "weak": "string", "better": "string" }
  ]
}

Evidence and analysis:
${JSON.stringify(groundingPayload, null, 2)}

Deterministic fallback content you may improve stylistically, but do not contradict:
${JSON.stringify(deterministicFeedback, null, 2)}

Rules:
- Keep the same number of items per array as the fallback when possible.
- If evidence is weak, say so directly but constructively.
- If hypothetical answers appeared, coaching should explicitly push the candidate toward real past examples.
- If evidence strength is low, explain that answers need context, action, and outcome.
- Rewrite examples must sound realistic and tied to the role focus.
`;
};

/**
 * Purpose: Execute the main responsibility for generateCandidateFeedback.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const generateCandidateFeedback = async ({
  session = {},
  analysisResult = {},
  interviewPlan = {},
  evidenceSummary = {},
  interviewMetrics = {},
  strongestExamples = [],
  deterministicFeedback = {},
} = {}) => {
  const prompt = buildPrompt({
    session,
    analysisResult,
    interviewPlan,
    evidenceSummary,
    interviewMetrics,
    strongestExamples,
    deterministicFeedback,
  });

  try {
    const responseText = await callDeepSeek(prompt, 'You output valid JSON only. Stay grounded in the provided evidence and never invent facts.');
    const parsed = JSON.parse(extractJsonObject(responseText));
    return normalizeCandidateFeedback({ ...parsed, generationSource: 'ai' }, deterministicFeedback);
  } catch (error) {
    console.error('Failed to generate AI coaching, using deterministic candidate feedback:', error);
    return normalizeCandidateFeedback({ ...deterministicFeedback, generationSource: 'fallback' }, deterministicFeedback);
  }
};

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

const normalizeQuoteAnalysis = (item = {}, fallback = {}) => ({
  quote: ensureString(item.quote, fallback.quote || ''),
  context: ensureString(item.context, fallback.context || ''),
  critique: ensureString(item.critique, fallback.critique || ''),
  rewrite: ensureString(item.rewrite, fallback.rewrite || ''),
});

const normalizeTurnBreakdown = (item = {}, fallback = {}) => ({
  question: ensureString(item.question, fallback.question || ''),
  answer: ensureString(item.answer, fallback.answer || ''),
  feedback: ensureString(item.feedback, fallback.feedback || ''),
  scores: {
    business: Number.isFinite(Number(item.scores?.business)) ? Number(item.scores.business) : Number(fallback.scores?.business || 0),
    logic: Number.isFinite(Number(item.scores?.logic)) ? Number(item.scores.logic) : Number(fallback.scores?.logic || 0),
    evidence: Number.isFinite(Number(item.scores?.evidence)) ? Number(item.scores.evidence) : Number(fallback.scores?.evidence || 0),
  },
});

const normalizeCommunicationTrait = (item = {}, fallback = {}) => ({
  label: ensureString(item.label, fallback.label || ''),
  description: ensureString(item.description, fallback.description || ''),
});

const normalizeCommunicationProfile = (profile = {}, fallback = {}) => ({
  summary: ensureString(profile.summary, fallback.summary || ''),
  keyTraits: ensureArray(profile.keyTraits)
    .map((item, index) => normalizeCommunicationTrait(item, ensureArray(fallback.keyTraits)[index] || {}))
    .filter((item) => item.label && item.description),
  fillerWords: ensureString(profile.fillerWords, fallback.fillerWords || ''),
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
  communicationProfile: normalizeCommunicationProfile(candidateFeedback.communicationProfile, fallback.communicationProfile || {}),
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
  quoteAnalyses: ensureArray(candidateFeedback.quoteAnalyses)
    .map((item, index) => normalizeQuoteAnalysis(item, ensureArray(fallback.quoteAnalyses)[index] || {}))
    .filter((item) => item.quote && item.critique),
  turnBreakdowns: ensureArray(candidateFeedback.turnBreakdowns)
    .map((item, index) => normalizeTurnBreakdown(item, ensureArray(fallback.turnBreakdowns)[index] || {}))
    .filter((item) => item.question && item.feedback),
});

/**
 * Purpose: Execute the main responsibility for buildPrompt.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildPrompt = ({ session, analysisResult, interviewPlan, evidenceSummary: _evidenceSummary, interviewMetrics, strongestExamples, deterministicFeedback }) => {
  const groundingPayload = {
    candidateName: analysisResult.candidateName || session.candidateName || 'Candidate',
    jobTitle: analysisResult.jobTitle || session.targetRole || 'Target Role',
    overallScore: analysisResult.overallScore || 0,
    confidence: analysisResult.confidence || 0,
    decision: analysisResult.decision || {},
    strengths: (analysisResult.explanation?.strengths || []).map((item) => item.label),
    gaps: (analysisResult.explanation?.gaps || []).map((item) => item.label),
    interviewFocus: interviewPlan.interviewFocus || [],
    interviewMetrics,
    strongestExamples,
    transcript: session.transcript || [],
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
  "communicationProfile": {
    "summary": "string",
    "keyTraits": [
      { "label": "string", "description": "string" }
    ],
    "fillerWords": "string"
  },
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
  ],
  "quoteAnalyses": [
    { "quote": "string", "context": "string", "critique": "string", "rewrite": "string" }
  ],
  "turnBreakdowns": [
    { 
      "question": "string", 
      "answer": "string", 
      "feedback": "string", 
      "scores": { "business": 5, "logic": 5, "evidence": 5 } 
    }
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
- quoteAnalyses MUST extract exact, verbatim quotes from the candidate's transcript to show them exactly what they said, explain why it was weak/strong, and how to improve it. Include at least 2-3 quote analyses.
- communicationProfile MUST analyze their communication style, tone, conciseness, and use of filler words (if any) based on the transcript.
- turnBreakdowns MUST provide a turn-by-turn analysis of each major question asked. Summarize the question and answer, provide constructive feedback, and score (0-10) for business understanding, logic/structure, and evidence strength.
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
    const { content: responseText } = await callDeepSeek(prompt, 'You output valid JSON only. Stay grounded in the provided evidence and never invent facts.');

    const parsed = JSON.parse(extractJsonObject(responseText));
    return normalizeCandidateFeedback({ ...parsed, generationSource: 'ai' }, deterministicFeedback);
  } catch (error) {
    console.error('Failed to generate AI coaching, using deterministic candidate feedback:', error);
    return normalizeCandidateFeedback({ ...deterministicFeedback, generationSource: 'fallback' }, deterministicFeedback);
  }
};

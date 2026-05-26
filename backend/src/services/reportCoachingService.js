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
const TRUST_LABELS = new Set(['supported_by_cv', 'supported_by_jd', 'supported_by_answer', 'supported_by_nz_guide', 'needs_user_confirmation']);
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);
const FEEDBACK_STATUSES = new Set(['confirmed_feedback', 'downgraded_feedback', 'needs_confirmation', 'refused_claim']);

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
  displayValue: ensureString(item.displayValue, fallback.displayValue || ''),
  unit: ensureString(item.unit, fallback.unit || ''),
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

const buildDefaultTrust = ({ item = {}, fallback = {}, type = 'feedback', evidenceSummary = {} } = {}) => {
  const averageStrength = Number(evidenceSummary.averageStrength || 0);
  const directTurns = Number(evidenceSummary.totals?.direct_past_experience || 0);
  const weakEvidence = averageStrength < 2.2 || directTurns === 0;
  const inputLabel = item.evidenceLabel || fallback.evidenceLabel;
  const evidenceLabel = TRUST_LABELS.has(inputLabel)
    ? inputLabel
    : type === 'strength' && weakEvidence
      ? 'needs_user_confirmation'
      : type === 'nz'
        ? 'supported_by_nz_guide'
        : 'supported_by_answer';
  const inputConfidence = item.confidenceLevel || fallback.confidenceLevel;
  const confidenceLevel = CONFIDENCE_LEVELS.has(inputConfidence)
    ? inputConfidence
    : weakEvidence && type === 'strength'
      ? 'low'
      : averageStrength >= 2.8
        ? 'high'
        : 'medium';
  const inputStatus = item.feedbackStatus || fallback.feedbackStatus;
  const feedbackStatus = FEEDBACK_STATUSES.has(inputStatus)
    ? inputStatus
    : evidenceLabel === 'needs_user_confirmation'
      ? 'needs_confirmation'
      : confidenceLevel === 'low'
        ? 'downgraded_feedback'
        : 'confirmed_feedback';

  return {
    evidenceLabel,
    confidenceLevel,
    evidenceSources: ensureArray(item.evidenceSources || fallback.evidenceSources || ['interview_answer']).filter(Boolean),
    evidenceReason: ensureString(
      item.evidenceReason,
      fallback.evidenceReason || (weakEvidence
        ? 'The feedback is useful, but the captured evidence is not strong enough to treat it as a confirmed high-confidence claim.'
        : 'The feedback is grounded in the available interview evidence.'),
    ),
    needsUserConfirmation: Boolean(item.needsUserConfirmation ?? fallback.needsUserConfirmation ?? evidenceLabel === 'needs_user_confirmation'),
    feedbackStatus,
  };
};

const applyTrust = (item = {}, fallback = {}, context = {}) => ({
  ...item,
  ...buildDefaultTrust({ item, fallback, ...context }),
});

const normalizeScoreExplanations = (scoreExplanations = {}, fallback = {}) => {
  const normalizeOne = (key) => ({
    summary: ensureString(scoreExplanations[key]?.summary, fallback[key]?.summary || ''),
    helped: ensureString(scoreExplanations[key]?.helped, fallback[key]?.helped || ''),
    lowered: ensureString(scoreExplanations[key]?.lowered, fallback[key]?.lowered || ''),
    next: ensureString(scoreExplanations[key]?.next, fallback[key]?.next || ''),
  });

  return {
    overall: normalizeOne('overall'),
    cvJdMatch: normalizeOne('cvJdMatch'),
    interview: normalizeOne('interview'),
  };
};

const normalizeDimensionReasons = (item = {}, fallback = {}) => ({
  business: ensureString(item.business, fallback.business || ''),
  logic: ensureString(item.logic, fallback.logic || ''),
  evidence: ensureString(item.evidence, fallback.evidence || ''),
});

const normalizeStarBreakdown = (item = {}, fallback = {}) => {
  if (item === null || fallback === null) return null;
  const normalizePart = (value, fallbackValue = 'missing') => (['clear', 'partial', 'missing'].includes(value) ? value : fallbackValue);
  return {
    situation: normalizePart(item.situation, fallback.situation || 'partial'),
    task: normalizePart(item.task, fallback.task || 'partial'),
    action: normalizePart(item.action, fallback.action || 'partial'),
    result: normalizePart(item.result, fallback.result || 'missing'),
    mainMissingElement: ensureString(item.mainMissingElement, fallback.mainMissingElement || 'result'),
    scoreReason: ensureString(item.scoreReason, fallback.scoreReason || 'The answer needs clearer situation, task, action, and result evidence.'),
  };
};

const normalizeStructureBreakdown = (item = {}, fallback = {}) => {
  if (!item && !fallback) return null;
  return {
    ...(fallback || {}),
    ...(item || {}),
    mainMissingElement: ensureString(item?.mainMissingElement, fallback?.mainMissingElement || ''),
    scoreReason: ensureString(item?.scoreReason, fallback?.scoreReason || ''),
  };
};

const buildFallbackStarBreakdown = (turn = {}) => {
  const answer = ensureString(turn.answer);
  const lower = answer.toLowerCase();
  const tokenCount = answer.split(/\s+/).filter(Boolean).length;
  const hasOwnership = /\b(i|my|me)\b/.test(lower) && /\b(built|designed|implemented|led|owned|fixed|improved|handled|created|deployed|checked|tested|used)\b/.test(lower);
  const hasResult = /\d/.test(answer) || /\b(result|impact|improved|reduced|increased|saved|faster|outcome|metric|validated|tested)\b/.test(lower);
  const hasFriction = /\b(challenge|problem|issue|tradeoff|trade-off|deadline|conflict|risk|bug|difficulty)\b/.test(lower);
  return normalizeStarBreakdown({
    situation: tokenCount < 18 ? 'missing' : 'partial',
    task: hasFriction ? 'clear' : tokenCount < 18 ? 'missing' : 'partial',
    action: hasOwnership ? 'partial' : 'missing',
    result: hasResult ? 'partial' : 'missing',
    mainMissingElement: hasResult ? (hasOwnership ? 'validation_method' : 'action') : 'result',
    scoreReason: hasResult
      ? 'The answer includes some outcome evidence, but it can still sharpen ownership and validation detail.'
      : 'The answer includes some context, but it does not provide a measurable result or clear outcome.',
  });
};

const normalizeTurnBreakdown = (item = {}, fallback = {}, context = {}) => applyTrust({
  question: ensureString(item.question, fallback.question || ''),
  answer: ensureString(item.answer, fallback.answer || ''),
  feedback: ensureString(item.feedback, fallback.feedback || ''),
  questionType: ensureString(item.questionType, fallback.questionType || ''),
  questionStage: ensureString(item.questionStage, fallback.questionStage || ''),
  questionTopic: ensureString(item.questionTopic, fallback.questionTopic || ''),
  rubricType: ensureString(item.rubricType, fallback.rubricType || 'star'),
  starApplicable: item.starApplicable ?? fallback.starApplicable ?? true,
  structureLabel: ensureString(item.structureLabel, fallback.structureLabel || ((item.starApplicable ?? fallback.starApplicable) === false ? 'Answer structure' : 'STAR evidence')),
  structureBreakdown: normalizeStructureBreakdown(item.structureBreakdown || item.starBreakdown, fallback.structureBreakdown || fallback.starBreakdown),
  scores: {
    business: Number.isFinite(Number(item.scores?.business)) ? Number(item.scores.business) : Number(fallback.scores?.business || 0),
    logic: Number.isFinite(Number(item.scores?.logic)) ? Number(item.scores.logic) : Number(fallback.scores?.logic || 0),
    evidence: Number.isFinite(Number(item.scores?.evidence)) ? Number(item.scores.evidence) : Number(fallback.scores?.evidence || 0),
  },
  dimensionReasons: normalizeDimensionReasons(item.dimensionReasons || item.scoreReasons, fallback.dimensionReasons || fallback.scoreReasons || {}),
  starBreakdown: (item.starApplicable ?? fallback.starApplicable) === false
    ? null
    : normalizeStarBreakdown(item.starBreakdown || {}, fallback.starBreakdown || buildFallbackStarBreakdown(item)),
}, fallback, { ...context, type: 'turn' });

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
const normalizeCandidateFeedback = (candidateFeedback = {}, fallback = {}, context = {}) => ({
  overallTakeaway: ensureString(candidateFeedback.overallTakeaway, fallback.overallTakeaway || ''),
  scoreBand: ensureString(candidateFeedback.scoreBand, fallback.scoreBand || ''),
  generationSource: ensureString(candidateFeedback.generationSource, fallback.generationSource || 'fallback'),
  scoreExplanations: normalizeScoreExplanations(candidateFeedback.scoreExplanations, fallback.scoreExplanations || {}),
  communicationProfile: normalizeCommunicationProfile(candidateFeedback.communicationProfile, fallback.communicationProfile || {}),
  plainEnglishMetrics: ensureArray(candidateFeedback.plainEnglishMetrics)
    .map((item, index) => applyTrust(normalizeMetric(item, ensureArray(fallback.plainEnglishMetrics)[index] || {}), ensureArray(fallback.plainEnglishMetrics)[index] || {}, { ...context, type: 'metric' }))
    .filter((item) => item.label && item.interpretation),
  strengthHighlights: ensureArray(candidateFeedback.strengthHighlights)
    .map((item, index) => applyTrust(normalizeStrength(item, ensureArray(fallback.strengthHighlights)[index] || {}), ensureArray(fallback.strengthHighlights)[index] || {}, { ...context, type: 'strength' }))
    .filter((item) => item.title && item.explanation),
  improvementPriorities: ensureArray(candidateFeedback.improvementPriorities)
    .map((item, index) => applyTrust(normalizePriority(item, ensureArray(fallback.improvementPriorities)[index] || {}), ensureArray(fallback.improvementPriorities)[index] || {}, { ...context, type: 'improvement' }))
    .filter((item) => item.title && item.whyItMatters && item.action),
  coachingAdvice: ensureArray(candidateFeedback.coachingAdvice)
    .map((item, index) => applyTrust(normalizeAdvice(item, ensureArray(fallback.coachingAdvice)[index] || {}), ensureArray(fallback.coachingAdvice)[index] || {}, { ...context, type: 'coaching' }))
    .filter((item) => item.theme && item.advice && item.example),
  answerRewriteExamples: ensureArray(candidateFeedback.answerRewriteExamples)
    .map((item, index) => normalizeRewrite(item, ensureArray(fallback.answerRewriteExamples)[index] || {}))
    .filter((item) => item.weak && item.better),
  quoteAnalyses: ensureArray(candidateFeedback.quoteAnalyses)
    .map((item, index) => normalizeQuoteAnalysis(item, ensureArray(fallback.quoteAnalyses)[index] || {}))
    .filter((item) => item.quote && item.critique),
  turnBreakdowns: ensureArray(candidateFeedback.turnBreakdowns)
    .map((item, index) => normalizeTurnBreakdown(item, ensureArray(fallback.turnBreakdowns)[index] || {}, context))
    .filter((item) => item.question && item.feedback),
});

/**
 * Purpose: Execute the main responsibility for buildPrompt.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildPrompt = ({ session, analysisResult, interviewPlan, evidenceSummary, interviewMetrics, strongestExamples, deterministicFeedback, nzWorkplaceFit = {} }) => {
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
    evidenceSummary,
    strongestExamples,
    nzWorkplaceFit,
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
    { "id": "string", "label": "string", "value": number, "displayValue": "string", "unit": "string", "interpretation": "string" }
  ],
  "scoreExplanations": {
    "overall": { "summary": "string", "helped": "string", "lowered": "string", "next": "string" },
    "cvJdMatch": { "summary": "string", "helped": "string", "lowered": "string", "next": "string" },
    "interview": { "summary": "string", "helped": "string", "lowered": "string", "next": "string" }
  },
  "communicationProfile": {
    "summary": "string",
    "keyTraits": [
      { "label": "string", "description": "string" }
    ],
    "fillerWords": "string"
  },
  "strengthHighlights": [
    { "title": "string", "explanation": "string", "evidenceLabel": "supported_by_cv | supported_by_jd | supported_by_answer | supported_by_nz_guide | needs_user_confirmation", "confidenceLevel": "high | medium | low", "evidenceSources": ["cv", "jd", "interview_answer", "nz_guide", "star_rubric"], "evidenceReason": "string", "needsUserConfirmation": false, "feedbackStatus": "confirmed_feedback | downgraded_feedback | needs_confirmation | refused_claim" }
  ],
  "improvementPriorities": [
    { "title": "string", "whyItMatters": "string", "action": "string", "evidenceLabel": "supported_by_answer", "confidenceLevel": "medium", "evidenceSources": ["interview_answer"], "evidenceReason": "string", "needsUserConfirmation": false, "feedbackStatus": "confirmed_feedback | downgraded_feedback | needs_confirmation | refused_claim" }
  ],
  "coachingAdvice": [
    { "theme": "string", "advice": "string", "example": "string", "evidenceLabel": "supported_by_answer", "confidenceLevel": "medium", "evidenceSources": ["interview_answer", "star_rubric"], "evidenceReason": "string", "needsUserConfirmation": false, "feedbackStatus": "confirmed_feedback | downgraded_feedback | needs_confirmation | refused_claim" }
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
      "rubricType": "self_intro | company_motivation | star | conversation",
      "starApplicable": true,
      "structureLabel": "string",
      "structureBreakdown": { "mainMissingElement": "string", "scoreReason": "string" },
      "scores": { "business": 5, "logic": 5, "evidence": 5 },
      "dimensionReasons": { "business": "string", "logic": "string", "evidence": "string" },
      "starBreakdown": { "situation": "clear | partial | missing", "task": "clear | partial | missing", "action": "clear | partial | missing", "result": "clear | partial | missing", "mainMissingElement": "string", "scoreReason": "string" },
      "evidenceLabel": "supported_by_answer | needs_user_confirmation",
      "confidenceLevel": "high | medium | low",
      "evidenceSources": ["interview_answer", "star_rubric"],
      "evidenceReason": "string",
      "needsUserConfirmation": false,
      "feedbackStatus": "confirmed_feedback | downgraded_feedback | needs_confirmation | refused_claim"
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
- If nzWorkplaceFit.enabled is true, coachingAdvice and communicationProfile should include NZ workplace communication guidance grounded in nzWorkplaceFit. Focus on observable behaviours such as teamwork, humility with confidence, initiative, open communication, respect, relationship-building, and sustainable delivery. Do not claim the candidate culturally "fits" New Zealand; discuss interview communication behaviours only.
- scoreExplanations MUST explain Overall, CV-JD Match, and Interview scores with one short summary, one helped factor, one lowered factor, and one next lever.
- turnBreakdowns MUST provide a turn-by-turn analysis of each major question asked. Summarize the question and answer, provide constructive feedback, score (0-10) for business understanding, logic/structure, and evidence strength, and explain each micro-score in dimensionReasons.
- Every strength, improvement priority, coaching advice, and turn breakdown MUST include evidenceLabel, confidenceLevel, evidenceSources, evidenceReason, needsUserConfirmation, and feedbackStatus.
- Do not mark unsupported or weakly supported skill claims as high-confidence strengths. Use needs_user_confirmation or downgraded_feedback when evidence is thin.
- Use STAR only for behavioural, project, technical example, decision, or past-experience answers.
- Do NOT apply STAR to self-introduction, company motivation, candidate questions, or other conversational turns. For those turns set starApplicable=false, starBreakdown=null, and use structureBreakdown for the relevant structure instead.
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
  nzWorkplaceFit = {},
} = {}) => {
  const prompt = buildPrompt({
    session,
    analysisResult,
    interviewPlan,
    evidenceSummary,
    interviewMetrics,
    strongestExamples,
    deterministicFeedback,
    nzWorkplaceFit,
  });

  try {
    const { content: responseText } = await callDeepSeek(prompt, 'You output valid JSON only. Stay grounded in the provided evidence and never invent facts.', {
      usageMetadata: { stage: 'report_generated', operation: 'llm_chat', feature: 'candidate_feedback' },
    });

    const parsed = JSON.parse(extractJsonObject(responseText));
    return normalizeCandidateFeedback({ ...parsed, generationSource: 'ai' }, deterministicFeedback, { evidenceSummary });
  } catch (error) {
    console.error('Failed to generate AI coaching, using deterministic candidate feedback:', error);
    return normalizeCandidateFeedback({ ...deterministicFeedback, generationSource: 'fallback' }, deterministicFeedback, { evidenceSummary });
  }
};

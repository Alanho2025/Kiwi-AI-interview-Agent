import { buildMatchAnalysis, buildNormalizedCvProfile, buildNormalizedJdRubric } from './sessionStateService.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim();
const truncateText = (value = '', maxLength = 240) => {
  const text = normalizeText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
};
const take = (value, limit) => ensureArray(value).filter(Boolean).slice(0, limit);

const compactTextArray = (value, limit = 5, maxLength = 180) => take(value, limit)
  .map((item) => (typeof item === 'string' ? truncateText(item, maxLength) : item));

const compactObjectArray = (value, limit = 5, maxLength = 220) => take(value, limit).map((item) => {
  if (!item || typeof item !== 'object') return truncateText(item, maxLength);
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
      .map(([key, entryValue]) => [
        key,
        typeof entryValue === 'string' ? truncateText(entryValue, maxLength) : entryValue,
      ])
  );
});

const getLatestUserTurn = (session = {}) => [...ensureArray(session.transcript)].reverse()
  .find((turn) => turn.role === 'user') || null;

export const isCompactVoiceContext = ({ session = {}, payload = {} } = {}) => {
  const inputMode = normalizeText(payload.inputMode || getLatestUserTurn(session)?.metadata?.inputMode || session.mode).toLowerCase();
  return inputMode.includes('voice') || inputMode.includes('duplex') || inputMode.includes('realtime');
};

export const buildCompactRetrievalBundle = (retrievalBundle = null) => {
  if (!retrievalBundle) return null;
  return {
    ...retrievalBundle,
    items: ensureArray(retrievalBundle.items).slice(0, 2).map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      text: truncateText(item.text, 240),
      metadata: {
        topic: item.metadata?.topic || null,
        category: item.metadata?.category || null,
        skillTags: take(item.metadata?.skillTags, 4),
        question: truncateText(item.metadata?.question || '', 180),
      },
      scores: item.scores || {},
    })),
    evidenceSummary: compactTextArray(retrievalBundle.evidenceSummary, 2, 120),
    compactContext: true,
  };
};

const collectRecentTranscriptSupport = (transcript = []) => ensureArray(transcript)
  .filter((turn) => turn.role === 'user' && normalizeText(turn.text))
  .slice(-3)
  .map((turn) => ({
    role: turn.role,
    text: truncateText(turn.text, 220),
    timestamp: turn.timestamp,
    topic: turn.metadata?.topic || null,
    stage: turn.metadata?.stage || null,
  }));

export const buildCompactEvidenceBundle = ({ session = {}, retrievalBundle = null } = {}) => {
  const normalizedJdRubric = buildNormalizedJdRubric(session);
  const normalizedCvProfile = buildNormalizedCvProfile(session);
  const matchAnalysis = buildMatchAnalysis(session);
  const questionPlanHints = matchAnalysis.questionPlanHints || {};

  const compactJdRubric = {
    targetRole: session.targetRole || normalizedJdRubric.targetRole || normalizedJdRubric.title || null,
    requiredSkills: compactTextArray(normalizedJdRubric.requiredSkills, 6, 120),
    requiredCapabilities: compactTextArray(normalizedJdRubric.requiredCapabilities, 5, 140),
    behaviouralSignals: compactTextArray(normalizedJdRubric.behaviouralSignals, 5, 160),
    sourceMeta: normalizedJdRubric.sourceMeta || {},
  };

  const compactCvProfile = {
    candidateName: normalizedCvProfile.candidateName || null,
    candidateIntro: truncateText(normalizedCvProfile.candidateIntro || normalizedCvProfile.summary || '', 240),
    careerDirection: truncateText(normalizedCvProfile.careerDirection || '', 180),
    skills: compactTextArray(normalizedCvProfile.skills, 8, 80),
    projects: compactObjectArray(normalizedCvProfile.projects, 3, 180),
    strongestEvidence: compactObjectArray(normalizedCvProfile.strongestEvidence, 4, 200),
    jdRelevantEvidence: compactObjectArray(normalizedCvProfile.jdRelevantEvidence, 4, 200),
    suggestedInterviewHooks: compactObjectArray(normalizedCvProfile.suggestedInterviewHooks, 5, 200),
    weakOrMissingEvidence: compactObjectArray(normalizedCvProfile.weakOrMissingEvidence, 5, 200),
    sourceMeta: normalizedCvProfile.sourceMeta || {},
  };

  const compactMatchAnalysis = {
    matchedStrengths: compactObjectArray(matchAnalysis.matchedStrengths, 5, 200),
    missingRequiredSkills: compactTextArray(matchAnalysis.missingRequiredSkills, 5, 120),
    missingPreferredSkills: compactTextArray(matchAnalysis.missingPreferredSkills, 4, 120),
    capabilityGaps: compactTextArray(matchAnalysis.capabilityGaps, 5, 140),
    riskyClaims: compactObjectArray(matchAnalysis.riskyClaims, 4, 200),
    validationTargets: compactTextArray(matchAnalysis.validationTargets, 5, 120),
    questionPlanHints: {
      roleCanonical: questionPlanHints.roleCanonical || '',
      priorityTopics: compactTextArray(questionPlanHints.priorityTopics, 6, 100),
      nzCultureQuestions: compactObjectArray(questionPlanHints.nzCultureQuestions, 3, 180),
    },
  };

  return {
    normalizedJdRubric: compactJdRubric,
    normalizedCvProfile: compactCvProfile,
    matchAnalysis: compactMatchAnalysis,
    hardRequirements: compactTextArray([
      ...ensureArray(compactJdRubric.requiredSkills),
      ...ensureArray(compactJdRubric.requiredCapabilities),
    ], 8, 120),
    matchedEvidence: ensureArray(compactMatchAnalysis.matchedStrengths),
    missingEvidence: compactTextArray([
      ...ensureArray(compactMatchAnalysis.missingRequiredSkills),
      ...ensureArray(compactMatchAnalysis.capabilityGaps),
    ], 7, 140),
    riskyClaims: ensureArray(compactMatchAnalysis.riskyClaims),
    behaviouralSignals: ensureArray(compactJdRubric.behaviouralSignals),
    validationTargets: ensureArray(compactMatchAnalysis.validationTargets),
    transcriptSupport: collectRecentTranscriptSupport(session.transcript || []),
    retrievalSupport: ensureArray(retrievalBundle?.items).map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      text: truncateText(item.text, 240),
      metadata: item.metadata || {},
      scores: item.scores || {},
    })),
    sourceAttribution: {
      jd: compactJdRubric.sourceMeta || {},
      cv: compactCvProfile.sourceMeta || {},
      retrieval: {
        objective: retrievalBundle?.objective || null,
        sourceQuality: retrievalBundle?.sourceQuality || 'unknown',
        correctiveRetryUsed: Boolean(retrievalBundle?.correctiveRetryUsed),
      },
    },
    compactContext: true,
  };
};

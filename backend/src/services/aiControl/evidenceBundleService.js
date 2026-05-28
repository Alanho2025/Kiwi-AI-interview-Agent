import { buildMatchAnalysis, buildNormalizedCvProfile, buildNormalizedJdRubric } from './sessionStateService.js';
import { ensureArray } from '../../utils/commonHelpers.js';

const collectTranscriptSupport = (transcript = []) => transcript
  .filter((turn) => turn.role === 'user' && String(turn.text || '').trim())
  .map((turn) => ({
    role: turn.role,
    text: turn.text,
    timestamp: turn.timestamp,
    topic: turn.metadata?.topic || null,
    stage: turn.metadata?.stage || null,
  }));

export const buildEvidenceBundle = ({ session = {}, retrievalBundle = null } = {}) => {
  const normalizedJdRubric = buildNormalizedJdRubric(session);
  const normalizedCvProfile = buildNormalizedCvProfile(session);
  const matchAnalysis = buildMatchAnalysis(session);
  const transcriptSupport = collectTranscriptSupport(session.transcript || []);

  return {
    normalizedJdRubric,
    normalizedCvProfile,
    matchAnalysis,
    hardRequirements: ensureArray(normalizedJdRubric.requiredSkills)
      .concat(ensureArray(normalizedJdRubric.requiredCapabilities)),
    matchedEvidence: ensureArray(matchAnalysis.matchedStrengths),
    missingEvidence: ensureArray(matchAnalysis.missingRequiredSkills)
      .concat(ensureArray(matchAnalysis.capabilityGaps)),
    riskyClaims: ensureArray(matchAnalysis.riskyClaims),
    behaviouralSignals: ensureArray(normalizedJdRubric.behaviouralSignals),
    validationTargets: ensureArray(matchAnalysis.validationTargets),
    transcriptSupport,
    retrievalSupport: ensureArray(retrievalBundle?.items).map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      text: item.text,
      metadata: item.metadata || {},
      scores: item.scores || {},
    })),
    sourceAttribution: {
      jd: normalizedJdRubric.sourceMeta || {},
      cv: normalizedCvProfile.sourceMeta || {},
      retrieval: {
        objective: retrievalBundle?.objective || null,
        sourceQuality: retrievalBundle?.sourceQuality || 'unknown',
        correctiveRetryUsed: Boolean(retrievalBundle?.correctiveRetryUsed),
      },
    },
  };
};

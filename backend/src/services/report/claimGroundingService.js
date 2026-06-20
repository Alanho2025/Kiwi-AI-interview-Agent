import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';

const collectStrings = (value, depth = 0) => {
  if (depth > 4 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (typeof value === 'object') return Object.values(value).flatMap((item) => collectStrings(item, depth + 1));
  return [];
};

const buildCorpus = ({ analysisResult = {}, session = {}, transcript = [] } = {}) => ({
  cv: collectStrings(analysisResult.parsedCvProfile || session.cvProfile || session.analysisResult?.parsedCvProfile).join(' '),
  jd: collectStrings(analysisResult.parsedJdProfile || session.analysisResult?.parsedJdProfile).join(' '),
  transcript: ensureArray(transcript).filter((turn) => turn.role === 'user').map((turn) => turn.text).join(' '),
  nz_guide: collectStrings(session.nzWorkplaceFit || session.settings?.nzWorkplaceFit).join(' '),
});

const hasAsrQualityRisk = (transcript = [], session = {}) => {
  const mode = String(session.mode || session.interviewMode || session.settings?.mode || session.settings?.interviewMode || '').toLowerCase();
  const voiceTurnRisk = ensureArray(transcript).some((turn) => {
    const delivery = turn.metadata?.voiceDelivery || {};
    return delivery.deliveryConfidence === 'low' || Number(delivery.totalUnclearSpeechSegments || delivery.unclearSpeechSegments || 0) > 0;
  });
  return mode.includes('voice') || voiceTurnRisk;
};

const overlapScore = (claimText = '', sourceText = '') => {
  const claimTokens = [...new Set(tokenize(claimText))];
  if (!claimTokens.length) return 0;
  const sourceTokens = new Set(tokenize(sourceText));
  return Number((claimTokens.filter((token) => sourceTokens.has(token)).length / claimTokens.length).toFixed(2));
};

const extractSnippet = (claimText = '', sourceText = '') => {
  if (!sourceText) return '';
  const tokens = [...new Set(tokenize(claimText))].filter(t => t.length > 3);
  let bestIdx = -1;
  for (const t of tokens) {
    const idx = sourceText.toLowerCase().indexOf(t);
    if (idx !== -1) {
      bestIdx = idx;
      break;
    }
  }
  if (bestIdx === -1) bestIdx = 0;
  const start = Math.max(0, bestIdx - 30);
  const end = Math.min(sourceText.length, bestIdx + 90);
  let snippet = sourceText.substring(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < sourceText.length) snippet = snippet + '...';
  return snippet;
};

const claimTextForItem = (item = {}) => normalizeText(
  item.title
  || item.label
  || item.theme
  || item.explanation
  || item.whyItMatters
  || item.action
  || item.advice
  || item.feedback
  || item.interpretation
);

const statusFromScores = ({ scores = {}, claimKind = 'feedback' } = {}) => {
  const supportedByAnswer = scores.transcript >= 0.18;
  const supportedByCv = scores.cv >= 0.18;
  const supportedByJd = scores.jd >= 0.18;
  const supportedByNzGuide = scores.nz_guide >= 0.18;
  const supported = supportedByAnswer || supportedByCv || supportedByJd || supportedByNzGuide;
  const confidenceLevel = !supported
    ? 'low'
    : (supportedByAnswer && (supportedByCv || supportedByJd || supportedByNzGuide))
      ? 'high'
      : 'medium';
  const feedbackStatus = !supported
    ? claimKind === 'strength' ? 'needs_confirmation' : 'downgraded_feedback'
    : confidenceLevel === 'high' ? 'confirmed_feedback' : 'downgraded_feedback';
  const evidenceLabel = supportedByAnswer
    ? 'supported_by_answer'
    : supportedByCv
      ? 'supported_by_cv'
      : supportedByJd
        ? 'supported_by_jd'
        : supportedByNzGuide
          ? 'supported_by_nz_guide'
          : 'needs_user_confirmation';

  return {
    supported,
    confidenceLevel,
    feedbackStatus,
    evidenceLabel,
    needsUserConfirmation: !supported,
  };
};

const evidenceSourcesForStatus = ({ sources = [], status = {}, item = {} } = {}) => {
  if (sources.length) return sources;
  if (status.needsUserConfirmation) return ['needs_user_confirmation'];
  return ensureArray(item.evidenceSources);
};

const groundItem = ({ item = {}, claimKind = 'feedback', index = 0, corpus = {}, retrievalItems = [], asrQualityRisk = false } = {}) => {
  const claimText = claimTextForItem(item);
  const scores = {
    cv: overlapScore(claimText, corpus.cv),
    jd: overlapScore(claimText, corpus.jd),
    transcript: overlapScore(claimText, corpus.transcript),
    nz_guide: overlapScore(claimText, corpus.nz_guide),
  };
  const status = statusFromScores({ scores, claimKind });
  const isTurnBreakdown = claimKind === 'turn_breakdown';
  const usesRoleFramework = isTurnBreakdown && item.rubricType === 'role_specific';
  const usesStarFramework = isTurnBreakdown
    && item.starApplicable !== false
    && (item.frameworkKey === 'behavioural_starr' || ['star', 'starr'].includes(item.rubricType));
  const sources = [
    scores.cv >= 0.18 ? 'cv' : null,
    scores.jd >= 0.18 ? 'jd' : null,
    scores.transcript >= 0.18 ? 'interview_answer' : null,
    scores.nz_guide >= 0.18 ? 'nz_guide' : null,
    usesStarFramework ? 'star_rubric' : null,
    usesRoleFramework ? 'role_framework' : null,
  ].filter(Boolean);
  const retrieval = retrievalItems[index % Math.max(1, retrievalItems.length)] || {};
  const confidenceLevel = asrQualityRisk && status.confidenceLevel === 'high' ? 'medium' : status.confidenceLevel;
  const evidenceReason = status.supported
    ? `Grounding overlap: CV ${scores.cv}, JD ${scores.jd}, transcript ${scores.transcript}, NZ guide ${scores.nz_guide}.${asrQualityRisk ? ' Voice transcript quality may limit confidence.' : ''}`
    : `This claim is relevant but not strongly supported by CV, JD, interview answer, or NZ guide evidence.${asrQualityRisk ? ' Voice transcript quality may also limit confidence.' : ''}`;
  const evidenceSnippets = [
    scores.cv >= 0.18 ? { sourceType: 'cv', text: extractSnippet(claimText, corpus.cv), similarity: scores.cv } : null,
    scores.jd >= 0.18 ? { sourceType: 'jd', text: extractSnippet(claimText, corpus.jd), similarity: scores.jd } : null,
    scores.transcript >= 0.18 ? { sourceType: 'interview_answer', text: extractSnippet(claimText, corpus.transcript), similarity: scores.transcript } : null,
    scores.nz_guide >= 0.18 ? { sourceType: 'nz_guide', text: extractSnippet(claimText, corpus.nz_guide), similarity: scores.nz_guide } : null,
  ].filter(Boolean);

  const grounded = {
    ...item,
    evidenceLabel: status.evidenceLabel,
    confidenceLevel,
    evidenceSources: evidenceSourcesForStatus({ sources, status, item }),
    evidenceReason,
    evidenceSnippets,
    needsUserConfirmation: status.needsUserConfirmation,
    feedbackStatus: status.feedbackStatus,
  };
  const claimReference = {
    claimId: `claim_${String(index + 1).padStart(3, '0')}`,
    claimText,
    sourceType: retrieval.sourceType || (sources[0] === 'cv' ? 'cv' : sources[0] === 'jd' ? 'jd' : sources[0] === 'nz_guide' ? 'nz_guide' : sources[0] === 'interview_answer' ? 'transcript' : 'needs_user_confirmation'),
    sourceId: retrieval.sourceId || '',
    chunkId: retrieval.chunkId || '',
    similarity: Math.max(scores.cv, scores.jd, scores.transcript, scores.nz_guide),
    retrievalMethod: retrieval.retrievalMethod || 'hybrid',
    usedInOutput: true,
    claimSupported: status.supported,
    degraded: !status.supported || status.confidenceLevel === 'low',
    degradedReason: status.supported ? '' : grounded.evidenceReason,
    feedbackStatus: grounded.feedbackStatus,
    evidenceLabel: grounded.evidenceLabel,
    confidenceLevel: grounded.confidenceLevel,
    evidenceSources: grounded.evidenceSources,
    evidenceSnippets: grounded.evidenceSnippets,
    claimKind,
    rubricSource: usesRoleFramework ? 'role_framework' : usesStarFramework ? 'star_rubric' : '',
  };
  return { grounded, claimReference };
};

const mapItems = ({ items = [], claimKind, startIndex, corpus, retrievalItems, asrQualityRisk }) => {
  const references = [];
  const grounded = ensureArray(items).map((item, localIndex) => {
    const result = groundItem({ item, claimKind, index: startIndex + localIndex, corpus, retrievalItems, asrQualityRisk });
    references.push(result.claimReference);
    return result.grounded;
  });
  return { grounded, references };
};

export const groundCandidateFeedbackClaims = ({ candidateFeedback = {}, session = {}, analysisResult = {}, retrievalBundle = null } = {}) => {
  const transcript = session.transcript || [];
  const corpus = buildCorpus({ analysisResult, session, transcript });
  const retrievalItems = ensureArray(retrievalBundle?.items);
  const asrQualityRisk = hasAsrQualityRisk(transcript, session);
  let cursor = 0;
  const allReferences = [];
  const apply = (key, claimKind) => {
    const result = mapItems({ items: candidateFeedback[key], claimKind, startIndex: cursor, corpus, retrievalItems, asrQualityRisk });
    cursor += ensureArray(candidateFeedback[key]).length;
    allReferences.push(...result.references);
    return result.grounded;
  };

  return {
    candidateFeedback: {
      ...candidateFeedback,
      strengthHighlights: apply('strengthHighlights', 'strength'),
      improvementPriorities: apply('improvementPriorities', 'improvement'),
      coachingAdvice: apply('coachingAdvice', 'coaching'),
      turnBreakdowns: apply('turnBreakdowns', 'turn_breakdown'),
    },
    claimEvidenceReferences: allReferences,
    claimEvidenceDiagnostics: {
      totalClaims: allReferences.length,
      downgradedClaims: allReferences.filter((item) => item.degraded).length,
      needsConfirmationClaims: allReferences.filter((item) => item.feedbackStatus === 'needs_confirmation').length,
      refusedClaims: allReferences.filter((item) => item.feedbackStatus === 'refused_claim').length,
    },
  };
};

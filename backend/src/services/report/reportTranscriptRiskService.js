import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';

const turnId = (turn = {}, index = 0) => turn.questionId
  || turn.metadata?.answeredQuestionId
  || turn.metadata?.questionId
  || `turn-${index + 1}`;

const turnEvidence = (turn = {}, index = 0) => ({
  turnId: turnId(turn, index),
  rawSnippet: normalizeText(turn.metadata?.rawTranscriptText || turn.text).slice(0, 220),
  normalizedSnippet: normalizeText(turn.metadata?.normalizedTranscriptText || turn.text).slice(0, 220),
});

const normalizeName = (value = '') => normalizeText(value).toLowerCase().replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ');

const detectNameRisk = ({ candidateTurns, session }) => {
  const expectedName = normalizeName(session.candidateName || session.analysisResult?.candidateName);
  if (!expectedName) return null;
  const match = candidateTurns
    .map((turn, index) => ({ turn, index, match: normalizeText(turn.text).match(/\bmy name is\s+([a-z][a-z '-]{1,50})/i) }))
    .find((item) => item.match);
  if (!match) return null;
  const spokenName = normalizeName(match.match[1].split(/\b(?:and|i am|i'm)\b/i)[0]);
  if (!spokenName || spokenName === expectedName || spokenName.includes(expectedName) || expectedName.includes(spokenName)) return null;
  const evidence = turnEvidence(match.turn, match.index);
  return {
    code: 'candidate_name_mismatch',
    message: 'The self-introduced name differs from the session candidate name.',
    affectedTurnIds: [evidence.turnId],
    evidence: [evidence],
    needsUserConfirmation: true,
  };
};

const metricClaims = (candidateTurns = []) => candidateTurns.flatMap((turn, index) => (
  [...normalizeText(turn.text).matchAll(/\bfrom\s+(\d+(?:\.\d+)?)\s*(%|percent)(?!\w)\s+to\s+(\d+(?:\.\d+)?)\s*(%|percent)(?!\w)/gi)]
    .map((match) => ({
      from: Number(match[1]),
      to: Number(match[3]),
      unit: '%',
      turn,
      index,
    }))
));

const detectMetricRisks = (candidateTurns = []) => {
  const claims = metricClaims(candidateTurns);
  const risks = [];
  for (let left = 0; left < claims.length; left += 1) {
    for (let right = left + 1; right < claims.length; right += 1) {
      const first = claims[left];
      const second = claims[right];
      if (first.to !== second.to || first.from === second.from) continue;
      const evidence = [turnEvidence(first.turn, first.index), turnEvidence(second.turn, second.index)];
      risks.push({
        code: 'conflicting_metric_values',
        message: `The transcript contains conflicting values (${first.from}% to ${first.to}% and ${second.from}% to ${second.to}%).`,
        affectedTurnIds: evidence.map((item) => item.turnId),
        evidence,
        needsUserConfirmation: true,
      });
    }
  }
  return risks;
};

const detectLowConfidenceEntityRisks = (candidateTurns = []) => candidateTurns.flatMap((turn, index) => {
  const confidence = Number(turn.metadata?.asrConfidence);
  const partialFallback = Boolean(turn.metadata?.vad?.usedPartialFallback);
  const hasHighValueEntity = /\b(?:\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|units?)|[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)\b/.test(normalizeText(turn.text));
  if (!hasHighValueEntity || (!partialFallback && (!Number.isFinite(confidence) || confidence >= 0.6))) return [];
  const evidence = turnEvidence(turn, index);
  return [{
    code: partialFallback ? 'partial_asr_fallback_high_value_entity' : 'low_confidence_high_value_entity',
    message: 'A high-value name or metric came from lower-confidence speech recognition.',
    affectedTurnIds: [evidence.turnId],
    evidence: [evidence],
    needsUserConfirmation: true,
  }];
});

export const detectReportTranscriptRisks = ({ transcript = [], session = {} } = {}) => {
  const candidateTurns = ensureArray(transcript).filter((turn) => turn.role === 'user');
  return [
    detectNameRisk({ candidateTurns, session }),
    ...detectMetricRisks(candidateTurns),
    ...detectLowConfidenceEntityRisks(candidateTurns),
  ].filter(Boolean);
};

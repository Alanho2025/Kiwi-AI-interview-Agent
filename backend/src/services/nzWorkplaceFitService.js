/**
 * File responsibility: Deterministic New Zealand workplace communication coaching.
 * Main responsibilities:
 * - Score transcript evidence against observable NZ workplace interview behaviours.
 * - Keep cultural coaching focused on communication behaviours, not identity.
 * - Produce grounded strengths, gaps, and rewrite guidance for reports.
 */

import { findValueById } from '../data/nzWorkplaceCultureKB.js';
import { DIMENSIONS } from '../config/nzWorkplaceDimensions.js';
import {
  candidateTurns,
  splitSentences,
  tokenize,
  clampScore,
  buildDimensionScore,
  buildSummary,
  pickSuggestedRewrite,
} from '../utils/nzWorkplaceHelpers.js';

export const buildNzWorkplaceFit = ({ session = {}, transcript = null } = {}) => {
  const enabled = Boolean(session?.settings?.enableNZCultureFit);
  if (!enabled) {
    return {
      enabled: false,
      score: null,
      summary: 'NZ workplace communication coaching was not enabled for this session.',
      dimensionScores: [],
      strengths: [],
      gaps: [],
      evidence: [],
      suggestedRewrite: null,
    };
  }

  const turns = candidateTurns(transcript || session.transcript || []);
  const sentences = splitSentences(turns);
  const transcriptText = turns.join(' ');
  const tokenCount = tokenize(transcriptText).length;

  if (tokenCount < 8) {
    return {
      enabled: true,
      score: 0,
      summary: 'There was not enough candidate transcript evidence to assess NZ workplace communication fit.',
      dimensionScores: DIMENSIONS.map((dimension) => ({
        id: dimension.id,
        label: dimension.label,
        score: 0,
        observed: false,
        riskDetected: false,
        evidenceQuote: '',
        riskQuote: '',
        feedback: dimension.gapText,
      })),
      strengths: [],
      gaps: ['Give at least one specific example with context, action, collaboration, and result.'],
      evidence: [],
      suggestedRewrite: null,
    };
  }

  const dimensionScores = DIMENSIONS.map((dimension) => buildDimensionScore({ dimension, transcriptText, sentences, findValueById }));
  const observedScores = dimensionScores.filter((item) => item.observed || item.riskDetected);
  const denominator = observedScores.length || dimensionScores.length;
  const score = clampScore((observedScores.length ? observedScores : dimensionScores).reduce((sum, item) => sum + item.score, 0) / denominator);
  const strengths = dimensionScores
    .filter((item) => item.observed && !item.riskDetected && item.score >= 6)
    .slice(0, 4)
    .map((item) => item.feedback);
  const gaps = dimensionScores
    .filter((item) => item.riskDetected || (!item.observed && ['teamwork', 'humility_confidence', 'open_communication'].includes(item.id)))
    .slice(0, 4)
    .map((item) => item.feedback);
  const evidence = dimensionScores
    .filter((item) => item.evidenceQuote || item.riskQuote)
    .slice(0, 6)
    .map((item) => ({
      dimension: item.label,
      quote: item.riskQuote || item.evidenceQuote,
      signal: item.riskDetected ? 'risk' : 'strength',
    }));

  return {
    enabled: true,
    score,
    summary: buildSummary({ score, strengths, gaps }),
    dimensionScores,
    strengths,
    gaps,
    evidence,
    suggestedRewrite: pickSuggestedRewrite({ sentences, dimensionScores }),
  };
};

export default buildNzWorkplaceFit;

// Made with Bob

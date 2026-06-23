import { ensureArray } from '../../utils/commonHelpers.js';

export const computeInterviewPerformanceScore = (evidenceSummary = {}, candidateFeedback = {}) => {
  const frameworkScores = ensureArray(candidateFeedback.turnBreakdowns)
    .filter((turn) => turn.rubricType !== 'conversation' && turn.questionFamily !== 'conversation')
    .map((turn) => Number(turn.frameworkBreakdown?.normalizedScore))
    .filter(Number.isFinite);

  if (frameworkScores.length) {
    const average = frameworkScores.reduce((sum, score) => sum + score, 0) / frameworkScores.length;
    return Math.round(Math.min(100, Math.max(0, average * 10)));
  }

  const strength = Number(evidenceSummary.averageStrength || 0);
  const strengthScore = Math.min(100, (strength / 4) * 100);
  const totals = evidenceSummary.totals || {};
  const directTurns = Number(totals.direct_past_experience || 0) + Number(totals.indirect_adjacent_experience || 0);
  const hypotheticalTurns = Number(totals.hypothetical_understanding || 0);
  const genericTurns = Number(totals.generic_filler || 0);
  const totalTurns = directTurns + hypotheticalTurns + genericTurns;
  const directRatioScore = totalTurns > 0 ? Math.min(100, (directTurns / totalTurns) * 100) : 0;
  const turnScores = ensureArray(candidateFeedback.turnBreakdowns)
    .map((turn) => {
      const item = turn.scores || {};
      return (Number(item.business || 0) + Number(item.logic || 0) + Number(item.evidence || 0)) / 3;
    })
    .filter((value) => value > 0);

  if (turnScores.length > 0) {
    const averageTurnScore = turnScores.reduce((sum, value) => sum + value, 0) / turnScores.length;
    return Math.round(strengthScore * 0.4 + directRatioScore * 0.3 + Math.min(100, averageTurnScore * 10) * 0.3);
  }

  return Math.round(strengthScore * 0.55 + directRatioScore * 0.45);
};

export const buildReportScores = ({
  cvJdScore = 0,
  interviewScore = 0,
  analysisResult = {},
  evidenceSummary = {},
} = {}) => {
  const resolvedCvJdScore = Number(cvJdScore || analysisResult.overallScore || 0);
  const resolvedInterviewScore = Number(interviewScore || 0);

  return {
    overall: Number(((resolvedCvJdScore * 0.5) + (resolvedInterviewScore * 0.5)).toFixed(1)),
    cvJdMatch: resolvedCvJdScore,
    interviewPerformance: resolvedInterviewScore,
    macro: Number(analysisResult.scoreBreakdown?.macro || 0),
    micro: Number(analysisResult.scoreBreakdown?.micro || 0),
    requirements: Number(analysisResult.scoreBreakdown?.requirements || 0),
    evidenceStrength: Number(evidenceSummary.averageStrength || 0),
    directEvidenceTurns: Number(evidenceSummary.totals?.direct_past_experience || 0),
    hypotheticalTurns: Number(evidenceSummary.hypotheticalOnlyTurns ?? evidenceSummary.totals?.hypothetical_understanding ?? 0),
  };
};


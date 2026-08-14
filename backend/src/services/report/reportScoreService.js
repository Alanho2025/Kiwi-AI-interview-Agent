import { ensureArray } from '../../utils/commonHelpers.js';

export const computeInterviewPerformanceScore = (evidenceSummary = {}, candidateFeedback = {}) => {
  const turnBreakdowns = ensureArray(candidateFeedback.turnBreakdowns);

  // Exclude conversation turns, empty direct answers, and follow-ups from the denominator
  const eligibleTurns = turnBreakdowns.filter((turn) => {
    if (turn.rubricType === 'conversation' || turn.questionFamily === 'conversation') return false;
    if (turn.rubricType === 'direct_answer' && (!turn.frameworkBreakdown?.dimensions || turn.frameworkBreakdown.dimensions.length === 0)) return false;
    if (turn.questionType === 'follow_up' || turn.isFollowUp) return false;
    // Keep genuine 0-evidence answers, but skip if partial provider feedback caused missing normalizedScore
    return turn.frameworkBreakdown && Number.isFinite(Number(turn.frameworkBreakdown.normalizedScore));
  });

  if (eligibleTurns.length > 0) {
    let totalScore = 0;
    
    for (const turn of eligibleTurns) {
      const contentScore = Number(turn.frameworkBreakdown.normalizedScore) * 10; // Convert 0-10 to 0-100

      if (turn.voiceDurationAssessment?.eligible) {
        const durationPoints = Number(turn.voiceDurationAssessment.earnedPoints || 0);
        totalScore += (contentScore * 0.9) + durationPoints;
      } else {
        totalScore += contentScore;
      }
    }
    
    return Math.round(Math.min(100, Math.max(0, totalScore / eligibleTurns.length)));
  }

  // Legacy fallback for old reports without turnBreakdowns
  const strength = Number(evidenceSummary.averageStrength || 0);
  const strengthScore = Math.min(100, (strength / 4) * 100);
  const totals = evidenceSummary.totals || {};
  const directTurns = Number(totals.direct_past_experience || 0);
  const adjacentTurns = Number(totals.indirect_adjacent_experience || 0);
  const hypotheticalTurns = Number(totals.hypothetical_understanding || 0);
  const genericTurns = Number(totals.generic_filler || 0);
  const totalTurns = directTurns + adjacentTurns + hypotheticalTurns + genericTurns;
  const directRatioScore = totalTurns > 0 ? Math.min(100, (directTurns / totalTurns) * 100) : 0;
  
  const turnScores = turnBreakdowns
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
  interviewScore = 0,
  evidenceSummary = {},
} = {}) => {
  const resolvedInterviewScore = Number(interviewScore || 0);

  return {
    overall: resolvedInterviewScore,
    interviewPerformance: resolvedInterviewScore,
    evidenceStrength: Number(evidenceSummary.averageStrength || 0),
    directEvidenceTurns: Number(evidenceSummary.totals?.direct_past_experience || 0),
    hypotheticalTurns: Number(evidenceSummary.hypotheticalOnlyTurns ?? evidenceSummary.totals?.hypothetical_understanding ?? 0),
  };
};

/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: viewModel should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildFallbackAnswerRewriteTips, buildFallbackCoachingAdvice, buildFallbackImprovementPriorities, buildFallbackStrengthHighlights } from './coaching.js';
import { buildDataInsights, buildTakeaway } from './insights.js';
import { getScoreBand } from './shared.js';

/**
 * Purpose: Execute the main responsibility for buildReportViewModel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildReportViewModel = (reportData) => {
  const report = reportData?.report || {};
  const qa = reportData?.qaResult || {};
  const interviewMetrics = report.interviewMetrics || {};
  const evidenceDiagnostics = report.evidenceDiagnostics || {};
  const qaDiagnostics = qa.diagnostics || {};
  const candidateFeedback = report.candidateFeedback || {};

  return {
    report,
    qa,
    interviewMetrics,
    evidenceDiagnostics,
    qaDiagnostics,
    candidateFeedback,
    takeaway: candidateFeedback.overallTakeaway || buildTakeaway({ report, qa, evidenceDiagnostics }),
    scoreBand: candidateFeedback.scoreBand || getScoreBand(Number(report.scores?.overall || 0)),
    generationSource: candidateFeedback.generationSource || '',
    dataInsights: (candidateFeedback.plainEnglishMetrics || []).length
      ? candidateFeedback.plainEnglishMetrics
      : buildDataInsights({ report, qa, interviewMetrics, evidenceDiagnostics }),
    strengthHighlights: (candidateFeedback.strengthHighlights || []).length
      ? candidateFeedback.strengthHighlights
      : buildFallbackStrengthHighlights(report),
    improvementPriorities: (candidateFeedback.improvementPriorities || []).length
      ? candidateFeedback.improvementPriorities
      : buildFallbackImprovementPriorities({ report, interviewMetrics, evidenceDiagnostics }),
    coachingAdvice: (candidateFeedback.coachingAdvice || []).length
      ? candidateFeedback.coachingAdvice
      : buildFallbackCoachingAdvice({ report, interviewMetrics, evidenceDiagnostics }),
    answerRewriteTips: (candidateFeedback.answerRewriteExamples || []).length
      ? candidateFeedback.answerRewriteExamples
      : buildFallbackAnswerRewriteTips({ report, evidenceDiagnostics }),
  };
};

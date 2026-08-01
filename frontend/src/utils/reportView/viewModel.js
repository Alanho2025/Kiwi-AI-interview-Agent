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
  const nzWorkplaceFit = report.nzWorkplaceFit || {};
  const companyMotivationFit = report.companyMotivationFit || {};
  const commercialStressTest = reportData?.commercialStressTest || report.commercialStressTest || null;
  const rewriteItems = (candidateFeedback.answerRewriteExamples || []).length
    ? candidateFeedback.answerRewriteExamples
    : buildFallbackAnswerRewriteTips({ report, evidenceDiagnostics });
  const unsafeRewritePattern = /\[[^\]]{2,}\]|(?:�|Ã|Â|â€|Š|Ÿ|Œ|Ð|Þ)|(?:補充|說明|釐清|列出|假設|限制|風險|驗證)/;
  const normalizedRewrites = rewriteItems.map((item) => {
    const better = String(item.better || '');
    if (item.status === 'unavailable' || !better || unsafeRewritePattern.test(better)) {
      return {
        ...item,
        status: 'unavailable',
        better: '',
        failureReason: item.failureReason || 'A grounded stronger answer could not be generated reliably.',
      };
    }
    return { ...item, status: 'ready' };
  });
  const legacyUnsafeRewrite = String(report.schemaVersion || '').toLowerCase() === 'v5'
    && rewriteItems.some((item) => unsafeRewritePattern.test(String(item.better || '')));
  const legacyLimitations = Array.isArray(report.legacyLimitations)
    ? report.legacyLimitations.filter((item) => item?.message)
    : [];

  return {
    report,
    qa,
    interviewMetrics,
    evidenceDiagnostics,
    qaDiagnostics,
    candidateFeedback,
    nzWorkplaceFit,
    companyMotivationFit,
    commercialStressTest,
    takeaway: candidateFeedback.overallTakeaway || buildTakeaway({ report, qa, evidenceDiagnostics }),
    scoreBand: getScoreBand(Number(report.scores?.overall || 0)),
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
    answerRewriteTips: normalizedRewrites,
    evidenceSources: (report.evidenceReferences || []).filter((item) => item?.claim && item?.evidenceSnippet),
    transcriptRisks: report.transcriptRisks || [],
    legacyReportNotice: legacyLimitations[0]?.message
      || (legacyUnsafeRewrite ? 'Legacy report needs regeneration. Regenerate this report for corrected scoring and safe rewrite content.' : ''),
    communicationProfile: candidateFeedback.communicationProfile || null,
    quoteAnalyses: candidateFeedback.quoteAnalyses || [],
    turnBreakdowns: candidateFeedback.turnBreakdowns || [],
    scoreExplanations: report.scoreExplanations || null,
    scoreLimitations: report.scoreLimitations || [],
    authenticityMetrics: report.authenticityMetrics || null,
    candidateReflections: Array.isArray(reportData?.candidateReflections)
      ? reportData.candidateReflections.map((item) => ({
        reflectionId: item.reflectionId || '',
        text: item.text || '',
        focusArea: item.focusArea || 'other',
        submittedAt: item.submittedAt || '',
      })).filter((item) => item.text)
      : [],
  };
};

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

const buildRoleFitView = (roleFit = {}) => {
  if (!roleFit?.schemaVersion && !roleFit?.status) return { available: false, status: 'unavailable' };
  const status = ['ready', 'limited', 'unavailable'].includes(roleFit.status)
    ? roleFit.status
    : 'unavailable';
  return {
    available: ['ready', 'limited'].includes(status),
    status,
    roleIntentCoverage: {
      total: Number(roleFit.roleIntentCoverage?.total || 0),
      covered: Number(roleFit.roleIntentCoverage?.covered || 0),
      partial: Number(roleFit.roleIntentCoverage?.partial || 0),
      missing: Number(roleFit.roleIntentCoverage?.missing || 0),
      unavailable: Number(roleFit.roleIntentCoverage?.unavailable || 0),
      items: (roleFit.roleIntentCoverage?.items || []).map((item) => ({
        label: item.label || 'Role focus',
        status: item.status || 'unavailable',
      })),
    },
    evidenceUsageMap: {
      totalUses: Number(roleFit.evidenceUsageMap?.totalUses || 0),
      items: (roleFit.evidenceUsageMap?.items || []).map((item) => ({
        label: item.label || 'Interview example',
        useCount: Number(item.useCount || 0),
        angles: item.angles || [],
      })),
    },
    answerAlignments: (roleFit.answerAlignments || []).map((item) => ({
      turnId: item.turnId || item.questionId,
      question: item.question || 'Interview question',
      label: item.label || 'unavailable',
      score: Number(item.score || 0),
      scoreBreakdown: item.scoreBreakdown || {},
      groundingStatus: item.groundingStatus || 'limited',
      diagnosis: item.diagnosis || {},
      betterAnswerPlan: item.betterAnswerPlan || {},
    })),
    questionReasoning: (roleFit.questionReasoning || []).map((item) => ({
      topic: item.topic || 'Role focus',
      reason: item.reason || 'This question checked an important part of the role.',
    })),
  };
};

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
    answerRewriteTips: normalizedRewrites,
    evidenceSources: (report.evidenceReferences || []).filter((item) => item?.claim && item?.evidenceSnippet),
    transcriptRisks: report.transcriptRisks || [],
    legacyReportNotice: legacyUnsafeRewrite ? 'Legacy report needs regeneration. Regenerate this report for corrected scoring and safe rewrite content.' : '',
    communicationProfile: candidateFeedback.communicationProfile || null,
    quoteAnalyses: candidateFeedback.quoteAnalyses || [],
    turnBreakdowns: candidateFeedback.turnBreakdowns || [],
    scoreExplanations: report.scoreExplanations || null,
    scoreLimitations: report.scoreLimitations || [],
    authenticityMetrics: report.authenticityMetrics || null,
    roleFit: buildRoleFitView(report.roleFit),
  };
};

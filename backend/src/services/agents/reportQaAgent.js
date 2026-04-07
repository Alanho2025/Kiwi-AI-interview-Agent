import { validateReportQaOutput } from '../schemaValidationService.js';

const scoreCoverage = (report = {}) => {
  const sections = Array.isArray(report.sections) ? report.sections.length : 0;
  const evidenceRefs = Array.isArray(report.evidenceReferences) ? report.evidenceReferences.length : 0;
  const metrics = report.interviewMetrics || {};
  const diagnostics = report.evidenceDiagnostics || {};

  let score = 0;
  score += Math.min(35, sections * 6);
  score += Math.min(20, evidenceRefs * 4);
  score += metrics.interviewerQuestionCount ? Math.min(20, (metrics.interviewerQuestionCount / Math.max(metrics.plannedQuestionCount || 1, 1)) * 20) : 0;
  score += diagnostics.averageStrength ? Math.min(25, (Number(diagnostics.averageStrength) / 4) * 25) : 0;
  return Math.round(Math.min(100, score));
};

export const runReportQaAgent = async ({ report = {}, analysisResult = {}, retrievalBundle = null } = {}) => {
  const qualityFlags = [];
  const consistencyChecks = [];
  const metrics = report.interviewMetrics || {};
  const diagnostics = report.evidenceDiagnostics || {};

  if (!report.summary) {
    qualityFlags.push('missing_summary');
  }
  if (!report.sections?.length) {
    qualityFlags.push('missing_sections');
  }
  if ((analysisResult.explanation?.strengths || []).length && !String(report.sections?.find((section) => section.id === 'strengths')?.content || '').trim()) {
    qualityFlags.push('missing_strength_coverage');
  }
  if ((diagnostics.totals?.hypothetical_understanding || 0) > 0 && !String(report.sections?.find((section) => section.id === 'gaps')?.content || '').toLowerCase().includes('hypothetical')) {
    qualityFlags.push('missing_hypothetical_gap_note');
  }
  if (metrics.plannedQuestionCount && metrics.interviewerQuestionCount !== metrics.plannedQuestionCount) {
    qualityFlags.push('question_count_mismatch');
  }
  if ((metrics.extraAiTurnCount || 0) > 0) {
    qualityFlags.push('extra_ai_turns_detected');
  }

  consistencyChecks.push({
    rule: 'decision_alignment',
    passed: String(report.summary || '').toLowerCase().includes(String(analysisResult.decision?.label || '').replace('_', ' ')) || !analysisResult.decision?.label,
  });

  consistencyChecks.push({
    rule: 'evidence_presence',
    passed: (report.evidenceReferences || []).length > 0 || (retrievalBundle?.items || []).length > 0,
  });

  consistencyChecks.push({
    rule: 'metrics_present',
    passed: Boolean(metrics.interviewerQuestionCount || metrics.candidateTurnCount),
  });

  const coverageScore = scoreCoverage(report);
  const hallucinationRisk = qualityFlags.some((flag) => ['question_count_mismatch', 'missing_hypothetical_gap_note'].includes(flag))
    ? 'medium'
    : qualityFlags.length
      ? 'low_to_medium'
      : 'low';

  return validateReportQaOutput({
    schemaVersion: 'v3',
    reportId: report.id || report.sessionId || '',
    coverageScore,
    hallucinationRisk,
    qualityFlags,
    consistencyChecks,
    passed: qualityFlags.length === 0 && consistencyChecks.every((item) => item.passed),
    diagnostics: {
      interviewerQuestionCount: metrics.interviewerQuestionCount || 0,
      plannedQuestionCount: metrics.plannedQuestionCount || 0,
      averageEvidenceStrength: diagnostics.averageStrength || 0,
    },
  });
};

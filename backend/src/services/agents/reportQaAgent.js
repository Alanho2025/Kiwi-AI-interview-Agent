/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportQaAgent should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateReportQaOutput } from '../schemaValidationService.js';

const scoreCoverage = (report = {}) => {
  const sections = Array.isArray(report.sections) ? report.sections.length : 0;
  const evidenceRefs = Array.isArray(report.evidenceReferences) ? report.evidenceReferences.length : 0;
  const metrics = report.interviewMetrics || {};
  const diagnostics = report.evidenceDiagnostics || {};
  let score = 0;
  score += Math.min(35, sections * 4);
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
  const candidateFeedback = report.candidateFeedback || {};
  const coachingAdvice = candidateFeedback.coachingAdvice || [];

  if (!report.summary) qualityFlags.push('missing_summary');
  if (!report.sections?.length) qualityFlags.push('missing_sections');
  if (!report.sections?.find((section) => section.id === 'interaction_feedback')) qualityFlags.push('missing_interaction_section');
  if (!report.sections?.find((section) => section.id === 'reflection_memory')) qualityFlags.push('missing_reflection_section');
  if ((analysisResult.explanation?.strengths || []).length && !String(report.sections?.find((section) => section.id === 'strengths')?.content || '').trim()) qualityFlags.push('missing_strength_coverage');
  if ((diagnostics.totals?.hypothetical_understanding || 0) > 0 && !String(report.sections?.find((section) => section.id === 'gaps')?.content || '').toLowerCase().includes('hypothetical')) qualityFlags.push('missing_hypothetical_gap_note');
  if (metrics.plannedQuestionCount && metrics.interviewerQuestionCount !== metrics.plannedQuestionCount) qualityFlags.push('question_count_mismatch');
  if ((metrics.extraAiTurnCount || 0) > 0) qualityFlags.push('extra_ai_turns_detected');
  if (!candidateFeedback.overallTakeaway) qualityFlags.push('missing_candidate_feedback');
  if (!(candidateFeedback.plainEnglishMetrics || []).length) qualityFlags.push('missing_metric_translation');
  if (!coachingAdvice.length) qualityFlags.push('missing_actionable_coaching');
  if (!(candidateFeedback.answerRewriteExamples || []).length) qualityFlags.push('missing_rewrite_examples');
  if ((report.scores?.reflectionCount || 0) > 0 && !String(report.sections?.find((section) => section.id === 'reflection_memory')?.content || '').trim()) qualityFlags.push('missing_reflection_content');
  if (typeof report.scores?.averageInteractionScore !== 'number') qualityFlags.push('missing_interaction_metrics');

  consistencyChecks.push({
    rule: 'decision_alignment',
    passed: String(report.summary || '').toLowerCase().includes(String(analysisResult.decision?.label || '').replace('_', ' ')) || !analysisResult.decision?.label,
  });
  consistencyChecks.push({ rule: 'evidence_presence', passed: (report.evidenceReferences || []).length > 0 || (retrievalBundle?.items || []).length > 0 });
  consistencyChecks.push({ rule: 'metrics_present', passed: Boolean(metrics.interviewerQuestionCount || metrics.candidateTurnCount) });
  consistencyChecks.push({ rule: 'candidate_feedback_present', passed: Boolean(candidateFeedback.overallTakeaway && coachingAdvice.length) });
  consistencyChecks.push({ rule: 'metric_translation_present', passed: (candidateFeedback.plainEnglishMetrics || []).length > 0 });
  consistencyChecks.push({ rule: 'interaction_feedback_present', passed: Boolean(report.sections?.find((section) => section.id === 'interaction_feedback')?.content) });

  const coverageScore = scoreCoverage(report);
  const hallucinationRisk = qualityFlags.some((flag) => ['question_count_mismatch', 'missing_hypothetical_gap_note'].includes(flag)) ? 'medium' : qualityFlags.length ? 'low_to_medium' : 'low';

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
      averageInteractionScore: report.scores?.averageInteractionScore || 0,
      reflectionCount: report.scores?.reflectionCount || 0,
    },
  });
};

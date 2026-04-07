import { validateReportQaOutput } from '../schemaValidationService.js';

const scoreCoverage = (report = {}) => {
  const sections = Array.isArray(report.sections) ? report.sections.length : 0;
  const evidenceRefs = Array.isArray(report.evidenceReferences) ? report.evidenceReferences.length : 0;
  return Math.min(100, sections * 15 + evidenceRefs * 5);
};

export const runReportQaAgent = async ({ report = {}, analysisResult = {}, retrievalBundle = null } = {}) => {
  const qualityFlags = [];
  const consistencyChecks = [];

  if (!report.summary) {
    qualityFlags.push('missing_summary');
  }
  if (!report.sections?.length) {
    qualityFlags.push('missing_sections');
  }
  if ((analysisResult.explanation?.strengths || []).length && !String(report.sections?.find((section) => section.id === 'strengths')?.content || '').trim()) {
    qualityFlags.push('missing_strength_coverage');
  }

  consistencyChecks.push({
    rule: 'decision_alignment',
    passed: String(report.summary || '').toLowerCase().includes(String(analysisResult.decision?.label || '').replace('_', ' ')) || !analysisResult.decision?.label,
  });

  consistencyChecks.push({
    rule: 'evidence_presence',
    passed: (report.evidenceReferences || []).length > 0 || (retrievalBundle?.items || []).length > 0,
  });

  const coverageScore = scoreCoverage(report);
  const hallucinationRisk = qualityFlags.length ? 'medium' : 'low';

  return validateReportQaOutput({
    schemaVersion: 'v3',
    reportId: report.id || report.sessionId || '',
    coverageScore,
    hallucinationRisk,
    qualityFlags,
    consistencyChecks,
    passed: qualityFlags.length === 0 && consistencyChecks.every((item) => item.passed),
  });
};

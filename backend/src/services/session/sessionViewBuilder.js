/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionViewBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { validateAnalyzeOutput, validateInterviewPlan } from '../schemaValidationService.js';
import {
  buildCanonicalRoleMeta,
  buildInterviewPlanPayload,
  extractDisplayTitle,
  mapSessionRow,
  normalizeAnalysisResult,
  titleCaseWords,
} from './sessionShared.js';

const sanitizeQuestionPoolForClient = (questionPool = []) => questionPool.map(({ sourceType, sourceId, matchedRequirementId, matchedSkill, cvEvidenceRefs, generationReason, confidence, planPriority, ...safeItem }) => safeItem);
const mapTranscriptTurns = (transcript) => transcript?.turns?.map((turn) => ({
  role: turn.role,
  text: turn.text,
  timestamp: new Date(turn.timestamp).toISOString(),
  questionId: turn.questionId,
})) || [];

export const buildSessionDetails = ({ row, plan, transcript, analysis, report, cvDocument }) => {
  const baseSession = mapSessionRow(row);
  const normalizedAnalysis = normalizeAnalysisResult(analysis);
  const roleMeta = buildCanonicalRoleMeta({
    resolvedTargetRole: row.target_role,
    normalizedAnalysis,
    settings: plan?.settingsSnapshot || baseSession.settings,
  });

  return {
    ...baseSession,
    displayTitle: roleMeta.displayTitle,
    compactRoleLabel: roleMeta.compactRoleLabel,
    canonicalRole: roleMeta.canonicalRole,
    roleFamily: roleMeta.roleFamily,
    interviewModeKey: roleMeta.interviewModeKey,
    settings: plan?.settingsSnapshot || baseSession.settings,
    analysisResult: normalizedAnalysis,
    interviewPlan: plan ? { ...validateInterviewPlan(plan), questionPool: sanitizeQuestionPoolForClient(validateInterviewPlan(plan).questionPool || []) } : null,
    hasReport: Boolean(report?.report),
    reportStatus: report?.latestStatus || null,
    cvProfile: cvDocument?.cvProfile || null,
    cvDisplay: cvDocument?.displayProfile || null,
    transcript: mapTranscriptTurns(transcript),
  };
};

export const buildSessionListItem = ({ row, plan, report, analysis }) => {
  const normalizedAnalysis = normalizeAnalysisResult(analysis);
  const matchSummary = normalizedAnalysis?.matchSummary || {};
  const roleMeta = buildCanonicalRoleMeta({
    resolvedTargetRole: row.target_role || plan?.jobTitle || matchSummary.jobTitle || '',
    normalizedAnalysis,
    settings: plan?.settingsSnapshot || { seniorityLevel: row.seniority_level, focusArea: row.focus_area },
  });
  const roleLabel = roleMeta.compactRoleLabel || row.target_role || matchSummary.jobTitle || plan?.jobTitle || 'Interview Session';
  const displayTitle = extractDisplayTitle(
    roleMeta.displayTitle,
    matchSummary.jobTitle,
    plan?.jobTitle,
    normalizedAnalysis?.parsedJdProfile?.title,
    normalizedAnalysis?.parsedJdProfile?.jobTitle,
    roleLabel
  );
  const reportOverallScore = report?.report?.scores?.overall;
  const displayScore = Number.isFinite(Number(reportOverallScore))
    ? Number(reportOverallScore)
    : Number.isFinite(Number(row.overall_score))
      ? Number(row.overall_score)
      : Number.isFinite(Number(matchSummary.matchScore))
        ? Number(matchSummary.matchScore)
        : null;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    targetRole: roleLabel,
    candidateName: row.candidate_name,
    overallScore: reportOverallScore ?? row.overall_score,
    displayScore,
    totalQuestions: row.total_questions,
    currentQuestionIndex: row.current_question_index,
    durationSeconds: row.duration_seconds ?? row.elapsed_seconds ?? 0,
    planPreview: plan?.planPreview || matchSummary.planPreview || normalizedAnalysis?.explanation?.summary || '',
    scoreBand: report?.report?.candidateFeedback?.scoreBand || '',
    reportStatus: report?.latestStatus || null,
    hasReport: Boolean(report?.report),
    matchScore: matchSummary.matchScore ?? null,
    displayTitle: roleMeta.displayTitle || titleCaseWords(displayTitle),
    compactRoleLabel: roleMeta.compactRoleLabel || roleLabel,
    interviewModeKey: roleMeta.interviewModeKey,
  };
};

export const buildSessionPlanUpdatePayload = ({ current, data }) => {
  const normalizedAnalysis = data.analysisResult ? validateAnalyzeOutput(data.analysisResult) : current.analysisResult;
  if (!data.settings && !normalizedAnalysis) return null;

  return validateInterviewPlan({
    ...(data.settings ? { settingsSnapshot: data.settings } : {}),
    ...(normalizedAnalysis
      ? {
          candidateName: normalizedAnalysis.candidateName,
          jobTitle: normalizedAnalysis.jobTitle,
          matchScore: normalizedAnalysis.matchScore,
          confidence: normalizedAnalysis.confidence,
          decision: normalizedAnalysis.decision,
          requirementChecks: normalizedAnalysis.requirementChecks,
          explanation: normalizedAnalysis.explanation,
          strengths: normalizedAnalysis.strengths,
          gaps: normalizedAnalysis.gaps,
          interviewFocus: normalizedAnalysis.interviewFocus,
          planPreview: normalizedAnalysis.planPreview,
          questionPool: buildInterviewPlanPayload({
            normalizedAnalysis,
            settings: data.settings || current.settings || {},
            resolvedCandidateName: normalizedAnalysis.candidateName || current.candidateName,
            resolvedTargetRole: current.displayTitle || normalizedAnalysis.jobTitle || current.targetRole,
          }).questionPool,
        }
      : {}),
  });
};

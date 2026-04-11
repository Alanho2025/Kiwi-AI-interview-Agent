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
  buildInterviewPlanPayload,
  extractDisplayTitle,
  mapSessionRow,
  normalizeAnalysisResult,
  titleCaseWords,
} from './sessionShared.js';

/**
 * Purpose: Execute the main responsibility for mapTranscriptTurns.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const mapTranscriptTurns = (transcript) => transcript?.turns?.map((turn) => ({
  role: turn.role,
  text: turn.text,
  timestamp: new Date(turn.timestamp).toISOString(),
  questionId: turn.questionId,
})) || [];

/**
 * Purpose: Execute the main responsibility for buildSessionDetails.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildSessionDetails = ({ row, plan, transcript, analysis, report, cvDocument }) => {
  const baseSession = mapSessionRow(row);
  const normalizedAnalysis = normalizeAnalysisResult(analysis);

  return {
    ...baseSession,
    settings: plan?.settingsSnapshot || baseSession.settings,
    analysisResult: normalizedAnalysis,
    interviewPlan: plan ? validateInterviewPlan(plan) : null,
    hasReport: Boolean(report?.report),
    reportStatus: report?.latestStatus || null,
    cvText: cvDocument?.normalizedText || cvDocument?.rawText || '',
    transcript: mapTranscriptTurns(transcript),
  };
};

/**
 * Purpose: Execute the main responsibility for buildSessionListItem.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildSessionListItem = ({ row, plan, report, analysis }) => {
  const matchSummary = analysis?.matchSummary || {};
  const roleLabel = row.target_role || matchSummary.jobTitle || plan?.jobTitle || 'Interview Session';
  const displayTitle = extractDisplayTitle(
    matchSummary.jobTitle,
    plan?.jobTitle,
    analysis?.parsedJdProfile?.title,
    analysis?.parsedJdProfile?.jobTitle,
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
    planPreview: plan?.planPreview || matchSummary.planPreview || analysis?.explanation?.summary || '',
    scoreBand: report?.report?.candidateFeedback?.scoreBand || '',
    reportStatus: report?.latestStatus || null,
    hasReport: Boolean(report?.report),
    matchScore: matchSummary.matchScore ?? null,
    displayTitle: titleCaseWords(displayTitle),
  };
};

/**
 * Purpose: Execute the main responsibility for buildSessionPlanUpdatePayload.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildSessionPlanUpdatePayload = ({ current, data }) => {
  const normalizedAnalysis = data.analysisResult ? validateAnalyzeOutput(data.analysisResult) : current.analysisResult;
  if (!data.settings && !normalizedAnalysis) {
    return null;
  }

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
            resolvedTargetRole: normalizedAnalysis.jobTitle || current.targetRole,
          }).questionPool,
        }
      : {}),
  });
};

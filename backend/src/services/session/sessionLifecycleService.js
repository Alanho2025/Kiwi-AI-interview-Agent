/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionLifecycleService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query } from '../../db/postgres.js';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../../db/models/interviewPlanModel.js';
import { SessionReport } from '../../db/models/sessionReportModel.js';
import { clampVarchar, fetchSessionRowById } from './sessionShared.js';
import {
  fetchSessionDependencies,
  initializeTranscript,
  normalizeAnalysisPayload,
  persistInterviewPlan,
  persistParsedSkills,
  persistSessionAnalysis,
  persistSessionSetup,
} from './sessionPersistenceService.js';
import {
  buildSessionDetails,
  buildSessionListItem,
  buildSessionPlanUpdatePayload,
} from './sessionViewBuilder.js';

/**
 * Purpose: Execute the main responsibility for createSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const createSession = async ({
  userId,
  cvFileId = null,
  rawJD = '',
  jdText = '',
  jdRubric = null,
  settings = {},
  analysisResult = {},
  targetRole,
  totalQuestions = 8,
  candidateName = 'Candidate',
}) => {
  const id = crypto.randomUUID();
  const normalizedAnalysis = normalizeAnalysisPayload(analysisResult);
  const resolvedTargetRole = clampVarchar(targetRole || normalizedAnalysis.jobTitle || 'Target Role');
  const resolvedCandidateName = clampVarchar(normalizedAnalysis.candidateName || candidateName || 'Candidate');
  const resolvedSeniorityLevel = clampVarchar(settings.seniorityLevel || 'Junior/Grad');
  const resolvedFocusArea = clampVarchar(settings.focusArea || 'Combined');

  await persistSessionSetup({
    id,
    userId,
    cvFileId,
    rawJD,
    jdText,
    normalizedAnalysis,
    resolvedTargetRole,
    resolvedCandidateName,
    resolvedSeniorityLevel,
    resolvedFocusArea,
    settings,
    totalQuestions,
  });

  await persistParsedSkills({ id, normalizedAnalysis, jdRubric });
  await persistSessionAnalysis({ id, userId, cvFileId, jdText, jdRubric, normalizedAnalysis });
  await persistInterviewPlan({ id, userId, normalizedAnalysis, settings, resolvedCandidateName, resolvedTargetRole });
  await initializeTranscript({ id, userId });

  return getSessionById(id);
};

/**
 * Purpose: Execute the main responsibility for getSessionById.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getSessionById = async (id) => {
  const row = await fetchSessionRowById(id);
  if (!row) {
    return null;
  }

  const dependencies = await fetchSessionDependencies({ id, cvFileId: row.cv_file_id });
  return buildSessionDetails({ row, ...dependencies });
};

/**
 * Purpose: Execute the main responsibility for listSessionsByUserId.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const listSessionsByUserId = async (userId, limit = 20) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const result = await query(
    `SELECT *
     FROM interview_sessions
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [String(userId), safeLimit]
  );

  const rows = result.rows || [];
  if (!rows.length) {
    return [];
  }

  const sessionIds = rows.map((row) => row.id);
  const [reports, plans, analyses] = await Promise.all([
    SessionReport.find({ sessionId: { $in: sessionIds } }).lean(),
    InterviewPlan.find({ sessionId: { $in: sessionIds } }).lean(),
    SessionAnalysis.find({ sessionId: { $in: sessionIds } }).lean(),
  ]);

  const reportMap = new Map(reports.map((item) => [item.sessionId, item]));
  const planMap = new Map(plans.map((item) => [item.sessionId, item]));
  const analysisMap = new Map(analyses.map((item) => [item.sessionId, item]));

  return rows.map((row) => buildSessionListItem({
    row,
    plan: planMap.get(row.id),
    report: reportMap.get(row.id),
    analysis: analysisMap.get(row.id),
  }));
};

/**
 * Purpose: Execute the main responsibility for updateSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const updateSession = async (id, data) => {
  const current = await getSessionById(id);
  if (!current) {
    return null;
  }

  await query(
    `UPDATE interview_sessions
     SET status = $2,
         current_question_index = $3,
         elapsed_seconds = $4,
         last_resumed_at = $5,
         ended_at = $6,
         summary_text = $7,
         overall_score = $8,
         updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.status ?? current.status,
      data.currentQuestionIndex ?? current.currentQuestionIndex,
      data.elapsedSeconds ?? current.elapsedSeconds,
      data.lastResumedAt ?? current.lastResumedAt,
      data.endedAt ?? current.endedAt,
      data.summaryText ?? current.summaryText,
      data.overallScore ?? current.overallScore,
    ]
  );

  const planPayload = buildSessionPlanUpdatePayload({ current, data });
  if (planPayload) {
    await InterviewPlan.findOneAndUpdate(
      { sessionId: id },
      planPayload,
      { returnDocument: 'after' }
    );
  }

  return getSessionById(id);
};

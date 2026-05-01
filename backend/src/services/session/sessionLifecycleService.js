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
import { normalizeControlMode, normalizeQuestionLimit, normalizeTimeLimitMinutes, resolveInterviewModeConfig } from '../../config/interviewBlueprints.js';
import { clampVarchar, fetchSessionRowById, fetchOwnedSessionRowById } from './sessionShared.js';
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

const normalizeSessionMode = (value) => (value === 'voice' ? 'voice' : 'text');

const resolveSessionSetup = ({ settings = {}, sessionSetup = {}, mode = 'text' } = {}) => {
  const controlMode = normalizeControlMode(sessionSetup.controlMode || settings.controlMode);
  const timeLimitMinutes = normalizeTimeLimitMinutes(sessionSetup.timeLimitMinutes || settings.timeLimitMinutes);
  const questionLimit = normalizeQuestionLimit(sessionSetup.questionLimit || settings.questionLimit);
  const questionType = sessionSetup.questionType || settings.focusArea || 'Combined';

  return {
    deliveryMode: normalizeSessionMode(sessionSetup.deliveryMode || mode),
    controlMode,
    questionLimit,
    timeLimitMinutes,
    questionType,
  };
};

export const createSession = async ({
  userId,
  cvFileId = null,
  rawJD = '',
  jdText = '',
  jdRubric = null,
  settings = {},
  analysisResult = {},
  matchAnalysisId = null,
  evidenceRefs = [],
  targetRole,
  totalQuestions = 8,
  candidateName = 'Candidate',
  mode = 'text',
  sessionSetup = {},
}) => {
  const id = crypto.randomUUID();
  const normalizedAnalysis = normalizeAnalysisPayload(analysisResult);
  const resolvedTargetRole = clampVarchar(targetRole || normalizedAnalysis.jobTitle || 'Target Role');
  const resolvedCandidateName = clampVarchar(normalizedAnalysis.candidateName || candidateName || 'Candidate');
  const resolvedSeniorityLevel = clampVarchar(settings.seniorityLevel || 'Junior/Grad');
  const resolvedFocusArea = clampVarchar(settings.focusArea || 'Combined');
  const setup = resolveSessionSetup({ settings, sessionSetup, mode });
  const resolvedMode = setup.deliveryMode;
  const modeConfig = resolveInterviewModeConfig({
    seniorityLevel: resolvedSeniorityLevel,
    focusArea: setup.questionType || resolvedFocusArea,
    questionType: setup.questionType || resolvedFocusArea,
    controlMode: setup.controlMode,
    questionLimit: setup.questionLimit,
    timeLimitMinutes: setup.timeLimitMinutes,
  });
  const resolvedSettings = {
    ...settings,
    seniorityLevel: resolvedSeniorityLevel,
    focusArea: resolvedFocusArea,
    questionType: setup.questionType,
    controlMode: modeConfig.controlMode,
    questionLimit: modeConfig.questionLimit,
    timeLimitMinutes: modeConfig.timeLimitMinutes || setup.timeLimitMinutes,
    timeLimitSeconds: modeConfig.timeLimitSeconds,
  };

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
    settings: resolvedSettings,
    totalQuestions: modeConfig.totalQuestions || totalQuestions,
    sessionMode: resolvedMode,
    controlMode: modeConfig.controlMode,
    questionType: modeConfig.focusAreaKey,
    questionLimit: modeConfig.questionLimit,
    timeLimitSeconds: modeConfig.timeLimitSeconds,
  });

  await persistParsedSkills({ id, normalizedAnalysis, jdRubric });
  await persistSessionAnalysis({ id, userId, cvFileId, jdText, jdRubric, normalizedAnalysis, matchAnalysisId, evidenceRefs });
  await persistInterviewPlan({ id, userId, normalizedAnalysis, settings: resolvedSettings, resolvedCandidateName, resolvedTargetRole, matchAnalysisId, evidenceRefs });
  await initializeTranscript({ id, userId });

  return getSessionById(id);
};

export const getSessionById = async (id) => {
  const row = await fetchSessionRowById(id);
  if (!row) return null;
  const dependencies = await fetchSessionDependencies({ id, cvFileId: row.cv_file_id });
  return buildSessionDetails({ row, ...dependencies });
};

export const getOwnedSessionById = async (id, userId) => {
  const row = await fetchOwnedSessionRowById(id, userId);
  if (!row) return null;
  const dependencies = await fetchSessionDependencies({ id, cvFileId: row.cv_file_id });
  return buildSessionDetails({ row, ...dependencies });
};

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
  if (!rows.length) return [];

  const sessionIds = rows.map((row) => row.id);
  const [reports, plans, analyses] = await Promise.all([
    SessionReport.find({ sessionId: { $in: sessionIds } }).lean(),
    InterviewPlan.find({ sessionId: { $in: sessionIds } }).lean(),
    SessionAnalysis.find({ sessionId: { $in: sessionIds } }).lean(),
  ]);

  return rows.map((row) => buildSessionListItem({
    row,
    plan: plans.find((item) => item.sessionId === row.id),
    report: reports.find((item) => item.sessionId === row.id),
    analysis: analyses.find((item) => item.sessionId === row.id),
  }));
};

const normalizeSessionUpdateArgs = (id, userIdOrData, maybeData) => {
  if (maybeData === undefined && userIdOrData && typeof userIdOrData === 'object' && !Array.isArray(userIdOrData)) {
    return { id, userId: null, data: userIdOrData };
  }

  return {
    id,
    userId: userIdOrData ?? null,
    data: maybeData && typeof maybeData === 'object' ? maybeData : {},
  };
};

const updateInterviewSessionRow = async ({ id, userId = null, data = {} }) => {
  const assignments = [];
  const values = [];
  let index = 1;

  const assign = (column, value) => {
    assignments.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (Object.prototype.hasOwnProperty.call(data, 'status')) assign('status', data.status);
  if (Object.prototype.hasOwnProperty.call(data, 'mode')) assign('mode', data.mode);
  if (Object.prototype.hasOwnProperty.call(data, 'targetRole')) assign('target_role', data.targetRole);
  if (Object.prototype.hasOwnProperty.call(data, 'candidateName')) assign('candidate_name', data.candidateName);
  if (Object.prototype.hasOwnProperty.call(data, 'totalQuestions')) assign('total_questions', data.totalQuestions);
  if (Object.prototype.hasOwnProperty.call(data, 'currentQuestionIndex')) assign('current_question_index', data.currentQuestionIndex);
  if (Object.prototype.hasOwnProperty.call(data, 'elapsedSeconds')) assign('elapsed_seconds', data.elapsedSeconds);
  if (Object.prototype.hasOwnProperty.call(data, 'lastResumedAt')) assign('last_resumed_at', data.lastResumedAt);
  if (Object.prototype.hasOwnProperty.call(data, 'startedAt')) assign('started_at', data.startedAt);
  if (Object.prototype.hasOwnProperty.call(data, 'endedAt')) assign('ended_at', data.endedAt);
  if (Object.prototype.hasOwnProperty.call(data, 'durationSeconds')) assign('duration_seconds', data.durationSeconds);
  if (Object.prototype.hasOwnProperty.call(data, 'overallScore')) assign('overall_score', data.overallScore);
  if (Object.prototype.hasOwnProperty.call(data, 'summaryText')) assign('summary_text', data.summaryText);
  if (Object.prototype.hasOwnProperty.call(data, 'completedBecause')) assign('completed_because', data.completedBecause);

  if (!assignments.length) {
    return;
  }

  assignments.push('updated_at = NOW()');
  values.push(String(id));
  const idIndex = index;
  index += 1;

  let sql = `UPDATE interview_sessions SET ${assignments.join(', ')} WHERE id = $${idIndex}`;
  if (userId) {
    values.push(String(userId));
    sql += ` AND user_id = $${index}`;
    index += 1;
  }
  sql += ' AND deleted_at IS NULL';

  await query(sql, values);
};

export const updateSessionById = async (id, userId, data = {}) => {
  const normalized = normalizeSessionUpdateArgs(id, userId, data);
  const existing = normalized.userId
    ? await getOwnedSessionById(normalized.id, normalized.userId)
    : await getSessionById(normalized.id);
  if (!existing) return null;

  await updateInterviewSessionRow(normalized);

  const planUpdate = buildSessionPlanUpdatePayload({ current: existing, data: normalized.data });
  if (planUpdate) {
    await InterviewPlan.findOneAndUpdate({ sessionId: normalized.id }, planUpdate, { upsert: true, new: true });
  }

  return normalized.userId
    ? getOwnedSessionById(normalized.id, normalized.userId)
    : getSessionById(normalized.id);
};

export const softDeleteSessionById = async (idOrPayload, userId) => {
  const sessionId = typeof idOrPayload === 'object' && idOrPayload !== null ? idOrPayload.sessionId : idOrPayload;
  const resolvedUserId = typeof idOrPayload === 'object' && idOrPayload !== null ? idOrPayload.userId : userId;
  const result = await query(
    `UPDATE interview_sessions
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [String(sessionId), String(resolvedUserId)]
  );
  return Boolean(result.rows[0]?.id);
};

export const updateSession = updateSessionById;

export const softDeleteOwnedSession = softDeleteSessionById;


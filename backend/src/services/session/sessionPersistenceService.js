/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionPersistenceService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query, withTransaction } from '../../db/postgres.js';
import { DocumentContent } from '../../db/models/documentContentModel.js';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../../db/models/interviewPlanModel.js';
import { SessionReport } from '../../db/models/sessionReportModel.js';
import { SessionTranscript } from '../../db/models/sessionTranscriptModel.js';
import { validateAnalyzeOutput } from '../schemaValidationService.js';
import { buildInterviewPlanPayload, retentionDate } from './sessionShared.js';

/**
 * Purpose: Execute the main responsibility for insertInterviewSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const insertInterviewSession = async ({
  client,
  id,
  userId,
  resolvedTargetRole,
  resolvedCandidateName,
  resolvedSeniorityLevel,
  resolvedFocusArea,
  settings,
  totalQuestions,
}) => client.query(
  `INSERT INTO interview_sessions (
    id, user_id, status, mode, target_role, candidate_name, seniority_level, focus_area,
    enable_nz_culture_fit, current_question_index, total_questions, elapsed_seconds,
    created_at, updated_at
  ) VALUES ($1,$2,'ready','voice',$3,$4,$5,$6,$7,1,$8,0,now(),now())`,
  [
    id,
    userId,
    resolvedTargetRole,
    resolvedCandidateName,
    resolvedSeniorityLevel,
    resolvedFocusArea,
    Boolean(settings.enableNZCultureFit),
    totalQuestions,
  ]
);

/**
 * Purpose: Execute the main responsibility for linkSessionCvFile.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const linkSessionCvFile = async ({ client, id, cvFileId }) => {
  if (!cvFileId) {
    return;
  }

  await client.query('UPDATE interview_sessions SET cv_file_id = $2, updated_at = now() WHERE id = $1', [id, cvFileId]);
};

/**
 * Purpose: Execute the main responsibility for insertJobDescriptionInput.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const insertJobDescriptionInput = async ({ client, id, rawJD }) => client.query(
  `INSERT INTO job_description_inputs (
    id, session_id, source_type, raw_text, redacted_text, contains_pii, created_at, updated_at
  ) VALUES ($1,$2,'pasted_text',$3,$4,false,now(),now())`,
  [crypto.randomUUID(), id, rawJD, rawJD]
);

/**
 * Purpose: Execute the main responsibility for upsertParsedProfile.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const upsertParsedProfile = async ({
  client,
  id,
  normalizedAnalysis,
  resolvedCandidateName,
  resolvedTargetRole,
  jdText,
}) => client.query(
  `INSERT INTO parsed_profiles (
    id, session_id, candidate_name, job_title, cv_summary, jd_summary, match_score,
    profile_source_version, created_at, updated_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,'v3',now(),now())
  ON CONFLICT (session_id) DO UPDATE SET
    candidate_name = EXCLUDED.candidate_name,
    job_title = EXCLUDED.job_title,
    cv_summary = EXCLUDED.cv_summary,
    jd_summary = EXCLUDED.jd_summary,
    match_score = EXCLUDED.match_score,
    updated_at = now()`,
  [
    crypto.randomUUID(),
    id,
    resolvedCandidateName,
    resolvedTargetRole,
    normalizedAnalysis.planPreview || null,
    jdText || null,
    normalizedAnalysis.matchScore || null,
  ]
);

/**
 * Purpose: Execute the main responsibility for persistSessionSetup.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistSessionSetup = async ({
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
}) => withTransaction(async (client) => {
  await insertInterviewSession({
    client,
    id,
    userId,
    resolvedTargetRole,
    resolvedCandidateName,
    resolvedSeniorityLevel,
    resolvedFocusArea,
    settings,
    totalQuestions,
  });
  await linkSessionCvFile({ client, id, cvFileId });
  await insertJobDescriptionInput({ client, id, rawJD });
  await upsertParsedProfile({
    client,
    id,
    normalizedAnalysis,
    resolvedCandidateName,
    resolvedTargetRole,
    jdText,
  });
});

/**
 * Purpose: Execute the main responsibility for buildSkillRows.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildSkillRows = ({ id, normalizedAnalysis, jdRubric }) => {
  const rubric = normalizedAnalysis.parsedJdProfile || normalizedAnalysis.matchingDetails?.rubric || jdRubric || {};
  const cvSkills = [...(normalizedAnalysis.strengths || [])].map((skill) => ({
    sourceType: 'cv',
    skillName: skill,
    skillCategory: 'detected',
    importanceLevel: 'detected',
    evidenceText: 'Derived from analysis strengths',
  }));
  const jdSkills = [
    ...((rubric.microCriteria || []).map((item) => item.label)),
    ...(rubric.technicalSkillRequirements || []),
    ...(rubric.softSkillRequirements || []),
  ].map((skill) => ({
    sourceType: 'jd',
    skillName: skill,
    skillCategory: 'required',
    importanceLevel: 'required',
    evidenceText: 'Derived from JD rubric',
  }));

  return [...cvSkills, ...jdSkills].map((item) => ({ id: crypto.randomUUID(), sessionId: id, ...item, createdAt: new Date() }));
};

/**
 * Purpose: Execute the main responsibility for insertParsedSkill.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const insertParsedSkill = async ({ sessionId, sourceType, skillName, skillCategory, importanceLevel, evidenceText }) => query(
  `INSERT INTO parsed_skills (
    id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
  [crypto.randomUUID(), sessionId, sourceType, skillName, skillCategory, importanceLevel, evidenceText]
);

/**
 * Purpose: Execute the main responsibility for persistParsedSkills.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistParsedSkills = async ({ id, normalizedAnalysis, jdRubric }) => {
  const skillRows = buildSkillRows({ id, normalizedAnalysis, jdRubric });
  for (const skillRow of skillRows) {
    await insertParsedSkill(skillRow);
  }
};

/**
 * Purpose: Execute the main responsibility for buildSessionAnalysisDocument.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildSessionAnalysisDocument = ({ id, userId, cvFileId, jdText, rubric, normalizedAnalysis }) => ({
  sessionId: id,
  userId,
  cvDocumentId: cvFileId,
  jdStructuredText: jdText,
  jdRubric: rubric,
  parsedCvProfile: normalizedAnalysis.parsedCvProfile || {},
  parsedJdProfile: normalizedAnalysis.parsedJdProfile || rubric,
  matchSummary: {
    candidateName: normalizedAnalysis.candidateName,
    jobTitle: normalizedAnalysis.jobTitle,
    matchScore: normalizedAnalysis.matchScore,
    strengths: normalizedAnalysis.strengths || [],
    gaps: normalizedAnalysis.gaps || [],
    interviewFocus: normalizedAnalysis.interviewFocus || [],
  },
  matchingDetails: normalizedAnalysis.matchingDetails || {},
  macroScores: normalizedAnalysis.macroScores || [],
  microScores: normalizedAnalysis.microScores || [],
  requirementChecks: normalizedAnalysis.requirementChecks || [],
  scoreBreakdown: normalizedAnalysis.scoreBreakdown || {},
  decision: normalizedAnalysis.decision || {},
  confidence: normalizedAnalysis.confidence || 0,
  explanation: normalizedAnalysis.explanation || {},
  evidenceMap: normalizedAnalysis.evidenceMap || [],
  sourceSnapshots: normalizedAnalysis.sourceSnapshots || [],
  analysisStatus: 'completed',
  retentionUntil: retentionDate(),
  schemaVersion: normalizedAnalysis.schemaVersion || 'v3',
});

/**
 * Purpose: Execute the main responsibility for persistSessionAnalysis.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistSessionAnalysis = async ({ id, userId, cvFileId, jdText, jdRubric, normalizedAnalysis }) => {
  const rubric = normalizedAnalysis.parsedJdProfile || normalizedAnalysis.matchingDetails?.rubric || jdRubric || {};

  await SessionAnalysis.findOneAndUpdate(
    { sessionId: id },
    buildSessionAnalysisDocument({ id, userId, cvFileId, jdText, rubric, normalizedAnalysis }),
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/**
 * Purpose: Execute the main responsibility for persistInterviewPlan.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistInterviewPlan = async ({ id, userId, normalizedAnalysis, settings, resolvedCandidateName, resolvedTargetRole }) => {
  const validatedPlan = buildInterviewPlanPayload({
    normalizedAnalysis,
    settings,
    resolvedCandidateName,
    resolvedTargetRole,
  });

  await InterviewPlan.findOneAndUpdate(
    { sessionId: id },
    {
      sessionId: id,
      userId,
      ...validatedPlan,
      retentionUntil: retentionDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/**
 * Purpose: Execute the main responsibility for initializeTranscript.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const initializeTranscript = async ({ id, userId }) => {
  await SessionTranscript.findOneAndUpdate(
    { sessionId: id },
    {
      sessionId: id,
      userId,
      turns: [],
      fullTranscript: '',
      redactedTranscript: '',
      lastTurnOrder: 0,
      retentionUntil: retentionDate(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/**
 * Purpose: Execute the main responsibility for fetchSessionDependencies.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const fetchSessionDependencies = async ({ id, cvFileId }) => {
  const [plan, transcript, analysis, report, cvDocument] = await Promise.all([
    InterviewPlan.findOne({ sessionId: id }).lean(),
    SessionTranscript.findOne({ sessionId: id }).lean(),
    SessionAnalysis.findOne({ sessionId: id }).lean(),
    SessionReport.findOne({ sessionId: id }).lean(),
    cvFileId ? DocumentContent.findOne({ fileId: cvFileId }).lean() : Promise.resolve(null),
  ]);

  return { plan, transcript, analysis, report, cvDocument };
};

/**
 * Purpose: Execute the main responsibility for normalizeAnalysisPayload.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeAnalysisPayload = (analysisResult = {}) => validateAnalyzeOutput(analysisResult || {});

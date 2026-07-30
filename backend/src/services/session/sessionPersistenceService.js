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
import { CompanyValuesProfile } from '../../db/models/companyValuesProfileModel.js';
import { buildInterviewProofStrategy } from '../questions/roleSpecificPracticePlannerService.js';
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
  sessionMode = 'text',
  controlMode = 'question_limited',
  questionType = 'combined',
  questionLimit = 8,
  timeLimitSeconds = null,
}) => client.query(
  `INSERT INTO interview_sessions (
    id, user_id, status, mode, target_role, candidate_name, seniority_level, focus_area,
    enable_nz_culture_fit, current_question_index, total_questions, elapsed_seconds,
    control_mode, question_type, question_limit, time_limit_seconds,
    data_retention_days, expires_at, created_at, updated_at
  ) VALUES ($1,$2,'ready',$3,$4,$5,$6,$7,$8,1,$9,0,$10,$11,$12,$13,7,now() + interval '7 days',now(),now())`,
  [
    id,
    userId,
    sessionMode === 'voice' ? 'voice' : 'text',
    resolvedTargetRole,
    resolvedCandidateName,
    resolvedSeniorityLevel,
    resolvedFocusArea,
    Boolean(settings.enableNZCultureFit),
    totalQuestions,
    controlMode,
    questionType,
    questionLimit,
    timeLimitSeconds,
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

  await client.query(
    `UPDATE interview_sessions
     SET cv_file_id = $2, updated_at = now(), expires_at = now() + interval '7 days'
     WHERE id = $1`,
    [id, cvFileId],
  );
  await client.query(
    `UPDATE uploaded_files
     SET last_used_at = now(), updated_at = now(), expires_at = now() + interval '7 days'
     WHERE id = $1 AND deleted_at IS NULL`,
    [cvFileId],
  );
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
  sessionMode = 'text',
  controlMode = 'question_limited',
  questionType = 'combined',
  questionLimit = 8,
  timeLimitSeconds = null,
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
    sessionMode,
    controlMode,
    questionType,
    questionLimit,
    timeLimitSeconds,
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
const buildSessionAnalysisDocument = ({ id, userId, cvFileId, jdText, rubric, normalizedAnalysis, matchAnalysisId, evidenceRefs }) => ({
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
  evidenceMap: [],
  roleEvidenceMap: normalizedAnalysis.roleEvidenceMap || {},
  sourceSnapshots: normalizedAnalysis.sourceSnapshots || [],
  retrievalSnapshots: [{ matchAnalysisId, evidenceRefs: evidenceRefs || [] }],
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
export const persistSessionAnalysis = async ({ id, userId, cvFileId, jdText, jdRubric, normalizedAnalysis, matchAnalysisId = null, evidenceRefs = [] }) => {
  const rubric = normalizedAnalysis.parsedJdProfile || normalizedAnalysis.matchingDetails?.rubric || jdRubric || {};

  await SessionAnalysis.findOneAndUpdate(
    { sessionId: id },
    buildSessionAnalysisDocument({ id, userId, cvFileId, jdText, rubric, normalizedAnalysis, matchAnalysisId, evidenceRefs }),
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/**
 * Purpose: Execute the main responsibility for persistInterviewPlan.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const persistInterviewPlan = async ({ id, userId, normalizedAnalysis, settings, resolvedCandidateName, resolvedTargetRole, matchAnalysisId = null, evidenceRefs = [] }) => {
  const validatedPlan = buildInterviewPlanPayload({
    normalizedAnalysis,
    settings,
    resolvedCandidateName,
    resolvedTargetRole,
  });

  const jdFingerprint = normalizedAnalysis.parsedJdProfile?.metadata?.jdFingerprint;
  let proofStrategy = buildInterviewProofStrategy();
  if (jdFingerprint) {
    const companyProfile = await CompanyValuesProfile.findOne({ userId: String(userId), jdFingerprint }).lean();
    if (companyProfile?.roleFitProfile && normalizedAnalysis.roleEvidenceMap) {
      proofStrategy = buildInterviewProofStrategy({
        roleFitProfile: companyProfile.roleFitProfile,
        roleEvidenceMap: normalizedAnalysis.roleEvidenceMap,
        roleEvidenceMapId: matchAnalysisId || normalizedAnalysis.roleEvidenceMap?.matchAnalysisId || '',
      });
    }
  }

  await InterviewPlan.findOneAndUpdate(
    { sessionId: id },
    {
      sessionId: id,
      userId,
      ...validatedPlan,
      strategy: { ...(validatedPlan.strategy || {}), matchAnalysisId },
      questionPlanSnapshot: {
        matchAnalysisId,
        evidenceRefs,
        source: 'legacy_plan_plus_db_pool',
        dbBackedPoolExpected: true,
      },
      roleFit: {
        proofStrategy,
      },
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
export const fetchRelationalTranscriptTurns = async (sessionId) => {
  try {
    const [qRes, rRes] = await Promise.all([
      query(
        `SELECT id, question_order, question_text, created_at
         FROM interview_questions
         WHERE session_id = $1
         ORDER BY question_order ASC`,
        [sessionId]
      ),
      query(
        `SELECT id, question_id, transcript_text, created_at
         FROM interview_responses
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionId]
      ),
    ]);

    const turns = [];
    const questions = qRes.rows || [];
    const responses = rRes.rows || [];

    for (const q of questions) {
      turns.push({
        role: 'ai',
        text: q.question_text,
        timestamp: q.created_at ? new Date(q.created_at) : new Date(),
        questionId: q.id,
        metadata: {
          rootQuestionId: q.id,
          questionId: q.id,
          turnKind: 'root_question',
          turnType: 'interview_question',
          countsAsQuestion: true,
        },
      });

      const matchingResponses = responses.filter((r) => r.question_id === q.id);
      for (const r of matchingResponses) {
        if (r.transcript_text) {
          turns.push({
            role: 'user',
            text: r.transcript_text,
            timestamp: r.created_at ? new Date(r.created_at) : new Date(),
            questionId: q.id,
            metadata: {
              rootQuestionId: q.id,
              questionId: q.id,
              turnType: 'user_answer',
              countsAsAnswer: true,
              transcriptAcceptance: { accepted: true },
            },
          });
        }
      }
    }

    return turns;
  } catch (error) {
    return [];
  }
};

export const fetchSessionDependencies = async ({ id, cvFileId }) => {
  const [plan, transcriptDoc, analysis, report, cvDocument, jobDescriptionInput] = await Promise.all([
    InterviewPlan.findOne({ sessionId: id }).lean(),
    SessionTranscript.findOne({ sessionId: id }).lean(),
    SessionAnalysis.findOne({ sessionId: id }).lean(),
    SessionReport.findOne({ sessionId: id }).lean(),
    cvFileId ? DocumentContent.findOne({ fileId: cvFileId }).lean() : Promise.resolve(null),
    query(
      `SELECT raw_text, redacted_text, created_at, updated_at
       FROM job_description_inputs
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    ).then((result) => result.rows[0] || null),
  ]);

  let transcript = transcriptDoc;
  if (!transcript || !Array.isArray(transcript.turns) || transcript.turns.length === 0) {
    const relationalTurns = await fetchRelationalTranscriptTurns(id);
    if (relationalTurns.length > 0) {
      transcript = {
        sessionId: id,
        turns: relationalTurns,
        fullTranscript: relationalTurns.map((t) => `${t.role}: ${t.text}`).join('\n\n'),
        redactedTranscript: relationalTurns.map((t) => `${t.role}: ${t.text}`).join('\n\n'),
        redactionStatus: 'no_sensitive_match',
      };
    }
  }

  return { plan, transcript, analysis, report, cvDocument, jobDescriptionInput };
};

/**
 * Purpose: Execute the main responsibility for normalizeAnalysisPayload.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeAnalysisPayload = (analysisResult = {}) => validateAnalyzeOutput(analysisResult || {});

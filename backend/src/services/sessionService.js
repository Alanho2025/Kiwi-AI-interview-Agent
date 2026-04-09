import crypto from 'crypto';
import { query, withTransaction } from '../db/postgres.js';
import { DocumentContent } from '../db/models/documentContentModel.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';
import { validateAnalyzeOutput, validateInterviewPlan } from './schemaValidationService.js';
import { prettifyCanonicalRole } from './taxonomyService.js';

const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');
const retentionDate = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const clampVarchar = (value, maxLength = 255, fallback = '') => {
  const text = String(value ?? fallback ?? '').trim() || fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const mapSessionRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  mode: row.mode,
  targetRole: row.target_role,
  candidateName: row.candidate_name,
  totalQuestions: row.total_questions,
  currentQuestionIndex: row.current_question_index,
  elapsedSeconds: row.elapsed_seconds,
  lastResumedAt: row.last_resumed_at,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  overallScore: row.overall_score,
  summaryText: row.summary_text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  settings: {
    seniorityLevel: row.seniority_level,
    focusArea: row.focus_area,
    enableNZCultureFit: row.enable_nz_culture_fit,
  },
});

const buildQuestionPoolFromAnalysis = (analysisResult) => {
  const hints = analysisResult?.matchingDetails?.questionPlanHints || {};
  const rubric = analysisResult?.parsedJdProfile || analysisResult?.matchingDetails?.rubric || {};
  const roleLabel = prettifyCanonicalRole(hints.roleCanonical || rubric.roleCanonical || '') || analysisResult?.jobTitle || 'the role';
  const technicalCore = (hints.mustProbeSkills || []).slice(0, 3).flatMap((skill, index) => ([
    { type: 'technical_core', stage: 'technical_core', topic: skill, followUpDepth: 0, text: `Tell me about a project where you used ${skill} in a ${roleLabel} context.`, reason: 'Role-aligned technical core question generated from JD requirements and matching gaps.', priority: index + 2, basedOnSkills: [skill] },
    { type: 'technical_follow_up', stage: 'technical_core', topic: skill, followUpDepth: 1, text: `What was your exact approach with ${skill}, and how did you know it worked?`, reason: 'Follow-up to keep the conversation on the same technical topic.', priority: index + 20, basedOnSkills: [skill] },
  ]));
  const experienceDeepDive = (hints.mustProbeExperience || []).slice(0, 2).flatMap((topic, index) => ([
    { type: 'experience_deep_dive', stage: 'experience_deep_dive', topic, followUpDepth: 0, text: `Can you walk me through a specific example that shows ${topic}?`, reason: 'Experience probe generated from JD requirements and CV-JD comparison.', priority: index + 40, basedOnSkills: [topic] },
    { type: 'experience_follow_up', stage: 'experience_deep_dive', topic, followUpDepth: 1, text: 'What was your role, what action did you take, and what result came from it?', reason: 'STAR-style follow-up to gather evidence before changing topic.', priority: index + 60, basedOnSkills: [topic] },
  ]));
  const behavioural = (hints.mustProbeBehavioural || ['teamwork', 'communication']).slice(0, 2).flatMap((topic, index) => ([
    { type: 'behavioural', stage: 'behavioural', topic, followUpDepth: 0, text: `Tell me about a time when you had to show ${topic}.`, reason: 'Behavioural probe aligned to the role and NZ interview style.', priority: index + 80, basedOnSkills: [topic] },
    { type: 'behavioural_follow_up', stage: 'behavioural', topic, followUpDepth: 1, text: 'What was the situation, what did you do, and what was the outcome?', reason: 'STAR follow-up keeps the answer structured and natural.', priority: index + 100, basedOnSkills: [topic] },
  ]));
  return [
    { type: 'self_intro', stage: 'opening', topic: 'self_introduction', followUpDepth: 0, text: 'Please introduce yourself.', reason: 'default opener', priority: 1, basedOnSkills: [] },
    ...technicalCore,
    ...experienceDeepDive,
    ...behavioural,
    { type: 'wrap_up', stage: 'wrap_up', topic: 'candidate_questions', followUpDepth: 0, text: 'Before we finish, what questions do you have for me about the role or team?', reason: 'Close the conversation naturally.', priority: 999, basedOnSkills: [] },
  ];
};

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
  const normalizedAnalysis = validateAnalyzeOutput(analysisResult || {});
  const resolvedTargetRole = clampVarchar(targetRole || normalizedAnalysis.jobTitle || 'Target Role');
  const resolvedCandidateName = clampVarchar(normalizedAnalysis.candidateName || candidateName || 'Candidate');
  const resolvedSeniorityLevel = clampVarchar(settings.seniorityLevel || 'Junior/Grad');
  const resolvedFocusArea = clampVarchar(settings.focusArea || 'Combined');

  await withTransaction(async (client) => {
    await client.query(
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

    if (cvFileId) {
      await client.query('UPDATE interview_sessions SET cv_file_id = $2, updated_at = now() WHERE id = $1', [id, cvFileId]);
    }

    await client.query(
      `INSERT INTO job_description_inputs (
        id, session_id, source_type, raw_text, redacted_text, contains_pii, created_at, updated_at
      ) VALUES ($1,$2,'pasted_text',$3,$4,false,now(),now())`,
      [crypto.randomUUID(), id, rawJD, rawJD]
    );

    await client.query(
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
  });

  const rubric = normalizedAnalysis.parsedJdProfile || normalizedAnalysis.matchingDetails?.rubric || jdRubric || {};
  const cvSkills = [...(normalizedAnalysis.strengths || [])];
  const jdSkills = [
    ...((rubric.microCriteria || []).map((item) => item.label)),
    ...(rubric.technicalSkillRequirements || []),
    ...(rubric.softSkillRequirements || []),
  ];

  for (const skill of cvSkills) {
    await query(
      `INSERT INTO parsed_skills (
        id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
      ) VALUES ($1,$2,'cv',$3,'detected','detected',$4,now())`,
      [crypto.randomUUID(), id, skill, 'Derived from analysis strengths']
    );
  }

  for (const skill of jdSkills) {
    await query(
      `INSERT INTO parsed_skills (
        id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
      ) VALUES ($1,$2,'jd',$3,'required','required',$4,now())`,
      [crypto.randomUUID(), id, skill, 'Derived from JD rubric']
    );
  }

  await SessionAnalysis.findOneAndUpdate(
    { sessionId: id },
    {
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
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const validatedPlan = validateInterviewPlan({
    schemaVersion: normalizedAnalysis.schemaVersion || 'v3',
    candidateName: resolvedCandidateName,
    jobTitle: resolvedTargetRole,
    matchScore: normalizedAnalysis.matchScore || 0,
    decision: normalizedAnalysis.decision,
    confidence: normalizedAnalysis.confidence,
    requirementChecks: normalizedAnalysis.requirementChecks,
    explanation: normalizedAnalysis.explanation,
    strengths: normalizedAnalysis.strengths || [],
    gaps: normalizedAnalysis.gaps || [],
    interviewFocus: normalizedAnalysis.interviewFocus || [],
    planPreview: normalizedAnalysis.planPreview || '',
    strategy: { opening: 1, followUp: 3, technical: 2, behavioural: 2 },
    questionPool: buildQuestionPoolFromAnalysis(normalizedAnalysis),
    fallbackRules: { short_answer: 'ask_probe', time_low: 'end_early' },
    settingsSnapshot: settings,
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

  return getSessionById(id);
};

export const getSessionById = async (id) => {
  const sessionResult = await query('SELECT * FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  if (!sessionResult.rows[0]) {
    return null;
  }

  const row = sessionResult.rows[0];
  const baseSession = mapSessionRow(row);
  const [plan, transcript, analysis, cvDocument] = await Promise.all([
    InterviewPlan.findOne({ sessionId: id }).lean(),
    SessionTranscript.findOne({ sessionId: id }).lean(),
    SessionAnalysis.findOne({ sessionId: id }).lean(),
    row.cv_file_id ? DocumentContent.findOne({ fileId: row.cv_file_id }).lean() : Promise.resolve(null),
  ]);

  const normalizedAnalysis = analysis ? validateAnalyzeOutput({ ...analysis.matchSummary, ...analysis.toObject?.(), ...analysis }) : null;

  return {
    ...baseSession,
    settings: plan?.settingsSnapshot || baseSession.settings,
    analysisResult: normalizedAnalysis,
    interviewPlan: plan ? validateInterviewPlan(plan) : null,
    cvText: cvDocument?.normalizedText || cvDocument?.rawText || '',
    transcript: transcript?.turns?.map((turn) => ({
      role: turn.role,
      text: turn.text,
      timestamp: new Date(turn.timestamp).toISOString(),
      questionId: turn.questionId,
    })) || [],
  };
};

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

  if (data.settings || data.analysisResult) {
    const normalizedAnalysis = data.analysisResult ? validateAnalyzeOutput(data.analysisResult) : current.analysisResult;
    await InterviewPlan.findOneAndUpdate(
      { sessionId: id },
      validateInterviewPlan({
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
              questionPool: buildQuestionPoolFromAnalysis(normalizedAnalysis),
            }
          : {}),
      }),
      { returnDocument: 'after' }
    );
  }

  return getSessionById(id);
};

export const appendTranscriptTurn = async (sessionId, turn) => {
  const transcript = await SessionTranscript.findOne({ sessionId });
  if (!transcript) {
    return null;
  }

  const nextTurn = {
    role: turn.role,
    text: turn.text,
    timestamp: new Date(turn.timestamp || new Date()),
    questionId: turn.questionId,
    source: turn.source || 'app',
    durationSeconds: turn.durationSeconds,
    metadata: turn.metadata || {},
  };
  transcript.turns.push(nextTurn);
  transcript.lastTurnOrder = transcript.turns.length;
  transcript.fullTranscript = buildFullTranscript(transcript.turns);
  transcript.redactedTranscript = transcript.fullTranscript;
  await transcript.save();

  return {
    role: nextTurn.role,
    text: nextTurn.text,
    timestamp: nextTurn.timestamp.toISOString(),
    questionId: nextTurn.questionId,
  };
};

export const createInterviewQuestion = async ({ sessionId, questionOrder, questionType = 'follow_up', sourceType = 'generated', questionText, basedOnCv = false, basedOnJd = true }) => {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO interview_questions (
      id, session_id, question_order, question_type, source_type, question_text,
      based_on_cv, based_on_jd, asked_at, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
    ON CONFLICT (session_id, question_order) DO UPDATE SET
      question_text = EXCLUDED.question_text,
      question_type = EXCLUDED.question_type,
      source_type = EXCLUDED.source_type,
      based_on_cv = EXCLUDED.based_on_cv,
      based_on_jd = EXCLUDED.based_on_jd,
      asked_at = now()`,
    [id, sessionId, questionOrder, questionType, sourceType, questionText, basedOnCv, basedOnJd]
  );

  const latest = await query(`SELECT id FROM interview_questions WHERE session_id = $1 AND question_order = $2 LIMIT 1`, [sessionId, questionOrder]);
  return latest.rows[0]?.id || id;
};

export const getLatestQuestionForSession = async (sessionId) => {
  const result = await query(
    `SELECT id, question_order, question_text
     FROM interview_questions
     WHERE session_id = $1
     ORDER BY question_order DESC
     LIMIT 1`,
    [sessionId]
  );
  return result.rows[0] || null;
};

export const createInterviewResponse = async ({ sessionId, questionId, transcriptText, responseMode = 'text' }) => {
  await query(
    `INSERT INTO interview_responses (
      id, session_id, question_id, response_mode, transcript_text,
      redacted_transcript_text, contains_sensitive_data,
      response_started_at, response_ended_at, word_count, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,true,now(),now(),$7,now())`,
    [
      crypto.randomUUID(),
      sessionId,
      questionId,
      responseMode,
      transcriptText,
      transcriptText,
      transcriptText.trim().split(/\s+/).filter(Boolean).length,
    ]
  );
};

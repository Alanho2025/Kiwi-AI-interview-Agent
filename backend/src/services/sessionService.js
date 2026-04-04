import crypto from 'crypto';
import { query, withTransaction } from '../db/postgres.js';
import { DocumentContent } from '../db/models/documentContentModel.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { InterviewPlan } from '../db/models/interviewPlanModel.js';
import { SessionTranscript } from '../db/models/sessionTranscriptModel.js';

const buildFullTranscript = (turns) => turns.map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`).join('\n\n');

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
  const resolvedTargetRole = targetRole || analysisResult?.jobTitle || 'Target Role';

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
        candidateName,
        settings.seniorityLevel || 'Junior/Grad',
        settings.focusArea || 'Combined',
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'v1',now(),now())
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
        candidateName,
        resolvedTargetRole,
        analysisResult?.planPreview || null,
        jdText || null,
        analysisResult?.matchScore || null,
      ]
    );
  });

  const rubric = analysisResult?.matchingDetails?.rubric || jdRubric || {};
  const cvSkills = [...(analysisResult?.strengths || [])];
  const jdSkills = [
    ...(rubric.technicalSkillRequirements || []),
    ...(rubric.softSkillRequirements || []),
  ];

  for (const skill of cvSkills) {
    await query(
      `INSERT INTO parsed_skills (
        id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
      ) VALUES ($1,$2,'cv',$3,'detected','detected',$4,now())`,
      [crypto.randomUUID(), id, skill, 'Derived from current match strengths']
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
      matchSummary: {
        candidateName: analysisResult?.candidateName,
        jobTitle: analysisResult?.jobTitle,
        matchScore: analysisResult?.matchScore,
        strengths: analysisResult?.strengths || [],
        gaps: analysisResult?.gaps || [],
        interviewFocus: analysisResult?.interviewFocus || [],
      },
      matchingDetails: analysisResult?.matchingDetails || {},
      analysisStatus: 'completed',
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  await InterviewPlan.findOneAndUpdate(
    { sessionId: id },
    {
      sessionId: id,
      userId,
      settingsSnapshot: settings,
      candidateName,
      jobTitle: resolvedTargetRole,
      matchScore: analysisResult?.matchScore || 0,
      strengths: analysisResult?.strengths || [],
      gaps: analysisResult?.gaps || [],
      interviewFocus: analysisResult?.interviewFocus || [],
      planPreview: analysisResult?.planPreview || '',
      strategy: {
        opening: 1,
        followUp: 3,
        technical: 2,
        behavioural: 2,
      },
      questionPool: [
        { type: 'self_intro', text: 'Please introduce yourself.', reason: 'default opener', priority: 1 },
        ...(analysisResult?.interviewFocus || []).slice(0, 3).map((item, index) => ({
          type: 'follow_up',
          text: `Can you share a specific example related to ${item}?`,
          reason: 'Generated from match gaps/focus',
          priority: index + 2,
          basedOnSkills: [item],
        })),
      ],
      fallbackRules: {
        short_answer: 'ask_probe',
        time_low: 'end_early',
      },
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
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
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return getSessionById(id);
};

export const getSessionById = async (id) => {
  const sessionResult = await query(
    'SELECT * FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

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

  return {
    ...baseSession,
    settings: plan?.settingsSnapshot || baseSession.settings,
    analysisResult: plan
      ? {
          candidateName: plan.candidateName,
          jobTitle: plan.jobTitle,
          matchScore: plan.matchScore,
          strengths: plan.strengths || [],
          gaps: plan.gaps || [],
          interviewFocus: plan.interviewFocus || [],
          planPreview: plan.planPreview || '',
          matchingDetails: analysis?.matchingDetails || {},
        }
      : null,
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

  const nextStatus = data.status ?? current.status;
  const nextCurrentQuestionIndex = data.currentQuestionIndex ?? current.currentQuestionIndex;
  const nextElapsedSeconds = data.elapsedSeconds ?? current.elapsedSeconds;
  const nextLastResumedAt = data.lastResumedAt ?? current.lastResumedAt;
  const nextEndedAt = data.endedAt ?? current.endedAt;
  const nextSummaryText = data.summaryText ?? current.summaryText;
  const nextOverallScore = data.overallScore ?? current.overallScore;

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
    [id, nextStatus, nextCurrentQuestionIndex, nextElapsedSeconds, nextLastResumedAt, nextEndedAt, nextSummaryText, nextOverallScore]
  );

  if (data.settings || data.analysisResult) {
    await InterviewPlan.findOneAndUpdate(
      { sessionId: id },
      {
        ...(data.settings ? { settingsSnapshot: data.settings } : {}),
        ...(data.analysisResult
          ? {
              candidateName: data.analysisResult.candidateName ?? current.analysisResult?.candidateName ?? current.candidateName,
              jobTitle: data.analysisResult.jobTitle ?? current.analysisResult?.jobTitle ?? current.targetRole,
              matchScore: data.analysisResult.matchScore ?? current.analysisResult?.matchScore ?? 0,
              strengths: data.analysisResult.strengths ?? current.analysisResult?.strengths ?? [],
              gaps: data.analysisResult.gaps ?? current.analysisResult?.gaps ?? [],
              interviewFocus: data.analysisResult.interviewFocus ?? current.analysisResult?.interviewFocus ?? [],
              planPreview: data.analysisResult.planPreview ?? current.analysisResult?.planPreview ?? '',
            }
          : {}),
      },
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

export const createInterviewQuestion = async ({
  sessionId,
  questionOrder,
  questionType = 'follow_up',
  sourceType = 'generated',
  questionText,
  basedOnCv = false,
  basedOnJd = true,
}) => {
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

  const latest = await query(
    `SELECT id FROM interview_questions WHERE session_id = $1 AND question_order = $2 LIMIT 1`,
    [sessionId, questionOrder]
  );
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

export const createInterviewResponse = async ({
  sessionId,
  questionId,
  transcriptText,
  responseMode = 'text',
}) => {
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

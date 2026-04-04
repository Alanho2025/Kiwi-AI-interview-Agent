import crypto from 'crypto';
import { query, withTransaction } from '../db/postgres.js';

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
  cvFileId: row.cv_file_id,
});

export const createSessionAggregate = async ({
  sessionId,
  userId,
  cvFileId = null,
  rawJD = '',
  jdText = '',
  settings = {},
  analysisResult = {},
  targetRole,
  totalQuestions = 8,
  candidateName = 'Candidate',
}) => {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO interview_sessions (
        id, user_id, status, mode, target_role, candidate_name, seniority_level, focus_area,
        enable_nz_culture_fit, current_question_index, total_questions, elapsed_seconds,
        created_at, updated_at
      ) VALUES ($1,$2,'ready','voice',$3,$4,$5,$6,$7,1,$8,0,now(),now())`,
      [
        sessionId,
        userId,
        targetRole,
        candidateName,
        settings.seniorityLevel || 'Junior/Grad',
        settings.focusArea || 'Combined',
        Boolean(settings.enableNZCultureFit),
        totalQuestions,
      ]
    );

    if (cvFileId) {
      await client.query(
        'UPDATE interview_sessions SET cv_file_id = $2, updated_at = now() WHERE id = $1',
        [sessionId, cvFileId]
      );
    }

    await client.query(
      `INSERT INTO job_description_inputs (
        id, session_id, source_type, raw_text, redacted_text, contains_pii, created_at, updated_at
      ) VALUES ($1,$2,'pasted_text',$3,$4,false,now(),now())`,
      [crypto.randomUUID(), sessionId, rawJD, rawJD]
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
        sessionId,
        candidateName,
        targetRole,
        analysisResult?.planPreview || null,
        jdText || null,
        analysisResult?.matchScore || null,
      ]
    );
  });
};

export const replaceParsedSkills = async ({ sessionId, cvSkills, jdSkills }) => {
  await query('DELETE FROM parsed_skills WHERE session_id = $1', [sessionId]);

  for (const skill of cvSkills) {
    await query(
      `INSERT INTO parsed_skills (
        id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
      ) VALUES ($1,$2,'cv',$3,'detected','detected',$4,now())`,
      [crypto.randomUUID(), sessionId, skill, 'Derived from current match strengths']
    );
  }

  for (const skill of jdSkills) {
    await query(
      `INSERT INTO parsed_skills (
        id, session_id, source_type, skill_name, skill_category, importance_level, evidence_text, created_at
      ) VALUES ($1,$2,'jd',$3,'required','required',$4,now())`,
      [crypto.randomUUID(), sessionId, skill, 'Derived from JD rubric']
    );
  }
};

export const findSessionRowById = async (id) => {
  const result = await query(
    'SELECT * FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );

  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
};

export const updateSessionState = async (id, data) => {
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
      data.status,
      data.currentQuestionIndex,
      data.elapsedSeconds,
      data.lastResumedAt,
      data.endedAt,
      data.summaryText,
      data.overallScore,
    ]
  );
};

export const upsertInterviewQuestion = async ({
  sessionId,
  questionOrder,
  questionType,
  sourceType,
  questionText,
  basedOnCv,
  basedOnJd,
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

export const findLatestQuestionForSession = async (sessionId) => {
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

export const createInterviewResponseRecord = async ({
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

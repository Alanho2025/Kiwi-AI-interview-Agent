/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionQuestionService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query } from '../../db/postgres.js';

/**
 * Purpose: Execute the main responsibility for countWords.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const countWords = (value = '') => String(value).trim().split(/\s+/).filter(Boolean).length;

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

/**
 * Purpose: Execute the main responsibility for getLatestQuestionForSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for createInterviewResponse.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
      countWords(transcriptText),
    ]
  );
};

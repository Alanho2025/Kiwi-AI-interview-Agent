/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportEvidenceAnalysis should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { lower, normalizeText, toWords, isQuestionTurn } from './reportGeneratorShared.js';

/**
 * Purpose: Execute the main responsibility for classifyEvidenceType.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const classifyEvidenceType = (text = '') => {
  const value = lower(text);
  if (!value) return 'generic_filler';
  if (/(^|\b)(i would|i could|i can|would fit|would use|i see|i understand)\b/.test(value)) return 'hypothetical_understanding';
  if (/(^|\b)(i have not|i haven't|i did not|i didn't|mainly|rather than|not as the core)\b/.test(value)) return 'indirect_adjacent_experience';
  if (/(^|\b)(in my role|at foxconn|i used|i built|i worked on|my role was|the result was|i analysed|i automated|i supported|i proposed)\b/.test(value)) return 'direct_past_experience';
  return 'generic_filler';
};

/**
 * Purpose: Execute the main responsibility for scoreEvidenceStrength.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const scoreEvidenceStrength = (text = '') => {
  const value = lower(text);
  let score = 0;
  const reasons = [];

  if (/(at |during |when |in my role|project|workflow|process|station|session|system)/.test(value)) {
    score += 1;
    reasons.push('real_context');
  }

  if (/(i built|i used|i created|i analysed|i cleaned|i applied|i translated|i proposed|i designed|i handled|i implemented)/.test(value)) {
    score += 1;
    reasons.push('specific_action');
  }

  if (/(compared|checked|validated|make sure|knew it worked|consisten|benchmark|reviewed manually)/.test(value)) {
    score += 1;
    reasons.push('validation_method');
  }

  if (/(\d+\s*(minute|hour|%|percent|score|times?))/i.test(text) || /(reduced|improved|dropped|increase|decrease)/.test(value)) {
    score += 1;
    reasons.push('measurable_result');
  }

  return { score, reasons };
};

/**
 * Purpose: Execute the main responsibility for analyseCandidateAnswers.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const analyseCandidateAnswers = (turns = []) => turns.map((turn, index) => {
  const evidenceType = classifyEvidenceType(turn.text);
  const strength = scoreEvidenceStrength(turn.text);

  return {
    index,
    text: normalizeText(turn.text),
    evidenceType,
    evidenceStrength: strength.score,
    evidenceSignals: strength.reasons,
    wordCount: toWords(turn.text).length,
  };
});

/**
 * Purpose: Execute the main responsibility for buildEvidenceSummary.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildEvidenceSummary = (analysedAnswers = []) => {
  const totals = analysedAnswers.reduce((acc, item) => {
    acc[item.evidenceType] = (acc[item.evidenceType] || 0) + 1;
    return acc;
  }, {});

  const averageStrength = analysedAnswers.length
    ? Number((analysedAnswers.reduce((sum, item) => sum + item.evidenceStrength, 0) / analysedAnswers.length).toFixed(2))
    : 0;

  const strongestExamples = analysedAnswers
    .filter((item) => item.evidenceStrength >= 3)
    .slice(0, 2)
    .map((item) => item.text.slice(0, 180));

  return {
    totals,
    averageStrength,
    strongestExamples,
  };
};

/**
 * Purpose: Execute the main responsibility for buildInterviewMetrics.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildInterviewMetrics = (transcript = [], totalQuestions = 0) => {
  const candidateTurns = transcript.filter((turn) => turn.role === 'user');
  const questionTurns = transcript.filter((turn) => isQuestionTurn(turn));
  const extraAiTurns = transcript.filter((turn) => turn.role === 'ai' && !isQuestionTurn(turn));

  return {
    candidateTurnCount: candidateTurns.length,
    interviewerQuestionCount: questionTurns.length,
    extraAiTurnCount: extraAiTurns.length,
    plannedQuestionCount: totalQuestions,
    interviewCompletedByLimit: questionTurns.length >= totalQuestions && totalQuestions > 0,
  };
};

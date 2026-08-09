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

import { buildReportTurnDataset } from '../../report/reportTurnDatasetService.js';
import { extractAnswerEvidenceSignals } from '../../report/answerEvidenceSignalService.js';
import { summarizeVoiceDurationAssessments } from '../../report/voiceDurationAssessmentService.js';
import { lower, normalizeText, toWords } from './reportGeneratorShared.js';

/**
 * Purpose: Execute the main responsibility for classifyEvidenceType.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const classifyEvidenceType = (text = '') => {
  const value = lower(text);
  if (!value) return 'generic_filler';
  const signals = extractAnswerEvidenceSignals(text);
  if (signals.isDirectPastExperience) return 'direct_past_experience';
  if (/(^|\b)(i have not|i haven't|i did not|i didn't|mainly|rather than|not as the core)\b/.test(value)) return 'indirect_adjacent_experience';
  if (signals.isHypotheticalOnly || /(^|\b)(would fit|would use|i see|i understand)\b/.test(value)) return 'hypothetical_understanding';
  return 'generic_filler';
};

/**
 * Purpose: Execute the main responsibility for scoreEvidenceStrength.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const scoreEvidenceStrength = (text = '') => {
  const signals = extractAnswerEvidenceSignals(text);
  let score = 0;
  const reasons = [];

  if (signals.hasPastContext) {
    score += 1;
    reasons.push('real_context');
  }

  if (signals.hasPersonalAction) {
    score += 1;
    reasons.push('specific_action');
  }

  if (signals.hasValidation) {
    score += 1;
    reasons.push('validation_method');
  }

  if (signals.hasOutcome || signals.metricMatches.length > 0) {
    score += 1;
    reasons.push('measurable_result');
  }

  return { score, reasons, signals };
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
    signals: strength.signals,
    evidenceSnippets: strength.signals.metricMatches,
    wordCount: toWords(turn.text).length,
  };
});

export const detectCandidateRepetitionComplaint = (text = '') => (
  /\b(answered|answer|asked|ask)\b.*\b(before|again|already|repeat|same)\b/i.test(text)
  || /\bwhy\b.*\b(ask|asking)\b.*\bagain\b/i.test(text)
  || /\bi (have )?answered this\b/i.test(text)
);

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
    hypotheticalOnlyTurns: analysedAnswers.filter((item) => item.evidenceType === 'hypothetical_understanding').length,
    mixedFutureIntentTurns: analysedAnswers.filter((item) => (
      item.evidenceType === 'direct_past_experience' && item.signals?.hasFutureIntent
    )).length,
    repetitionComplaintCount: analysedAnswers.filter((item) => detectCandidateRepetitionComplaint(item.text)).length,
  };
};

/**
 * Purpose: Execute the main responsibility for buildInterviewMetrics.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildInterviewMetrics = (transcriptOrDataset = [], totalQuestions = 0) => {
  const dataset = Array.isArray(transcriptOrDataset)
    ? buildReportTurnDataset(transcriptOrDataset)
    : transcriptOrDataset;
  const turns = dataset.turns || [];
  const voiceDurationAssessmentSummary = dataset.voiceDurationAssessmentSummary
    || summarizeVoiceDurationAssessments(
      (dataset.questionAnswerPairs || []).map((pair) => pair.voiceDurationAssessment),
    );
  const extraAiTurns = turns.filter((turn) => (
    ['ai', 'assistant', 'interviewer'].includes(turn.role)
    && !dataset.countableQuestions?.includes(turn)
  ));

  return {
    candidateTurnCount: dataset.scoredAnswerCount || 0,
    rawCandidateTurnCount: dataset.rawCandidateTurnCount || 0,
    interviewerQuestionCount: dataset.countableQuestionCount || 0,
    scoredCandidateAnswerCount: dataset.scoredAnswerCount || 0,
    extraAiTurnCount: extraAiTurns.length,
    repairTurnCount: dataset.repairTurnCount || 0,
    plannedQuestionCount: totalQuestions,
    interviewCompletedByLimit: (dataset.scoredAnswerCount || 0) >= totalQuestions && totalQuestions > 0,
    voiceDurationAssessmentSummary,
  };
};

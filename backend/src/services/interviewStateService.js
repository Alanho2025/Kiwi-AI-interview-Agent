import { getQuestionCategory } from './interview/interviewTurnPolicy.js';
import { resolveInterviewSessionConfig } from './interview/interviewSessionConfigResolver.js';
import { normalizeText } from '../utils/commonHelpers.js';
import { buildQuestionHistory, evaluateQuestionNovelty } from './questions/questionDeduplicationService.js';

/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewStateService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for normalizeText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */

const isCompanyMotivationQuestion = (question = {}) =>
  question?.type === 'company_motivation' ||
  question?.topic === 'company_and_role_motivation' ||
  String(question?.text || '').toLowerCase().includes('what attracted you to this company and role');

const hasAskedCompanyMotivationQuestion = (session = {}) => (session?.transcript || [])
  .some((turn) => turn?.role === 'ai' && (
    turn.metadata?.questionType === 'company_motivation' ||
    turn.metadata?.topic === 'company_and_role_motivation' ||
    String(turn?.text || '').toLowerCase().includes('what attracted you to this company and role')
  ));

export const getQuestionPool = (session = {}) => session?.interviewPlan?.questionPool || [];

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

const getAnsweredQuestionCount = (session = {}) => (session?.transcript || [])
  .filter((turn) => {
    if (turn?.role !== 'user' || !String(turn?.text || '').trim()) return false;
    if (turn?.metadata?.countsAsQuestion === false) return false;
    if ([
      'transcript_confirmation',
      'clarification',
      'question_scope_clarification_request',
      'question_scope_clarification',
      'repair_prompt',
      'system',
    ].includes(turn?.metadata?.turnType)) return false;
    return true;
  })
  .length;


/**
 * Purpose: Execute the main responsibility for getOpeningQuestionText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getOpeningQuestionText = (session = {}) => normalizeText(getQuestionPool(session)?.[0]?.text || 'Hi, thanks for joining today. Could you briefly introduce yourself and your background?');

/**
 * Purpose: Execute the main responsibility for hasAskedOpeningQuestion.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const hasAskedOpeningQuestion = (session = {}) => {
  const openingText = getOpeningQuestionText(session);
  return (session?.transcript || []).some((turn) => turn.role === 'ai' && normalizeText(turn.text) === openingText);
};

/**
 * Purpose: Execute the main responsibility for getResolvedCurrentQuestionIndex.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getResolvedCurrentQuestionIndex = (session = {}) => {
  const raw = Number(session?.currentQuestionIndex || 1);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
};

/**
 * Purpose: Execute the main responsibility for getResolvedTotalQuestions.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getResolvedTotalQuestions = (session = {}) => {
  const resolved = resolveInterviewSessionConfig(session);
  const candidates = [
    session?.totalQuestions,
    session?.questionLimit,
    session?.settings?.totalQuestions,
    session?.settings?.questionLimit,
    resolved?.plannedQuestionCount,
    resolved?.totalQuestions,
  ].map(toPositiveInteger).filter(Boolean);

  if (candidates.length) {
    return Math.max(...candidates);
  }

  const poolLength = getQuestionPool(session).length;
  return poolLength > 1 ? Math.min(8, poolLength) : 8;
};

/**
 * Purpose: Execute the main responsibility for hasReachedQuestionLimit.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const hasReachedQuestionLimit = (session = {}) => {
  const totalQuestions = getResolvedTotalQuestions(session);
  const countableQuestionCount = buildQuestionHistory(session.transcript).countableQuestions.length;
  if (countableQuestionCount > 0) return countableQuestionCount >= totalQuestions;
  return getResolvedCurrentQuestionIndex(session) >= totalQuestions;
};

export const getEffectiveElapsedSeconds = (session = {}) => {
  const baseElapsed = Math.max(0, Number(session?.elapsedSeconds || 0));
  if (!session?.lastResumedAt) return baseElapsed;
  const elapsedMs = Date.now() - new Date(session.lastResumedAt).getTime();
  const activeElapsed = elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;
  return baseElapsed + activeElapsed;
};

export const hasReachedTimeLimit = (session = {}) => {
  const resolved = resolveInterviewSessionConfig(session);
  const timeLimitSeconds = Number(session?.timeLimitSeconds || session?.settings?.timeLimitSeconds || resolved?.timeLimitSeconds || 0);

  if (resolved.controlMode !== 'time_limited' || timeLimitSeconds <= 0) {
    return false;
  }

  if (session?.status !== 'in_progress') {
    return false;
  }

  const answeredQuestionCount = getAnsweredQuestionCount(session);

  // Do not auto-end immediately after the first real answer.
  // This prevents stale open sessions from ending before the interview has actually started.
  if (answeredQuestionCount < 2) {
    return false;
  }

  return getEffectiveElapsedSeconds(session) >= timeLimitSeconds;
};

export const getCurrentPoolQuestion = (session = {}) => {
  const questionPool = getQuestionPool(session);
  const currentIndex = getResolvedCurrentQuestionIndex(session);
  return questionPool[Math.max(0, currentIndex - 1)] || null;
};

/**
 * Purpose: Execute the main responsibility for getNextPoolQuestion.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getNextPoolQuestion = (session = {}, options = {}) => {
  const desiredCategory = String(options.category || '').trim().toLowerCase();
  const requireFresh = Boolean(options.freshOnly);
  const isRecoverySearch = Boolean(desiredCategory || requireFresh);
  if (hasReachedQuestionLimit(session) && !isRecoverySearch) {
    return null;
  }
  const questionPool = getQuestionPool(session);
  if (!hasAskedCompanyMotivationQuestion(session)) {
    const motivationQuestion = questionPool.find(isCompanyMotivationQuestion);
    if (motivationQuestion) return motivationQuestion;
  }
  const questionHistory = buildQuestionHistory(session.transcript);
  const startIndex = isRecoverySearch ? 1 : Math.max(1, getResolvedCurrentQuestionIndex(session));
  for (let index = startIndex; index < questionPool.length; index += 1) {
    const candidate = questionPool[index];
    if (!candidate) continue;
    const candidateCategory = getQuestionCategory(candidate);
    const candidateFollowUpDepth = Number(candidate.followUpDepth || 0);
    if (desiredCategory && candidateCategory !== desiredCategory) continue;
    if (requireFresh && candidateFollowUpDepth > 0) continue;
    if (!evaluateQuestionNovelty({ candidate, history: questionHistory }).allowed) continue;
    return candidate;
  }
  if (requireFresh) return null;
  return null;
};

/**
 * Purpose: Execute the main responsibility for getNextQuestionOrder.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getNextQuestionOrder = (session = {}, { countsAsQuestion = true } = {}) => {
  const countableQuestionCount = buildQuestionHistory(session.transcript).countableQuestions.length;
  const currentQuestionIndex = getResolvedCurrentQuestionIndex(session);
  if (!countsAsQuestion) return countableQuestionCount || currentQuestionIndex;
  if (hasReachedQuestionLimit(session)) return countableQuestionCount || currentQuestionIndex;
  return countableQuestionCount > 0 ? countableQuestionCount + 1 : currentQuestionIndex + 1;
};

/**
 * Purpose: Execute the main responsibility for shouldGenerateNextQuestion.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const shouldGenerateNextQuestion = (session = {}) => !hasReachedQuestionLimit(session);

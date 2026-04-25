import { buildInterviewStructure, getQuestionCategory } from './interview/interviewTurnPolicy.js';

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
const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase();

const buildQuestionRootKey = (question = {}) => {
  const topic = normalizeKey(question.topic || question.metadata?.topic || '');
  const category = normalizeKey(getQuestionCategory(question));
  const type = normalizeKey(question.type || question.metadata?.questionType || '');
  return [topic || 'topic', category || 'category', type || 'type'].join(':');
};

export const getQuestionPool = (session = {}) => session?.interviewPlan?.questionPool || [];

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
  const poolLength = getQuestionPool(session).length;
  const raw = Number(session?.totalQuestions || 0);
  const fallback = poolLength > 1 ? Math.min(8, poolLength - 1) : 1;
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

/**
 * Purpose: Execute the main responsibility for hasReachedQuestionLimit.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const hasReachedQuestionLimit = (session = {}) => getResolvedCurrentQuestionIndex(session) >= getResolvedTotalQuestions(session);

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
  const structure = buildInterviewStructure(session);
  const recentTexts = structure.askedQuestionTexts.slice(-3).map((item) => normalizeKey(item));
  const askedRootQuestionKeys = new Set((structure.askedRootQuestionKeys || []).map((item) => normalizeKey(item)));
  const startIndex = isRecoverySearch ? 0 : Math.max(0, getResolvedCurrentQuestionIndex(session));
  const avoidRootRepeat = options.avoidRootRepeat !== false;
  for (let index = startIndex; index < questionPool.length; index += 1) {
    const candidate = questionPool[index];
    if (!candidate) continue;
    const candidateCategory = getQuestionCategory(candidate);
    const candidateText = normalizeKey(candidate.text);
    const candidateFollowUpDepth = Number(candidate.followUpDepth || 0);
    const candidateRootKey = buildQuestionRootKey(candidate);
    if (recentTexts.includes(candidateText)) continue;
    if (desiredCategory && candidateCategory !== desiredCategory) continue;
    if (requireFresh && candidateFollowUpDepth > 0) continue;
    if (avoidRootRepeat && candidateFollowUpDepth <= 0 && askedRootQuestionKeys.has(candidateRootKey)) continue;
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
export const getNextQuestionOrder = (session = {}) => {
  if (hasReachedQuestionLimit(session)) {
    return getResolvedCurrentQuestionIndex(session);
  }
  return getResolvedCurrentQuestionIndex(session) + 1;
};

/**
 * Purpose: Execute the main responsibility for shouldGenerateNextQuestion.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const shouldGenerateNextQuestion = (session = {}) => !hasReachedQuestionLimit(session);

const normalizeText = (value = '') => String(value || '').trim();

export const getQuestionPool = (session = {}) => session?.interviewPlan?.questionPool || [];

export const getOpeningQuestionText = (session = {}) => normalizeText(getQuestionPool(session)?.[0]?.text || 'Please introduce yourself.');

export const hasAskedOpeningQuestion = (session = {}) => {
  const openingText = getOpeningQuestionText(session);
  return (session?.transcript || []).some((turn) => turn.role === 'ai' && normalizeText(turn.text) === openingText);
};

export const getResolvedCurrentQuestionIndex = (session = {}) => {
  const raw = Number(session?.currentQuestionIndex || 1);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
};

export const getResolvedTotalQuestions = (session = {}) => {
  const poolLength = getQuestionPool(session).length;
  const raw = Number(session?.totalQuestions || 0);
  const fallback = poolLength > 1 ? Math.min(8, poolLength - 1) : 1;
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
};

export const hasReachedQuestionLimit = (session = {}) => getResolvedCurrentQuestionIndex(session) >= getResolvedTotalQuestions(session);

export const getCurrentPoolQuestion = (session = {}) => {
  const questionPool = getQuestionPool(session);
  const currentIndex = getResolvedCurrentQuestionIndex(session);
  return questionPool[Math.max(0, currentIndex - 1)] || null;
};

export const getNextPoolQuestion = (session = {}) => {
  if (hasReachedQuestionLimit(session)) {
    return null;
  }
  const questionPool = getQuestionPool(session);
  const currentIndex = getResolvedCurrentQuestionIndex(session);
  return questionPool[currentIndex] || null;
};

export const getNextQuestionOrder = (session = {}) => {
  if (hasReachedQuestionLimit(session)) {
    return getResolvedCurrentQuestionIndex(session);
  }
  return getResolvedCurrentQuestionIndex(session) + 1;
};

export const shouldGenerateNextQuestion = (session = {}) => !hasReachedQuestionLimit(session);

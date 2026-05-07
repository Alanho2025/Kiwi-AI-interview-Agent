/**
 * File responsibility: Deterministic question-quality judge for interview agent evals.
 * Main responsibilities:
 * - Score open-ended interview questions without requiring a paid LLM judge.
 * - Check role relevance, CV/JD grounding, natural language quality, repetition, and difficulty fit.
 * - Return transparent failed checks so prompt or controller regressions are easy to debug.
 */

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const tokenize = (value = '') => normalize(value).split(' ').filter((token) => token.length > 2);
const unique = (items = []) => [...new Set(items.filter(Boolean))];
const collectKeywords = (source = {}) => unique([...(source.requiredSkills || []), ...(source.preferredSkills || []), ...(source.skills || []), ...(source.projects || []), ...(source.requirements || []), ...(source.priorityTopics || [])].flatMap((item) => tokenize(item)));
const containsAnyKeyword = (text = '', keywords = []) => {
  const normalizedText = normalize(text);
  return keywords.some((keyword) => normalizedText.includes(normalize(keyword)));
};
const isQuestionLike = (text = '') => /\?$|\b(tell me|describe|explain|how|why|what|could you|can you|walk me through)\b/i.test(text);
const isNaturalLength = (text = '') => tokenize(text).length >= 6 && tokenize(text).length <= 45;
const hasInterviewTone = (text = '') => /\b(you|your|project|experience|role|example|approach|challenge|result|trade-off|decision)\b/i.test(text);
const difficultySignals = {
  junior: ['example', 'basic', 'explain', 'tell me', 'describe'],
  intermediate: ['trade-off', 'design', 'decision', 'approach', 'debug', 'improve'],
  senior: ['architecture', 'strategy', 'stakeholder', 'scale', 'risk', 'lead'],
};

export const judgeQuestionQuality = ({ question = '', previousQuestions = [], cvProfile = {}, jdProfile = {}, expectedDifficulty = 'junior' } = {}) => {
  const normalizedQuestion = normalize(question);
  const jdKeywords = collectKeywords(jdProfile);
  const cvKeywords = collectKeywords(cvProfile);
  const previousNormalized = previousQuestions.map((item) => normalize(item));
  const difficultyKey = normalize(expectedDifficulty || 'junior');
  const expectedSignals = difficultySignals[difficultyKey] || difficultySignals.junior;
  const checks = [
    { label: 'is_question_like', passed: isQuestionLike(question) },
    { label: 'natural_length', passed: isNaturalLength(question) },
    { label: 'interview_tone', passed: hasInterviewTone(question) },
    { label: 'jd_grounded', passed: containsAnyKeyword(question, jdKeywords) },
    { label: 'cv_or_project_grounded', passed: cvKeywords.length ? containsAnyKeyword(question, cvKeywords) || /\b(your project|your experience|your cv|your background)\b/i.test(question) : true },
    { label: 'not_repeated', passed: !previousNormalized.includes(normalizedQuestion) },
    { label: 'difficulty_fit', passed: containsAnyKeyword(question, expectedSignals) || difficultyKey === 'combined' },
  ];
  const earned = checks.filter((check) => check.passed).length;
  return { score: Number((earned / checks.length).toFixed(2)), earned, possible: checks.length, failedChecks: checks.filter((check) => !check.passed).map((check) => check.label), checks };
};

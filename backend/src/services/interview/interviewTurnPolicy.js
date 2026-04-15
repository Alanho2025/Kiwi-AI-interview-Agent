import { resolveInterviewModeConfig } from '../../config/interviewBlueprints.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim().toLowerCase();
const buildRootQuestionKey = (question = {}) => {
  const topic = normalizeText(question.topic || question.metadata?.topic || '');
  const category = normalizeText(getQuestionCategory({ category: question.questionCategory || question.category || question.metadata?.questionCategory, stage: question.stage || question.metadata?.stage, type: question.type || question.metadata?.questionType }));
  const type = normalizeText(question.type || question.metadata?.questionType || '');
  return [topic || 'topic', category || 'category', type || 'type'].join(':');
};

export const getQuestionCategory = (question = {}) => {
  const explicit = String(question.category || '').trim().toLowerCase();
  if (explicit) return explicit;
  const stage = String(question.stage || question.type || '').toLowerCase();
  if (stage.includes('behaviour')) return 'behavioural';
  if (stage.includes('technical')) return 'technical';
  if (stage.includes('opening') || stage.includes('self_intro')) return 'opening';
  if (stage.includes('wrap')) return 'closing';
  return 'experience';
};

export const buildInterviewStructure = (session = {}) => {
  const blueprint = resolveInterviewModeConfig({
    seniorityLevel: session?.settings?.seniorityLevel || session?.settings?.level || 'junior',
    focusArea: session?.settings?.focusArea || 'combined',
  });
  const transcript = ensureArray(session.transcript);
  const aiTurns = transcript.filter((turn) => turn.role === 'ai');
  const askedQuestions = aiTurns.map((turn, index) => ({
    turnIndex: index + 1,
    text: String(turn.text || '').trim(),
    topic: turn.metadata?.topic || '',
    followUpDepth: Number(turn.metadata?.followUpDepth || 0),
    questionCategory: getQuestionCategory({ category: turn.metadata?.questionCategory, stage: turn.metadata?.stage, type: turn.metadata?.questionType }),
    questionType: turn.metadata?.questionType || '',
    stage: turn.metadata?.stage || '',
  }));
  const categoryCounts = askedQuestions.reduce((acc, item) => {
    const key = item.questionCategory || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topicProgress = askedQuestions.reduce((acc, item) => {
    const topic = normalizeText(item.topic);
    if (!topic) return acc;
    const entry = acc[topic] || { rootQuestionAsked: false, followUpCount: 0, maxFollowUps: blueprint.maxFollowUpsPerTopic, exhausted: false, closed: false };
    if (item.followUpDepth <= 0) entry.rootQuestionAsked = true;
    if (item.followUpDepth > 0) entry.followUpCount += 1;
    entry.exhausted = entry.followUpCount >= entry.maxFollowUps;
    acc[topic] = entry;
    return acc;
  }, {});
  const askedQuestionTexts = askedQuestions.map((item) => normalizeText(item.text)).filter(Boolean);
  const askedRootQuestionKeys = askedQuestions
    .filter((item) => item.followUpDepth <= 0)
    .map((item) => buildRootQuestionKey(item))
    .filter(Boolean);
  const nextTurnIndex = askedQuestions.length + 1;
  const mustBeFreshQuestion = blueprint.freshTurnAnchors.includes(nextTurnIndex);
  return {
    blueprint,
    nextTurnIndex,
    mustBeFreshQuestion,
    askedQuestions,
    askedQuestionTexts,
    categoryCounts,
    topicProgress,
    askedRootQuestionKeys,
  };
};

export const buildInterviewTurnPolicy = (session = {}, decisionContext = {}) => {
  const interviewStructure = buildInterviewStructure(session);
  const { blueprint, nextTurnIndex, mustBeFreshQuestion, categoryCounts, topicProgress } = interviewStructure;
  const targetTopic = String(decisionContext?.currentTopic || '').trim().toLowerCase();
  const currentTopicState = topicProgress[targetTopic] || null;
  const technicalCount = categoryCounts.technical || 0;
  const behaviouralCount = categoryCounts.behavioural || 0;

  let requiredCategory = null;
  let forceCategory = null;

  if (blueprint.focusAreaKey === 'technical') {
    if (technicalCount < blueprint.minTechnicalQuestions) {
      requiredCategory = mustBeFreshQuestion ? 'technical' : null;
      forceCategory = 'technical';
    }
  } else if (blueprint.focusAreaKey === 'behavioral') {
    if (behaviouralCount < blueprint.minBehaviouralQuestions) {
      requiredCategory = mustBeFreshQuestion ? 'behavioural' : null;
      forceCategory = 'behavioural';
    }
  } else {
    const needsTechnical = technicalCount < blueprint.minTechnicalQuestions;
    const needsBehavioural = behaviouralCount < blueprint.minBehaviouralQuestions;
    requiredCategory = mustBeFreshQuestion
      ? (nextTurnIndex >= 4 && needsTechnical
        ? 'technical'
        : nextTurnIndex >= 7 && needsBehavioural
          ? 'behavioural'
          : null)
      : null;
    forceCategory = nextTurnIndex >= 4 && needsTechnical
      ? 'technical'
      : nextTurnIndex >= 7 && needsBehavioural
        ? 'behavioural'
        : null;
  }

  return {
    ...interviewStructure,
    targetTopic,
    currentTopicState,
    followUpAllowed: !mustBeFreshQuestion && !(currentTopicState?.exhausted),
    requiredCategory,
    forceCategory,
    focusAreaKey: blueprint.focusAreaKey,
    interviewModeKey: blueprint.interviewModeKey,
    shouldCloseSoon: nextTurnIndex >= blueprint.totalQuestions,
  };
};
